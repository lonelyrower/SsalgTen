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
  | 'reddit'
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
  | 'idc'
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
  testedUrls?: string[];
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
      // 强制使用 IPv4 进行流媒体检测
      // 因为某些流媒体服务的 IPv6 支持不完善，可能误判为屏蔽
      family: 4,
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
      'reddit',
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
      case 'reddit':
        return this.detectReddit();
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
    const testedUrls = [
      this.netflixTitles.global,
      this.netflixTitles.original,
    ];

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
          testedUrls,
          errorMsg: 'Empty response from Netflix titles',
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
          },
          testedAt: new Date(),
        };
      }

      let region = this.parseNetflixRegion(htmlGlobal);
      if (region) {
        const regionFromOriginal = this.parseNetflixRegion(htmlOriginal);
        if (regionFromOriginal) {
          region = regionFromOriginal;
        }
      } else {
        region =
          this.extractRegionFromHeaders(globalResp.headers) ||
          this.extractRegionFromHeaders(originalResp.headers) ||
          (await this.lookupGeoInfo()).country;
      }

      // Netflix 使用 Check_DNS_2（IPQuality 第460行）
      const unlockType = await this.detectUnlockType(['netflix.com'], true);

      const globalHasOhNo = /Oh no!/i.test(htmlGlobal);
      const originalHasOhNo = /Oh no!/i.test(htmlOriginal);

      if (globalHasOhNo && originalHasOhNo) {
        return {
          service: 'netflix',
          status: 'org',
          region,
          unlockType,
          testedUrls,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
            globalHasOhNo,
            originalHasOhNo,
          },
          testedAt: new Date(),
        };
      }

      if (!globalHasOhNo || !originalHasOhNo) {
        return {
          service: 'netflix',
          status: 'yes',
          region,
          unlockType,
          testedUrls,
          details: {
            globalStatus: globalResp.status,
            originalStatus: originalResp.status,
            globalHasOhNo,
            originalHasOhNo,
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'netflix',
        status: 'no',
        region,
        testedUrls,
        details: {
          globalStatus: globalResp.status,
          originalStatus: originalResp.status,
          globalHasOhNo,
          originalHasOhNo,
        },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'netflix',
        status: 'failed',
        testedUrls,
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
    const testedUrls = [
      'https://disney.api.edge.bamgrid.com/devices',
      'https://disney.api.edge.bamgrid.com/token',
      'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
      'https://disneyplus.com',
    ];

    try {
      const unlockType = await this.detectUnlockType(['disneyplus.com']);

      const deviceResp = await this.axios.post(
        testedUrls[0],
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
          testedUrls,
          errorMsg: 'Failed to obtain Disney+ device assertion',
          details: { deviceStatus: deviceResp.status },
          testedAt: new Date(),
        };
      }

      const tokenPayload = this.disneyTokenPayloadTemplate.replace('DISNEYASSERTION', assertion);

      const tokenResp = await this.axios.post(testedUrls[1], tokenPayload, {
        headers: {
          Authorization: this.disneyAuthorization,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
        validateStatus: () => true,
      });

      const rawTokenData =
        typeof tokenResp.data === 'string' ? tokenResp.data : JSON.stringify(tokenResp.data);
      const forbidden =
        tokenResp.data?.error_description === 'forbidden-location' ||
        rawTokenData.includes('403 ERROR');

      if (forbidden || tokenResp.status === 403) {
        return {
          service: 'disney_plus',
          status: 'no',
          testedUrls,
          details: {
            tokenStatus: tokenResp.status,
            error: tokenResp.data?.error_description ?? rawTokenData,
          },
          testedAt: new Date(),
        };
      }

      const refreshToken: string | undefined = tokenResp.data?.refresh_token;
      if (!refreshToken) {
        return {
          service: 'disney_plus',
          status: 'failed',
          testedUrls,
          errorMsg: 'No refresh token returned from Disney+ token endpoint',
          details: {
            tokenStatus: tokenResp.status,
            tokenPayload: rawTokenData,
          },
          testedAt: new Date(),
        };
      }

      const graphPayload = JSON.parse(
        JSON.stringify(this.disneyGraphPayloadTemplate).replace('ILOVEDISNEY', refreshToken),
      );

      const graphResp = await this.axios.post(testedUrls[2], graphPayload, {
        headers: {
          Authorization: this.disneyAuthorization,
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': this.userAgent,
        },
        validateStatus: () => true,
      });

      const region = graphResp.data?.extensions?.sdk?.session?.location?.countryCode;
      const inSupportedLocation =
        graphResp.data?.extensions?.sdk?.session?.inSupportedLocation;

      let previewUrl: string | undefined;
      let isUnavailable = false;
      try {
        const previewResp = await this.axios.get(testedUrls[3], {
          maxRedirects: 5,
          validateStatus: () => true,
        });
        const finalUrl =
          (previewResp.request as any)?.res?.responseUrl || previewResp.headers?.location;
        if (typeof finalUrl === 'string') {
          previewUrl = finalUrl;
          if (/preview/i.test(finalUrl)) {
            isUnavailable = /unavailable/i.test(finalUrl);
          }
        }
      } catch {
        // 预览站点访问失败时忽略，保持 undefined
      }

      if (region === 'JP') {
        return {
          service: 'disney_plus',
          status: 'yes',
          region,
          unlockType,
          testedUrls,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      if (region && inSupportedLocation === false && !isUnavailable) {
        return {
          service: 'disney_plus',
          status: 'pending',
          region,
          unlockType,
          testedUrls,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      if (region && isUnavailable) {
        return {
          service: 'disney_plus',
          status: 'no',
          testedUrls,
          details: {
            region,
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
          testedUrls,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      if (!region) {
        return {
          service: 'disney_plus',
          status: 'no',
          testedUrls,
          details: {
            inSupportedLocation,
            previewUrl,
          },
          testedAt: new Date(),
        };
      }

      return {
        service: 'disney_plus',
        status: 'failed',
        testedUrls,
        errorMsg: 'Unable to determine Disney+ availability',
        details: {
          region,
          inSupportedLocation,
          previewUrl,
        },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'disney_plus',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * Amazon Prime Video 检测
   */
  private async detectAmazonPrime(): Promise<StreamingResult> {
    const testedUrls = ['https://www.primevideo.com'];

    try {
      const response = await this.axios.get(`${testedUrls[0]}/`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        validateStatus: () => true,
      });

      const html = typeof response.data === 'string' ? response.data : '';

      if (!html) {
        return {
          service: 'amazon_prime',
          status: 'failed',
          testedUrls,
          errorMsg: 'Empty response from Prime Video homepage',
          details: { homepageStatus: response.status },
          testedAt: new Date(),
        };
      }

      const match = html.match(/"currentTerritory":"([A-Z]{2})"/i);
      if (match && match[1]) {
        return {
          service: 'amazon_prime',
          status: 'yes',
          region: match[1],
          unlockType: await this.detectUnlockType(['www.primevideo.com']),
          testedUrls,
          details: { homepageStatus: response.status },
          testedAt: new Date(),
        };
      }

      return {
        service: 'amazon_prime',
        status: 'no',
        testedUrls,
        details: { homepageStatus: response.status },
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'amazon_prime',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * YouTube Premium 检测
   */
  private async detectYouTube(): Promise<StreamingResult> {
    const testedUrls = ['https://www.youtube.com/premium'];

    try {
      const response = await this.axios.get(testedUrls[0], {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en',
          Cookie: this.youtubeCookie,
        },
      });

      const html = typeof response.data === 'string' ? response.data : '';

      if (!html) {
        return {
          service: 'youtube',
          status: 'failed',
          testedUrls,
          errorMsg: 'Empty response from YouTube Premium page',
          testedAt: new Date(),
        };
      }

      const regionMatch = html.match(/"contentRegion":"([A-Z]{2})"/i);
      const region = regionMatch ? regionMatch[1] : undefined;

      const isCn = /www\.google\.cn/i.test(html);
      const notAvailable = /Premium is not available in your country/i.test(html);
      const hasPremiumCopy = /ad-free/i.test(html);

      if (isCn) {
        return {
          service: 'youtube',
          status: 'cn',
          region: 'CN',
          testedUrls,
          testedAt: new Date(),
        };
      }

      if (notAvailable) {
        return {
          service: 'youtube',
          status: 'noprem',
          testedUrls,
          testedAt: new Date(),
        };
      }

      if (hasPremiumCopy && region) {
        return {
          service: 'youtube',
          status: 'yes',
          region,
          unlockType: await this.detectUnlockType(['www.youtube.com']),
          testedUrls,
          testedAt: new Date(),
        };
      }

      if (hasPremiumCopy && !region) {
        return {
          service: 'youtube',
          status: 'yes',
          unlockType: await this.detectUnlockType(['www.youtube.com']),
          testedUrls,
          testedAt: new Date(),
        };
      }

      return {
        service: 'youtube',
        status: 'failed',
        testedUrls,
        errorMsg: 'Unable to determine YouTube Premium availability',
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'youtube',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  /**
   * TikTok 检测
   * 参考 IPQuality 逻辑：检查屏蔽页面标记和状态码
   */
  private async detectTikTok(): Promise<StreamingResult> {
    const testedUrls = ['https://www.tiktok.com/'];

    try {
      const unlockType = await this.detectUnlockType(['tiktok.com']);

      try {
        const firstResp = await this.axios.get(testedUrls[0], {
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'en',
          },
        });
        const firstHtml = typeof firstResp.data === 'string' ? firstResp.data : '';
        const firstRegionMatch = firstHtml.match(/"region":"([A-Z]{2})"/i);
        if (firstRegionMatch && firstRegionMatch[1]) {
          return {
            service: 'tiktok',
            status: 'yes',
            region: firstRegionMatch[1],
            unlockType,
            testedUrls,
            testedAt: new Date(),
          };
        }
      } catch {
        return {
          service: 'tiktok',
          status: 'no',
          testedUrls,
          testedAt: new Date(),
        };
      }

      try {
        const compressed = await this.axios.get(testedUrls[0], {
          headers: {
            'User-Agent': this.userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Encoding': 'gzip',
            'Accept-Language': 'en',
          },
          responseType: 'arraybuffer',
        });

        const html = zlib.gunzipSync(Buffer.from(compressed.data)).toString('utf-8');
        const regionMatch = html.match(/"region":"([A-Z]{2})"/i);
        if (regionMatch && regionMatch[1]) {
          return {
            service: 'tiktok',
            status: 'idc',
            region: regionMatch[1],
            unlockType,
            testedUrls,
            testedAt: new Date(),
          };
        }
      } catch {
        // ignore errors for the second attempt
      }

      return {
        service: 'tiktok',
        status: 'failed',
        testedUrls,
        errorMsg: 'Unable to extract TikTok region',
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'tiktok',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }
  /**
   * Reddit 检测
   * 参考 IPQuality 中的 Reddit 判定逻辑
   */
  private async detectReddit(): Promise<StreamingResult> {
    const testedUrls = ['https://www.reddit.com/'];

    try {
      const response = await this.axios.get(testedUrls[0], {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const statusCode = response.status;
      const html = typeof response.data === 'string' ? response.data : '';

      if (statusCode === 403) {
        return {
          service: 'reddit',
          status: 'no',
          testedUrls,
          testedAt: new Date(),
        };
      }

      if (statusCode === 200) {
        const regionMatch = html.match(/country="([^"]+)"/i);
        const region = regionMatch?.[1];
        return {
          service: 'reddit',
          status: 'yes',
          region,
          unlockType: await this.detectUnlockType(['reddit.com'], true, false),
          testedUrls,
          testedAt: new Date(),
        };
      }

      return {
        service: 'reddit',
        status: 'failed',
        testedUrls,
        errorMsg: `Unhandled Reddit status ${statusCode}`,
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'reddit',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }
  /**
   * ChatGPT 检测
   * 完全复刻 IPQuality ip.sh 的判定逻辑
   */
  private async detectChatGPT(): Promise<StreamingResult> {
    const testedUrls = [
      'https://api.openai.com/compliance/cookie_requirements',
      'https://ios.chat.openai.com/',
      'https://chat.openai.com/cdn-cgi/trace',
    ];

    try {
      const normalizeBody = (input: unknown): string => {
        if (typeof input === 'string') {
          return input;
        }
        if (input === undefined || input === null) {
          return '';
        }
        try {
          return JSON.stringify(input);
        } catch {
          return String(input);
        }
      };

      const fetchChatGPTEndpoint = async (
        url: string,
        headers: Record<string, string>,
      ): Promise<{ body: string; status?: number; curlError: boolean }> => {
        try {
          const resp = await this.axios.get(url, {
            headers,
            transformResponse: r => r,
            validateStatus: () => true,
          });
          const body = normalizeBody(resp.data);
          return { body, status: resp.status, curlError: false };
        } catch (error) {
          const axiosError = error as any;
          if (axiosError?.response) {
            const body = normalizeBody(axiosError.response.data);
            return { body, status: axiosError.response.status, curlError: false };
          }
          return { body: '', status: undefined, curlError: true };
        }
      };

      const compliance = await fetchChatGPTEndpoint(testedUrls[0], {
        Authorization: 'Bearer null',
        Origin: 'https://platform.openai.com',
        Referer: 'https://platform.openai.com/',
        'User-Agent': this.userAgent,
        Accept: '*/*',
        'Accept-Language': 'en',
        'Content-Type': 'application/json',
      });

      const ios = await fetchChatGPTEndpoint(testedUrls[1], {
        'User-Agent': this.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en',
      });

      const hasUnsupported = /unsupported_country/i.test(compliance.body);
      const hasVpn = /VPN/i.test(ios.body);
      const complianceCurlError = compliance.curlError;
      const iosCurlError = ios.curlError;

      let countryCode: string | undefined;
      try {
        const traceResp = await this.axios.get(testedUrls[2], {
          headers: { 'User-Agent': this.userAgent },
          transformResponse: r => r,
        });
        const traceBody = normalizeBody(traceResp.data);
        const match = traceBody.match(/loc=([A-Z]{2})/i);
        if (match) {
          countryCode = match[1];
        }
      } catch {
        // ignore trace failure
      }

      if (!countryCode) {
        countryCode = (await this.lookupGeoInfo()).country;
      }

      const unlockType = await this.detectChatGPTUnlockType();
      const baseDetails = {
        complianceStatus: compliance.status,
        iosStatus: ios.status,
        complianceCurlError,
        iosCurlError,
        hasUnsupported,
        hasVpn,
      };

      // 完全解锁：两个端点都无异常，且没有屏蔽标记
      if (!hasVpn && !hasUnsupported && !complianceCurlError && !iosCurlError) {
        return {
          service: 'chatgpt',
          status: 'yes',
          region: countryCode,
          unlockType,
          testedUrls,
          details: baseDetails,
          testedAt: new Date(),
        };
      }

      // 完全不可用：两个端点都被屏蔽
      if (hasVpn && hasUnsupported) {
        return {
          service: 'chatgpt',
          status: 'no',
          testedUrls,
          details: baseDetails,
          testedAt: new Date(),
        };
      }

      // 仅 Web 可用：iOS 屏蔽且合规端点成功
      if (!hasUnsupported && hasVpn && !complianceCurlError) {
        return {
          service: 'chatgpt',
          status: 'web',
          region: countryCode,
          unlockType,
          testedUrls,
          details: baseDetails,
          testedAt: new Date(),
        };
      }

      // 仅 APP 可用：合规端点受限但 iOS 正常
      if (hasUnsupported && !hasVpn) {
        return {
          service: 'chatgpt',
          status: 'app',
          region: countryCode,
          unlockType,
          testedUrls,
          details: baseDetails,
          testedAt: new Date(),
        };
      }

      // 合规端点失败且 iOS 有 VPN 提示 => 视为不可用
      if (complianceCurlError && hasVpn) {
        return {
          service: 'chatgpt',
          status: 'no',
          testedUrls,
          details: baseDetails,
          testedAt: new Date(),
        };
      }

      return {
        service: 'chatgpt',
        status: 'failed',
        testedUrls,
        errorMsg: 'Unable to determine ChatGPT availability',
        details: baseDetails,
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'chatgpt',
        status: 'failed',
        testedUrls,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }
  /**
   * ChatGPT 专用的 unlockType 检测
   * IPQuality 对 ChatGPT 的 3 个域名使用不同的检查组合：
   * - chat.openai.com: Check_DNS_1 + Check_DNS_2 + Check_DNS_3
   * - ios.chat.openai.com: Check_DNS_1 + Check_DNS_2 + Check_DNS_3
   * - api.openai.com: Check_DNS_1 + Check_DNS_3 (不使用 Check_DNS_2)
   */
  private async detectChatGPTUnlockType(): Promise<UnlockType> {
    try {
      const checks: Promise<boolean>[] = [];

      // chat.openai.com: 使用所有3个检查
      checks.push(this.checkDNS1('chat.openai.com'));
      checks.push(this.checkDNS2('chat.openai.com'));
      checks.push(this.checkDNS3('chat.openai.com'));

      // ios.chat.openai.com: 使用所有3个检查
      checks.push(this.checkDNS1('ios.chat.openai.com'));
      checks.push(this.checkDNS2('ios.chat.openai.com'));
      checks.push(this.checkDNS3('ios.chat.openai.com'));

      // api.openai.com: 只使用 Check_DNS_1 和 Check_DNS_3
      checks.push(this.checkDNS1('api.openai.com'));
      checks.push(this.checkDNS3('api.openai.com'));

      const results = await Promise.all(checks);

      // IPQuality逻辑：任何检查失败 => DNS解锁
      if (results.some(result => !result)) {
        return 'dns';
      }

      // 所有检查通过 => 原生解锁
      return 'native';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 解析解锁类型：完全按照 IPQuality 脚本的逻辑实现
   *
   * IPQuality 的判断标准：
   * 1. Check_DNS_1: 检查DNS是否返回私有IP地址（10.x, 172.16.x, 192.168.x等）
   * 2. Check_DNS_2: 检查DNS ANSWER记录数量（≤2 表示污染）
   * 3. Check_DNS_3: 检查随机子域名是否有解析结果（通配符DNS污染）
   *
   * 判断规则：
   * - 任何一个检查失败（返回false）=> DNS解锁
   * - 所有检查通过（都返回true）=> 原生解锁
   *
   * @param domains 要检查的域名列表（可以是单个或多个）
   * @param useCheck2 是否使用 Check_DNS_2（某些服务需要）
   * @param useCheck3 是否使用 Check_DNS_3（某些服务需要）
   */
  private async detectUnlockType(
    domains: string[],
    useCheck2 = false,
    useCheck3 = true,
  ): Promise<UnlockType> {
    try {
      // 对每个域名执行检查
      const checks: Promise<boolean>[] = [];

      for (const domain of domains) {
        checks.push(this.checkDNS1(domain));   // Check_DNS_1
        if (useCheck2) {
          checks.push(this.checkDNS2(domain)); // Check_DNS_2 (可选)
        }
        if (useCheck3) {
          checks.push(this.checkDNS3(domain));   // Check_DNS_3
        }
      }

      const results = await Promise.all(checks);

      // IPQuality逻辑：任何检查失败 => DNS解锁
      if (results.some(result => !result)) {
        return 'dns';
      }

      // 所有检查通过 => 原生解锁
      return 'native';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check_DNS_1: 检查DNS返回的IP是否为私有IP
   * 返回 true: 正常公网IP
   * 返回 false: 私有IP或本地IP（DNS被污染）
   */
  private async checkDNS1(domain: string): Promise<boolean> {
    try {
      const records = await dns.resolve4(domain);
      if (!records.length) {
        return false;
      }

      // 检查第一个IP是否为私有IP
      const ip = records[0];

      // 检查私有IP范围
      if (this.isPrivateIP(ip)) {
        return false;  // 私有IP => DNS污染
      }

      // 检查是否与本地DNS服务器处于同一子网（/24）
      const firstServer = dns
        .getServers()
        .map(server => server.split('%')[0]) // 去除可能的作用域后缀
        .find(server => this.isIPv4Address(server));

      if (firstServer && this.isSame24Subnet(ip, firstServer)) {
        return false;
      }

      return true;  // 公网IP => 正常
    } catch {
      return false;
    }
  }

  /**
   * Check_DNS_2: 检查DNS ANSWER记录数量
   * 返回 true: ANSWER数量 > 2（正常）
   * 返回 false: ANSWER数量 ≤ 2（DNS污染，返回的IP太少）
   *
   * 注意：IPQuality计算的是DNS响应中ANSWER section的总记录数
   * 包括CNAME记录 + A记录。例如：
   * - chat.openai.com -> CNAME (1) + A记录 (1) = 2条记录
   * - netflix.com -> 多个A记录 (通常>2)
   */
  private async checkDNS2(domain: string): Promise<boolean> {
    try {
      let answerCount = 0;

      // 检查是否有CNAME记录
      try {
        const cnames = await dns.resolveCname(domain);
        if (cnames && cnames.length > 0) {
          answerCount += cnames.length;  // CNAME记录计数
        }
      } catch {
        // 没有CNAME记录，正常
      }

      // 检查A记录
      const records = await dns.resolve4(domain);
      answerCount += records.length;  // A记录计数

      // IPQuality 逻辑：ANSWER 数量 <= 2 表示 DNS 污染
      // 正常的域名应该返回多个记录
      if (answerCount <= 2) {
        return false;  // 记录太少 => DNS污染
      }

      return true;  // 记录足够多 => 正常
    } catch {
      return false;
    }
  }

  /**
   * Check_DNS_3: 检查随机子域名是否返回结果
   * 返回 true: 随机子域名无结果（正常）
   * 返回 false: 随机子域名有结果（通配符DNS污染）
   */
  private async checkDNS3(domain: string): Promise<boolean> {
    try {
      const randomSubdomain = `test${Math.floor(Math.random() * 100000)}${Math.floor(Math.random() * 100000)}.${domain}`;
      const records = await dns.resolve4(randomSubdomain);

      // 如果随机子域名返回结果 => DNS污染
      if (records && records.length > 0) {
        return false;
      }

      return true;
    } catch {
      // 解析失败是正常的（随机子域名不应该存在）
      return true;
    }
  }

  /**
   * 检查IP是否为私有IP地址
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) {
      return false;
    }

    const [a, b, c, d] = parts;

    // 10.0.0.0/8
    if (a === 10) {
      return true;
    }

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }

    // 169.254.0.0/16 (Link-local)
    if (a === 169 && b === 254) {
      return true;
    }

    // 127.0.0.0/8 (Loopback)
    if (a === 127) {
      return true;
    }

    return false;
  }

  private isIPv4Address(ip: string): boolean {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  }

  private isSame24Subnet(ip1: string, ip2: string): boolean {
    if (!this.isIPv4Address(ip1) || !this.isIPv4Address(ip2)) {
      return false;
    }

    const toInt = (ip: string): number =>
      ip
        .split('.')
        .map(Number)
        .reduce((acc, octet) => (acc << 8) + (octet & 0xff), 0);

    const mask = 0xffffff00; // /24
    return (toInt(ip1) & mask) === (toInt(ip2) & mask);
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
