import { Prisma } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import os from "os";

export interface CreateNodeRequest {
  name: string;
  hostname?: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  ipv4?: string;
  ipv6?: string;
  provider: string;
  datacenter?: string;
  description?: string;
  tags?: string[];
  monthlyCost?: number | null;
}

export interface UpdateNodeRequest {
  name?: string;
  hostname?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  ipv4?: string;
  ipv6?: string;
  provider?: string;
  datacenter?: string;
  description?: string;
  tags?: string[];
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  monthlyCost?: number | null;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  name: string;
  password: string;
  role?: "ADMIN" | "OPERATOR" | "VIEWER";
  active?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  name?: string;
  avatar?: string;
  password?: string;
  role?: "ADMIN" | "OPERATOR" | "VIEWER";
  active?: boolean;
}

export class AdminController {
  // 节点管理
  async createNode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        hostname,
        country,
        city,
        latitude,
        longitude,
        ipv4,
        ipv6,
        provider,
        datacenter,
        description,
        tags,
        monthlyCost,
      }: CreateNodeRequest = req.body;

      if (
        !name ||
        !country ||
        !city ||
        latitude === undefined ||
        latitude === null ||
        longitude === undefined ||
        longitude === null ||
        !provider
      ) {
        const response: ApiResponse = {
          success: false,
          error:
            "Required fields: name, country, city, latitude, longitude, provider",
        };
        res.status(400).json(response);
        return;
      }

      // 生成唯一的Agent ID和API Key
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const apiKey = require("crypto").randomBytes(32).toString("hex");

      const node = await prisma.node.create({
        select: {
          id: true,
          name: true,
          hostname: true,
          country: true,
          city: true,
          latitude: true,
          longitude: true,
          ipv4: true,
          ipv6: true,
          provider: true,
          datacenter: true,
          monthlyCost: true,
          agentId: true,
          apiKey: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        data: {
          name,
          hostname,
          country,
          city,
          latitude,
          longitude,
          ipv4,
          ipv6,
          provider,
          datacenter,
          agentId,
          apiKey,
          description,
          tags: tags ? JSON.stringify(tags) : null,
          monthlyCost:
            monthlyCost === undefined || monthlyCost === null
              ? null
              : new Prisma.Decimal(monthlyCost),
          status: "OFFLINE",
        },
      });

      // Return node data without sensitive apiKey
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey: _, ...nodeWithoutApiKey } = node;

      const response: ApiResponse = {
        success: true,
        data: nodeWithoutApiKey,
        message: "Node created successfully",
      };

      logger.info(`Admin created node: ${name} by user: ${req.user?.username}`);
      res.status(201).json(response);
    } catch (error) {
      logger.error("Admin create node error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to create node",
      };
      res.status(500).json(response);
    }
  }

  async updateNode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateNodeRequest = req.body;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "Node ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 检查节点是否存在
      const existingNode = await prisma.node.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!existingNode) {
        const response: ApiResponse = {
          success: false,
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      // 处理tags数组
      const updateDataFormatted: Record<string, unknown> = {
        ...updateData,
        tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
      };

      if (updateData.monthlyCost !== undefined) {
        updateDataFormatted.monthlyCost =
          updateData.monthlyCost === null
            ? null
            : new Prisma.Decimal(updateData.monthlyCost);
      }

      // 如果名称被修改，标记为用户自定义
      if (updateData.name && updateData.name !== existingNode.name) {
        updateDataFormatted.nameCustomized = true;
      }

      const updatedNode = await prisma.node.update({
        where: { id },
        data: updateDataFormatted,
        select: {
          id: true,
          name: true,
          hostname: true,
          country: true,
          city: true,
          latitude: true,
          longitude: true,
          ipv4: true,
          ipv6: true,
          provider: true,
          datacenter: true,
          monthlyCost: true,
          agentId: true,
          apiKey: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Return node data without sensitive apiKey
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey: _, ...nodeWithoutApiKey } = updatedNode;

      const response: ApiResponse = {
        success: true,
        data: nodeWithoutApiKey,
        message: "Node updated successfully",
      };

      logger.info(`Admin updated node: ${id} by user: ${req.user?.username}`);
      res.json(response);
    } catch (error) {
      logger.error("Admin update node error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to update node",
      };
      res.status(500).json(response);
    }
  }

  // View API Key for a node (one-time secure access)
  async viewNodeApiKey(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "Node ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // Check if node exists and get API key
      const node = await prisma.node.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          apiKey: true,
        },
      });

      if (!node) {
        const response: ApiResponse = {
          success: false,
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          apiKey: node.apiKey,
        },
        message: "API Key retrieved successfully",
      };

      // Log this sensitive operation for auditing
      logger.warn(
        `Admin viewed API key for node: ${node.name} (${id}) by user: ${req.user?.username}`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Admin view node API key error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to retrieve API key",
      };
      res.status(500).json(response);
    }
  }

  async deleteNode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "Node ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 检查节点是否存在
      const existingNode = await prisma.node.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!existingNode) {
        const response: ApiResponse = {
          success: false,
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      // 删除相关的诊断记录和心跳日志
      await prisma.$transaction(async (tx) => {
        await tx.diagnosticRecord.deleteMany({
          where: { nodeId: id },
        });
        await tx.heartbeatLog.deleteMany({
          where: { nodeId: id },
        });
        await tx.node.delete({
          where: { id },
          select: { id: true },
        });
      });

      const response: ApiResponse = {
        success: true,
        message: "Node deleted successfully",
      };

      logger.info(
        `Admin deleted node: ${existingNode.name} by user: ${req.user?.username}`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Admin delete node error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to delete node",
      };
      res.status(500).json(response);
    }
  }

  // 批量导入占位节点（未安装Agent的VPS资产）
  async importPlaceholderNodes(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const payload = req.body;
      const items: Array<{
        ip: string;
        name?: string;
        notes?: string;
        tags?: string[];
        neverAdopt?: boolean;
      }> = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: "items is required (non-empty array)",
        };
        res.status(400).json(response);
        return;
      }

      // 基础IP格式过滤（简单校验）
      const filtered = items.filter(
        (it) => typeof it.ip === "string" && it.ip.trim().length > 0,
      );
      if (filtered.length === 0) {
        res.status(400).json({ success: false, error: "No valid ip in items" });
        return;
      }

      const { nodeService } = await import("../services/NodeService");
      let result;
      try {
        result = await nodeService.createPlaceholdersFromIPs(filtered);
      } catch (e: unknown) {
        const error = e as { message?: string };
        const msg = error && error.message ? String(error.message) : "";
        if (msg.includes("Placeholder feature not available")) {
          res.status(501).json({
            success: false,
            error:
              "Placeholder feature not available: please apply database migrations (prisma migrate deploy) and retry.",
          });
          return;
        }
        throw e;
      }
      const response: ApiResponse = {
        success: true,
        data: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          total: filtered.length,
        },
        message: `Placeholders imported: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`,
      };
      logger.info(
        `Admin imported placeholder nodes by ${req.user?.username}: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`,
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error("Admin import placeholder nodes error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to import placeholder nodes",
      };
      res.status(500).json(response);
    }
  }

  // 用户管理
  async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true,
          lastLogin: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const response: ApiResponse = {
        success: true,
        data: users,
        message: `Found ${users.length} users`,
      };

      res.json(response);
    } catch (error) {
      logger.error("Admin get users error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get users",
      };
      res.status(500).json(response);
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        username,
        email,
        name,
        password,
        role = "VIEWER",
        active = true,
      }: CreateUserRequest = req.body;

      if (!username || !email || !name || !password) {
        const response: ApiResponse = {
          success: false,
          error: "Required fields: username, email, name, password",
        };
        res.status(400).json(response);
        return;
      }

      if (password.length < 6) {
        const response: ApiResponse = {
          success: false,
          error: "Password must be at least 6 characters long",
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户名和邮箱是否已存在
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
        },
      });

      if (existingUser) {
        const response: ApiResponse = {
          success: false,
          error: "Username or email already exists",
        };
        res.status(400).json(response);
        return;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          name,
          password: hashedPassword,
          role,
          active,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true,
        },
      });

      const response: ApiResponse = {
        success: true,
        data: user,
        message: "User created successfully",
      };

      logger.info(
        `Admin created user: ${username} by user: ${req.user?.username}`,
      );
      res.status(201).json(response);
    } catch (error) {
      logger.error("Admin create user error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to create user",
      };
      res.status(500).json(response);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateUserRequest = req.body;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "User ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      // 如果更新用户名或邮箱，检查是否冲突
      if (updateData.username || updateData.email) {
        const conflictUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  updateData.username ? { username: updateData.username } : {},
                  updateData.email ? { email: updateData.email } : {},
                ].filter((obj) => Object.keys(obj).length > 0),
              },
            ],
          },
        });

        if (conflictUser) {
          const response: ApiResponse = {
            success: false,
            error: "Username or email already exists",
          };
          res.status(400).json(response);
          return;
        }
      }

      // 准备更新数据
      const dataToUpdate: Record<string, unknown> = { ...updateData };

      // 如果包含密码，需要加密
      if (updateData.password) {
        if (updateData.password.length < 6) {
          const response: ApiResponse = {
            success: false,
            error: "Password must be at least 6 characters long",
          };
          res.status(400).json(response);
          return;
        }
        dataToUpdate.password = await bcrypt.hash(updateData.password, 12);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: dataToUpdate,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true,
          lastLogin: true,
        },
      });

      const response: ApiResponse = {
        success: true,
        data: updatedUser,
        message: "User updated successfully",
      };

      logger.info(`Admin updated user: ${id} by user: ${req.user?.username}`);
      res.json(response);
    } catch (error) {
      logger.error("Admin update user error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to update user",
      };
      res.status(500).json(response);
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "User ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      // 防止删除自己
      if (req.user?.userId === id) {
        const response: ApiResponse = {
          success: false,
          error: "Cannot delete your own account",
        };
        res.status(400).json(response);
        return;
      }

      await prisma.user.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: "User deleted successfully",
      };

      logger.info(
        `Admin deleted user: ${existingUser.username} by user: ${req.user?.username}`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Admin delete user error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to delete user",
      };
      res.status(500).json(response);
    }
  }

  // 系统统计信息
  async getSystemStats(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const [nodeStats, userStats, diagnosticStats, heartbeatStats] =
        await Promise.all([
          prisma.node.groupBy({
            by: ["status"],
            _count: { status: true },
          }),
          prisma.user.groupBy({
            by: ["role"],
            _count: { role: true },
          }),
          prisma.diagnosticRecord.count(),
          prisma.heartbeatLog.count(),
        ]);

      // 处理节点统计
      const nodeStatsMap = nodeStats.reduce(
        (acc, stat) => {
          acc[stat.status.toLowerCase()] = stat._count.status;
          return acc;
        },
        {} as Record<string, number>,
      );

      // 处理用户统计
      const userStatsMap = userStats.reduce(
        (acc, stat) => {
          acc[stat.role.toLowerCase()] = stat._count.role;
          return acc;
        },
        {} as Record<string, number>,
      );

      // 获取最近活动
      const recentActivity = await prisma.heartbeatLog.findMany({
        take: 10,
        orderBy: { timestamp: "desc" },
        include: {
          node: {
            select: { name: true, country: true, city: true },
          },
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          nodes: {
            total: Object.values(nodeStatsMap).reduce((a, b) => a + b, 0),
            online: nodeStatsMap.online || 0,
            offline: nodeStatsMap.offline || 0,
          },
          users: {
            total: Object.values(userStatsMap).reduce((a, b) => a + b, 0),
            admins: userStatsMap.admin || 0,
            operators: userStatsMap.operator || 0,
            viewers: userStatsMap.viewer || 0,
          },
          diagnostics: {
            totalRecords: diagnosticStats,
          },
          heartbeats: {
            totalLogs: heartbeatStats,
          },
          recentActivity: recentActivity.map((activity) => ({
            nodeId: activity.nodeId,
            nodeName: activity.node.name,
            location: `${activity.node.city}, ${activity.node.country}`,
            status: activity.status,
            timestamp: activity.timestamp,
          })),
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Admin get system stats error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get system statistics",
      };
      res.status(500).json(response);
    }
  }

  async getSystemOverview(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 并行查询所有统计数据
      const [nodeStats, heartbeatTotal, heartbeat24h] = await Promise.all([
        // 节点统计 (复用现有逻辑)
        this.getNodeStats(),

        // 心跳统计
        prisma.heartbeatLog.count(),
        prisma.heartbeatLog.count({
          where: { timestamp: { gte: twentyFourHoursAgo } },
        }),
      ]);

      // 计算平均心跳频率
      const avgPerHour = heartbeat24h > 0 ? Math.round(heartbeat24h / 24) : 0;

      // 系统信息
      const startTime = process.uptime(); // 后端进程运行时间（秒）

      // 获取系统资源使用情况（真实系统内存，而非 Node.js 进程堆内存）
      const memTotalBytes = os.totalmem();
      const memFreeBytes = os.freemem();
      const memUsedBytes = memTotalBytes - memFreeBytes;

      const memUsedMB = Math.round(memUsedBytes / 1024 / 1024);
      const memTotalMB = Math.round(memTotalBytes / 1024 / 1024);
      const memUsagePercent = Math.round((memUsedBytes / memTotalBytes) * 100);

      // CPU使用率 (简化实现，使用进程CPU时间)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = Math.min(
        100,
        Math.round(
          ((cpuUsage.user + cpuUsage.system) / 1000000 / startTime) * 100,
        ),
      );

      // 数据库实例运行时间（更能代表系统整体持续运行时长，不受后端重启影响）
      let dbUptimeSec = 0;
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ seconds: unknown }>>(
          "SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) AS seconds",
        );
        const sec = rows && rows[0] && rows[0].seconds;
        dbUptimeSec = Math.max(
          0,
          Math.floor(typeof sec === "string" ? parseFloat(sec) : Number(sec)),
        );
      } catch {
        // 忽略错误，回退为0
      }
      const version = process.env.APP_VERSION || "0.1.0";
      const environment = process.env.NODE_ENV || "development";

      const response: ApiResponse = {
        success: true,
        data: {
          nodes: nodeStats,
          heartbeats: {
            total: heartbeatTotal,
            last24h: heartbeat24h,
            avgPerHour: avgPerHour,
          },
          resources: {
            memoryUsedMB: memUsedMB,
            memoryTotalMB: memTotalMB,
            memoryPercent: memUsagePercent,
            cpuPercent: cpuPercent,
          },
          system: {
            uptime: Math.floor(startTime),
            dbUptime: dbUptimeSec,
            version: version,
            environment: environment,
          },
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Admin get system overview error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get system overview",
      };
      res.status(500).json(response);
    }
  }

  private async getNodeStats() {
    // 复用现有的节点统计逻辑
    const [totalNodes, onlineNodes, offlineNodes] = await Promise.all([
      prisma.node.count(),
      prisma.node.count({ where: { status: "ONLINE" } }),
      prisma.node.count({ where: { status: "OFFLINE" } }),
    ]);

    const [totalCountries, totalProviders] = await Promise.all([
      prisma.node
        .groupBy({
          by: ["country"],
          _count: { country: true },
        })
        .then((result) => result.length),
      prisma.node
        .groupBy({
          by: ["provider"],
          _count: { provider: true },
        })
        .then((result) => result.length),
    ]);

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalCountries,
      totalProviders,
    };
  }
}

export const adminController = new AdminController();
