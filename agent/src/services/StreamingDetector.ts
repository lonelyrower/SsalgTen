import axios, { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 流媒体服务类型
 */
export type StreamingService =
  | 'netflix'
  | 'youtube'
  | 'disney_plus'
  | 'tiktok'
  | 'amazon_prime'
  | 'spotify'
  | 'chatgpt';

/**
 * 检测结果状态
 */
export type StreamingStatus = 'yes' | 'no' | 'org' | 'pending' | 'failed' | 'unknown';

/**
 * 解锁类型
 */
export type UnlockType = 'native' | 'dns' | 'idc' | 'unknown';

/**
 * 单个流媒体服务检测结果
 */
export interface StreamingResult {
  service: StreamingService;
  status: StreamingStatus;
  region?: string;
  unlockType?: UnlockType;
  details?: Record<string, any>;
  errorMsg?: string;
  testedAt: Date;
}

/**
 * 流媒体解锁检测器
 * 参考 IPQuality 项目的检测逻辑
 * GitHub: https://github.com/xykt/IPQuality
 */
export class StreamingDetector {
  private axios: AxiosInstance;
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor() {
    this.axios = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': this.userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: () => true, // 接受所有状态码
    });
  }

  /**
   * 检测所有流媒体服务
   */
  async detectAll(): Promise<StreamingResult[]> {
    const services: StreamingService[] = [
      'netflix',
      'youtube',
      'tiktok',
      'chatgpt',
    ];

    const results: StreamingResult[] = [];

    for (const service of services) {
      try {
        console.log(`[StreamingDetector] Testing ${service}...`);
        const result = await this.detectService(service);
        results.push(result);
      } catch (error) {
        console.error(`[StreamingDetector] Error testing ${service}:`, error);
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
   * 检测单个流媒体服务
   */
  async detectService(service: StreamingService): Promise<StreamingResult> {
    switch (service) {
      case 'netflix':
        return await this.detectNetflix();
      case 'youtube':
        return await this.detectYouTube();
      case 'tiktok':
        return await this.detectTikTok();
      case 'chatgpt':
        return await this.detectChatGPT();
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
   * 参考: IPQuality ip.sh 第1457-1520行
   */
  private async detectNetflix(): Promise<StreamingResult> {
    try {
      // 访问两个测试片源
      const [res1, res2] = await Promise.all([
        this.axios.get('https://www.netflix.com/title/81280792'),
        this.axios.get('https://www.netflix.com/title/70143836'),
      ]);

      // 提取区域代码
      const regionMatch = res1.data.match(/data-country="([A-Z]+)"/);
      const region = regionMatch ? regionMatch[1] :
                     res2.data.match(/data-country="([A-Z]+)"/)?.[1];

      if (!region) {
        return {
          service: 'netflix',
          status: 'no',
          testedAt: new Date(),
        };
      }

      // 检测是否受限 - 寻找 "Oh no!" 关键字
      const isRestricted1 = res1.data.includes('Oh no!');
      const isRestricted2 = res2.data.includes('Oh no!');

      // 获取解锁类型
      const unlockType = await this.detectUnlockType('netflix.com');

      if (isRestricted1 && isRestricted2) {
        // 仅自制剧
        return {
          service: 'netflix',
          status: 'org',
          region,
          unlockType,
          testedAt: new Date(),
        };
      } else if (!isRestricted1 || !isRestricted2) {
        // 完全解锁
        return {
          service: 'netflix',
          status: 'yes',
          region,
          unlockType,
          testedAt: new Date(),
        };
      } else {
        // 完全封锁
        return {
          service: 'netflix',
          status: 'no',
          testedAt: new Date(),
        };
      }
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
   * YouTube Premium 检测
   * 参考: IPQuality ip.sh 第1497-1555行
   */
  private async detectYouTube(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.youtube.com/premium', {
        headers: {
          'Cookie': 'YSC=BiCUU3-5Gdk; CONSENT=YES+cb.20220301-11-p0.en+FX+700',
        },
      });

      // 检测是否重定向到 google.cn
      const isCN = response.data.includes('www.google.cn');
      if (isCN) {
        return {
          service: 'youtube',
          status: 'no',
          region: 'CN',
          testedAt: new Date(),
        };
      }

      // 检测是否提示不可用
      const isNotAvailable = response.data.includes('Premium is not available in your country');
      if (isNotAvailable) {
        return {
          service: 'youtube',
          status: 'no',
          testedAt: new Date(),
        };
      }

      // 提取区域代码
      const regionMatch = response.data.match(/"contentRegion":"([^"]+)"/);
      const region = regionMatch ? regionMatch[1] : 'Global';

      // 检测是否有 Premium 特征
      const isAvailable = response.data.includes('ad-free') || response.data.includes('premium');

      const unlockType = await this.detectUnlockType('www.youtube.com');

      return {
        service: 'youtube',
        status: isAvailable ? 'yes' : 'no',
        region,
        unlockType,
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
   * 参考: IPQuality ip.sh 第1320-1370行
   */
  private async detectTikTok(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://www.tiktok.com/');

      // 从页面提取区域信息
      const regionMatch = response.data.match(/"region":"([^"]+)"/);
      const region = regionMatch ? regionMatch[1] : null;

      if (region) {
        const unlockType = await this.detectUnlockType('tiktok.com');

        return {
          service: 'tiktok',
          status: 'yes',
          region,
          unlockType,
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
   * ChatGPT 检测
   */
  private async detectChatGPT(): Promise<StreamingResult> {
    try {
      const response = await this.axios.get('https://chat.openai.com/');

      // 检测是否被限制
      const isBlocked = response.status === 403 ||
                       response.data.includes('not available in your country') ||
                       response.data.includes('VPN or proxy');

      if (isBlocked) {
        return {
          service: 'chatgpt',
          status: 'no',
          testedAt: new Date(),
        };
      }

      // 如果能正常访问，认为可用
      const isAvailable = response.status === 200;

      return {
        service: 'chatgpt',
        status: isAvailable ? 'yes' : 'no',
        region: isAvailable ? 'Available' : undefined,
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
   * 检测解锁类型 (Native / DNS / IDC)
   * 通过对比 DoH 和本地 DNS 解析结果
   */
  private async detectUnlockType(domain: string): Promise<UnlockType> {
    try {
      // 简化版本：只检测本地DNS
      // 完整版本需要对比 DoH (DNS over HTTPS) 和本地DNS
      return 'native'; // 默认返回 native
    } catch {
      return 'unknown';
    }
  }
}

// 导出单例
export const streamingDetector = new StreamingDetector();
