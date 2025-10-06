import axios from 'axios';
import { config } from '../config';
import { getSystemInfo } from '../utils/system';
import { logger } from '../utils/logger';
import { HeartbeatData } from '../types';
import { buildSignedHeaders } from '../utils/signing';
import { http } from '../utils/http';
import { securityMonitor } from './SecurityMonitor';

export class HeartbeatService {
  private intervalId: NodeJS.Timeout | null = null;

  // 开始心跳
  start(): void {
    logger.info('Starting heartbeat service...');
    
    // 立即发送一次心跳
    this.sendHeartbeat();
    
    // 设置定时心跳
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, config.heartbeatInterval);
    
    logger.info(`Heartbeat interval set to ${config.heartbeatInterval}ms`);
  }

  // 停止心跳
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Heartbeat service stopped');
    }
  }

  // 发送心跳到主控端
  private async sendHeartbeat(): Promise<void> {
    try {
      const systemInfo = await getSystemInfo();

      // 检查 SSH 暴力破解
      const securityData = await securityMonitor.checkSshBruteforce();

      const heartbeatData: HeartbeatData = {
        agentId: config.id,
        timestamp: new Date(),
        status: 'online',
        systemInfo,
        security: securityData || undefined,
        version: '0.1.0'
      };

      const response = await http.post(
        `${config.masterUrl}/api/agents/heartbeat`,
        heartbeatData,
        {
          headers: {
            ...buildSignedHeaders(config.apiKey, heartbeatData)
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        logger.debug('Heartbeat sent successfully');
      } else {
        logger.warn(`Heartbeat failed with status ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.warn('Master server unavailable');
        } else {
          logger.error('Heartbeat failed:', error.message);
        }
      } else {
        logger.error('Heartbeat error:', error);
      }
    }
  }

  // 注册节点到主控端
  async registerNode(): Promise<boolean> {
    try {
      logger.info('Registering node with master server...');
      
      const registrationData = {
        id: config.id,
        name: config.name,
        location: config.location,
        provider: config.provider,
        apiKey: config.apiKey,
        capabilities: ['ping', 'traceroute', 'mtr', 'speedtest'],
        version: '0.1.0'
      };

      const response = await axios.post(
        `${config.masterUrl}/api/agents/register`,
        registrationData,
        {
          headers: {
            'Content-Type': 'application/json',
            ...buildSignedHeaders(config.apiKey, registrationData)
          },
          timeout: 15000
        }
      );

      if (response.status === 200 || response.status === 201) {
        logger.info('Node registered successfully');
        return true;
      } else {
        logger.warn(`Registration failed with status ${response.status}`);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Registration failed:', error.message);
      } else {
        logger.error('Registration error:', error);
      }
      return false;
    }
  }
}

export const heartbeatService = new HeartbeatService();
