import { Request, Response } from "express";
import { Prisma, ServiceType, ServiceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { getIO } from "../sockets/ioRegistry";
import { apiKeyService } from "../services/ApiKeyService";

const DEFAULT_SERVICE_DATA_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;
const parsedExpiryMs = Number(process.env.SERVICE_DATA_EXPIRY_THRESHOLD_MS);
const SERVICE_DATA_EXPIRY_THRESHOLD_MS =
  Number.isFinite(parsedExpiryMs) && parsedExpiryMs > 0
    ? parsedExpiryMs
    : DEFAULT_SERVICE_DATA_EXPIRY_MS;

/**
 * Agent 上报的服务数据接口
 */
interface ServiceReportInput {
  serviceType: string;
  serviceName: string;
  version?: string;
  status: string;
  port?: number;
  protocol?: string;
  configPath?: string;
  configHash?: string;
  domains?: string[];
  sslEnabled?: boolean;
  containerInfo?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

/**
 * 服务总览API控制器
 */
export class ServicesController {
  /**
   * Agent 上报服务检测结果
   * POST /api/services/report
   */
  static async reportServices(req: Request, res: Response) {
    try {
      const { nodeId, services, scannedAt } = req.body;

      if (!nodeId || !services || !Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
        });
      }

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

      // 全量替换策略：先删除该节点的所有旧服务记录
      await prisma.detectedService.deleteMany({
        where: { nodeId },
      });

      logger.info(`Deleted old service records for node ${nodeId}`);

      // 批量保存新的服务检测结果
      const savedServices = await Promise.all(
        services.map(async (service: ServiceReportInput) => {
          const serviceData = {
            nodeId,
            serviceType: service.serviceType.toUpperCase() as ServiceType,
            serviceName: service.serviceName,
            version: service.version,
            status: service.status.toUpperCase() as ServiceStatus,
            port: service.port,
            protocol: service.protocol,
            configPath: service.configPath,
            configHash: service.configHash,
            domains: service.domains
              ? (service.domains as Prisma.InputJsonValue)
              : undefined,
            sslEnabled: service.sslEnabled,
            containerInfo: service.containerInfo
              ? (service.containerInfo as Prisma.InputJsonValue)
              : undefined,
            details: service.details
              ? (service.details as Prisma.InputJsonValue)
              : undefined,
          };

          // 直接创建新记录（因为上面已经删除了所有旧记录）
          return await prisma.detectedService.create({
            data: serviceData,
          });
        }),
      );

      // 广播服务检测结果给前端
      const io = getIO();
      if (io) {
        io.emit("service-scan-completed", {
          nodeId,
          servicesCount: savedServices.length,
          scannedAt,
        });
      }

      logger.info(
        `Saved ${savedServices.length} service detection results for node ${nodeId}`,
      );

      return res.json({
        success: true,
        message: "Services reported successfully",
        data: {
          count: savedServices.length,
        },
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when reporting services, returning failure response.",
        );
        return res.status(503).json({
          success: false,
          error: "Service management is not available yet",
        });
      }
      logger.error("Report services error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to report services",
      });
    }
  }
  /**
   * 获取服务总览统计
   * GET /api/services/overview
   */
  static async getServicesOverview(req: Request, res: Response) {
    try {
      const [activeServices, onlineNodes] = await Promise.all([
        prisma.detectedService.findMany({
          where: {
            node: { status: "ONLINE" },
          },
          select: {
            id: true,
            nodeId: true,
            serviceType: true,
            status: true,
            updatedAt: true,
          },
        }),
        prisma.node.findMany({
          where: {
            status: "ONLINE",
          },
          select: {
            id: true,
            updatedAt: true,
            detectedServices: {
              select: {
                updatedAt: true,
              },
              orderBy: {
                updatedAt: "desc",
              },
              take: 1,
            },
          },
        }),
      ]);

      const now = Date.now();
      const serviceTypes = Object.values(ServiceType);
      const servicesByType = serviceTypes.reduce(
        (acc, type) => {
          const key = type.toLowerCase();
          acc[key] = 0;
          return acc;
        },
        {} as Record<string, number>,
      );

      activeServices.forEach((service) => {
        const key = String(service.serviceType).toLowerCase();
        servicesByType[key] = (servicesByType[key] ?? 0) + 1;
      });

      const runningServices = activeServices.filter(
        (s) => s.status === ServiceStatus.RUNNING,
      ).length;
      const stoppedServices = activeServices.filter(
        (s) => s.status === ServiceStatus.STOPPED,
      ).length;
      const failedServices = activeServices.filter(
        (s) => s.status === ServiceStatus.UNKNOWN,
      ).length;

      const lastUpdatedTimestamp = activeServices.reduce((latest, service) => {
        const updatedAt = service.updatedAt.getTime();
        return updatedAt > latest ? updatedAt : latest;
      }, 0);
      const lastUpdated = new Date(
        lastUpdatedTimestamp || Date.now(),
      ).toISOString();

      const serviceTypeDistribution = serviceTypes.map((type) => {
        const key = type.toLowerCase();
        return {
          type: key,
          count: servicesByType[key] ?? 0,
        };
      });

      const expiredNodes = onlineNodes.reduce((count, node) => {
        const latestService = node.detectedServices[0]?.updatedAt;
        if (!latestService) {
          return count + 1;
        }
        return now - latestService.getTime() > SERVICE_DATA_EXPIRY_THRESHOLD_MS
          ? count + 1
          : count;
      }, 0);

      return res.json({
        success: true,
        data: {
          totalNodes: onlineNodes.length,
          totalServices: activeServices.length,
          runningServices,
          stoppedServices,
          failedServices,
          expiredNodes,
          servicesByType,
          serviceTypeDistribution,
          lastUpdated,
        },
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when fetching overview, returning default values.",
        );
        const totalNodes = await prisma.node
          .count({ where: { status: "ONLINE" } })
          .catch(() => 0);
        const serviceTypes = Object.values(ServiceType);
        const serviceTypeDistribution = serviceTypes.map((type) => ({
          type: type.toLowerCase(),
          count: 0,
        }));
        const servicesByType = serviceTypes.reduce(
          (acc, type) => {
            acc[type.toLowerCase()] = 0;
            return acc;
          },
          {} as Record<string, number>,
        );
        return res.json({
          success: true,
          data: {
            totalNodes,
            totalServices: 0,
            runningServices: 0,
            stoppedServices: 0,
            failedServices: 0,
            expiredNodes: totalNodes,
            servicesByType,
            serviceTypeDistribution,
            lastUpdated: new Date().toISOString(),
          },
        });
      }
      logger.error("Get services overview error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get services overview",
      });
    }
  }

  /**
   * 获取所有服务（支持筛选）
   * GET /api/services
   */
  static async getAllServices(req: Request, res: Response) {
    try {
      const { nodeId, serviceType, status, search } = req.query;

      // 构建查询条件
      const whereClause: Prisma.DetectedServiceWhereInput = {
        node: {
          status: "ONLINE",
        },
        ...(nodeId && { nodeId: nodeId as string }),
        ...(serviceType && {
          serviceType: serviceType.toString().toUpperCase() as ServiceType,
        }),
        ...(status && {
          status: status.toString().toUpperCase() as ServiceStatus,
        }),
        ...(search && {
          OR: [
            {
              serviceName: { contains: search as string, mode: "insensitive" },
            },
            {
              node: {
                name: { contains: search as string, mode: "insensitive" },
              },
            },
          ],
        }),
      };

      const services = await prisma.detectedService.findMany({
        where: whereClause,
        include: {
          node: {
            select: {
              id: true,
              name: true,
              country: true,
              city: true,
              status: true,
              ipv4: true,
              ipv6: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      // 转换为前端期望的格式
      const formattedServices = services.map((service) => {
        const access = buildServiceAccess({
          domains: service.domains,
          port: service.port,
          protocol: service.protocol,
          containerInfo: service.containerInfo,
        });

        return {
          id: service.id,
          nodeId: service.nodeId,
          nodeName: service.node.name,
          nodeCountry: service.node.country ?? undefined,
          nodeCity: service.node.city ?? undefined,
          nodeIp: service.node.ipv4 ?? service.node.ipv6 ?? undefined,
          name: service.serviceName,
          type: service.serviceType.toLowerCase(),
          status: service.status.toLowerCase(),
          deploymentType: "unknown",
          access,
          port: service.port,
          protocol: service.protocol,
          version: service.version ?? undefined,
          domains: service.domains,
          sslEnabled: service.sslEnabled,
          configPath: service.configPath,
          containerInfo: service.containerInfo,
          details: service.details,
          lastUpdated: service.updatedAt.toISOString(),
          createdAt: service.detectedAt.toISOString(),
        };
      });

      return res.json({
        success: true,
        data: formattedServices,
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when fetching services list, returning empty list.",
        );
        return res.json({
          success: true,
          data: [],
        });
      }
      logger.error("Get all services error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get services",
      });
    }
  }

  /**
   * 获取服务按节点分组
   * GET /api/services/grouped
   */
  static async getNodeServicesGrouped(req: Request, res: Response) {
    try {
      // 获取所有在线节点
      const nodes = await prisma.node.findMany({
        where: {
          status: "ONLINE",
        },
        include: {
          detectedServices: {
            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      });

      const now = Date.now();

      // Build summarized overview per node
      const nodeServicesOverview = nodes.map((node) => {
        const services = node.detectedServices.map((service) => {
          const access = buildServiceAccess({
            domains: service.domains,
            port: service.port,
            protocol: service.protocol,
            containerInfo: service.containerInfo,
          });

          return {
            id: service.id,
            nodeId: node.id,
            nodeName: node.name,
            nodeCountry: node.country ?? undefined,
            nodeCity: node.city ?? undefined,
            name: service.serviceName,
            type: service.serviceType.toLowerCase(),
            status: service.status.toLowerCase(),
            deploymentType: "unknown",
            access,
            version: service.version ?? undefined,
            lastUpdated: service.updatedAt.toISOString(),
            createdAt: service.detectedAt.toISOString(),
          };
        });

        const runningCount = services.filter(
          (s) => s.status === "running",
        ).length;
        const stoppedCount = services.filter(
          (s) => s.status === "stopped",
        ).length;
        const failedCount = services.filter(
          (s) => s.status === "unknown",
        ).length;

        const lastReportedIso =
          services.length > 0
            ? services[0].lastUpdated
            : node.updatedAt.toISOString();
        const lastReportedTime = new Date(lastReportedIso).getTime();
        const isExpired =
          services.length === 0 ||
          !Number.isFinite(lastReportedTime) ||
          now - lastReportedTime > SERVICE_DATA_EXPIRY_THRESHOLD_MS;

        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeCountry: node.country,
          nodeCity: node.city,
          services,
          totalServices: services.length,
          runningServices: runningCount,
          stoppedServices: stoppedCount,
          failedServices: failedCount,
          lastReported: lastReportedIso,
          isExpired,
        };
      });

      return res.json({
        success: true,
        data: nodeServicesOverview,
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when fetching grouped node services, returning empty list.",
        );
        return res.json({
          success: true,
          data: [],
        });
      }
      logger.error("Get node services grouped error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get node services grouped",
      });
    }
  }

  /**
   * 更新服务信息
   * PUT /api/services/:id
   */
  static async updateService(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // 验证服务是否存在
      const service = await prisma.detectedService.findUnique({
        where: { id },
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
        });
      }

      // 目前 DetectedService 模型比较简单，大部分字段由 Agent 上报
      // 这里只允许更新 details 字段（用于存储额外的用户定义信息）
      const updatedService = await prisma.detectedService.update({
        where: { id },
        data: {
          details: updates.details
            ? (updates.details as Prisma.InputJsonValue)
            : undefined,
        },
        include: {
          node: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info(`Service ${id} updated`);

      return res.json({
        success: true,
        data: {
          id: updatedService.id,
          nodeId: updatedService.nodeId,
          nodeName: updatedService.node.name,
          name: updatedService.serviceName,
          type: updatedService.serviceType.toLowerCase(),
          status: updatedService.status.toLowerCase(),
          details: updatedService.details,
          lastUpdated: updatedService.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when updating service, returning failure response.",
        );
        return res.status(503).json({
          success: false,
          error: "Service management is not available yet",
        });
      }
      logger.error("Update service error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update service",
      });
    }
  }

  /**
   * 删除服务
   * DELETE /api/services/:id
   */
  static async deleteService(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // 验证服务是否存在
      const service = await prisma.detectedService.findUnique({
        where: { id },
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
        });
      }

      await prisma.detectedService.delete({
        where: { id },
      });

      logger.info(`Service ${id} deleted`);

      return res.json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when deleting service, returning failure response.",
        );
        return res.status(503).json({
          success: false,
          error: "Service management is not available yet",
        });
      }
      logger.error("Delete service error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete service",
      });
    }
  }

  /**
   * 导出服务数据
   * GET /api/services/export
   */
  static async exportServices(req: Request, res: Response) {
    const { format = "json", nodeId, serviceType, status } = req.query;

    try {
      // 获取服务数据
      const whereClause: Prisma.DetectedServiceWhereInput = {
        node: {
          status: "ONLINE",
        },
        ...(nodeId && { nodeId: nodeId as string }),
        ...(serviceType && {
          serviceType: serviceType.toString().toUpperCase() as ServiceType,
        }),
        ...(status && {
          status: status.toString().toUpperCase() as ServiceStatus,
        }),
      };

      const services = await prisma.detectedService.findMany({
        where: whereClause,
        include: {
          node: {
            select: {
              id: true,
              name: true,
              country: true,
              city: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      const exportData = services.map((service) => ({
        nodeId: service.nodeId,
        nodeName: service.node.name,
        country: service.node.country,
        city: service.node.city,
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        status: service.status,
        port: service.port,
        protocol: service.protocol,
        version: service.version,
        lastUpdated: service.updatedAt.toISOString(),
      }));

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=services-export-${new Date().toISOString().split("T")[0]}.json`,
        );
        return res.json(exportData);
      } else if (format === "csv") {
        const csvHeader =
          "Node ID,Node Name,Country,City,Service Name,Service Type,Status,Port,Protocol,Version,Last Updated\n";
        const csvRows = exportData
          .map((s) =>
            [
              s.nodeId,
              s.nodeName,
              s.country,
              s.city,
              s.serviceName,
              s.serviceType,
              s.status,
              s.port || "",
              s.protocol || "",
              s.version || "",
              s.lastUpdated,
            ]
              .map((v) => `"${v}"`)
              .join(","),
          )
          .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=services-export-${new Date().toISOString().split("T")[0]}.csv`,
        );
        return res.send(csvHeader + csvRows);
      } else if (format === "markdown") {
        const mdHeader =
          "| Node | Country | City | Service | Type | Status | Port | Version |\n";
        const mdSeparator =
          "|------|---------|------|---------|------|--------|------|---------|\n";
        const mdRows = exportData
          .map(
            (s) =>
              `| ${s.nodeName} | ${s.country} | ${s.city} | ${s.serviceName} | ${s.serviceType} | ${s.status} | ${s.port || "N/A"} | ${s.version || "N/A"} |`,
          )
          .join("\n");

        res.setHeader("Content-Type", "text/markdown");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=services-export-${new Date().toISOString().split("T")[0]}.md`,
        );
        return res.send(
          `# Services Export\n\n${mdHeader}${mdSeparator}${mdRows}`,
        );
      }

      return res.status(400).json({
        success: false,
        error: "Unsupported format. Use json, csv, or markdown",
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when exporting services, returning empty export.",
        );
        if (format === "json") {
          res.setHeader("Content-Type", "application/json");
          return res.json([]);
        }
        if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=services-export-${new Date().toISOString().split("T")[0]}.csv`,
          );
          return res.send(
            "Node ID,Node Name,Country,City,Service Name,Service Type,Status,Port,Protocol,Version,Last Updated\n",
          );
        }
        if (format === "markdown") {
          res.setHeader("Content-Type", "text/markdown");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=services-export-${new Date().toISOString().split("T")[0]}.md`,
          );
          return res.send(
            "# Services Export\n\n| Node | Country | City | Service | Type | Status | Port | Version |\n|------|---------|------|---------|------|--------|------|---------|\n",
          );
        }
        return res.status(400).json({
          success: false,
          error: "Unsupported format. Use json, csv, or markdown",
        });
      }
      logger.error("Export services error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to export services",
      });
    }
  }

  /**
   * 触发节点服务重新扫描
   * POST /api/nodes/:nodeId/services/scan
   */
  static async triggerServiceScan(req: Request, res: Response) {
    try {
      const { nodeId } = req.params;

      const node = await prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return res.status(404).json({
          success: false,
          error: "Node not found",
        });
      }

      // 构建 Agent 控制 URL
      const agentBaseUrl = buildAgentBaseUrl(node);
      if (!agentBaseUrl) {
        return res.status(400).json({
          success: false,
          error: "Node is missing a reachable agent address",
        });
      }

      const agentControlApiKey = await apiKeyService.getSystemApiKey();

      if (!agentControlApiKey) {
        logger.error("Agent control API key is not configured on the server");
        return res.status(500).json({
          success: false,
          error: "Agent control API key is not configured",
        });
      }

      const axios = require("axios");
      const AGENT_CONTROL_TIMEOUT = parseInt(
        process.env.AGENT_CONTROL_TIMEOUT || "8000",
      );

      try {
        await axios.post(
          `${agentBaseUrl}/api/services/scan`,
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
      } catch (error: unknown) {
        logger.error(
          `Failed to trigger service scan on agent ${node.agentId} (${agentBaseUrl}):`,
          error,
        );

        const errorMessage =
          (error as { code?: string }).code === "ECONNREFUSED"
            ? "Agent is not reachable (connection refused)"
            : "Failed to contact agent for service scan";

        return res.status(502).json({
          success: false,
          error: errorMessage,
        });
      }

      const io = getIO();
      if (io) {
        io.emit("service-scan-started", { nodeId });
      }

      logger.info(
        `Triggered service scan for node ${nodeId} via agent ${node.agentId}`,
      );

      return res.json({
        success: true,
        message: "Service scan has been triggered on the agent",
        data: {
          nodeId,
          status: "pending",
        },
      });
    } catch (error) {
      if (isMissingServicesTableError(error)) {
        logger.warn(
          "Services table missing when triggering service scan, returning failure response.",
        );
        return res.status(503).json({
          success: false,
          error: "Service management is not available yet",
        });
      }
      logger.error("Trigger service scan error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to trigger service scan",
      });
    }
  }
}

