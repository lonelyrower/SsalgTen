import { serviceDetector } from './ServiceDetector';
import { config } from '../config';
import { logger } from '../utils/logger';
import { http } from '../utils/http';
import { buildSignedHeaders } from '../utils/signing';
import type { DetectedService } from '../types';
import { registrationService } from './RegistrationService';

/**
 * 服务检测调度服务
 * 负责定时执行服务检测并上报结果
 */
export class ServiceDetectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private serviceStarted = false;
  private executing = false;
  private lastRunAt: number | null = null;

  private readonly scanInterval: number; // 扫描周期（毫秒）

  constructor(scanIntervalHours: number = 12) {
    this.scanInterval = scanIntervalHours * 60 * 60 * 1000;
  }

  /**
   * 启动周期性检测
   */
  start(): void {
    if (this.serviceStarted) {
      logger.warn('[ServiceDetectionService] Already running');
      return;
    }

    logger.info('[ServiceDetectionService] Starting service detection service...');
    logger.info(
      `[ServiceDetectionService] Scan interval: ${this.scanInterval / (60 * 60 * 1000)} hours`
    );

    // 首次延迟执行，避免刚启动立即占用资源
    setTimeout(() => {
      void this.runScan();
    }, 120 * 1000); // 2分钟后首次执行

    // 周期执行
    this.intervalId = setInterval(() => {
      void this.runScan();
    }, this.scanInterval);

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
    logger.info('[ServiceDetectionService] Service detection service stopped');
  }

  /**
   * 手动触发扫描
   */
  async triggerManual(): Promise<{ started: boolean; reason?: string }> {
    if (this.executing) {
      return { started: false, reason: 'in_progress' };
    }

    void this.runScan();
    return { started: true };
  }

  /**
   * 执行一次扫描
   */
  async runScan(): Promise<void> {
    if (this.executing) {
      logger.warn('[ServiceDetectionService] Scan already running, skip duplicate trigger');
      return;
    }

    this.executing = true;
    try {
      logger.info('[ServiceDetectionService] Starting service detection scan...');

      const services = await serviceDetector.detectAll();
      logger.info(
        `[ServiceDetectionService] Scan completed: ${services.length} services detected`
      );

      services.forEach((service) => {
        logger.info(
          `[ServiceDetectionService] - ${service.serviceName} (${service.serviceType}): ${service.status}` +
            (service.port ? ` [Port ${service.port}]` : '') +
            (service.version ? ` v${service.version}` : '')
        );
      });

      await this.reportServices(services);
      this.lastRunAt = Date.now();
    } catch (error) {
      logger.error('[ServiceDetectionService] Scan failed:', error);
    } finally {
      this.executing = false;
    }
  }

  /**
   * 上报服务检测结果到 Master
   */
  private async reportServices(services: DetectedService[]): Promise<void> {
    try {
      // 获取注册后的 nodeId
      const nodeInfo = registrationService.getNodeInfo();
      if (!nodeInfo?.nodeId) {
        logger.warn('[ServiceDetectionService] Node not registered, skipping service report');
        return;
      }

      const payload = {
        nodeId: nodeInfo.nodeId,
        services: services.map((s) => ({
          serviceType: s.serviceType,
          serviceName: s.serviceName,
          version: s.version,
          status: s.status,
          port: s.port,
          protocol: s.protocol,
          configPath: s.configPath,
          configHash: s.configHash,
          domains: s.domains,
          sslEnabled: s.sslEnabled,
          containerInfo: s.containerInfo,
          details: s.details,
        })),
        scannedAt: new Date().toISOString(),
      };

      const response = await http.post(`${config.masterUrl}/api/services/report`, payload, {
        headers: {
          ...buildSignedHeaders(config.apiKey, payload),
        },
        timeout: 15000,
      });

      if (response.status === 200) {
        logger.info('[ServiceDetectionService] Services reported successfully');
      } else {
        logger.warn(
          `[ServiceDetectionService] Report failed with status ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      logger.error('[ServiceDetectionService] Failed to report services:', error);
    }
  }

  getLastRunAt(): number | null {
    return this.lastRunAt;
  }

  isExecuting(): boolean {
    return this.executing;
  }
}

export const serviceDetectionService = new ServiceDetectionService(12);
