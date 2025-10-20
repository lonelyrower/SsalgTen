import axios, {
  type AxiosInstance,
  type AxiosResponseHeaders,
  type RawAxiosResponseHeaders,
} from 'axios';
import { promises as dns } from 'dns';

/**
 * 支持的流媒体服务
 */
export type StreamingService =
  | 'netflix'
  | 'disney_plus'
  | 'amazon_prime'
  | 'youtube'
  | 'tiktok'
  | 'spotify'
  | 'chatgpt';

/**
 * 流媒体状态
 */
export type StreamingStatus =
  | 'yes'
  | 'no'
  | 'org'
  | 'pending'
  | 'failed'
  | 'unknown';

/**
 * 解锁类型
 */
export type UnlockType = 'native' | 'dns' | 'idc' | 'unknown';

/**
 * 流媒体检测结果
 */
export interface StreamingResult {
  service: StreamingService;
  status: StreamingStatus;
  region?: string;
  unlockType?: UnlockType;
  details?: Record<string, unknown>;
  errorMsg?: string;
  testedAt: Date;
}

/**
 * 流媒体检测器
 * 参考 IPQuality.ip.sh 中的判定思路
 */
export class StreamingDetector {
  private axios: AxiosInstance;
  private userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  private geoCache: { country?: string; region?: string; isp?: string } | null = null;

