import { Request, Response } from 'express';
import { networkService } from '../services/NetworkService';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface DiagnosticResponse {
  success: boolean;
  data?: any;
  error?: string;
  agent?: {
    id: string;
    name: string;
    location: string;
  };
  timestamp?: string;
}

export class DiagnosticController {
  
  // Ping 控制器
  async ping(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { count } = req.query;
    
    if (!target) {
      const response: DiagnosticResponse = {
        success: false,
        error: 'Target parameter is required'
      };
      res.status(400).json(response);
      return;
    }

    try {
      logger.info(`Starting ping test to ${target}`);
      const startTime = Date.now();
      
      const result = await networkService.ping(
        target,
        count ? parseInt(count as string) : undefined
      );
      
      const duration = Date.now() - startTime;
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          ...result,
          duration,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info(`Ping test completed for ${target}: ${result.avg}ms avg`);
      res.json(response);
    } catch (error) {
      logger.error(`Ping test failed for ${target}:`, error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Ping test failed',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // Traceroute 控制器
  async traceroute(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { maxHops } = req.query;
    
    if (!target) {
      const response: DiagnosticResponse = {
        success: false,
        error: 'Target parameter is required'
      };
      res.status(400).json(response);
      return;
    }

    try {
      logger.info(`Starting traceroute test to ${target}`);
      const startTime = Date.now();
      
      const result = await networkService.traceroute(
        target,
        maxHops ? parseInt(maxHops as string) : undefined
      );
      
      const duration = Date.now() - startTime;
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          ...result,
          duration,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info(`Traceroute test completed for ${target}: ${result.totalHops} hops`);
      res.json(response);
    } catch (error) {
      logger.error(`Traceroute test failed for ${target}:`, error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Traceroute test failed',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // MTR 控制器
  async mtr(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { count } = req.query;
    
    if (!target) {
      const response: DiagnosticResponse = {
        success: false,
        error: 'Target parameter is required'
      };
      res.status(400).json(response);
      return;
    }

    try {
      logger.info(`Starting MTR test to ${target}`);
      const startTime = Date.now();
      
      const result = await networkService.mtr(
        target,
        count ? parseInt(count as string) : undefined
      );
      
      const duration = Date.now() - startTime;
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          ...result,
          duration,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info(`MTR test completed for ${target}`);
      res.json(response);
    } catch (error) {
      logger.error(`MTR test failed for ${target}:`, error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'MTR test failed',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // Speedtest 控制器
  async speedtest(req: Request, res: Response): Promise<void> {
    const { serverId } = req.query;
    
    try {
      logger.info('Starting speedtest');
      const startTime = Date.now();
      
      const result = await networkService.speedtest(serverId as string | undefined);
      
      const duration = Date.now() - startTime;
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          ...result,
          duration,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info(`Speedtest completed: ${result.download}Mbps down, ${result.upload}Mbps up`);
      res.json(response);
    } catch (error) {
      logger.error('Speedtest failed:', error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Speedtest failed',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // 网络信息
  async networkInfo(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting network information');
      
      const result = await networkService.getNetworkInfo();
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          ...result,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info('Network information retrieved');
      res.json(response);
    } catch (error) {
      logger.error('Failed to get network info:', error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get network info',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // 连接性测试
  async connectivity(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Starting connectivity test');
      const startTime = Date.now();
      
      const result = await networkService.testConnectivity();
      
      const duration = Date.now() - startTime;
      
      const response: DiagnosticResponse = {
        success: true,
        data: {
          connectivity: result,
          duration,
          executedAt: config.name
        },
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info('Connectivity test completed');
      res.json(response);
    } catch (error) {
      logger.error('Connectivity test failed:', error);
      const response: DiagnosticResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Connectivity test failed',
        agent: {
          id: config.id,
          name: config.name,
          location: `${config.location.city}, ${config.location.country}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}

export const diagnosticController = new DiagnosticController();