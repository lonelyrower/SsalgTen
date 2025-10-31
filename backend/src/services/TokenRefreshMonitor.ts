import { logger } from "../utils/logger";

/**
 * Token 刷新监控服务
 * 监控异常的 token 刷新行为，防止滥用
 */
class TokenRefreshMonitor {
  // 内存缓存：userId -> 刷新记录
  private refreshCache = new Map<
    string,
    {
      count: number;
      firstRefreshAt: number;
      lastRefreshAt: number;
    }
  >();

  // 监控窗口：1小时
  private readonly WINDOW_MS = 60 * 60 * 1000;

  // 告警阈值：1小时内刷新超过100次
  private readonly ALERT_THRESHOLD = 100;

  // 清理间隔：每10分钟清理过期记录
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 启动定期清理
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      10 * 60 * 1000,
    );
  }

  /**
   * 记录一次刷新操作
   * @param userId 用户ID
   * @param ip 客户端IP
   * @returns 如果超过阈值返回 true
   */
  recordRefresh(userId: string, ip?: string): boolean {
    const now = Date.now();
    const record = this.refreshCache.get(userId);

    if (!record) {
      // 首次刷新
      this.refreshCache.set(userId, {
        count: 1,
        firstRefreshAt: now,
        lastRefreshAt: now,
      });
      return false;
    }

    // 检查是否在监控窗口内
    const windowStart = now - this.WINDOW_MS;
    if (record.firstRefreshAt < windowStart) {
      // 窗口已过期，重置计数
      this.refreshCache.set(userId, {
        count: 1,
        firstRefreshAt: now,
        lastRefreshAt: now,
      });
      return false;
    }

    // 在窗口内，增加计数
    record.count++;
    record.lastRefreshAt = now;
    this.refreshCache.set(userId, record);

    // 检查是否超过阈值
    if (record.count > this.ALERT_THRESHOLD) {
      const minutesSinceFirst = Math.floor(
        (now - record.firstRefreshAt) / 60000,
      );
      logger.warn(
        `[TokenRefreshMonitor] Suspicious token refresh activity detected`,
        {
          userId,
          ip,
          count: record.count,
          windowMinutes: minutesSinceFirst,
          threshold: this.ALERT_THRESHOLD,
        },
      );
      return true;
    }

    return false;
  }

  /**
   * 获取用户的刷新统计
   */
  getStats(userId: string) {
    const record = this.refreshCache.get(userId);
    if (!record) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;

    // 检查是否过期
    if (record.firstRefreshAt < windowStart) {
      return null;
    }

    return {
      count: record.count,
      windowMinutes: Math.floor((now - record.firstRefreshAt) / 60000),
      isAnomalous: record.count > this.ALERT_THRESHOLD,
    };
  }

  /**
   * 清理过期的记录
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    let cleanedCount = 0;

    for (const [userId, record] of this.refreshCache.entries()) {
      if (record.firstRefreshAt < windowStart) {
        this.refreshCache.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(
        `[TokenRefreshMonitor] Cleaned up ${cleanedCount} expired records`,
      );
    }
  }

  /**
   * 清理定时器（用于优雅关闭）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const tokenRefreshMonitor = new TokenRefreshMonitor();
