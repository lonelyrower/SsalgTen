import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getSystemInfo } from '../utils/system';

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
      const registrationData = {
        agentId: config.id,
        systemInfo: {
          platform: systemInfo.platform,
          version: systemInfo.version,
          hostname: systemInfo.hostname,
          uptime: systemInfo.uptime
        }
      };

      const masterUrl = config.masterUrl.replace(/\/$/, ''); // 移除尾部斜杠
      const response = await axios.post(
        `${masterUrl}/api/agent/register`,
        registrationData,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `SsalgTen-Agent/${config.id}`
          }
        }
      );

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
        logger.error('Agent registration failed:', response.data.error);
        return {
          success: false,
          error: response.data.error || 'Registration failed'
        };
      }
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
      const heartbeatData: HeartbeatData = {
        status: 'healthy',
        uptime: systemInfo.uptime,
        cpuUsage: systemInfo.cpuUsage,
        memoryUsage: systemInfo.memoryUsage,
        diskUsage: systemInfo.diskUsage,
        connectivity: await this.getConnectivityStatus()
      };

      const masterUrl = config.masterUrl.replace(/\/$/, '');
      const response = await axios.post(
        `${masterUrl}/api/agent/${config.id}/heartbeat`,
        heartbeatData,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `SsalgTen-Agent/${config.id}`
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