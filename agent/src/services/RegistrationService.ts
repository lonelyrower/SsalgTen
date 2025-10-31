import axios from 'axios';
import { promises as dns } from 'dns';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getSystemInfo, getPublicIPs } from '../utils/system';
import { securityMonitor } from './SecurityMonitor';
import { processMonitor } from './ProcessMonitor';
import { networkMonitor } from './NetworkMonitor';
import { fileMonitor } from './FileMonitor';
import { emailAlertService } from './EmailAlertService';
import { buildSignedHeaders } from '../utils/signing';

export interface RegistrationResult {
  success: boolean;
  nodeId?: string;
  nodeName?: string;
  location?: string;
  error?: string;
}

export interface HeartbeatData {
  status: string;
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  connectivity?: any;
  systemInfo?: any;
  nodeIPs?: { ipv4?: string; ipv6?: string };
}

export class RegistrationService {
  private isRegistered = false;
  private nodeInfo: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000; // 30秒
  private readonly connectivityTimeoutMs = 1500;

  constructor() {
    // 绑定方法以确保正确的this上下文
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
  }

  // 注册Agent到主服务器
  async registerAgent(): Promise<RegistrationResult> {
    try {
      logger.info('Attempting to register agent with master server...');
      
      const systemInfo = await getSystemInfo();
      const publicIPs = await getPublicIPs();
      const registrationData = {
        agentId: config.id,
        apiKey: config.apiKey, // 直接在body中包含API Key
        nodeInfo: {
          name: config.name,
          country: config.location.country,
          city: config.location.city,
          latitude: config.location.latitude,
          longitude: config.location.longitude,
          provider: config.provider,
          ipv4: publicIPs.ipv4,
          ipv6: publicIPs.ipv6,
        },
        systemInfo: {
          platform: systemInfo.platform,
          version: systemInfo.version,
          hostname: systemInfo.hostname,
          uptime: systemInfo.uptime
        }
      };

      let masterUrl = config.masterUrl.replace(/\/$/, ''); // 移除尾部斜杠

      // 解析原始URL以便构造回退地址
      let urlsToTry: string[] = [];
      try {
        const u = new URL(masterUrl);
        const scheme = u.protocol; // 'http:' or 'https:'
        const port = u.port || (scheme === 'https:' ? '443' : '80');
        const originNoSlash = `${scheme}//${u.hostname}${u.port ? `:${u.port}` : ''}`;

        // 1) 原始地址优先
        urlsToTry.push(originNoSlash);

        // 2) 基于不同宿主访问方式的回退
        if (u.hostname === 'host.docker.internal') {
          urlsToTry.push(`${scheme}//172.17.0.1:${u.port || port}`);
          urlsToTry.push(`${scheme}//localhost:${u.port || port}`);
          urlsToTry.push(`${scheme}//127.0.0.1:${u.port || port}`);
        } else if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          urlsToTry.push(`${scheme}//host.docker.internal:${u.port || port}`);
          urlsToTry.push(`${scheme}//172.17.0.1:${u.port || port}`);
        } else {
          // 保守追加同机常见回退（置于末尾，避免影响异机部署）
          urlsToTry.push(`${scheme}//host.docker.internal:${u.port || port}`);
          urlsToTry.push(`${scheme}//172.17.0.1:${u.port || port}`);
          urlsToTry.push(`${scheme}//localhost:${u.port || port}`);
          urlsToTry.push(`${scheme}//127.0.0.1:${u.port || port}`);
        }
      } catch {
        // URL解析失败时维持原行为
        urlsToTry = [masterUrl];
      }

      let lastError;
      for (const tryUrl of urlsToTry) {
        try {
          logger.info(`尝试连接到: ${tryUrl}`);

          // 先做一次健康检查，快速过滤明显不可达地址
          try {
            const health = await axios.get(`${tryUrl}/api/health`, { timeout: 3000 });
            if (!health.data?.success) {
              logger.warn(`健康检查未通过: ${tryUrl}`);
              continue;
            }
          } catch (e) {
            logger.warn(`健康检查失败，跳过: ${tryUrl}`);
            continue;
          }

          const response = await axios.post(
            `${tryUrl}/api/agents/register`,
            registrationData,
            {
              // 合理超时，避免长时间阻塞
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': `SsalgTen-Agent/${config.id}`,
                // 简化认证：直接在body中包含apiKey，避免签名验证问题
              }
            }
          );

          // 如果成功，更新配置中的masterUrl为可工作的URL
          if (response.data.success && tryUrl !== masterUrl) {
            logger.info(`连接成功，使用URL: ${tryUrl}`);
            config.masterUrl = tryUrl;
          }

          if (response.data.success) {
            this.isRegistered = true;
            this.nodeInfo = response.data.data;
            
            logger.info('Agent registration successful!', {
              nodeId: this.nodeInfo.nodeId,
              nodeName: this.nodeInfo.nodeName,
              location: this.nodeInfo.location
            });

            // 初始化安全监控服务
            this.initializeSecurityServices();

            // 开始发送心跳
            this.startHeartbeat();

            return {
              success: true,
              nodeId: this.nodeInfo.nodeId,
              nodeName: this.nodeInfo.nodeName,
              location: this.nodeInfo.location
            };
          } else {
            logger.error(`Agent registration failed with ${tryUrl}:`, response.data.error);
            lastError = new Error(response.data.error || 'Registration failed');
          }
        } catch (error) {
          logger.warn(`Failed to connect to ${tryUrl}:`, error instanceof Error ? error.message : 'Unknown error');
          lastError = error instanceof Error ? error : new Error('Unknown error');
        }
      }