  constructor() {
    this.axios = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': this.userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: () => true,
    });
  }

  /**
   * 依次检测所有服务
   */
  async detectAll(): Promise<StreamingResult[]> {
    const services: StreamingService[] = [
      'netflix',
      'disney_plus',
      'amazon_prime',
      'youtube',
      'tiktok',
      'spotify',
      'chatgpt',
    ];

    const results: StreamingResult[] = [];

    for (const service of services) {
      try {
        const result = await this.detectService(service);
        results.push(result);
      } catch (error) {
        results.push({
          service,
          status: 'failed',
          errorMsg: error instanceof Error ? error.message : 'Unknown error',
          testedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * 检测单个服务
   */
  async detectService(service: StreamingService): Promise<StreamingResult> {
    switch (service) {
      case 'netflix':
        return this.detectNetflix();
      case 'disney_plus':
        return this.detectDisneyPlus();
      case 'amazon_prime':
        return this.detectAmazonPrime();
      case 'youtube':
        return this.detectYouTube();
      case 'tiktok':
        return this.detectTikTok();
      case 'spotify':
        return this.detectSpotify();
      case 'chatgpt':
        return this.detectChatGPT();
      default:
        return {
          service,
          status: 'unknown',
          testedAt: new Date(),
        };
    }
  }

  /**
   * Netflix 检测
   * 参考 IPQuality ip.sh 中的片源判定逻辑
   */
  private async detectNetflix(): Promise<StreamingResult> {
    try {
      const globalTitle = 'https://www.netflix.com/title/81280792';
      const originalTitle = 'https://www.netflix.com/title/80018499';

      const [globalResp, originalResp] = await Promise.all([
        this.axios.get(globalTitle),
        this.axios.get(originalTitle),
      ]);

      const region =
        this.extractRegionFromHeaders(globalResp.headers) ??
        this.extractRegionFromHeaders(originalResp.headers) ??
        (await this.lookupGeoInfo()).country;

      const unlockType = await this.detectUnlockType('www.netflix.com');

      if (globalResp.status === 200) {
        return {
          service: 'netflix',
          status: 'yes',
          region,
          unlockType,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
          },
          testedAt: new Date(),
        };
      }

      if (globalResp.status === 404 && originalResp.status === 200) {
        return {
          service: 'netflix',
          status: 'org',
          region,
          unlockType,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
          },
          testedAt: new Date(),
        };
      }

      if (globalResp.status === 403) {
        return {
          service: 'netflix',
          status: 'no',
          region,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'netflix',
        status: 'failed',
        errorMsg: `Unexpected response: global=${globalResp.status}, original=${originalResp.status}`,
        details: {
          globalStatus: globalResp.status,
          originalStatus: originalResp.status,
        },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'netflix',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * Disney+ 检测
   * 利用主页提示信息判断地区可用性
   */
  private async detectDisneyPlus(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.disneyplus.com/');
      const html = typeof response.data === 'string' ? response.data : '';

      const unavailable =
        /unavailable in your region/i.test(html) ||
        /not available in your (location|country)/i.test(html);

      const region =
        this.extractRegionFromHeaders(response.headers) ??
        (await this.lookupGeoInfo()).country;

      if (response.status === 200 && !unavailable) {
        return {
          service: 'disney_plus',
          status: 'yes',
          region,
          unlockType: await this.detectUnlockType('www.disneyplus.com'),
          details: { homepageStatus: response.status },
          testedAt: new Date(),
        };
      }

      if (response.status === 200 && unavailable) {
        return {
          service: 'disney_plus',
          status: 'no',
          region,
          details: {
            homepageStatus: response.status,
            reason: 'unavailable_notice',
          },
          testedAt: new Date(),
        };
      }

      if (response.status === 403) {
        return {
          service: 'disney_plus',
          status: 'no',
          region,
          details: {
            homepageStatus: response.status,
            reason: 'http_403',
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'disney_plus',
        status: 'failed',
        errorMsg: `Unexpected status ${response.status}`,
        details: { homepageStatus: response.status },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'disney_plus',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * Amazon Prime Video 检测
   */
  private async detectAmazonPrime(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.primevideo.com/');
      const html = typeof response.data === 'string' ? response.data : '';

      const blocked =
        /not available in your location/i.test(html) ||
        /geographic restriction/i.test(html) ||
        /unavailable in your territory/i.test(html);

      const region =
        this.extractRegionFromHeaders(response.headers) ??
        (await this.lookupGeoInfo()).country;

      if (response.status === 200 && !blocked) {
        return {
          service: 'amazon_prime',
          status: 'yes',
          region,
          unlockType: await this.detectUnlockType('www.primevideo.com'),
          details: { homepageStatus: response.status },
          testedAt: new Date(),
        };
      }

      if ((response.status === 200 && blocked) || response.status === 403) {
        return {
          service: 'amazon_prime',
          status: 'no',
          region,
          details: {
            homepageStatus: response.status,
            reason: blocked ? 'blocked_notice' : 'http_403',
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'amazon_prime',
        status: 'failed',
        errorMsg: `Unexpected status ${response.status}`,
        details: { homepageStatus: response.status },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'amazon_prime',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * YouTube Premium 检测
   */
  private async detectYouTube(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.youtube.com/premium');

      if (response.status === 403 || response.status === 429) {
        return {
          service: 'youtube',
          status: 'no',
          testedAt: new Date(),
        };
      }

      const regionMatch = response.data.match(/"contentRegion":"([^"]+)"/);
      const region =
        (regionMatch ? regionMatch[1] : null) ?? (await this.lookupGeoInfo()).country ?? 'Global';

      const isAvailable =
        typeof response.data === 'string' &&
        (response.data.includes('Premium benefits') || response.data.includes('Ad-free'));

      return {
        service: 'youtube',
        status: isAvailable ? 'yes' : 'no',
        region,
        unlockType: await this.detectUnlockType('www.youtube.com'),
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'youtube',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * TikTok 检测
   */
  private async detectTikTok(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.tiktok.com/');

      const regionMatch = response.data.match(/"region":"([^"]+)"/);
      const region =
        (regionMatch ? regionMatch[1] : null) ?? (await this.lookupGeoInfo()).country ?? undefined;

      if (region) {
        return {
          service: 'tiktok',
          status: 'yes',
          region,
          unlockType: await this.detectUnlockType('www.tiktok.com'),
          testedAt: new Date(),
        };
      }

      return {
        service: 'tiktok',
        status: 'no',
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'tiktok',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * Spotify 检测
   */
  private async detectSpotify(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get(
        'https://spclient.wg.spotify.com/signup/public/v1/account/availability',
        {
          params: {
            key: '142b583129b2df829de3656f9eb484e6',
          },
          headers: {
            'User-Agent': 'Spotify/8.6.44 Android/29 (SM-G960F)',
            'Accept-Language': 'en',
          },
        },
      );

      const availability = response.data?.countries ?? response.data?.countryList ?? null;
      const countryCode =
        (Array.isArray(availability) && availability[0]) ||
        response.data?.country ||
        response.data?.countryCode ||
        (await this.lookupGeoInfo()).country;

      const status =
        response.status === 200 && countryCode ? 'yes' : 'no';

      return {
        service: 'spotify',
        status,
        region: countryCode,
        unlockType: await this.detectUnlockType('spclient.wg.spotify.com'),
        details: {
          availability,
          httpStatus: response.status,
        },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'spotify',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * ChatGPT 检测
   */
  private async detectChatGPT(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://chat.openai.com/');

      const isBlocked =
        response.status === 403 ||
        (typeof response.data === 'string' &&
          (response.data.includes('not available in your country') ||
            response.data.includes('VPN or proxy')));

      if (isBlocked) {
        return {
          service: 'chatgpt',
          status: 'no',
          testedAt: new Date(),
        };
      }

      return {
        service: 'chatgpt',
        status: response.status === 200 ? 'yes' : 'no',
        region: response.status === 200 ? (await this.lookupGeoInfo()).country : undefined,
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'chatgpt',
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * 解析解锁类型：对比本地 DNS 和 DoH 结果
   */
  private async detectUnlockType(domain: string): Promise<UnlockType> {
    try {
      const [localRecords, dohRecords] = await Promise.all([
        this.resolveLocal(domain),
        this.resolveDoh(domain),
      ]);

      if (!localRecords.length || !dohRecords.length) {
        return 'unknown';
      }

      const intersection = localRecords.filter((ip) => dohRecords.includes(ip));

      if (intersection.length === 0) {
        return 'dns';
      }

      if (intersection.length === dohRecords.length) {
        return 'native';
      }

      return 'idc';
    } catch {
      return 'unknown';
    }
  }

  private async resolveLocal(domain: string): Promise<string[]> {
    try {
      const records = await dns.resolve4(domain);
      return records;
    } catch {
      return [];
    }
  }

  private async resolveDoh(domain: string): Promise<string[]> {
    try {
      const resp = await this.axios.get('https://dns.google/resolve', {
        params: {
          name: domain,
          type: 'A',
        },
        timeout: 5000,
      });

      const answers = resp.data?.Answer;
      if (!Array.isArray(answers)) {
        return [];
      }

      return answers
        .filter((item: { data?: string; type?: number }) => item?.type === 1 && typeof item?.data === 'string')
        .map((item: { data: string }) => item.data);
    } catch {
      return [];
    }
  }

  private extractRegionFromHeaders(
    headers: AxiosResponseHeaders | RawAxiosResponseHeaders,
  ): string | undefined {
    const normalized: Record<string, string | string[]> = {};

    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value as string | string[];
    });

    const candidates = ['x-geo-country', 'x-country', 'cf-ipcountry', 'geoip-country'];
    for (const key of candidates) {
      const value = normalized[key];
      if (typeof value === 'string' && value.length === 2) {
        return value.toUpperCase();
      }
    }

    const origin = normalized['x-originating-url'];
    if (typeof origin === 'string') {
      const match = origin.match(/country=([A-Z]{2})/i);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    return undefined;
  }

  private async lookupGeoInfo(): Promise<{ country?: string; region?: string; isp?: string }> {
    if (this.geoCache) {
      return this.geoCache;
    }

    try {
      const resp = await this.axios.get('https://api.ip.sb/geoip', { timeout: 5000 });
      this.geoCache = {
        country:
          resp.data?.country_code ||
          resp.data?.country_code_iso ||
          resp.data?.country_iso_code ||
          resp.data?.country,
        region: resp.data?.region,
        isp: resp.data?.organization || resp.data?.isp,
      };
      return this.geoCache;
    } catch {
      this.geoCache = {};
      return this.geoCache;
    }
  }
}

export const streamingDetector = new StreamingDetector();
