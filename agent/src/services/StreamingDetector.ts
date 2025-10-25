import axios, {
  type AxiosInstance,
  type AxiosResponseHeaders,
  type RawAxiosResponseHeaders,
} from 'axios';
import { promises as dns } from 'dns';
import zlib from 'zlib';

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
  | 'noprem'
  | 'pending'
  | 'cn'
  | 'app'
  | 'web'
  | 'failed'
  | 'unknown';

/**
 * 解锁类型
 */
export type UnlockType = 'native' | 'dns' | 'unknown';

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

  private readonly netflixTitles = {
    global: 'https://www.netflix.com/title/81280792',
    original: 'https://www.netflix.com/title/70143836',
  };

  private readonly disneyTokenPayloadTemplate =
    'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&latitude=0&longitude=0&platform=browser&subject_token=DISNEYASSERTION&subject_token_type=urn%3Abamtech%3Aparams%3Aoauth%3Atoken-type%3Adevice';

  private readonly disneyGraphPayloadTemplate = {
    query:
      'mutation refreshToken($input: RefreshTokenInput!) {\n            refreshToken(refreshToken: $input) {\n                activeSession {\n                    sessionId\n                }\n            }\n        }',
    variables: {
      input: {
        refreshToken: 'ILOVEDISNEY',
      },
    },
  };

  private readonly disneyAuthorization =
    'Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84';

  private readonly spotifySignupBody =
    'birth_day=11&birth_month=11&birth_year=2000&collect_personal_info=undefined&creation_flow=&creation_point=https%3A%2F%2Fwww.spotify.com%2Fhk-en%2F&displayname=Gay%20Lord&gender=male&iagree=1&key=a1e486e2729f46d6bb368d6b2bcda326&platform=www&identifier_token=AgE6YTvEzkReHNfJpO114514&referrer=&send-email=0&thirdpartyemail=0';

  private readonly youtubeCookie =
    'YSC=BiCUU3-5Gdk; CONSENT=YES+cb.20220301-11-p0.en+FX+700; GPS=1; VISITOR_INFO1_LIVE=4VwPMkB7W5A; PREF=tz=Asia.Shanghai; _gcl_au=1.1.1809531354.1646633279';

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
      const [globalResp, originalResp] = await Promise.all([
        this.axios.get(this.netflixTitles.global, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }),
        this.axios.get(this.netflixTitles.original, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }),
      ]);

      const htmlGlobal = typeof globalResp.data === 'string' ? globalResp.data : '';
      const htmlOriginal = typeof originalResp.data === 'string' ? originalResp.data : '';

      if (!htmlGlobal || !htmlOriginal) {
        return {
          service: 'netflix',
          status: 'failed',
          errorMsg: 'Empty response from Netflix titles',
          testedAt: new Date(),
        };
      }

      const region =
        this.parseNetflixRegion(htmlGlobal) ||
        this.parseNetflixRegion(htmlOriginal) ||
        this.extractRegionFromHeaders(globalResp.headers) ||
        this.extractRegionFromHeaders(originalResp.headers) ||
        (await this.lookupGeoInfo()).country;

      const unlockType = await this.detectUnlockType('www.netflix.com');

      const globalOk = globalResp.status === 200;
      const originalOk = originalResp.status === 200;
      const globalHasOhNo = /Oh no!/i.test(htmlGlobal);
      const originalHasOhNo = /Oh no!/i.test(htmlOriginal);

      // 按照 IPQuality 逻辑：
      // 1. 两个都成功且都没有 "Oh no!" -> 完全解锁
      // 2. 至少一个包含 "Oh no!" -> 仅自制
      // 3. 请求失败或两个都是 "Oh no!" -> 屏蔽

      if (globalOk && originalOk && !globalHasOhNo && !originalHasOhNo) {
        // 完全解锁
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

      if ((globalOk || originalOk) && (globalHasOhNo || originalHasOhNo)) {
        // 仅自制：至少一个请求成功但包含 "Oh no!"
        return {
          service: 'netflix',
          status: 'org',
          region,
          unlockType,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
            globalHasOhNo,
            originalHasOhNo,
          },
          testedAt: new Date(),
        };
      }

      // 屏蔽：请求失败或两个都是错误
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
      const deviceResp = await this.axios.post(
        'https://disney.api.edge.bamgrid.com/devices',
        {
          deviceFamily: 'browser',
          applicationRuntime: 'chrome',
          deviceProfile: 'windows',
          attributes: {},
        },
        {
          headers: {
            Authorization: this.disneyAuthorization,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': this.userAgent,
          },
        },
      );

      const assertion: string | undefined = deviceResp.data?.assertion;
      if (!assertion) {
        return {
          service: 'disney_plus',
          status: 'failed',
          errorMsg: 'Failed to obtain Disney+ device assertion',
          testedAt: new Date(),
        };
      }

      const tokenPayload = this.disneyTokenPayloadTemplate.replace(
        'DISNEYASSERTION',
        encodeURIComponent(assertion),
      );

      const tokenResp = await this.axios.post(
        'https://disney.api.edge.bamgrid.com/token',
        tokenPayload,
        {
          headers: {
            Authorization: this.disneyAuthorization,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
        },
      );

      const forbidden = tokenResp.data?.error_description === 'forbidden-location';
      if (forbidden || tokenResp.status === 403) {
        return {
          service: 'disney_plus',
          status: 'no',
          details: {
            tokenStatus: tokenResp.status,
            error: tokenResp.data?.error_description,
          },
          testedAt: new Date(),
        };
      }

      const refreshToken: string | undefined = tokenResp.data?.refresh_token;
      if (!refreshToken) {
        return {
          service: 'disney_plus',
          status: 'failed',
          errorMsg: 'No refresh token returned from Disney+ token endpoint',
          testedAt: new Date(),
        };
      }

      const graphPayload = JSON.parse(
        JSON.stringify(this.disneyGraphPayloadTemplate).replace(
          'ILOVEDISNEY',
          refreshToken,
        ),
      );

      const graphResp = await this.axios.post(
        'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
        graphPayload,
        {
          headers: {
            Authorization: this.disneyAuthorization,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': this.userAgent,
          },
        },
      );

      const region = graphResp.data?.extensions?.sdk?.session?.location?.countryCode;
      const inSupportedLocation = graphResp.data?.extensions?.sdk?.session?.inSupportedLocation;

      const previewResp = await this.axios.get('https://disneyplus.com', {
        maxRedirects: 5,
      });
      const previewUrl: string | undefined =
        (previewResp.request as any)?.res?.responseUrl || previewResp.headers?.location;
      const isUnavailable = typeof previewUrl === 'string' && /unavailable|preview/i.test(previewUrl);

      const unlockType = await this.detectUnlockType('www.disneyplus.com');

      if (region === 'JP') {
        return {
          service: 'disney_plus',
          status: 'yes',
          region,
          unlockType,
          testedAt: new Date(),
        };
      }

      if (region && inSupportedLocation === false && !isUnavailable) {
        return {
          service: 'disney_plus',
          status: 'pending',
          region,
          unlockType,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      if ((region && isUnavailable) || !region) {
        return {
          service: 'disney_plus',
          status: 'no',
          region: region || undefined,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      if (region && inSupportedLocation === true) {
        return {
          service: 'disney_plus',
          status: 'yes',
          region,
          unlockType,
          testedAt: new Date(),
        };
      }

      return {
        service: 'disney_plus',
        status: 'failed',
        errorMsg: 'Unable to determine Disney+ availability',
        details: {
          inSupportedLocation,
          previewUrl,
        },
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
      const response = await this.axios.get('https://www.primevideo.com/', {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const html = typeof response.data === 'string' ? response.data : '';

      const regionMatch = html.match(/"currentTerritory":"([A-Z]{2})"/i);
      const region =
        (regionMatch ? regionMatch[1] : undefined) ||
        this.extractRegionFromHeaders(response.headers) ||
        (await this.lookupGeoInfo()).country;

      const blocked =
        /not available in your (location|territory)/i.test(html) ||
        /geographic restriction/i.test(html);

      if (response.status === 200 && !blocked && region) {
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
      const response = await this.axios.get('https://www.youtube.com/premium', {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en',
          Cookie: this.youtubeCookie,
        },
      });

      const html = typeof response.data === 'string' ? response.data : '';

      const regionMatch = html.match(/"contentRegion":"([A-Z]{2})"/i);
      const region =
        (regionMatch ? regionMatch[1] : undefined) ||
        this.extractRegionFromHeaders(response.headers) ||
        (await this.lookupGeoInfo()).country;

      const isCn = /www\.google\.cn/i.test(html);
      const notAvailable = /Premium is not available in your country/i.test(html);
      const hasPremiumCopy = /Premium benefits/i.test(html) || /Ad-free/i.test(html);

      const unlockType = await this.detectUnlockType('www.youtube.com');

      if (isCn) {
        return {
          service: 'youtube',
          status: 'cn',
          region: 'CN',
          details: { reason: 'google_cn_redirect' },
          testedAt: new Date(),
        };
      }

      if (notAvailable) {
        return {
          service: 'youtube',
          status: 'noprem',
          region,
          details: { reason: 'premium_not_available' },
          testedAt: new Date(),
        };
      }

      if (hasPremiumCopy) {
        return {
          service: 'youtube',
          status: 'yes',
          region,
          unlockType,
          testedAt: new Date(),
        };
      }

      return {
        service: 'youtube',
        status: 'failed',
        errorMsg: 'Unable to determine YouTube Premium availability',
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
      const response = await this.axios.get('https://www.tiktok.com/', {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en',
        },
      });

      let html = typeof response.data === 'string' ? response.data : '';
      let regionMatch = html.match(/"region":"([A-Z]{2})"/i);

      if (!regionMatch) {
        const compressed = await this.axios.get('https://www.tiktok.com/', {
          headers: {
            'User-Agent': this.userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Encoding': 'gzip',
            'Accept-Language': 'en',
          },
          responseType: 'arraybuffer',
        });

        try {
          html = zlib.gunzipSync(Buffer.from(compressed.data)).toString('utf-8');
          regionMatch = html.match(/"region":"([A-Z]{2})"/i);
          if (regionMatch) {
            return {
              service: 'tiktok',
              status: 'yes',
              region: regionMatch[1],
              unlockType: await this.detectUnlockType('www.tiktok.com'),
              details: { detection: 'gzipped' },
              testedAt: new Date(),
            };
          }
        } catch {
          // Ignore decompression errors
        }
      }

      const region =
        (regionMatch ? regionMatch[1] : undefined) || (await this.lookupGeoInfo()).country;

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
      const response = await this.axios.post(
        'https://spclient.wg.spotify.com/signup/public/v1/account',
        this.spotifySignupBody,
        {
          headers: {
            'User-Agent': 'Spotify/8.6.44 Android/29 (SM-G960F)',
            'Accept-Language': 'en',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (typeof response.data !== 'object') {
        return {
          service: 'spotify',
          status: 'failed',
          errorMsg: 'Unexpected Spotify response',
          testedAt: new Date(),
        };
      }

      const statusCode = String(response.data.status ?? '000');
      const region = response.data.country || (await this.lookupGeoInfo()).country;
      const isLaunched = response.data.is_country_launched === true;
      const unlockType = await this.detectUnlockType('spclient.wg.spotify.com');

      if (statusCode === '320' || statusCode === '120') {
        return {
          service: 'spotify',
          status: 'no',
          region,
          details: {
            statusCode,
            message: response.data.message,
          },
          testedAt: new Date(),
        };
      }

      if (statusCode === '311' && isLaunched && region) {
        return {
          service: 'spotify',
          status: 'yes',
          region,
          unlockType,
          details: {
            statusCode,
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'spotify',
        status: 'failed',
        errorMsg: `Unhandled Spotify status ${statusCode}`,
        details: {
          response: response.data,
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
      const [complianceResp, iosResp] = await Promise.all([
        this.axios.get('https://api.openai.com/compliance/cookie_requirements', {
          headers: {
            Authorization: 'Bearer null',
            Origin: 'https://platform.openai.com',
            Referer: 'https://platform.openai.com/',
            'User-Agent': this.userAgent,
          },
        }),
        this.axios.get('https://ios.chat.openai.com/', {
          headers: {
            'User-Agent': this.userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en',
          },
        }),
      ]);

      const complianceBlocked =
        typeof complianceResp.data === 'object' &&
        complianceResp.data?.error === 'unsupported_country';

      const iosHtml = typeof iosResp.data === 'string' ? iosResp.data : '';
      const iosBlocked = /not available in your country/i.test(iosHtml) || /VPN/i.test(iosHtml);

      // 根据 IPQuality 标准判断状态
      if (complianceBlocked && iosBlocked) {
        // 两者都被屏蔽
        return {
          service: 'chatgpt',
          status: 'no',
          details: {
            complianceStatus: complianceResp.status,
            iosBlocked: true,
          },
          testedAt: new Date(),
        };
      }

      if (complianceBlocked && !iosBlocked) {
        // API 受限但 iOS 可用 -> 仅APP
        return {
          service: 'chatgpt',
          status: 'app',
          details: {
            complianceStatus: complianceResp.status,
            iosAvailable: true,
          },
          testedAt: new Date(),
        };
      }

      if (!complianceBlocked && iosBlocked) {
        // iOS 被 VPN 检测但 API 可用 -> 仅Web
        return {
          service: 'chatgpt',
          status: 'web',
          details: {
            apiAvailable: true,
            iosBlocked: true,
          },
          testedAt: new Date(),
        };
      }

      let region: string | undefined;
      try {
        const trace = await this.axios.get('https://chat.openai.com/cdn-cgi/trace', {
          headers: {
            'User-Agent': this.userAgent,
          },
        });
        if (typeof trace.data === 'string') {
          const locMatch = trace.data.match(/loc=([A-Z]{2})/i);
          if (locMatch) {
            region = locMatch[1];
          }
        }
      } catch {
        // ignore trace failure
      }

      if (!region) {
        region = (await this.lookupGeoInfo()).country;
      }

      return {
        service: 'chatgpt',
        status: 'yes',
        region,
        unlockType: await this.detectUnlockType('api.openai.com'),
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
   * 根据 IPQuality 逻辑：只区分 native 和 dns
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

      // 完全匹配：原生解锁
      if (intersection.length === dohRecords.length && intersection.length === localRecords.length) {
        return 'native';
      }

      // 不匹配或部分匹配：DNS 解锁
      if (intersection.length === 0 || intersection.length < dohRecords.length) {
        return 'dns';
      }

      // 默认：原生
      return 'native';
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

  private parseNetflixRegion(html: string): string | undefined {
    const match = html.match(/data-country="([A-Z]{2})"/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
    const altMatch = html.match(/"country":"([A-Z]{2})"/i);
    if (altMatch && altMatch[1]) {
      return altMatch[1].toUpperCase();
    }
    return undefined;
  }
}

export const streamingDetector = new StreamingDetector();
