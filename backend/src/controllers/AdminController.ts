import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

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
  status?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

export interface CreateUserRequest {
  username: string;
  email: string;
  name: string;
  password: string;
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  active?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
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
        tags
      }: CreateNodeRequest = req.body;

      if (!name || !country || !city || !latitude || !longitude || !provider) {
        const response: ApiResponse = {
          success: false,
          error: 'Required fields: name, country, city, latitude, longitude, provider'
        };
        res.status(400).json(response);
        return;
      }

      // 生成唯一的Agent ID和API Key
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const apiKey = require('crypto').randomBytes(32).toString('hex');

      const node = await prisma.node.create({
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
          status: 'UNKNOWN'
        }
      });

      const response: ApiResponse = {
        success: true,
        data: node,
        message: 'Node created successfully'
      };

      logger.info(`Admin created node: ${name} by user: ${req.user?.username}`);
      res.status(201).json(response);

    } catch (error) {
      logger.error('Admin create node error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to create node'
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
          error: 'Node ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 检查节点是否存在
      const existingNode = await prisma.node.findUnique({
        where: { id }
      });

      if (!existingNode) {
        const response: ApiResponse = {
          success: false,
          error: 'Node not found'
        };
        res.status(404).json(response);
        return;
      }

      // 处理tags数组
      const updateDataFormatted = {
        ...updateData,
        tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined
      };

      const updatedNode = await prisma.node.update({
        where: { id },
        data: updateDataFormatted
      });

      const response: ApiResponse = {
        success: true,
        data: updatedNode,
        message: 'Node updated successfully'
      };

      logger.info(`Admin updated node: ${id} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Admin update node error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update node'
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
          error: 'Node ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 检查节点是否存在
      const existingNode = await prisma.node.findUnique({
        where: { id }
      });

      if (!existingNode) {
        const response: ApiResponse = {
          success: false,
          error: 'Node not found'
        };
        res.status(404).json(response);
        return;
      }

      // 删除相关的诊断记录和心跳日志
      await prisma.$transaction(async (tx) => {
        await tx.diagnosticRecord.deleteMany({
          where: { nodeId: id }
        });
        await tx.heartbeatLog.deleteMany({
          where: { nodeId: id }
        });
        await tx.node.delete({
          where: { id }
        });
      });

      const response: ApiResponse = {
        success: true,
        message: 'Node deleted successfully'
      };

      logger.info(`Admin deleted node: ${existingNode.name} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Admin delete node error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete node'
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
          lastLogin: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const response: ApiResponse = {
        success: true,
        data: users,
        message: `Found ${users.length} users`
      };

      res.json(response);

    } catch (error) {
      logger.error('Admin get users error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get users'
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
        role = 'VIEWER',
        active = true
      }: CreateUserRequest = req.body;

      if (!username || !email || !name || !password) {
        const response: ApiResponse = {
          success: false,
          error: 'Required fields: username, email, name, password'
        };
        res.status(400).json(response);
        return;
      }

      if (password.length < 6) {
        const response: ApiResponse = {
          success: false,
          error: 'Password must be at least 6 characters long'
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户名和邮箱是否已存在
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email }
          ]
        }
      });

      if (existingUser) {
        const response: ApiResponse = {
          success: false,
          error: 'Username or email already exists'
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
          active
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true
        }
      });

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'User created successfully'
      };

      logger.info(`Admin created user: ${username} by user: ${req.user?.username}`);
      res.status(201).json(response);

    } catch (error) {
      logger.error('Admin create user error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to create user'
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
          error: 'User ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
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
                  updateData.email ? { email: updateData.email } : {}
                ].filter(obj => Object.keys(obj).length > 0)
              }
            ]
          }
        });

        if (conflictUser) {
          const response: ApiResponse = {
            success: false,
            error: 'Username or email already exists'
          };
          res.status(400).json(response);
          return;
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true,
          lastLogin: true
        }
      });

      const response: ApiResponse = {
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      };

      logger.info(`Admin updated user: ${id} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Admin update user error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update user'
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
          error: 'User ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
        };
        res.status(404).json(response);
        return;
      }

      // 防止删除自己
      if (req.user?.userId === id) {
        const response: ApiResponse = {
          success: false,
          error: 'Cannot delete your own account'
        };
        res.status(400).json(response);
        return;
      }

      await prisma.user.delete({
        where: { id }
      });

      const response: ApiResponse = {
        success: true,
        message: 'User deleted successfully'
      };

      logger.info(`Admin deleted user: ${existingUser.username} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Admin delete user error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete user'
      };
      res.status(500).json(response);
    }
  }

  // 系统统计信息
  async getSystemStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [
        nodeStats,
        userStats,
        diagnosticStats,
        heartbeatStats
      ] = await Promise.all([
        prisma.node.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        }),
        prisma.diagnosticRecord.count(),
        prisma.heartbeatLog.count()
      ]);

      // 处理节点统计
      const nodeStatsMap = nodeStats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);

      // 处理用户统计
      const userStatsMap = userStats.reduce((acc, stat) => {
        acc[stat.role.toLowerCase()] = stat._count.role;
        return acc;
      }, {} as Record<string, number>);

      // 获取最近活动
      const recentActivity = await prisma.heartbeatLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          node: {
            select: { name: true, country: true, city: true }
          }
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          nodes: {
            total: Object.values(nodeStatsMap).reduce((a, b) => a + b, 0),
            online: nodeStatsMap.online || 0,
            offline: nodeStatsMap.offline || 0,
            unknown: nodeStatsMap.unknown || 0
          },
          users: {
            total: Object.values(userStatsMap).reduce((a, b) => a + b, 0),
            admins: userStatsMap.admin || 0,
            operators: userStatsMap.operator || 0,
            viewers: userStatsMap.viewer || 0
          },
          diagnostics: {
            totalRecords: diagnosticStats
          },
          heartbeats: {
            totalLogs: heartbeatStats
          },
          recentActivity: recentActivity.map(activity => ({
            nodeId: activity.nodeId,
            nodeName: activity.node.name,
            location: `${activity.node.city}, ${activity.node.country}`,
            status: activity.status,
            timestamp: activity.timestamp
          }))
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Admin get system stats error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get system statistics'
      };
      res.status(500).json(response);
    }
  }
}

export const adminController = new AdminController();