import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { NetworkInterfaceDetail } from "../types/heartbeat";

export class TrafficStatsService {
  /**
   * 更新节点的流量统计
   * @param nodeId 节点ID
   * @param networkInterfaces 网络接口数据（从心跳的 systemInfo.network 获取）
   */
  async updateTrafficStats(
    nodeId: string,
    networkInterfaces?: NetworkInterfaceDetail[],
  ): Promise<void> {
    if (!networkInterfaces || networkInterfaces.length === 0) {
      return;
    }

    try {
      // 汇总所有网络接口的流量（排除loopback）
      const totalRx = networkInterfaces
        .filter((iface) => !iface.interface.startsWith("lo"))
        .reduce((sum, iface) => sum + (iface.bytesReceived || 0), 0);

      const totalTx = networkInterfaces
        .filter((iface) => !iface.interface.startsWith("lo"))
        .reduce((sum, iface) => sum + (iface.bytesSent || 0), 0);

      if (totalRx === 0 && totalTx === 0) {
        return; // 没有流量数据
      }

      // 获取或创建流量统计记录
      const existing = await prisma.trafficStats.findUnique({
        where: { nodeId },
      });

      if (!existing) {
        // 首次记录：创建新记录
        await prisma.trafficStats.create({
          data: {
            nodeId,
            totalUpload: BigInt(totalTx),
            totalDownload: BigInt(totalRx),
            periodUpload: BigInt(totalTx),
            periodDownload: BigInt(totalRx),
            lastRxBytes: BigInt(totalRx),
            lastTxBytes: BigInt(totalTx),
            periodStart: new Date(),
          },
        });
        logger.debug(
          `[TrafficStats] Created new traffic stats for node ${nodeId}`,
        );
      } else {
        // 计算增量（处理网络接口重启导致的计数器重置）
        const lastRx = existing.lastRxBytes ? Number(existing.lastRxBytes) : 0;
        const lastTx = existing.lastTxBytes ? Number(existing.lastTxBytes) : 0;

        // 如果当前值小于上次记录，说明计数器可能重置了，只记录当前值
        const rxDelta = totalRx >= lastRx ? totalRx - lastRx : totalRx;
        const txDelta = totalTx >= lastTx ? totalTx - lastTx : totalTx;

        // 更新累计流量和周期流量
        await prisma.trafficStats.update({
          where: { nodeId },
          data: {
            totalUpload: {
              increment: BigInt(txDelta),
            },
            totalDownload: {
              increment: BigInt(rxDelta),
            },
            periodUpload: {
              increment: BigInt(txDelta),
            },
            periodDownload: {
              increment: BigInt(rxDelta),
            },
            lastRxBytes: BigInt(totalRx),
            lastTxBytes: BigInt(totalTx),
            updatedAt: new Date(),
          },
        });

        if (rxDelta > 0 || txDelta > 0) {
          logger.debug(
            `[TrafficStats] Updated traffic stats for node ${nodeId}: +${rxDelta} RX, +${txDelta} TX`,
          );
        }
      }
    } catch (error) {
      logger.error(`[TrafficStats] Failed to update traffic stats:`, error);
    }
  }

  /**
   * 重置节点的周期流量统计
   * @param nodeId 节点ID
   */
  async resetPeriodTraffic(nodeId: string): Promise<void> {
    try {
      await prisma.trafficStats.update({
        where: { nodeId },
        data: {
          periodUpload: BigInt(0),
          periodDownload: BigInt(0),
          periodStart: new Date(),
        },
      });
      logger.info(`[TrafficStats] Reset period traffic for node ${nodeId}`);
    } catch (error) {
      logger.error(
        `[TrafficStats] Failed to reset period traffic for node ${nodeId}:`,
        error,
      );
    }
  }

  /**
   * 获取节点的流量统计
   * @param nodeId 节点ID
   */
  async getTrafficStats(nodeId: string) {
    try {
      return await prisma.trafficStats.findUnique({
        where: { nodeId },
      });
    } catch (error) {
      logger.error(
        `[TrafficStats] Failed to get traffic stats for node ${nodeId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * 获取所有节点的流量统计（用于实时数据广播）
   */
  async getAllTrafficStats(): Promise<
    Map<
      string,
      {
        totalUpload: bigint;
        totalDownload: bigint;
        periodUpload: bigint;
        periodDownload: bigint;
      }
    >
  > {
    try {
      const stats = await prisma.trafficStats.findMany({
        select: {
          nodeId: true,
          totalUpload: true,
          totalDownload: true,
          periodUpload: true,
          periodDownload: true,
        },
      });

      const statsMap = new Map();
      for (const stat of stats) {
        statsMap.set(stat.nodeId, {
          totalUpload: stat.totalUpload,
          totalDownload: stat.totalDownload,
          periodUpload: stat.periodUpload,
          periodDownload: stat.periodDownload,
        });
      }
      return statsMap;
    } catch (error) {
      logger.error(`[TrafficStats] Failed to get all traffic stats:`, error);
      return new Map();
    }
  }
}

export const trafficStatsService = new TrafficStatsService();
