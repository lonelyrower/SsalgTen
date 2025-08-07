import { Request, Response } from 'express';
import { networkService } from '../services/NetworkService';
import { logger } from '../utils/logger';

export class DiagnosticController {
  
  // Ping 控制器
  async ping(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { count } = req.query;
    
    if (!target) {
      res.status(400).json({
        success: false,
        error: 'Target parameter is required'
      });
      return;
    }

    try {
      logger.info(`Ping request: ${target}`);
      
      const result = await networkService.ping(
        target,
        count ? parseInt(count as string) : undefined
      );
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Ping controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ping failed'
      });
    }
  }

  // Traceroute 控制器
  async traceroute(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { maxHops } = req.query;
    
    if (!target) {
      res.status(400).json({
        success: false,
        error: 'Target parameter is required'
      });
      return;
    }

    try {
      logger.info(`Traceroute request: ${target}`);
      
      const result = await networkService.traceroute(
        target,
        maxHops ? parseInt(maxHops as string) : undefined
      );
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Traceroute controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Traceroute failed'
      });
    }
  }

  // MTR 控制器
  async mtr(req: Request, res: Response): Promise<void> {
    const { target } = req.params;
    const { count } = req.query;
    
    if (!target) {
      res.status(400).json({
        success: false,
        error: 'Target parameter is required'
      });
      return;
    }

    try {
      logger.info(`MTR request: ${target}`);
      
      const result = await networkService.mtr(
        target,
        count ? parseInt(count as string) : undefined
      );
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('MTR controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'MTR failed'
      });
    }
  }

  // Speedtest 控制器
  async speedtest(req: Request, res: Response): Promise<void> {
    const { serverId } = req.query;
    
    try {
      logger.info('Speedtest request started');
      
      // 发送开始响应
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
      });
      
      res.write('Starting speedtest...\n');
      
      const result = await networkService.speedtest(serverId as string);
      
      res.write(JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }));
      
      res.end();
    } catch (error) {
      logger.error('Speedtest controller error:', error);
      
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Speedtest failed'
      };
      
      if (!res.headersSent) {
        res.status(500).json(errorResponse);
      } else {
        res.write(JSON.stringify(errorResponse));
        res.end();
      }
    }
  }

  // 网络信息
  async networkInfo(req: Request, res: Response): Promise<void> {
    try {
      const info = await networkService.getNetworkInfo();
      
      res.json({
        success: true,
        data: info,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Network info error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get network info'
      });
    }
  }
}

export const diagnosticController = new DiagnosticController();