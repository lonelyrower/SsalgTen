/**
 * IP 地理位置服务
 * 用于获取访客的 IP 地址和地理位置信息
 */

export interface IPLocationData {
  ip: string;           // IPv4 地址
  ipv6?: string;        // IPv6 地址（如果可用）
  latitude: number;     // 纬度
  longitude: number;    // 经度
  city: string;         // 城市
  country: string;      // 国家名称
  countryCode: string;  // 国家代码（如 CN, US）
  timezone: string;     // 时区
  isp?: string;         // ISP 提供商
  org?: string;         // 组织名称
  regionName?: string;  // 省份/州
}

/**
 * API 响应接口 - ip-api.com
 */
interface IPApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  query: string;  // IP 地址
}

/**
 * 备用 API 响应接口 - ipapi.co
 */
interface IPApiCoResponse {
  ip: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  org: string;
}

class IPService {
  private cache: IPLocationData | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取访客的 IP 地理位置信息
   * 使用多个 API 作为备选方案
   */
  async getVisitorLocation(): Promise<IPLocationData> {
    // 检查缓存
    if (this.cache && Date.now() - this.cacheTime < this.CACHE_DURATION) {
      return this.cache;
    }

    // 尝试多个 API，按优先级顺序
    const apis = [
      this.fetchFromIPApi,
      this.fetchFromIPApiCo,
      this.fetchFromIPify,
    ];

    for (const api of apis) {
      try {
        const data = await api.call(this);
        if (data) {
          this.cache = data;
          this.cacheTime = Date.now();
          return data;
        }
      } catch (error) {
        console.warn(`IP API failed, trying next:`, error);
        continue;
      }
    }

    throw new Error('All IP geolocation APIs failed');
  }

  /**
   * 清除缓存（用于强制刷新）
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * 主要 API: ip-api.com
   * 免费，45次/分钟，支持 IPv4 和 IPv6
   */
  private async fetchFromIPApi(): Promise<IPLocationData | null> {
    const response = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,query', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ip-api.com returned ${response.status}`);
    }

    const data: IPApiResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error('ip-api.com returned failure status');
    }

    return {
      ip: data.query,
      latitude: data.lat,
      longitude: data.lon,
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.countryCode || '',
      timezone: data.timezone || '',
      isp: data.isp,
      org: data.org,
      regionName: data.regionName,
    };
  }

  /**
   * 备用 API 1: ipapi.co
   * 免费，30k次/月，支持 IPv4 和 IPv6
   */
  private async fetchFromIPApiCo(): Promise<IPLocationData | null> {
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ipapi.co returned ${response.status}`);
    }

    const data: IPApiCoResponse = await response.json();

    return {
      ip: data.ip,
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.country_code || '',
      timezone: data.timezone || '',
      org: data.org,
      regionName: data.region,
    };
  }

  /**
   * 备用 API 2: ipify + ipapi.co 组合
   * 先获取 IP，再获取位置信息
   */
  private async fetchFromIPify(): Promise<IPLocationData | null> {
    // 步骤 1: 获取 IP
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    if (!ipResponse.ok) {
      throw new Error('Failed to get IP from ipify');
    }
    const ipData = await ipResponse.json();
    const ip = ipData.ip;

    // 步骤 2: 使用 IP 获取位置信息
    const locationResponse = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!locationResponse.ok) {
      throw new Error('Failed to get location from ipapi.co');
    }

    const data: IPApiCoResponse = await locationResponse.json();

    return {
      ip: data.ip,
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.country_code || '',
      timezone: data.timezone || '',
      org: data.org,
      regionName: data.region,
    };
  }

  /**
   * 检查访客 IP 是否与某个节点的 IP 匹配
   */
  checkIPMatch(visitorIP: string, nodeIPs: { ipv4?: string; ipv6?: string }[]): number {
    const normalizedVisitorIP = visitorIP.trim().toLowerCase();

    for (let i = 0; i < nodeIPs.length; i++) {
      const node = nodeIPs[i];

      // 检查 IPv4 匹配
      if (node.ipv4 && node.ipv4.trim().toLowerCase() === normalizedVisitorIP) {
        return i;
      }

      // 检查 IPv6 匹配
      if (node.ipv6 && node.ipv6.trim().toLowerCase() === normalizedVisitorIP) {
        return i;
      }
    }

    return -1; // 未匹配
  }
}

// 导出单例
export const ipService = new IPService();
export default ipService;
