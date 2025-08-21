import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface EventDetails {
  [key: string]: any;
}

class EventService {
  async createEvent(nodeId: string, type: string, message?: string, details?: EventDetails): Promise<void> {
    try {
      await prisma.eventLog.create({
        data: {
          nodeId,
          type,
          message,
          details: details as any,
        }
      });
    } catch (error) {
      logger.error('创建事件日志失败:', error);
    }
  }

  async getEvents(nodeId: string, limit = 100) {
    return prisma.eventLog.findMany({
      where: { nodeId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        details: true,
        timestamp: true,
      }
    });
  }
}

export const eventService = new EventService();
