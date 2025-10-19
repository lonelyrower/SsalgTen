import { streamingDetector, StreamingResult } from './StreamingDetector';
import { config } from '../config';
import { logger } from '../utils/logger';
import { http } from '../utils/http';
import { buildSignedHeaders } from '../utils/signing';

/**
 * 流媒体检测服务
 * 定期检测流媒体解锁状态并上报到主控端
 */
export class StreamingTestService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // 检测间隔（默认6小时）
  private readonly testInterval: number;

  constructor(testIntervalHours: number = 6) {
    this.testInterval = testIntervalHours * 60 * 60 * 1000;
  }

  /**
   * 启动定期检测
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('[StreamingTestService] Already running');
      return;
    }

    logger.info('[StreamingTestService] Starting streaming detection service...');
    logger.info(`[StreamingTestService] Test interval: ${this.testInterval / (60 * 60 * 1000)} hours`);

    // 启动后延迟1分钟执行首次检测（避免启动时负载过高）
    setTimeout(() => {
      this.runTest();
    }, 60 * 1000);

    // 设置定期检测
    this.intervalId = setInterval(() => {
      this.runTest();
    }, this.testInterval);

    this.isRunning = true;
  }

  /**
   * 停止定期检测
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('[StreamingTestService] Streaming detection service stopped');
    }
  }

  /**
   * 立即执行一次检测（用于手动触发）
   */
  async runTest(): Promise<void> {
    try {
      logger.info('[StreamingTestService] Starting streaming unlock detection...');

      const results = await streamingDetector.detectAll();

      logger.info(`[StreamingTestService] Detection completed: ${results.length} services tested`);

      // 记录每个服务的检测结果
      results.forEach(result => {
        logger.info(
          `[StreamingTestService] ${result.service}: ${result.status}` +
          (result.region ? ` (${result.region})` : '') +
          (result.unlockType ? ` [${result.unlockType}]` : '')
        );
      });

      // 上报结果到主控端
      await this.reportResults(results);

    } catch (error) {
      logger.error('[StreamingTestService] Detection failed:', error);
    }
  }

  /**
   * 上报检测结果到主控端
   */
  private async reportResults(results: StreamingResult[]): Promise<void> {
    try {
      const payload = {
        nodeId: config.id,
        results: results.map(r => ({
          service: r.service.toUpperCase(), // 转换为大写匹配数据库 enum
          status: r.status.toUpperCase(),
          region: r.region,
          unlockType: r.unlockType?.toUpperCase(),
          details: r.details,
          testedAt: r.testedAt.toISOString(),
        })),
      };

      const response = await http.post(
        `${config.masterUrl}/api/streaming/results`,
        payload,
        {
          headers: {
            ...buildSignedHeaders(config.apiKey, payload),
          },
          timeout: 15000,
        }
      );

      if (response.status === 200) {
        logger.info('[StreamingTestService] Results reported successfully');
      } else {
        logger.warn(`[StreamingTestService] Report failed with status ${response.status}`);
      }
    } catch (error) {
      logger.error('[StreamingTestService] Failed to report results:', error);
    }
  }
}

// 导出单例
export const streamingTestService = new StreamingTestService(6); // 默认6小时检测一次