      // 如果所有URL都失败了，抛出最后一个错误
      throw lastError || new Error('All connection attempts failed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown registration error';
      logger.error('Agent registration error:', errorMessage);
      
      // 检查是否是网络连接问题
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          logger.warn(`Cannot connect to master server at ${config.masterUrl}. Will retry later.`);
          return {
            success: false,
            error: `Master server unreachable: ${config.masterUrl}`
          };
        }
        
        if (error.response?.status === 404) {
          logger.warn('Agent not found in master server. Please add this agent in the admin panel first.');
          return {
            success: false,
            error: 'Agent not registered in master server. Contact administrator.'
          };
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // 初始化安全监控服务
  private initializeSecurityServices(): void {
    logger.info('Initializing security monitoring services...');

    try {
      // 初始化邮件告警服务
      emailAlertService.initialize();
      
      // 初始化文件完整性基线（异步，不阻塞）
      fileMonitor.initializeBaseline().catch(err => {
        logger.error('Failed to initialize file baseline:', err);
      });

      logger.info('Security services initialized');
      logger.info(`- SSH Monitor: ${securityMonitor ? 'enabled' : 'disabled'}`);
      logger.info(`- Process Monitor: ${processMonitor.config.enabled ? 'enabled' : 'disabled'}`);
      logger.info(`- Network Monitor: ${networkMonitor.config.enabled ? 'enabled' : 'disabled'}`);
      logger.info(`- File Monitor: ${fileMonitor.config.enabled ? 'enabled' : 'disabled'}`);
      logger.info(`- Email Alerts: ${emailAlertService.config.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to initialize security services:', error);
    }
  }

  // 开始心跳循环
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    logger.info(`Starting heartbeat with ${this.heartbeatIntervalMs/1000}s interval`);
    
    // 立即发送一次心跳
    this.sendHeartbeat();
    
    // 设置定期心跳
    this.heartbeatInterval = setInterval(this.sendHeartbeat, this.heartbeatIntervalMs);
  }

  // 停止心跳
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat stopped');
    }
  }

  // 发送心跳到主服务器
  private async sendHeartbeat(): Promise<void> {
    if (!this.isRegistered) {
      logger.warn('Agent not registered, skipping heartbeat');
      return;
    }

    try {
      const systemInfo = await getSystemInfo();
      const publicIPs = await getPublicIPs();
      const heartbeatData: HeartbeatData = {
        status: 'healthy',
        uptime: systemInfo.uptime,
        cpuUsage: systemInfo.cpuUsage,
        memoryUsage: systemInfo.memoryUsage,
        diskUsage: systemInfo.diskUsage,
        connectivity: await this.getConnectivityStatus(),
        // 公网IP，便于后端检测变更
        nodeIPs: publicIPs,
        // 添加详细系统信息
        systemInfo: {
          cpu: systemInfo.cpu,
          memory: systemInfo.memory,
          disk: systemInfo.disk,
          network: systemInfo.network,
          processes: systemInfo.processes,
          virtualization: systemInfo.virtualization,
          services: systemInfo.services,
          loadAverage: systemInfo.loadAverage
        }
      };

      // 收集所有安全监控数据
      const securityData: any = {};
      let hasAlerts = false;

      // 1. SSH暴力破解监控
      try {
        const sshData = await securityMonitor.checkSshBruteforce();
        if (sshData?.ssh) {
          securityData.ssh = sshData.ssh;
          if (sshData.ssh.alerts && sshData.ssh.alerts.length > 0) {
            hasAlerts = true;
            logger.warn(`SSH brute force detected: ${sshData.ssh.alerts.length} alerts`);
          }
        }
      } catch (error) {
        logger.debug('SSH monitor check failed:', error);
      }

      // 2. 进程监控
      try {
        const processData = await processMonitor.scanProcesses();
        if (processData.enabled) {
          securityData.processes = {
            enabled: processData.enabled,
            totalProcesses: processData.totalProcesses,
            suspiciousCount: processData.suspiciousProcesses.length,
            suspiciousProcesses: processData.suspiciousProcesses.slice(0, 10), // 最多发送10个
            summary: processData.summary,
          };
          
          if (processData.suspiciousProcesses.length > 0) {
            hasAlerts = true;
            logger.warn(`Suspicious processes detected: ${processData.suspiciousProcesses.length}`);
            
            // 检测到挖矿程序，发送Critical邮件
            const miners = processData.suspiciousProcesses.filter(p => p.reason.includes('miner'));
            if (miners.length > 0) {
              emailAlertService.sendAlert({
                level: 'critical',
                title: 'Cryptocurrency Miner Detected',
                message: `Detected ${miners.length} cryptocurrency mining process(es) on node ${config.name}`,
                details: miners.map(m => ({
                  process: m.process.name,
                  command: m.process.command,
                  cpu: m.process.cpu,
                  reason: m.reason,
                })),
                timestamp: new Date(),
              }, config.name).catch(err => logger.error('Failed to send miner alert email:', err));
            }
          }
        }
      } catch (error) {
        logger.debug('Process monitor check failed:', error);
      }

      // 3. 网络监控
      try {
        const networkData = await networkMonitor.monitor();
        if (networkData.enabled) {
          securityData.network = {
            enabled: networkData.enabled,
            alertsCount: networkData.alerts.length,
            alerts: networkData.alerts,
            trafficRate: networkData.trafficRate,
            connectionStats: networkData.connectionStats,
          };
          
          if (networkData.alerts.length > 0) {
            hasAlerts = true;
            logger.warn(`Network anomalies detected: ${networkData.alerts.length} alerts`);
            
            // 检测到DDoS攻击，发送Critical邮件
            const ddosAlerts = networkData.alerts.filter(a => a.type === 'connection_flood' && a.severity === 'critical');
            if (ddosAlerts.length > 0) {
              emailAlertService.sendAlert({
                level: 'critical',
                title: 'DDoS Attack Detected',
                message: `Potential DDoS attack detected on node ${config.name}`,
                details: ddosAlerts.map(a => ({
                  type: a.type,
                  message: a.message,
                  details: a.details,
                })),
                timestamp: new Date(),
              }, config.name).catch(err => logger.error('Failed to send DDoS alert email:', err));
            }
          }
        }
      } catch (error) {
        logger.debug('Network monitor check failed:', error);
      }

      // 4. 文件完整性监控
      try {
        const fileData = await fileMonitor.checkIntegrity();
        if (fileData.enabled && fileData.baselineInitialized) {
          securityData.files = {
            enabled: fileData.enabled,
            baselineInitialized: fileData.baselineInitialized,
            filesMonitored: fileData.filesMonitored,
            changesCount: fileData.changes.length,
            changes: fileData.changes.slice(0, 20), // 最多发送20个变更
            summary: fileData.summary,
          };
          
          if (fileData.changes.length > 0) {
            hasAlerts = true;
            logger.warn(`File integrity changes detected: ${fileData.changes.length} changes`);
            
            // 检测到Critical文件变更，发送邮件
            const criticalChanges = fileData.changes.filter(c => c.severity === 'critical');
            if (criticalChanges.length > 0) {
              emailAlertService.sendAlert({
                level: 'critical',
                title: 'Critical File Integrity Violation',
                message: `Critical system files have been modified on node ${config.name}`,
                details: criticalChanges.map(c => ({
                  path: c.path,
                  changeType: c.changeType,
                  oldHash: c.oldInfo?.hash,
                  newHash: c.newInfo?.hash,
                })),
                timestamp: new Date(),
              }, config.name).catch(err => logger.error('Failed to send file integrity alert email:', err));
            }
          }
        }
      } catch (error) {
        logger.debug('File monitor check failed:', error);
      }

      // 附加安全数据到心跳
      if (Object.keys(securityData).length > 0) {
        (heartbeatData as any).security = securityData;
      }

      if (hasAlerts) {
        logger.info('Security alerts included in heartbeat');
      }

      const masterUrl = config.masterUrl.replace(/\/$/, '');
      const response = await axios.post(
        `${masterUrl}/api/agents/${config.id}/heartbeat`,
        heartbeatData,
        {
          // 心跳偶发抖动时避免误判，放宽超时
          timeout: 12000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `SsalgTen-Agent/${config.id}`,
            ...buildSignedHeaders(config.apiKey, heartbeatData),
          }
        }
      );

      if (response.data.success) {
        logger.debug('Heartbeat sent successfully');
      } else {
        logger.warn('Heartbeat failed:', response.data.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown heartbeat error';
      logger.error('Heartbeat error:', errorMessage);
      
      // 如果心跳连续失败，可能需要重新注册
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Agent not found during heartbeat. Attempting re-registration...');
        this.isRegistered = false;
        this.nodeInfo = null;
        this.stopHeartbeat();
        
        // 延迟重新注册
        setTimeout(() => {
          this.registerAgent();
        }, 5000);
      }
    }
  }

  // 获取连接状态
  private async getConnectivityStatus(): Promise<Record<string, boolean>> {
    const probes: Array<{ name: string; action: () => Promise<unknown> }> = [
      { name: 'dns:cloudflare', action: () => dns.lookup('cloudflare.com') },
      { name: 'dns:google', action: () => dns.lookup('google.com') },
    ];

    const results: Record<string, boolean> = {};

    await Promise.all(
      probes.map(async ({ name, action }) => {
        try {
          await this.withTimeout(action());
          results[name] = true;
        } catch (error) {
          logger.debug(`Connectivity probe failed for ${name}:`, error);
          results[name] = false;
        }
      }),
    );

    return results;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('connectivity_probe_timeout'));
      }, this.connectivityTimeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  // 获取注册状态
  isAgentRegistered(): boolean {
    return this.isRegistered;
  }

  // 获取节点信息
  getNodeInfo(): any {
    return this.nodeInfo;
  }

  // 重试注册（用于启动时的重试逻辑）
  async retryRegistration(maxRetries = 5, retryDelay = 10000): Promise<RegistrationResult> {
    let lastError = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Registration attempt ${attempt}/${maxRetries}`);
      
      const result = await this.registerAgent();
      
      if (result.success) {
        return result;
      }
      
      lastError = result.error || 'Unknown error';
      
      if (attempt < maxRetries) {
        logger.info(`Registration failed, retrying in ${retryDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    logger.error(`Registration failed after ${maxRetries} attempts. Last error: ${lastError}`);
    return {
      success: false,
      error: `Registration failed after ${maxRetries} attempts: ${lastError}`
    };
  }

  // 优雅关闭
  async shutdown(): Promise<void> {
    logger.info('Shutting down registration service...');
    this.stopHeartbeat();
    
    if (this.isRegistered) {
      try {
        // 可以在这里发送下线通知
        logger.info('Agent going offline');
      } catch (error) {
        logger.error('Error during shutdown:', error);
      }
    }
    
    this.isRegistered = false;
    this.nodeInfo = null;
  }
}

export const registrationService = new RegistrationService();
