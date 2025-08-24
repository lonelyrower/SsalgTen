import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getSystemInfo, getPublicIPs } from '../utils/system';
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
      
      // 尝试多个连接地址（适用于同机部署的网络问题）
      const urlsToTry = [
        masterUrl,
        // 如果原URL使用host.docker.internal，添加Docker网关IP作为备用
        masterUrl.includes('host.docker.internal') 
          ? masterUrl.replace('host.docker.internal', '172.17.0.1')
          : null,
        // 添加localhost作为最后的备用（适用于某些Docker配置）
        masterUrl.includes('host.docker.internal')
          ? masterUrl.replace('host.docker.internal', 'localhost')
          : null
      ].filter(Boolean);

      let lastError;
      for (const tryUrl of urlsToTry) {
        try {
          logger.info(`尝试连接到: ${tryUrl}`);
          
          const response = await axios.post(
            `${tryUrl}/api/agents/register`,
            registrationData,
            {
              // 增加超时时间以适应网络延迟和容器启动时间
              timeout: 60000,
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

  // 获取网络连接状态
  private async getConnectivityStatus(): Promise<any> {
    try {
      // 简单的连接性测试
      const testTargets = ['8.8.8.8', '1.1.1.1'];
      const connectivityResults: { [key: string]: boolean } = {};
      
      for (const target of testTargets) {
        try {
          const response = await axios.get(`http://${target}`, { 
            timeout: 2000,
            // 忽略证书错误，因为我们只是测试连接性
            httpsAgent: false
          });
          connectivityResults[target] = true;
        } catch {
          connectivityResults[target] = false;
        }
      }
      
      return connectivityResults;
    } catch (error) {
      logger.debug('Connectivity test failed:', error);
      return {};
    }
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
