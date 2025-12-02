import { Request, Response } from "express";
import axios from "axios";
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
import { env } from "../config/env";
import { apiKeyService } from "../services/ApiKeyService";

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

const AGENT_CONTROL_PROTOCOL = env.AGENT_CONTROL_PROTOCOL || "http";
const AGENT_CONTROL_PORT = env.AGENT_CONTROL_PORT || 3002;
const AGENT_CONTROL_TIMEOUT = env.AGENT_CONTROL_TIMEOUT || 8000;
const FALLBACK_AGENT_CONTROL_API_KEY =
  env.AGENT_CONTROL_API_KEY || env.DEFAULT_AGENT_API_KEY;

const buildAgentBaseUrl = (node: {
  ipv4?: string | null;
  ipv6?: string | null;
}): string | null => {
  if (node.ipv4 && node.ipv4.trim().length > 0) {
    return `${AGENT_CONTROL_PROTOCOL}://${node.ipv4}:${AGENT_CONTROL_PORT}`;
  }
  if (node.ipv6 && node.ipv6.trim().length > 0) {
    return `${AGENT_CONTROL_PROTOCOL}://[${node.ipv6}]:${AGENT_CONTROL_PORT}`;
  }
  return null;
};

type AgentApiKeySource = "system" | "fallback" | "node";

const resolveAgentControlApiKey = async (): Promise<{
  key: string;
  source: AgentApiKeySource;
} | null> => {
  try {
    const key = await apiKeyService.getSystemApiKey();
    if (key && key.trim().length > 0) {
      return { key: key.trim(), source: "system" };
    }
  } catch (error) {
    logger.error(
      "[StreamingController] Failed to resolve system agent API key:",
      error,
    );
  }

  const fallback = FALLBACK_AGENT_CONTROL_API_KEY?.trim();
  if (fallback) {
    if (!apiKeyService.isSecureAgentApiKey(fallback)) {
      logger.error(
        "[StreamingController] Environment agent API key is not secure. Refusing to use fallback value.",
      );
      return null;
    }
    logger.warn(
      "[StreamingController] Falling back to environment agent API key. Verify system API key configuration if issues persist.",
    );
    return {
      key: fallback,
      source: "fallback",
    };
  }

  return null;
};

