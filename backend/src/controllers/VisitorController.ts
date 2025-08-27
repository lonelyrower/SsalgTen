import { Request, Response } from 'express';
import { ipInfoService } from '../services/IPInfoService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class VisitorController {
  
  /**
   * 获取访问者IP信息
   */
  async getVisitorInfo(req: Request, res: Response): Promise<void> {
    try {
      const visitorInfo = await ipInfoService.getVisitorInfo(req);
      
      // 记录访问者信息到数据库
      try {
        const [lat, lng] = (visitorInfo.loc || '0,0').split(',').map(parseFloat);
        
        await prisma.visitorLog.create({
          data: {
            ip: visitorInfo.ip,
            userAgent: visitorInfo.userAgent,
            city: visitorInfo.city,
            region: visitorInfo.region,
            country: visitorInfo.country,
            latitude: isNaN(lat) ? null : lat,
            longitude: isNaN(lng) ? null : lng,
            timezone: visitorInfo.timezone,
            asnNumber: visitorInfo.asn?.asn,
            asnName: visitorInfo.asn?.name,
            asnOrg: visitorInfo.asn?.org,
            company: visitorInfo.company?.name,
            endpoint: req.originalUrl,
            method: req.method,
            referer: req.headers.referer,
          }
        });
      } catch (dbError) {
        // 数据库记录失败不影响API响应
        logger.warn('Failed to log visitor info:', dbError);
      }

      res.json({
        success: true,
        data: visitorInfo
      });
    } catch (error) {
      logger.error('Failed to get visitor info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor information'
      });
    }
  }

  /**
   * 获取IP详细信息
   */
  async getIPDetails(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.params;
      
      if (!ip) {
        res.status(400).json({
          success: false,
          error: 'IP address is required'
        });
        return;
      }

      // 验证IP地址格式
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      if (!ipRegex.test(ip)) {
        res.status(400).json({
          success: false,
          error: 'Invalid IP address format'
        });
        return;
      }

      const ipInfo = await ipInfoService.getIPInfo(ip);
      
      if (!ipInfo) {
        res.status(404).json({
          success: false,
          error: 'IP information not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ipInfo
      });
    } catch (error) {
      logger.error(`Failed to get IP details for ${req.params.ip}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get IP information'
      });
    }
  }

  /**
   * 获取访问者统计信息
   */
  async getVisitorStats(req: Request, res: Response): Promise<void> {
    try {
      const { days = 7 } = req.query;
      const daysNumber = parseInt(days as string);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysNumber);

      const [
        totalVisitors,
        uniqueIPs,
        topCountries,
        topASNs,
        recentVisitors
      ] = await Promise.all([
        // 总访问量
        prisma.visitorLog.count({
          where: {
            createdAt: { gte: cutoffDate }
          }
        }),
        
        // 唯一IP数量 (优化性能)
        prisma.$queryRaw`SELECT COUNT(DISTINCT ip) as count FROM visitorLog WHERE createdAt >= ${cutoffDate}` as Promise<[{ count: bigint }]>,
        
        // 访问量最多的国家
        prisma.visitorLog.groupBy({
          by: ['country'],
          where: {
            createdAt: { gte: cutoffDate },
            country: { not: null }
          },
          _count: true,
          orderBy: { _count: { ip: 'desc' } },
          take: 10
        }),
        
        // 访问量最多的ASN
        prisma.visitorLog.groupBy({
          by: ['asnName'],
          where: {
            createdAt: { gte: cutoffDate },
            asnName: { not: null }
          },
          _count: true,
          orderBy: { _count: { ip: 'desc' } },
          take: 10
        }),
        
        // 最近的访问者
        prisma.visitorLog.findMany({
          where: {
            createdAt: { gte: cutoffDate }
          },
          select: {
            ip: true,
            country: true,
            city: true,
            asnName: true,
            userAgent: true,
            endpoint: true,
            referer: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })
      ]);

      res.json({
        success: true,
        data: {
          totalVisitors,
          uniqueIPs: Number(uniqueIPs[0]?.count || 0),
          topCountries: topCountries.map((item: any) => ({
            country: item.country,
            count: item._count
          })),
          topASNs: topASNs.map((item: any) => ({
            asn: item.asnName,
            count: item._count
          })),
          recentVisitors
        }
      });
    } catch (error) {
      logger.error('Failed to get visitor stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor statistics'
      });
    }
  }

  /**
   * 获取IP信息服务的缓存统计
   */
  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = ipInfoService.getCacheStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics'
      });
    }
  }

  /**
   * 清理IP信息缓存
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      ipInfoService.clearCache();
      
      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  }
}

export const visitorController = new VisitorController();