import { Request, Response } from "express";
import { Prisma, ServiceType, ServiceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

/**
 * 服务总览API控制器
 */
export class ServicesController {
  /**
   * 获取服务总览统计
   * GET /api/services/overview
   */
  static async getServicesOverview(req: Request, res: Response) {
    try {
      // 获取所有服务
      const allServices = await prisma.detectedService.findMany({
        include: {
          node: {
            select: {
              status: true,
            },
          },
        },
      });

      // 只统计在线节点的服务
      const activeServices = allServices.filter(
        (s) => s.node.status === "ONLINE",
      );

      // 统计在线节点数
      const totalNodes = await prisma.node.count({
        where: { status: "ONLINE" },
      });

      // 统计各类型服务数量
      const serviceTypes = Object.values(ServiceType);
      const serviceTypeDistribution = serviceTypes.map((type) => ({
        type: type.toLowerCase(),
        count: activeServices.filter((s) => s.serviceType === type).length,
      }));

      // 统计各状态服务数量
      const runningCount = activeServices.filter(
        (s) => s.status === "RUNNING",
      ).length;
      const stoppedCount = activeServices.filter(
        (s) => s.status === "STOPPED",
      ).length;
      const failedCount = activeServices.filter(
        (s) => s.status === "UNKNOWN",
      ).length;

      return res.json({
        success: true,
        data: {
          totalNodes,
          totalServices: activeServices.length,
          runningServices: runningCount,
          stoppedServices: stoppedCount,
          failedServices: failedCount,
          serviceTypeDistribution,
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
        const serviceTypes = Object.values(ServiceType).map((type) => ({
          type: type.toLowerCase(),
          count: 0,
        }));
        return res.json({
          success: true,
          data: {
            totalNodes,
            totalServices: 0,
            runningServices: 0,
            stoppedServices: 0,
            failedServices: 0,
            serviceTypeDistribution: serviceTypes,
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
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      // 转换为前端期望的格式
      const formattedServices = services.map((service) => ({
        id: service.id,
        nodeId: service.nodeId,
        nodeName: service.node.name,
        name: service.serviceName,
        type: service.serviceType.toLowerCase(),
        status: service.status.toLowerCase(),
        deploymentType: "unknown", // DetectedService 没有此字段，暂时返回 unknown
        port: service.port,
        protocol: service.protocol,
        version: service.version,
        domains: service.domains,
        sslEnabled: service.sslEnabled,
        configPath: service.configPath,
        containerInfo: service.containerInfo,
        details: service.details,
        lastUpdated: service.updatedAt.toISOString(),
        createdAt: service.detectedAt.toISOString(),
      }));

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

      // 为每个节点构建服务摘要
      const nodeServicesOverview = nodes.map((node) => {
        const services = node.detectedServices.map((service) => ({
          id: service.id,
          name: service.serviceName,
          type: service.serviceType.toLowerCase(),
          status: service.status.toLowerCase(),
          port: service.port,
          version: service.version,
          lastUpdated: service.updatedAt.toISOString(),
        }));

        const runningCount = services.filter(
          (s) => s.status === "running",
        ).length;
        const stoppedCount = services.filter(
          (s) => s.status === "stopped",
        ).length;
        const failedCount = services.filter(
          (s) => s.status === "unknown",
        ).length;

        return {
          nodeId: node.id,
          nodeName: node.name,
          country: node.country,
          city: node.city,
          services,
          totalServices: services.length,
          runningServices: runningCount,
          stoppedServices: stoppedCount,
          failedServices: failedCount,
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
    try {
      const { format = "json", nodeId, serviceType, status } = req.query;

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
}

function isMissingServicesTableError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}
