import { prisma } from '../lib/prisma';
import { Node, NodeStatus, DiagnosticType, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface CreateNodeInput {
  name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  provider: string;
  ipv4?: string;
  ipv6?: string;
  hostname?: string;
  datacenter?: string;
  tags?: string;
  description?: string;
  osType?: string;
  osVersion?: string;
}

export interface UpdateNodeInput {
  name?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  ipv4?: string;
  ipv6?: string;
  hostname?: string;
  datacenter?: string;
  tags?: string;
  description?: string;
  osType?: string;
  osVersion?: string;
  status?: NodeStatus;
}

export interface NodeWithStats extends Node {
  _count: {
    diagnosticRecords: number;
    heartbeatLogs: number;
  };
  lastHeartbeat?: {
    timestamp: Date;
    status: string;
    uptime: number | null;
  };
}

export class NodeService {
  
  // 创建新节点
  async createNode(input: CreateNodeInput): Promise<Node> {
    try {
      // 生成唯一的agentId和apiKey
      const agentId = crypto.randomUUID();
      const apiKey = crypto.randomBytes(32).toString('hex');

      const node = await prisma.node.create({
        data: {
          ...input,
          agentId,
          apiKey,
          status: NodeStatus.UNKNOWN
        }
      });

      logger.info(`Node created: ${node.name} (${node.id})`);
      return node;
    } catch (error) {
      logger.error('Failed to create node:', error);
      throw new Error('Failed to create node');
    }
  }

  // 获取所有节点
  async getAllNodes(): Promise<NodeWithStats[]> {
    try {
      const nodes = await prisma.node.findMany({
        include: {
          _count: {
            select: {
              diagnosticRecords: true,
              heartbeatLogs: true
            }
          },
          heartbeatLogs: {
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // 转换数据格式以匹配NodeWithStats接口
      return nodes.map(node => ({
        ...node,
        lastHeartbeat: node.heartbeatLogs[0] ? {
          timestamp: node.heartbeatLogs[0].timestamp,
          status: node.heartbeatLogs[0].status,
          uptime: node.heartbeatLogs[0].uptime
        } : undefined,
        heartbeatLogs: undefined // 移除原始heartbeatLogs数组
      })) as NodeWithStats[];
    } catch (error) {
      logger.error('Failed to fetch nodes:', error);
      throw new Error('Failed to fetch nodes');
    }
  }

  // 根据ID获取节点
  async getNodeById(id: string): Promise<Node | null> {
    try {
      return await prisma.node.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to fetch node ${id}:`, error);
      throw new Error('Failed to fetch node');
    }
  }

  // 根据agentId获取节点
  async getNodeByAgentId(agentId: string): Promise<Node | null> {
    try {
      return await prisma.node.findUnique({
        where: { agentId }
      });
    } catch (error) {
      logger.error(`Failed to fetch node by agentId ${agentId}:`, error);
      throw new Error('Failed to fetch node');
    }
  }

  // 更新节点信息
  async updateNode(id: string, input: UpdateNodeInput): Promise<Node> {
    try {
      const node = await prisma.node.update({
        where: { id },
        data: {
          ...input,
          updatedAt: new Date()
        }
      });

      logger.info(`Node updated: ${node.name} (${node.id})`);
      return node;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to update node ${id}:`, error);
      throw new Error('Failed to update node');
    }
  }

  // 删除节点
  async deleteNode(id: string): Promise<void> {
    try {
      await prisma.node.delete({
        where: { id }
      });
      logger.info(`Node deleted: ${id}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to delete node ${id}:`, error);
      throw new Error('Failed to delete node');
    }
  }

  // 更新节点状态
  async updateNodeStatus(agentId: string, status: NodeStatus): Promise<Node> {
    try {
      const node = await prisma.node.update({
        where: { agentId },
        data: {
          status,
          lastSeen: new Date()
        }
      });

      logger.debug(`Node status updated: ${node.name} -> ${status}`);
      return node;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to update node status ${agentId}:`, error);
      throw new Error('Failed to update node status');
    }
  }

  // 记录心跳
  async recordHeartbeat(agentId: string, heartbeatData: {
    status: string;
    uptime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    connectivity?: any;
  }): Promise<void> {
    try {
      // 首先更新节点状态
      await this.updateNodeStatus(agentId, NodeStatus.ONLINE);

      // 记录心跳日志
      await prisma.heartbeatLog.create({
        data: {
          node: {
            connect: { agentId }
          },
          ...heartbeatData,
          timestamp: new Date()
        }
      });

      logger.debug(`Heartbeat recorded for agent: ${agentId}`);
    } catch (error) {
      logger.error(`Failed to record heartbeat for ${agentId}:`, error);
      throw new Error('Failed to record heartbeat');
    }
  }

  // 记录诊断结果
  async recordDiagnostic(agentId: string, diagnosticData: {
    type: DiagnosticType;
    target?: string;
    success: boolean;
    result: any;
    error?: string;
    duration?: number;
  }): Promise<void> {
    try {
      await prisma.diagnosticRecord.create({
        data: {
          node: {
            connect: { agentId }
          },
          type: diagnosticData.type,
          target: diagnosticData.target,
          success: diagnosticData.success,
          result: JSON.stringify(diagnosticData.result),
          error: diagnosticData.error,
          duration: diagnosticData.duration,
          timestamp: new Date()
        }
      });

      logger.debug(`Diagnostic recorded for agent: ${agentId}, type: ${diagnosticData.type}`);
    } catch (error) {
      logger.error(`Failed to record diagnostic for ${agentId}:`, error);
      throw new Error('Failed to record diagnostic');
    }
  }

  // 获取节点统计信息
  async getNodeStats(): Promise<{
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    unknownNodes: number;
    totalCountries: number;
    totalProviders: number;
  }> {
    try {
      const [
        totalNodes,
        statusCounts,
        countries,
        providers
      ] = await Promise.all([
        prisma.node.count(),
        prisma.node.groupBy({
          by: ['status'],
          _count: true
        }),
        prisma.node.findMany({
          distinct: ['country'],
          select: { country: true }
        }),
        prisma.node.findMany({
          distinct: ['provider'],
          select: { provider: true }
        })
      ]);

      const statusMap = statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalNodes,
        onlineNodes: statusMap[NodeStatus.ONLINE] || 0,
        offlineNodes: statusMap[NodeStatus.OFFLINE] || 0,
        unknownNodes: statusMap[NodeStatus.UNKNOWN] || 0,
        totalCountries: countries.length,
        totalProviders: providers.length
      };
    } catch (error) {
      logger.error('Failed to fetch node stats:', error);
      throw new Error('Failed to fetch node stats');
    }
  }

  // 获取节点的诊断历史
  async getNodeDiagnostics(nodeId: string, type?: DiagnosticType, limit = 100): Promise<any[]> {
    try {
      const whereClause: any = { nodeId };
      if (type) {
        whereClause.type = type;
      }

      return await prisma.diagnosticRecord.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          target: true,
          success: true,
          result: true,
          error: true,
          duration: true,
          timestamp: true
        }
      });
    } catch (error) {
      logger.error(`Failed to fetch diagnostics for node ${nodeId}:`, error);
      throw new Error('Failed to fetch node diagnostics');
    }
  }

  // 清理旧的心跳和诊断记录
  async cleanupOldRecords(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const [deletedHeartbeats, deletedDiagnostics] = await Promise.all([
        prisma.heartbeatLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        }),
        prisma.diagnosticRecord.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        })
      ]);

      logger.info(`Cleaned up old records: ${deletedHeartbeats.count} heartbeats, ${deletedDiagnostics.count} diagnostics`);
    } catch (error) {
      logger.error('Failed to cleanup old records:', error);
    }
  }

  // 静态方法：计算节点统计信息
  static calculateStats(nodes: Node[]): {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalCountries: number;
    totalProviders: number;
  } {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(node => node.status === NodeStatus.ONLINE).length;
    const offlineNodes = totalNodes - onlineNodes;
    const countries = new Set(nodes.map(node => node.country));
    const providers = new Set(nodes.map(node => node.provider));

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalCountries: countries.size,
      totalProviders: providers.size
    };
  }
}

export const nodeService = new NodeService();