// Helper function to build agent base URL
function buildAgentBaseUrl(node: {
  ipv4?: string | null;
  ipv6?: string | null;
}): string | null {
  const protocol = process.env.AGENT_CONTROL_PROTOCOL || "http";
  const port = process.env.AGENT_CONTROL_PORT || 3002;

  if (node.ipv4 && node.ipv4.trim().length > 0) {
    return `${protocol}://${node.ipv4}:${port}`;
  }
  if (node.ipv6 && node.ipv6.trim().length > 0) {
    return `${protocol}://[${node.ipv6}]:${port}`;
  }
  return null;
}

function isMissingServicesTableError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function extractPrimaryDomain(
  domains: Prisma.JsonValue | null,
): string | undefined {
  if (!domains) return undefined;

  if (Array.isArray(domains)) {
    const firstDomain = domains.find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    return firstDomain;
  }

  if (typeof domains === "string") {
    return domains.length > 0 ? domains : undefined;
  }

  return undefined;
}

function buildServiceAccess(service: {
  domains: Prisma.JsonValue | null;
  port: number | null;
  protocol: string | null;
  containerInfo: Prisma.JsonValue | null;
}):
  | {
      domain?: string;
      port?: number;
      protocol?: string;
      containerName?: string;
    }
  | undefined {
  const domain = extractPrimaryDomain(service.domains);

  let containerName: string | undefined;
  if (
    service.containerInfo &&
    typeof service.containerInfo === "object" &&
    !Array.isArray(service.containerInfo)
  ) {
    const info = service.containerInfo as Record<string, unknown>;
    const candidate = info.containerName ?? info.name;
    if (typeof candidate === "string" && candidate.length > 0) {
      containerName = candidate;
    }
  }

  const access = {
    domain,
    port: service.port ?? undefined,
    protocol: service.protocol ?? undefined,
    containerName,
  };

  if (
    access.domain === undefined &&
    access.port === undefined &&
    access.protocol === undefined &&
    access.containerName === undefined
  ) {
    return undefined;
  }

  return access;
}