const resolveAgentApiKeyForNode = async (node: {
  apiKey?: string | null;
}): Promise<{ key: string; source: AgentApiKeySource } | null> => {
  const resolved = await resolveAgentControlApiKey();
  if (resolved) {
    return resolved;
  }

  if (node.apiKey && node.apiKey.trim().length > 0) {
    logger.warn(
      `[StreamingController] Using node-specific API key as fallback for agent ${node.apiKey.substring(0, 6)}...`,
    );
    return { key: node.apiKey.trim(), source: "node" };
  }

  logger.error(
    `[StreamingController] Unable to resolve agent API key (system, environment, and node-specific keys missing).`,
  );
  return null;
};

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
      const { services } = (req.body ?? {}) as {
        services?: string | string[];
      };

      const node = await prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return res.status(404).json({
          success: false,
          error: "Node not found",
        });
      }

      const agentBaseUrl = buildAgentBaseUrl(node);
      if (!agentBaseUrl) {
        return res.status(400).json({
          success: false,
          error: "Node is missing a reachable agent address",
        });
      }

      const resolvedKey = await resolveAgentApiKeyForNode(node);
      if (!resolvedKey) {
        logger.error("Agent control API key is not configured on the server");
        return res.status(500).json({
          success: false,
          error: "Agent control API key is not configured",
        });
      }
      const { key: agentControlApiKey, source: keySource } = resolvedKey;
      logger.debug(
        `[StreamingController] Using ${keySource} agent API key (len=${agentControlApiKey.length}) for node ${nodeId}`,
      );

      try {
        await axios.post(
          `${agentBaseUrl}/api/streaming/test`,
          {
            services: Array.isArray(services) ? services : undefined,
            origin: "master",
            triggeredAt: new Date().toISOString(),
          },
          {
            headers: {
              "x-agent-api-key": agentControlApiKey,
            },
            timeout: AGENT_CONTROL_TIMEOUT,
          },
        );
      } catch (error) {
        logger.error(
          `Failed to trigger streaming detection on agent ${node.agentId} (${agentBaseUrl}):`,
          error,
        );

        const errorMessage =
          axios.isAxiosError(error) && error.code === "ECONNREFUSED"
            ? "Agent is not reachable (connection refused)"
            : "Failed to contact agent for streaming detection";

        return res.status(502).json({
          success: false,
          error: errorMessage,
        });
      }

      const io = getIO();
      if (io) {
        notifyStreamingTestStart(io, nodeId);
      }

      logger.info(
        `Triggered streaming test for node ${nodeId} via agent ${node.agentId}, services: ${services || "all"}`,
      );

      return res.json({
        success: true,
        message: "Streaming test has been triggered on the agent",
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

  static async saveStreamingResults(req: Request, res: Response) {
    try {
      const { nodeId, results } = req.body;
      const headerApiKey = req.headers["x-api-key"] as string;
      const bodyApiKey = req.body.apiKey;
      const apiKey = headerApiKey || bodyApiKey;

      logger.debug(
        `[StreamingController] Received streaming results for node: ${nodeId}`,
      );
      logger.debug(`[StreamingController] Results count: ${results?.length}`);
      logger.debug(
        `[StreamingController] API Key present: ${apiKey ? "Yes (" + apiKey.substring(0, 4) + "...)" : "No"}`,
      );

      // 验证API密钥
      if (!apiKey) {
        logger.warn(
          `[StreamingController] Missing API key for streaming results`,
        );
        return res.status(401).json({
          success: false,
          error: "API key is required",
        });
      }

      const apiKeyService = await import("../services/ApiKeyService");
      const isValidApiKey =
        await apiKeyService.apiKeyService.validateApiKey(apiKey);

      if (!isValidApiKey) {
        logger.warn(
          `[StreamingController] Invalid API key for streaming results`,
        );
        return res.status(401).json({
          success: false,
          error: "Invalid API key",
        });
      }

      if (!nodeId || !results || !Array.isArray(results)) {
        logger.warn(
          `[StreamingController] Invalid request body: nodeId=${nodeId}, results=${Array.isArray(results)}`,
        );
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
        });
      }

      // 验证节点是否存在
      let node = await prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        node = await prisma.node.findUnique({
          where: { agentId: nodeId },
        });
        if (node) {
          logger.warn(
            `[StreamingController] Node ID ${nodeId} not found, resolved via agentId ${node.agentId}`,
          );
        }
      }

      if (!node) {
        logger.warn(`[StreamingController] Node not found: ${nodeId}`);
        return res.status(404).json({
          success: false,
          error: "Node not found",
        });
      }

      const resolvedNodeId = node.id;

      logger.info(
        `[StreamingController] Saving ${results.length} streaming test results for node ${resolvedNodeId} (${node.name})`,
      );

      // 批量保存检测结果
      const savedResults = await Promise.all(
        results.map(async (result: StreamingResultInput) => {
          return await prisma.streamingTest.create({
            data: {
              nodeId: resolvedNodeId,
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
        broadcastStreamingTestResult(io, resolvedNodeId, savedResults);
      }

      logger.info(
        `[StreamingController] Successfully saved ${savedResults.length} streaming test results for node ${resolvedNodeId}`,
      );

      return res.json({
        success: true,
        message: "Streaming results saved",
        data: {
          count: savedResults.length,
        },
      });
    } catch (error) {
      logger.error(
        "[StreamingController] Save streaming results error:",
        error,
      );
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

      const totalNodes = await prisma.node.count({
        where: { status: "ONLINE" },
      });

      const lastScan = await prisma.streamingTest.findFirst({
        orderBy: { testedAt: "desc" },
        select: { testedAt: true },
      });

      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // 只统计在线节点中有最近测试记录的节点数
      const recentNodeRows = await prisma.$queryRaw<Array<{ node_id: string }>>(
        Prisma.sql`
          SELECT DISTINCT st."nodeId" AS node_id
          FROM "streaming_tests" st
          INNER JOIN "nodes" n ON n.id = st."nodeId"
          WHERE st."testedAt" >= ${expiredThreshold}
            AND n.status = 'ONLINE'
        `,
      );
      const expiredNodes = Math.max(0, totalNodes - recentNodeRows.length);

      // 只统计在线节点的流媒体测试结果
      const latestStatsRows = await prisma.$queryRaw<
        Array<{
          service: StreamingService;
          status: StreamingStatus;
          count: bigint;
        }>
      >(Prisma.sql`
        WITH online_nodes AS (
          SELECT id FROM "nodes" WHERE status = 'ONLINE'
        ),
        latest AS (
          SELECT
            st."nodeId",
            st."service",
            MAX(st."testedAt") AS "latestTestedAt"
          FROM "streaming_tests" st
          INNER JOIN online_nodes n ON n.id = st."nodeId"
          GROUP BY st."nodeId", st."service"
        )
        SELECT
          st."service",
          st."status",
          COUNT(*)::bigint AS count
        FROM "streaming_tests" st
        INNER JOIN latest l
          ON l."nodeId" = st."nodeId"
          AND l."service" = st."service"
          AND st."testedAt" = l."latestTestedAt"
        GROUP BY st."service", st."status"
      `);

      type NumericStatField = Exclude<
        keyof PlatformStatsAccumulator,
        "service" | "name" | "icon" | "unlockRate"
      >;

      const statusFieldMap: Record<string, NumericStatField> = {
        YES: "unlocked",
        ORG: "originalOnly",
        PENDING: "pending",
        NO: "restricted",
        NOPREM: "noPremium",
        CN: "china",
        APP: "appOnly",
        WEB: "webOnly",
        IDC: "idc",
        FAILED: "failed",
        UNKNOWN: "unknown",
      };

      type PlatformStatsAccumulator = {
        service: string;
        name: string;
        icon: string;
        unlocked: number;
        originalOnly: number;
        pending: number;
        restricted: number;
        noPremium: number;
        china: number;
        appOnly: number;
        webOnly: number;
        idc: number;
        failed: number;
        unknown: number;
        total: number;
        unlockRate: number;
      };

      const createBaseStats = (): PlatformStatsAccumulator => ({
        service: "",
        name: "",
        icon: "",
        unlocked: 0,
        originalOnly: 0,
        pending: 0,
        restricted: 0,
        noPremium: 0,
        china: 0,
        appOnly: 0,
        webOnly: 0,
        idc: 0,
        failed: 0,
        unknown: 0,
        total: 0,
        unlockRate: 0,
      });

      const statsByService = new Map<
        StreamingService,
        PlatformStatsAccumulator
      >();

      services.forEach((service) => {
        const base = createBaseStats();
        base.service = service.toLowerCase();
        base.name = getServiceName(service);
        base.icon = getServiceIcon(service);
        statsByService.set(service, base);
      });

      latestStatsRows.forEach((row) => {
        const stats = statsByService.get(row.service);
        if (!stats) {
          return;
        }
        const field = statusFieldMap[row.status];
        const count = Number(row.count);
        if (!field) {
          return;
        }
        stats[field] += count;
        stats.total += count;
      });

      const platformStats = Array.from(statsByService.values()).map((stat) => ({
        ...stat,
        unlockRate: stat.total > 0 ? (stat.unlocked / stat.total) * 100 : 0,
      }));

      const totalTests = platformStats.reduce(
        (sum, item) => sum + item.total,
        0,
      );
      const totalUnlocked = platformStats.reduce(
        (sum, item) => sum + item.unlocked,
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
          originalOnly: 0,
          pending: 0,
          restricted: 0,
          noPremium: 0,
          china: 0,
          appOnly: 0,
          webOnly: 0,
          idc: 0,
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
      logger.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming overview",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取流媒体节点摘要列表（支持筛选）
   * GET /api/streaming/nodes
   */
  static async getStreamingNodeSummaries(req: Request, res: Response) {
    try {
      const { service, status, country, showExpired, search, region } =
        req.query;

      const services = Object.values(StreamingService);
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const nodeWhere: Prisma.NodeWhereInput = {
        status: "ONLINE",
      };

      if (country) {
        nodeWhere.country = country as string;
      }

      if (search) {
        const keyword = search.toString();
        nodeWhere.OR = [
          { name: { contains: keyword, mode: "insensitive" } },
          { city: { contains: keyword, mode: "insensitive" } },
          { country: { contains: keyword, mode: "insensitive" } },
        ];
      }

      const nodes = await prisma.node.findMany({
        where: nodeWhere,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
        },
      });

      if (nodes.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const nodeIds = nodes.map((node) => node.id);

      const latestRows = await prisma.$queryRaw<
        Array<{
          node_id: string;
          service: StreamingService;
          status: StreamingStatus;
          region: string | null;
          unlock_type: UnlockType | null;
          tested_at: Date | null;
        }>
      >(Prisma.sql`
        WITH latest AS (
          SELECT
            st."nodeId",
            st."service",
            MAX(st."testedAt") AS "latestTestedAt"
          FROM "streaming_tests" st
          WHERE st."nodeId" IN (${Prisma.join(nodeIds)})
          GROUP BY st."nodeId", st."service"
        )
        SELECT
          st."nodeId" AS node_id,
          st."service",
          st."status",
          st."region",
          st."unlockType" AS unlock_type,
          st."testedAt" AS tested_at
        FROM "streaming_tests" st
        INNER JOIN latest l
          ON l."nodeId" = st."nodeId"
          AND l."service" = st."service"
          AND st."testedAt" = l."latestTestedAt"
      `);

      const serviceFilter =
        typeof service === "string" && service.length > 0
          ? (service.toUpperCase() as StreamingService)
          : undefined;
      const statusFilter =
        typeof status === "string" && status.length > 0
          ? status.toLowerCase()
          : undefined;
      const regionFilter =
        typeof region === "string" && region.trim().length > 0
          ? region.trim().toLowerCase()
          : undefined;
      const hideExpired = showExpired === "false";

      const latestMap = new Map<
        string,
        Map<StreamingService, (typeof latestRows)[number]>
      >();
      latestRows.forEach((row) => {
        const mapForNode = latestMap.get(row.node_id) ?? new Map();
        mapForNode.set(row.service, row);
        latestMap.set(row.node_id, mapForNode);
      });

      const summaries: Array<{
        nodeId: string;
        nodeName: string;
        country: string;
        city: string | null;
        services: Array<{
          service: string;
          name: string;
          status: string;
          region?: string | null;
          unlockType?: string | null;
          lastTested?: Date | null;
        }>;
        lastScanned: Date | null;
        isExpired: boolean;
        unlockedCount: number;
        restrictedCount: number;
      }> = [];

      nodes.forEach((node) => {
        const perNode = latestMap.get(node.id) ?? new Map();
        let lastScanned: Date | null = null;
        let lastScannedTimestamp: number | null = null;

        const serviceResults = services.map((svc) => {
          const latest = perNode.get(svc) ?? null;
          const statusText = latest?.status
            ? latest.status.toLowerCase()
            : "unknown";
          const unlockTypeRaw = latest?.unlock_type
            ? latest.unlock_type.toLowerCase()
            : undefined;
          const unlockType =
            unlockTypeRaw === "idc" ? "unknown" : unlockTypeRaw;
          const regionCode = latest?.region ?? undefined;
          const testedAt = latest?.tested_at ?? null;
          const testedAtTimestamp = testedAt?.getTime() ?? null;

          if (testedAt && testedAtTimestamp !== null) {
            if (
              lastScannedTimestamp === null ||
              testedAtTimestamp > lastScannedTimestamp
            ) {
              lastScanned = testedAt;
              lastScannedTimestamp = testedAtTimestamp;
            }
          }

          return {
            service: svc.toLowerCase(),
            name: getServiceName(svc),
            status: statusText,
            region: regionCode,
            unlockType,
            lastTested: testedAt,
          };
        });

        const unlockedCount = serviceResults.filter(
          (s) => s.status === "yes",
        ).length;
        const restrictedCount = serviceResults.filter(
          (s) => s.status === "no",
        ).length;
        const isExpired =
          lastScannedTimestamp === null ||
          lastScannedTimestamp < expiredThreshold.getTime();

        const summary = {
          nodeId: node.id,
          nodeName: node.name,
          country: node.country,
          city: node.city,
          services: serviceResults,
          lastScanned,
          isExpired,
          unlockedCount,
          restrictedCount,
        };

        if (serviceFilter) {
          const serviceKey = serviceFilter.toLowerCase();
          if (!serviceResults.some((s) => s.service === serviceKey)) {
            return;
          }
        }

        if (statusFilter) {
          const matched = serviceFilter
            ? serviceResults.some(
                (s) =>
                  s.service === serviceFilter.toLowerCase() &&
                  s.status === statusFilter,
              )
            : serviceResults.some((s) => s.status === statusFilter);
          if (!matched) {
            return;
          }
        }

        if (regionFilter) {
          const matched = serviceResults.some(
            (s) => s.region && s.region.toLowerCase().includes(regionFilter),
          );
          if (!matched) {
            return;
          }
        }

        if (hideExpired && summary.isExpired) {
          return;
        }

        summaries.push(summary);
      });

      return res.json({
        success: true,
        data: summaries,
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
      logger.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filters: req.query,
      });
      return res.status(500).json({
        success: false,
        error: "Failed to get streaming node summaries",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async triggerBulkStreamingTest(req: Request, res: Response) {
    try {
      const { nodeIds } = req.body;

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "nodeIds must be a non-empty array",
        });
      }

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

      const io = getIO();
      let successCount = 0;
      const failures: Array<{ nodeId: string; reason: string }> = [];

      for (const node of nodes) {
        const baseUrl = buildAgentBaseUrl(node);
        if (!baseUrl) {
          failures.push({ nodeId: node.id, reason: "missing_agent_endpoint" });
          continue;
        }

        const resolvedKey = await resolveAgentApiKeyForNode(node);
        if (!resolvedKey) {
          failures.push({ nodeId: node.id, reason: "missing_api_key" });
          continue;
        }
        const { key: agentControlApiKey, source: keySource } = resolvedKey;
        logger.debug(
          `[StreamingController] Using ${keySource} agent API key (len=${agentControlApiKey.length}) for node ${node.id}`,
        );

        try {
          await axios.post(
            `${baseUrl}/api/streaming/test`,
            {
              origin: "master",
              triggeredAt: new Date().toISOString(),
            },
            {
              headers: {
                "x-agent-api-key": agentControlApiKey,
              },
              timeout: AGENT_CONTROL_TIMEOUT,
            },
          );
          successCount += 1;
          if (io) {
            notifyStreamingTestStart(io, node.id);
          }
        } catch (error) {
          logger.error(
            `Failed to trigger streaming detection on agent ${node.agentId} (${baseUrl}):`,
            error,
          );
          const reason =
            axios.isAxiosError(error) && error.code === "ECONNREFUSED"
              ? "agent_unreachable"
              : "agent_error";
          failures.push({ nodeId: node.id, reason });
        }
      }

      logger.info(
        `Triggered bulk streaming test for ${successCount} / ${nodes.length} nodes (failures: ${failures.length})`,
      );

      return res.json({
        success: true,
        message: `Streaming test triggered for ${successCount} / ${nodes.length} nodes`,
        data: {
          queued: successCount,
          total: nodes.length,
          failures,
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

  static async exportStreamingData(req: Request, res: Response) {
    const { format = "json", service, status, country } = req.query;

    try {
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
