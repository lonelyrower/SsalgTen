import { Request, Response } from 'express';
import { PrismaClient, StreamingService, StreamingStatus, UnlockType } from '@prisma/client';
import { getIO } from '../sockets/ioRegistry';
import { notifyStreamingTestStart, broadcastStreamingTestResult } from '../sockets/socketHandlers';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

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
          error: 'Node not found',
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
              testedAt: 'desc',
            },
          });

          return {
            service: service.toLowerCase(),
            name: getServiceName(service),
            icon: getServiceIcon(service),
            status: latestTest?.status.toLowerCase() || 'unknown',
            region: latestTest?.region,
            unlockType: latestTest?.unlockType?.toLowerCase(),
            lastTested: latestTest?.testedAt,
          };
        })
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
      console.error('Get node streaming error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get streaming data',
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
          error: 'Node not found',
        });
      }

      // 获取Socket.IO实例并通知Agent
      const io = getIO();
      if (io) {
        // 通知开始检测（广播给前端）
        notifyStreamingTestStart(io, nodeId);

        // TODO: 实际项目中应该通过Agent的Socket连接通知Agent执行检测
        // 目前Agent是定时执行，后续可以扩展为实时触发
        logger.info(`Triggered streaming test for node ${nodeId}, services: ${services || 'all'}`);
      } else {
        logger.warn('Socket.IO instance not available, cannot notify streaming test start');
      }

      return res.json({
        success: true,
        message: 'Streaming test triggered',
        data: {
          nodeId,
          services: services || 'all',
          status: 'pending',
        },
      });
    } catch (error) {
      logger.error('Trigger streaming test error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to trigger streaming test',
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
          error: 'Invalid request body',
        });
      }

      // 批量保存检测结果
      const savedResults = await Promise.all(
        results.map(async (result: any) => {
          return await prisma.streamingTest.create({
            data: {
              nodeId,
              service: result.service.toUpperCase() as StreamingService,
              status: result.status.toUpperCase() as StreamingStatus,
              region: result.region,
              unlockType: result.unlockType?.toUpperCase() as UnlockType,
              details: result.details,
              errorMsg: result.errorMsg,
            },
          });
        })
      );

      // 广播检测结果给前端
      const io = getIO();
      if (io) {
        broadcastStreamingTestResult(io, nodeId, savedResults);
      }

      logger.info(`Saved ${savedResults.length} streaming test results for node ${nodeId}`);

      return res.json({
        success: true,
        message: 'Streaming results saved',
        data: {
          count: savedResults.length,
        },
      });
    } catch (error) {
      logger.error('Save streaming results error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save streaming results',
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
      const { status = 'yes' } = req.query;

      const streamingService = service.toUpperCase() as StreamingService;

      // 查找支持指定流媒体的节点
      const nodes = await prisma.node.findMany({
        where: {
          status: 'ONLINE',
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
              testedAt: 'desc',
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
      console.error('Get nodes by streaming error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get nodes',
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
              status: 'YES',
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
            percentage: total > 0 ? ((unlocked / total) * 100).toFixed(1) : '0',
          };
        })
      );

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get streaming stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get streaming stats',
      });
    }
  }
}

// 辅助函数：获取服务名称
function getServiceName(service: StreamingService): string {
  const names: Record<StreamingService, string> = {
    NETFLIX: 'Netflix',
    YOUTUBE: 'YouTube',
    DISNEY_PLUS: 'Disney+',
    TIKTOK: 'TikTok',
    AMAZON_PRIME: 'Amazon Prime',
    SPOTIFY: 'Spotify',
    CHATGPT: 'ChatGPT',
  };
  return names[service];
}

// 辅助函数：获取服务图标
function getServiceIcon(service: StreamingService): string {
  const icons: Record<StreamingService, string> = {
    NETFLIX: '🎬',
    YOUTUBE: '📺',
    DISNEY_PLUS: '🎵',
    TIKTOK: '🎭',
    AMAZON_PRIME: '📦',
    SPOTIFY: '🎶',
    CHATGPT: '🤖',
  };
  return icons[service];
}
