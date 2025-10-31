import { streamingDetector, type StreamingResult } from './StreamingDetector';
import { config } from '../config';
import { logger } from '../utils/logger';
import { http } from '../utils/http';
import { buildSignedHeaders } from '../utils/signing';
import { registrationService } from './RegistrationService';

/**
 * 流媒体检测服务
 * 负责定时执行检测并回传结果
 */
export class StreamingTestService {
  private intervalId: NodeJS.Timeout | null = null;
  private serviceStarted = false;
  private executing = false;
  private lastRunAt: number | null = null;

  private readonly testInterval: number; // 周期（毫秒）

  constructor(testIntervalHours: number = 24) {
    this.testInterval = testIntervalHours * 60 * 60 * 1000;
  }

  /**
   * 启动周期性检测
   */
  start(): void {
    if (this.serviceStarted) {
      logger.warn('[StreamingTestService] Already running');
      return;
    }

    logger.info('[StreamingTestService] Starting streaming detection service...');
    logger.info(
      `[StreamingTestService] Test interval: ${this.testInterval / (60 * 60 * 1000)} hours`,
    );

    // 首次延迟执行，避免刚启动立即占用资源
    setTimeout(() => {
      void this.runTest();
    }, 60 * 1000);

    // 周期执行
    this.intervalId = setInterval(() => {
      void this.runTest();
    }, this.testInterval);

    this.serviceStarted = true;
  }

  /**
   * 停止周期任务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.serviceStarted = false;
    logger.info('[StreamingTestService] Streaming detection service stopped');
  }

  /**
   * 手动触发检测
   */
  async triggerManual(): Promise<{ started: boolean; reason?: string }> {
    if (this.executing) {
      return { started: false, reason: 'in_progress' };
    }

    void this.runTest();
    return { started: true };
  }

  /**
   * 执行一次检测
   */
  async runTest(): Promise<void> {
    if (this.executing) {
      logger.warn('[StreamingTestService] Detection already running, skip duplicate trigger');
      return;
    }

    this.executing = true;
    try {
      logger.info('[StreamingTestService] Starting streaming unlock detection...');

      const results = await streamingDetector.detectAll();
      logger.info(
        `[StreamingTestService] Detection completed: ${results.length} services tested`,
      );

      results.forEach((result) => {
        logger.info(
          `[StreamingTestService] ${result.service}: ${result.status}` +
            (result.region ? ` (${result.region})` : '') +
            (result.unlockType ? ` [${result.unlockType}]` : ''),
        );
      });

      await this.reportResults(results);
      this.lastRunAt = Date.now();
    } catch (error) {
      logger.error('[StreamingTestService] Detection failed:', error);
    } finally {
      this.executing = false;
    }
  }

  /**
   * 上报检测结果到 Master
   */
  private async reportResults(results: StreamingResult[]): Promise<void> {
    try {
      // 获取注册后的 nodeId (优先使用数据库 nodeId,回退到 agentId)
      const nodeInfo = registrationService.getNodeInfo();
      const nodeId = nodeInfo?.nodeId || config.id;

      if (!nodeInfo?.nodeId) {
        logger.warn('[StreamingTestService] Using agentId as fallback (node not fully registered)');
      }

      const payload = {
        nodeId: nodeId,
        results: results.map((r) => ({
          service: r.service.toUpperCase(),
          status: r.status.toUpperCase(),
          region: r.region,
          unlockType: r.unlockType?.toUpperCase(),
          details:
            r.testedUrls || r.details
              ? {
                  ...(r.details ?? {}),
                  ...(r.testedUrls ? { testedUrls: r.testedUrls } : {}),
                }
              : undefined,
          testedAt: r.testedAt.toISOString(),
        })),
      };

      logger.info(`[StreamingTestService] Reporting ${results.length} results to master...`);
      logger.debug(`[StreamingTestService] Master URL: ${config.masterUrl}/api/streaming/results`);
      logger.debug(`[StreamingTestService] Node ID: ${nodeId}`);
      logger.debug(`[StreamingTestService] API Key: ${config.apiKey.substring(0, 4)}...`);

      const response = await http.post(`${config.masterUrl}/api/streaming/results`, payload, {
        headers: {
          ...buildSignedHeaders(config.apiKey, payload),
          'x-api-key': config.apiKey,
        },
        timeout: 15000,
      });

      if (response.status === 200) {
        logger.info('[StreamingTestService] Results reported successfully');
      } else {
        logger.warn(
          `[StreamingTestService] Report failed with status ${response.status}: ${response.statusText}`,
        );
        logger.warn(`[StreamingTestService] Response data:`, response.data);
      }
    } catch (error) {
      logger.error('[StreamingTestService] Failed to report results:', error);
      if ((error as any).response) {
        logger.error('[StreamingTestService] Response status:', (error as any).response.status);
        logger.error('[StreamingTestService] Response data:', (error as any).response.data);
      }
    }
  }

  getLastRunAt(): number | null {
    return this.lastRunAt;
  }

  isExecuting(): boolean {
    return this.executing;
  }
}

export const streamingTestService = new StreamingTestService(24);
