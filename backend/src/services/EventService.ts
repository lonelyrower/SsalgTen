import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { getIO } from "../sockets/ioRegistry";

export interface EventDetails {
  [key: string]: unknown;
}

class EventService {
  async createEvent(
    nodeId: string,
    type: string,
    message?: string,
    details?: EventDetails,
  ): Promise<void> {
    try {
      await prisma.eventLog.create({
        data: {
          nodeId,
          type,
          message,
          details: details ? (details as Prisma.InputJsonValue) : undefined,
        },
      });

      // 广播到订阅该节点事件的客户端
      try {
        const io = getIO();
        if (io) {
          io.to(`node_events_${nodeId}`).emit("node_event", {
            id: undefined, // 客户端如需ID可二次查询，此处即时通知
            nodeId,
            type,
            message,
            details,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        logger.debug("Broadcast node_event failed (non-fatal):", e);
      }
    } catch (error) {
      logger.error("创建事件日志失败:", error);
    }
  }

  async getEvents(nodeId: string, limit = 100) {
    return prisma.eventLog.findMany({
      where: { nodeId },
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        details: true,
        timestamp: true,
      },
    });
  }

  async getGlobalActivities(limit = 100) {
    return prisma.eventLog.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        details: true,
        timestamp: true,
        node: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            status: true,
          },
        },
      },
    });
  }
}

export const eventService = new EventService();
