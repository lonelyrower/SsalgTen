import axios from 'axios';
import { logger } from '../utils/logger';

export interface ASNInfo {
  asn: string;
  name: string;
  org: string;
  route: string;
  type: string;
}

export interface IPInfo {
  ip: string;
  hostname?: string;
  city: string;
  region: string;
  country: string;
  loc: string; // "latitude,longitude"
  postal?: string;
  timezone: string;
  asn: ASNInfo;
  company?: {
    name: string;
    domain?: string;
    type?: string;
  };
}

export interface VisitorInfo {
  ip: string;
  userAgent: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  timezone?: string;
  asn?: ASNInfo;
  company?: {
    name: string;
    domain?: string;
    type?: string;
  };
}

class IPInfoService {
  private ipinfoToken: string;
  private cache: Map<string, { data: IPInfo; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存
  
  constructor() {
    // 使用免费的ipinfo.io服务，支持ASN查询
    this.ipinfoToken = process.env.IPINFO_TOKEN || '';
  }

  /**
   * 获取IP详细信息包括ASN
   */
  async getIPInfo(ip: string): Promise<IPInfo | null> {
    try {
      // 检查缓存
      const cached = this.cache.get(ip);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // 构建请求URL
      const baseUrl = 'https://ipinfo.io';
      const url = this.ipinfoToken 
        ? `${baseUrl}/${ip}?token=${this.ipinfoToken}`
        : `${baseUrl}/${ip}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SsalgTen-NetworkMonitor/1.0'
        }
      });

      const data = response.data;
      
      // 解析ASN信息从org字段 (格式: "AS15169 Google LLC")
      let asnInfo: ASNInfo = {
        asn: 'Unknown',
        name: 'Unknown', 
        org: data.org || 'Unknown',
        route: 'N/A',
        type: 'N/A'
      };

      if (data.org) {
        const orgMatch = data.org.match(/^AS(\d+)\s+(.+)$/);
        if (orgMatch) {
          asnInfo.asn = `AS${orgMatch[1]}`;
          asnInfo.name = orgMatch[2].trim();
          
          // 根据ASN名称和已知信息推断类型
          const name = asnInfo.name.toLowerCase();
          if (name.includes('google') || name.includes('amazon') || name.includes('microsoft') || 
              name.includes('facebook') || name.includes('cloudflare') || name.includes('apple')) {
            asnInfo.type = 'Content/CDN';
          } else if (name.includes('telecom') || name.includes('mobile') || name.includes('wireless') ||
                     name.includes('cellular') || name.includes('lte') || name.includes('5g')) {
            asnInfo.type = 'Mobile/ISP';
          } else if (name.includes('hosting') || name.includes('server') || name.includes('cloud') ||
                     name.includes('datacenter') || name.includes('digital ocean') || name.includes('linode')) {
            asnInfo.type = 'Hosting';
          } else if (name.includes('university') || name.includes('edu') || name.includes('research') ||
                     name.includes('academic') || name.includes('institute')) {
            asnInfo.type = 'Education';
          } else if (name.includes('government') || name.includes('gov') || name.includes('military') ||
                     name.includes('defense')) {
            asnInfo.type = 'Government';
          } else if (name.includes('isp') || name.includes('internet') || name.includes('broadband') ||
                     name.includes('fiber') || name.includes('cable')) {
            asnInfo.type = 'ISP';
          } else if (name.includes('exchange') || name.includes('ix') || name.includes('peering')) {
            asnInfo.type = 'IX/Peering';
          } else {
            asnInfo.type = 'Commercial';
          }
          
          // 路由信息通常需要专业数据源，这里设置为通用提示
          asnInfo.route = 'Check BGP tables';
        } else {
          // 如果没有AS前缀，直接使用org作为name
          asnInfo.name = data.org;
          asnInfo.type = 'Unknown';
        }
      }

      const ipInfo: IPInfo = {
        ip: data.ip,
        hostname: data.hostname,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown', 
        country: data.country || 'Unknown',
        loc: data.loc || '0,0',
        postal: data.postal,
        timezone: data.timezone || 'UTC',
        asn: asnInfo,
        company: data.company ? {
          name: data.company.name || 'Unknown',
          domain: data.company.domain,
          type: data.company.type
        } : undefined
      };

      // 缓存结果
      this.cache.set(ip, { data: ipInfo, timestamp: Date.now() });
      
      logger.info(`获取IP信息成功: ${ip} - ASN: ${asnInfo.asn} (${asnInfo.name})`);
      return ipInfo;

    } catch (error: any) {
      logger.error('获取IP信息失败:', { ip, error: error?.message });
      
      // 返回基础信息作为降级
      return {
        ip,
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        loc: '0,0',
        timezone: 'UTC',
        asn: {
          asn: 'Unknown',
          name: 'Unknown',
          org: 'Unknown',
          route: 'N/A',
          type: 'N/A'
        }
      };
    }
  }

  /**
   * 批量获取IP信息
   */
  async getBatchIPInfo(ips: string[]): Promise<Map<string, IPInfo>> {
    const results = new Map<string, IPInfo>();
    
    // 并发查询，但限制并发数
    const batchSize = 5;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const promises = batch.map(ip => this.getIPInfo(ip));
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(batch[index], result.value);
        }
      });
    }
    
    return results;
  }

  /**
   * 解析访问者信息
   */
  async getVisitorInfo(req: any): Promise<VisitorInfo> {
    // 获取真实IP地址
    const ip = this.extractRealIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    try {
      const ipInfo = await this.getIPInfo(ip);
      
      return {
        ip,
        userAgent,
        hostname: ipInfo?.hostname,
        city: ipInfo?.city,
        region: ipInfo?.region,
        country: ipInfo?.country,
        loc: ipInfo?.loc,
        timezone: ipInfo?.timezone,
        asn: ipInfo?.asn,
        company: ipInfo?.company
      };
    } catch (error: any) {
      logger.error('获取访问者信息失败:', { ip, error: error?.message });
      
      return {
        ip,
        userAgent
      };
    }
  }

  /**
   * 提取真实IP地址
   */
  private extractRealIP(req: any): string {
    // 检查各种可能的IP头
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return ips[0]; // 返回第一个IP（客户端真实IP）
    }
    
    return req.headers['x-real-ip'] || 
           req.headers['x-client-ip'] || 
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'Unknown';
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('IP信息缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL
    };
  }
}

export const ipInfoService = new IPInfoService();