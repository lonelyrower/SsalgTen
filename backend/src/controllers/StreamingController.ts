import { Request, Response } from "express";
import {
  Prisma,
  StreamingService,
  StreamingStatus,
  UnlockType,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIO } from "../sockets/ioRegistry";
import {
  notifyStreamingTestStart,
  broadcastStreamingTestResult,
} from "../sockets/socketHandlers";
import { logger } from "../utils/logger";

/**
 * Agent上报的流媒体检测结果接口
 */
interface StreamingResultInput {
  service: string;
  status: string;
  region?: string;
  unlockType?: string;
  details?: Record<string, unknown>;
  errorMsg?: string;
}

/**
 * 流媒体解锁API控制器
 */
export class StreamingController {
  /**
   * 获取节点的流媒体解锁状态
   * GET /api/nodes/:nodeId/streaming
   */
  static async getNodeStreaming(req: Request, res: Response) {
    try {
      const { nodeId } = req.params;

      // 验证节点是否存在
      const node = await prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return res.status(404).json({
          success: false,
          error: "Node not found",
        });
      }

      // 获取最新的流媒体测试结果（每个服务取最新一条）
      const services = Object.values(StreamingService);
      const streamingData = await Promise.all(
        services.map(async (service) => {
          const latestTest = await prisma.streamingTest.findFirst({
            where: {
              nodeId,
              service,
            },
            orderBy: {
              testedAt: "desc",
            },
          });

          return {
            service: service.toLowerCase(),
            name: getServiceName(service),
            icon: getServiceIcon(service),
            status: latestTest?.status.toLowerCase() || "unknown",
            region: latestTest?.region,
            unlockType: latestTest?.unlockType?.toLowerCase(),
            lastTested: latestTest?.testedAt,
          };
        }),
      );

      return res.json({
        success: true,
        data: {
          nodeId,
          services: streamingData,
          lastScanned: streamingData[0]?.lastTested || null,
        },
      });
    } catch (error) {
      console.error("Get node streaming error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming data",
      });
    }
  }

  /**
   * 触发节点流媒体重新检测
   * POST /api/nodes/:nodeId/streaming/test
   */
  static async triggerStreamingTest(req: Request, res: Response) {
    try {
      const { nodeId } = req.params;
      const { services } = req.body; // 可选：指定要测试的服务

      // 验证节点是否存在
      const node = await prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return res.status(404).json({
          success: false,
          error: "Node not found",
        });
      }

      // 获取Socket.IO实例并通知Agent
      const io = getIO();
      if (io) {
        // 通知开始检测（广播给前端）
        notifyStreamingTestStart(io, nodeId);

        // TODO: 实际项目中应该通过Agent的Socket连接通知Agent执行检测
        // 目前Agent是定时执行，后续可以扩展为实时触发
        logger.info(
          `Triggered streaming test for node ${nodeId}, services: ${services || "all"}`,
        );
      } else {
        logger.warn(
          "Socket.IO instance not available, cannot notify streaming test start",
        );
      }

      return res.json({
        success: true,
        message: "Streaming test triggered",
        data: {
          nodeId,
          services: services || "all",
          status: "pending",
        },
      });
    } catch (error) {
      logger.error("Trigger streaming test error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to trigger streaming test",
      });
    }
  }

  /**
   * 保存流媒体检测结果（由Agent调用）
   * POST /api/streaming/results
   */
  static async saveStreamingResults(req: Request, res: Response) {
    try {
      const { nodeId, results } = req.body;

      if (!nodeId || !results || !Array.isArray(results)) {
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
        });
      }

      // 批量保存检测结果
      const savedResults = await Promise.all(
        results.map(async (result: StreamingResultInput) => {
          return await prisma.streamingTest.create({
            data: {
              nodeId,
              service: result.service.toUpperCase() as StreamingService,
              status: result.status.toUpperCase() as StreamingStatus,
              region: result.region,
              unlockType: result.unlockType?.toUpperCase() as UnlockType,
              details: result.details
                ? (result.details as Prisma.InputJsonValue)
                : undefined,
              errorMsg: result.errorMsg,
            },
          });
        }),
      );

      // 广播检测结果给前端
      const io = getIO();
      if (io) {
        broadcastStreamingTestResult(io, nodeId, savedResults);
      }

      logger.info(
        `Saved ${savedResults.length} streaming test results for node ${nodeId}`,
      );

      return res.json({
        success: true,
        message: "Streaming results saved",
        data: {
          count: savedResults.length,
        },
      });
    } catch (error) {
      logger.error("Save streaming results error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to save streaming results",
      });
    }
  }

  /**
   * 按流媒体服务筛选节点
   * GET /api/nodes/streaming/:service
   */
  static async getNodesByStreaming(req: Request, res: Response) {
    try {
      const { service } = req.params;
      const { status = "yes" } = req.query;

      const streamingService = service.toUpperCase() as StreamingService;

      // 查找支持指定流媒体的节点
      const nodes = await prisma.node.findMany({
        where: {
          status: "ONLINE",
          streamingTests: {
            some: {
              service: streamingService,
              status: status.toString().toUpperCase() as StreamingStatus,
              testedAt: {
                // 只看最近7天的测试结果
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
        include: {
          streamingTests: {
            where: {
              service: streamingService,
            },
            orderBy: {
              testedAt: "desc",
            },
            take: 1,
          },
        },
      });

      return res.json({
        success: true,
        data: nodes.map((node) => ({
          id: node.id,
          name: node.name,
          country: node.country,
          city: node.city,
          streaming: node.streamingTests[0],
        })),
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when fetching nodes by streaming, returning empty result.",
        );
        return res.json({
          success: true,
          data: [],
        });
      }
      console.error("Get nodes by streaming error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get nodes",
      });
    }
  }

  /**
   * 获取流媒体统计信息
   * GET /api/streaming/stats
   */
  static async getStreamingStats(req: Request, res: Response) {
    try {
      const services = Object.values(StreamingService);

      const stats = await Promise.all(
        services.map(async (service) => {
          const total = await prisma.streamingTest.count({
            where: { service },
          });

          const unlocked = await prisma.streamingTest.count({
            where: {
              service,
              status: "YES",
              testedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          });

          return {
            service: service.toLowerCase(),
            name: getServiceName(service),
            total,
            unlocked,
            percentage: total > 0 ? ((unlocked / total) * 100).toFixed(1) : "0",
          };
        }),
      );

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when fetching streaming stats, returning defaults.",
        );
        const emptyStats = Object.values(StreamingService).map((service) => ({
          service: service.toLowerCase(),
          name: getServiceName(service),
          total: 0,
          unlocked: 0,
          percentage: "0",
        }));
        return res.json({
          success: true,
          data: emptyStats,
        });
      }
      console.error("Get streaming stats error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming stats",
      });
    }
  }

  /**
   * 获取流媒体解锁总览
   * GET /api/streaming/overview
   */
  static async getStreamingOverview(req: Request, res: Response) {
    try {
      const services = Object.values(StreamingService);

      // 获取所有在线节点数
      const totalNodes = await prisma.node.count({
        where: { status: "ONLINE" },
      });

      // 获取最近扫描时间
      const lastScan = await prisma.streamingTest.findFirst({
        orderBy: { testedAt: "desc" },
        select: { testedAt: true },
      });

      // 获取过期节点数（24小时内无检测数据）
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const nodesWithRecentTests = await prisma.streamingTest.findMany({
        where: {
          testedAt: { gte: expiredThreshold },
        },
        distinct: ["nodeId"],
        select: { nodeId: true },
      });
      const expiredNodes = Math.max(
        0,
        totalNodes - nodesWithRecentTests.length,
      );

      // 为每个平台统计解锁情况
      const platformStats = await Promise.all(
        services.map(async (service) => {
          // 获取每个节点的最新测试结果
          const latestTests = await prisma.streamingTest.findMany({
            where: { service },
            distinct: ["nodeId"],
            orderBy: { testedAt: "desc" },
            select: { nodeId: true, status: true },
          });

          const unlocked = latestTests.filter((t) => t.status === "YES").length;
          const restricted = latestTests.filter(
            (t) => t.status === "NO",
          ).length;
          const failed = latestTests.filter(
            (t) => t.status === "FAILED",
          ).length;
          const unknown = latestTests.filter(
            (t) => t.status === "UNKNOWN",
          ).length;
          const total = latestTests.length;

          return {
            service: service.toLowerCase(),
            name: getServiceName(service),
            icon: getServiceIcon(service),
            unlocked,
            restricted,
            failed,
            unknown,
            total,
            unlockRate: total > 0 ? (unlocked / total) * 100 : 0,
          };
        }),
      );

      // 计算全局解锁率
      const totalTests = platformStats.reduce((sum, s) => sum + s.total, 0);
      const totalUnlocked = platformStats.reduce(
        (sum, s) => sum + s.unlocked,
        0,
      );
      const globalUnlockRate =
        totalTests > 0 ? (totalUnlocked / totalTests) * 100 : 0;

      return res.json({
        success: true,
        data: {
          totalNodes,
          lastScanTime: lastScan?.testedAt || new Date().toISOString(),
          expiredNodes,
          platformStats,
          globalUnlockRate,
        },
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when fetching streaming overview, returning defaults.",
        );
        const services = Object.values(StreamingService);
        const platformStats = services.map((service) => ({
          service: service.toLowerCase(),
          name: getServiceName(service),
          icon: getServiceIcon(service),
          unlocked: 0,
          restricted: 0,
          failed: 0,
          unknown: 0,
          total: 0,
          unlockRate: 0,
        }));
        const totalNodes = await prisma.node
          .count({ where: { status: "ONLINE" } })
          .catch(() => 0);
        return res.json({
          success: true,
          data: {
            totalNodes,
            lastScanTime: null,
            expiredNodes: totalNodes,
            platformStats,
            globalUnlockRate: 0,
          },
        });
      }
      logger.error("Get streaming overview error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming overview",
      });
    }
  }

  /**
   * 获取流媒体节点摘要列表（支持筛选）
   * GET /api/streaming/nodes
   */
  static async getStreamingNodeSummaries(req: Request, res: Response) {
    try {
      const { service, status, country, showExpired, search } = req.query;

      // 获取所有在线节点
      const nodes = await prisma.node.findMany({
        where: {
          status: "ONLINE",
          ...(country && { country: country as string }),
          ...(search && {
            OR: [
              { name: { contains: search as string, mode: "insensitive" } },
              { city: { contains: search as string, mode: "insensitive" } },
              { country: { contains: search as string, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          streamingTests: {
            orderBy: { testedAt: "desc" },
          },
        },
      });

      const services = Object.values(StreamingService);
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 为每个节点构建摘要
      const nodeSummaries = nodes.map((node) => {
        // 获取每个服务的最新测试结果
        const serviceResults = services.map((svc) => {
          const latestTest = node.streamingTests
            .filter((t) => t.service === svc)
            .sort(
              (a, b) =>
                new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime(),
            )[0];

          return {
            service: svc.toLowerCase(),
            name: getServiceName(svc),
            status: latestTest?.status.toLowerCase() || "unknown",
            region: latestTest?.region,
            unlockType: latestTest?.unlockType?.toLowerCase(),
            lastTested: latestTest?.testedAt,
          };
        });

        const lastScanned =
          serviceResults
            .map((s) => s.lastTested)
            .filter(Boolean)
            .sort(
              (a, b) => new Date(b!).getTime() - new Date(a!).getTime(),
            )[0] || null;

        const unlockCount = serviceResults.filter(
          (s) => s.status === "yes",
        ).length;

        return {
          nodeId: node.id,
          nodeName: node.name,
          country: node.country,
          city: node.city,
          services: serviceResults,
          lastScanned,
          unlockCount,
        };
      });

      // 应用筛选
      let filtered = nodeSummaries;

      // 按服务筛选
      if (service) {
        filtered = filtered.filter((n) =>
          n.services.some(
            (s) =>
              s.service === (service as string).toLowerCase() &&
              s.status !== "unknown",
          ),
        );
      }

      // 按状态筛选
      if (status && service) {
        filtered = filtered.filter((n) =>
          n.services.some(
            (s) =>
              s.service === (service as string).toLowerCase() &&
              s.status === (status as string).toLowerCase(),
          ),
        );
      }

      // 过滤过期数据
      if (showExpired === "false") {
        filtered = filtered.filter((n) => {
          if (!n.lastScanned) return false;
          return (
            new Date(n.lastScanned).getTime() >= expiredThreshold.getTime()
          );
        });
      }

      return res.json({
        success: true,
        data: filtered,
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when fetching node summaries, returning empty list.",
        );
        return res.json({
          success: true,
          data: [],
        });
      }
      logger.error("Get streaming node summaries error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming node summaries",
      });
    }
  }

  /**
   * 批量触发流媒体检测
   * POST /api/streaming/test/bulk
   */
  static async triggerBulkStreamingTest(req: Request, res: Response) {
    try {
      const { nodeIds } = req.body;

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "nodeIds must be a non-empty array",
        });
      }

      // 验证所有节点是否存在
      const nodes = await prisma.node.findMany({
        where: {
          id: { in: nodeIds },
          status: "ONLINE",
        },
      });

      if (nodes.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No online nodes found",
        });
      }

      // 通过 Socket.IO 通知所有节点开始检测
      const io = getIO();
      if (io) {
        nodes.forEach((node) => {
          notifyStreamingTestStart(io, node.id);
        });
      }

      logger.info(`Triggered bulk streaming test for ${nodes.length} nodes`);

      return res.json({
        success: true,
        message: `Streaming test triggered for ${nodes.length} nodes`,
        data: {
          queued: nodes.length,
        },
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when triggering bulk streaming test, returning fallback response.",
        );
        return res.json({
          success: true,
          message: "Streaming testing is not available yet",
          data: {
            queued: 0,
          },
        });
      }
      logger.error("Trigger bulk streaming test error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to trigger bulk streaming test",
      });
    }
  }

  /**
   * 导出流媒体数据
   * GET /api/streaming/export
   */
  static async exportStreamingData(req: Request, res: Response) {
    try {
      const { format = "json", service, status, country } = req.query;

      // 获取流媒体节点摘要数据（复用现有逻辑）
      const nodes = await prisma.node.findMany({
        where: {
          status: "ONLINE",
          ...(country && { country: country as string }),
        },
        include: {
          streamingTests: {
            orderBy: { testedAt: "desc" },
          },
        },
      });

      const services = Object.values(StreamingService);
      const exportData = nodes.map((node) => {
        const serviceResults = services.map((svc) => {
          const latestTest = node.streamingTests
            .filter((t) => t.service === svc)
            .sort(
              (a, b) =>
                new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime(),
            )[0];

          return {
            service: svc.toLowerCase(),
            name: getServiceName(svc),
            status: latestTest?.status.toLowerCase() || "unknown",
            region: latestTest?.region,
            lastTested: latestTest?.testedAt,
          };
        });

        return {
          nodeId: node.id,
          nodeName: node.name,
          country: node.country,
          city: node.city,
          services: serviceResults,
        };
      });

      // 应用筛选
      let filtered = exportData;
      if (service) {
        filtered = filtered.filter((n) =>
          n.services.some(
            (s) =>
              s.service === (service as string).toLowerCase() &&
              s.status !== "unknown",
          ),
        );
      }
      if (status && service) {
        filtered = filtered.filter((n) =>
          n.services.some(
            (s) =>
              s.service === (service as string).toLowerCase() &&
              s.status === (status as string).toLowerCase(),
          ),
        );
      }

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=streaming-export-${new Date().toISOString().split("T")[0]}.json`,
        );
        return res.json(filtered);
      } else if (format === "csv") {
        // 生成 CSV
        const csvHeader =
          "Node ID,Node Name,Country,City," +
          services.map((s) => getServiceName(s)).join(",") +
          "\n";
        const csvRows = filtered
          .map((node) => {
            const serviceCells = services.map((svc) => {
              const result = node.services.find(
                (s) => s.service === svc.toLowerCase(),
              );
              return result?.status.toUpperCase() || "UNKNOWN";
            });
            return [node.nodeId, node.nodeName, node.country, node.city]
              .concat(serviceCells)
              .map((v) => `"${v}"`)
              .join(",");
          })
          .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=streaming-export-${new Date().toISOString().split("T")[0]}.csv`,
        );
        return res.send(csvHeader + csvRows);
      } else if (format === "markdown") {
        // 生成 Markdown 表格
        const mdHeader = `| Node | Country | City | ${services.map((s) => getServiceName(s)).join(" | ")} |\n`;
        const mdSeparator = `|------|---------|------|${services.map(() => "---").join("|")}|\n`;
        const mdRows = filtered
          .map((node) => {
            const serviceCells = services.map((svc) => {
              const result = node.services.find(
                (s) => s.service === svc.toLowerCase(),
              );
              const statusEmoji =
                result?.status === "yes"
                  ? "✅"
                  : result?.status === "no"
                    ? "❌"
                    : "❓";
              return `${statusEmoji} ${result?.region || ""}`;
            });
            return (
              `| ${node.nodeName} | ${node.country} | ${node.city} | ` +
              serviceCells.join(" | ") +
              " |"
            );
          })
          .join("\n");

        res.setHeader("Content-Type", "text/markdown");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=streaming-export-${new Date().toISOString().split("T")[0]}.md`,
        );
        return res.send(
          `# Streaming Export\n\n${mdHeader}${mdSeparator}${mdRows}`,
        );
      }

      return res.status(400).json({
        success: false,
        error: "Unsupported format. Use json, csv, or markdown",
      });
    } catch (error) {
      if (isMissingStreamingTableError(error)) {
        logger.warn(
          "Streaming tables missing when exporting streaming data, returning empty export.",
        );
        if (format === "json") {
          res.setHeader("Content-Type", "application/json");
          return res.json([]);
        }
        if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=streaming-export-${new Date().toISOString().split("T")[0]}.csv`,
          );
          return res.send("Node ID,Node Name,Country,City\n");
        }
        if (format === "markdown") {
          res.setHeader("Content-Type", "text/markdown");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=streaming-export-${new Date().toISOString().split("T")[0]}.md`,
          );
          return res.send(
            "# Streaming Export\n\n_No streaming data available_\n",
          );
        }
        return res.status(400).json({
          success: false,
          error: "Unsupported format. Use json, csv, or markdown",
        });
      }
      logger.error("Export streaming data error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to export streaming data",
      });
    }
  }
}

// 辅助函数：获取服务名称
function getServiceName(service: StreamingService): string {
  const names: Record<StreamingService, string> = {
    NETFLIX: "Netflix",
    YOUTUBE: "YouTube",
    DISNEY_PLUS: "Disney+",
    TIKTOK: "TikTok",
    AMAZON_PRIME: "Amazon Prime",
    SPOTIFY: "Spotify",
    CHATGPT: "ChatGPT",
  };
  return names[service];
}

// 辅助函数：获取服务图标
function getServiceIcon(service: StreamingService): string {
  const icons: Record<StreamingService, string> = {
    NETFLIX: "🎬",
    YOUTUBE: "📺",
    DISNEY_PLUS: "🎵",
    TIKTOK: "🎭",
    AMAZON_PRIME: "📦",
    SPOTIFY: "🎶",
    CHATGPT: "🤖",
  };
  return icons[service];
}

function isMissingStreamingTableError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}
