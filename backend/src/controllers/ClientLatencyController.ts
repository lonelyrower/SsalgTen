import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { nodeService } from '../services/NodeService';
import { getIO } from '../sockets/ioRegistry';

interface ClientLatencyData {
  nodeId: string;
  nodeName: string;
  location: string;
  country: string;
  city: string;
  ipv4?: string;
  latency: number | null;
  status: 'testing' | 'success' | 'failed' | 'timeout';
  lastTested: string;
  error?: string;
}

interface LatencyStats {
  average: number;
  min: number;
  max: number;
  tested: number;
  total: number;
  distribution: { range: string; count: number }[];
  bestNodes: ClientLatencyData[];
}

export class ClientLatencyController {
  // 存储延迟测试结果的内存缓存
  private latencyCache = new Map<string, ClientLatencyData[]>();
  private testTimeouts = new Map<string, NodeJS.Timeout>();

  // 获取客户端IP地址
  private getClientIP(req: Request): string {
    // 优先从代理头获取真实IP
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    const cfConnectingIP = req.headers['cf-connecting-ip'] as string; // Cloudflare
    
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) {
      // x-forwarded-for 可能包含多个IP，取第一个
      return forwarded.split(',')[0].trim();
    }
    
    return req.connection.remoteAddress || req.socket.remoteAddress || 
           (req.connection as any).socket?.remoteAddress || '127.0.0.1';
  }

  // 启动延迟测试
  async startLatencyTest(req: Request, res: Response): Promise<void> {
    try {
      const clientIP = this.getClientIP(req);
      logger.info(`Starting latency test for client IP: ${clientIP}`);

      // 获取所有在线节点
      const nodes = await nodeService.getAllNodes();
      const onlineNodes = nodes.filter(node => node.status === 'ONLINE');

      if (onlineNodes.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'No online nodes available for testing',
          data: { clientIP, nodeCount: 0 }
        };
        res.json(response);
        return;
      }

      // 初始化测试结果
      const testResults: ClientLatencyData[] = onlineNodes.map(node => ({
        nodeId: node.id,
        nodeName: node.name,
        location: `${node.city}, ${node.country}`,
        country: node.country,
        city: node.city,
        ipv4: node.ipv4 || undefined,
        latency: null,
        status: 'testing' as const,
        lastTested: new Date().toISOString()
      }));

      // 缓存测试结果
      this.latencyCache.set(clientIP, testResults);

      // 清除之前的超时器
      const existingTimeout = this.testTimeouts.get(clientIP);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // 设置总体超时（30秒）
      const timeout = setTimeout(() => {
        this.handleTestTimeout(clientIP);
      }, 30000);
      this.testTimeouts.set(clientIP, timeout);

      // 通过Socket.IO向节点发送ping测试请求
      const testPromises = onlineNodes.map(async (node) => {
        try {
          await this.requestNodePing(node.id, clientIP);
          logger.info(`Ping request sent to node ${node.name} (${node.id}) for IP ${clientIP}`);
        } catch (error) {
          logger.error(`Failed to send ping request to node ${node.id}:`, error);
          this.updateNodeLatency(clientIP, node.id, null, 'failed', `Failed to send request: ${error}`);
        }
      });

      // 等待所有请求发送完成（不等待响应）
      await Promise.allSettled(testPromises);

      const response: ApiResponse = {
        success: true,
        message: `Latency test started for ${onlineNodes.length} nodes`,
        data: {
          clientIP,
          nodeCount: onlineNodes.length,
          testId: clientIP,
          estimatedDuration: '15-30 seconds'
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Start latency test error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Failed to start latency test',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // 获取延迟测试结果
  async getLatencyResults(req: Request, res: Response): Promise<void> {
    try {
      const clientIP = this.getClientIP(req);
      const testResults = this.latencyCache.get(clientIP);

      if (!testResults) {
        const response: ApiResponse = {
          success: false,
          message: 'No latency test found for this client',
          data: { clientIP }
        };
        res.json(response);
        return;
      }

      // 计算统计数据
      const stats = this.calculateStats(testResults);

      const response: ApiResponse = {
        success: true,
        message: `Latency results for ${testResults.length} nodes`,
        data: {
          clientIP,
          results: testResults,
          stats,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Get latency results error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get latency results',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // 通过Socket.IO请求节点执行ping测试
  private async requestNodePing(nodeId: string, targetIP: string): Promise<void> {
    const io = getIO();
    if (!io) {
      throw new Error('Socket.IO not initialized');
    }

    const message = {
      type: 'ping_request',
      data: {
        targetIP,
        count: 4, // ping 4次取平均值
        timeout: 10000 // 10秒超时
      }
    };

    // 通过Socket.IO发送给特定节点房间
    io.to(`node_${nodeId}`).emit('ping_request', message);
    logger.info(`Sent ping request to node ${nodeId} for IP ${targetIP}`);
  }

  // 更新节点延迟结果
  updateNodeLatency(clientIP: string, nodeId: string, latency: number | null, status: ClientLatencyData['status'], error?: string): void {
    const testResults = this.latencyCache.get(clientIP);
    if (!testResults) return;

    const nodeIndex = testResults.findIndex(result => result.nodeId === nodeId);
    if (nodeIndex === -1) return;

    testResults[nodeIndex] = {
      ...testResults[nodeIndex],
      latency,
      status,
      lastTested: new Date().toISOString(),
      error
    };

    this.latencyCache.set(clientIP, testResults);

    // 检查是否所有测试都完成了
    const allCompleted = testResults.every(result => 
      result.status === 'success' || result.status === 'failed' || result.status === 'timeout'
    );

    if (allCompleted) {
      const timeout = this.testTimeouts.get(clientIP);
      if (timeout) {
        clearTimeout(timeout);
        this.testTimeouts.delete(clientIP);
      }
    }

    logger.info(`Updated latency for node ${nodeId}, client ${clientIP}: ${latency}ms (${status})`);
  }

  // 处理测试超时
  private handleTestTimeout(clientIP: string): void {
    const testResults = this.latencyCache.get(clientIP);
    if (!testResults) return;

    // 将所有仍在测试中的节点标记为超时
    testResults.forEach(result => {
      if (result.status === 'testing') {
        result.status = 'timeout';
        result.lastTested = new Date().toISOString();
        result.error = 'Test timeout after 30 seconds';
      }
    });

    this.latencyCache.set(clientIP, testResults);
    this.testTimeouts.delete(clientIP);
    logger.warn(`Latency test timeout for client ${clientIP}`);
  }

  // 计算统计数据
  private calculateStats(results: ClientLatencyData[]): LatencyStats {
    const successfulResults = results.filter(r => r.status === 'success' && r.latency !== null);
    const latencies = successfulResults.map(r => r.latency!);

    if (latencies.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        tested: results.length,
        total: results.length,
        distribution: [],
        bestNodes: []
      };
    }

    const average = Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length);
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);

    // 延迟分布统计
    const distribution = [
      { range: '<50ms', count: latencies.filter(l => l < 50).length },
      { range: '50-100ms', count: latencies.filter(l => l >= 50 && l < 100).length },
      { range: '100-200ms', count: latencies.filter(l => l >= 100 && l < 200).length },
      { range: '200ms+', count: latencies.filter(l => l >= 200).length }
    ];

    // 最佳节点（延迟最低的前3个）
    const bestNodes = successfulResults
      .sort((a, b) => a.latency! - b.latency!)
      .slice(0, 3);

    return {
      average,
      min,
      max,
      tested: results.filter(r => r.status !== 'testing').length,
      total: results.length,
      distribution,
      bestNodes
    };
  }

  // 清理过期的缓存数据（可以通过定时任务调用）
  cleanupExpiredCache(maxAgeHours: number = 1): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [clientIP, results] of this.latencyCache.entries()) {
      const lastTested = new Date(results[0]?.lastTested || 0);
      if (lastTested < cutoffTime) {
        this.latencyCache.delete(clientIP);
        const timeout = this.testTimeouts.get(clientIP);
        if (timeout) {
          clearTimeout(timeout);
          this.testTimeouts.delete(clientIP);
        }
        logger.info(`Cleaned up expired latency cache for client ${clientIP}`);
      }
    }
  }
}

export const clientLatencyController = new ClientLatencyController();