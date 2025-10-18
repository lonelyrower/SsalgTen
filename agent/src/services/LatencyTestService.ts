import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface LatencyTestTarget {
  name: string;
  url: string;
  category: 'standard' | 'extended';
}

export interface LatencyResult {
  target: string;
  latency: number | null;
  status: 'excellent' | 'good' | 'poor' | 'failed';
  error?: string;
}

export interface LatencyTestResult {
  testType: 'standard' | 'comprehensive';
  results: LatencyResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    excellentCount: number;
    goodCount: number;
    poorCount: number;
  };
  timestamp: Date;
}

export class LatencyTestService {
  private readonly testTargets: LatencyTestTarget[] = [
    // 标准测试目标（8个主要网站）
    { name: 'Google', url: 'google.com', category: 'standard' },
    { name: 'GitHub', url: 'github.com', category: 'standard' },
    { name: 'Apple', url: 'apple.com', category: 'standard' },
    { name: 'Microsoft', url: 'microsoft.com', category: 'standard' },
    { name: 'Amazon', url: 'amazon.com', category: 'standard' },
    { name: 'Twitter', url: 'twitter.com', category: 'standard' },
    { name: 'OpenAI', url: 'openai.com', category: 'standard' },
    { name: 'Steam', url: 'steampowered.com', category: 'standard' },
    
    // 扩展测试目标（额外12个网站）
    { name: 'Netflix', url: 'netflix.com', category: 'extended' },
    { name: 'Disney+', url: 'disneyplus.com', category: 'extended' },
    { name: 'Instagram', url: 'instagram.com', category: 'extended' },
    { name: 'Telegram', url: 'telegram.org', category: 'extended' },
    { name: 'Dropbox', url: 'dropbox.com', category: 'extended' },
    { name: 'OneDrive', url: 'onedrive.live.com', category: 'extended' },
    { name: 'Mega', url: 'mega.nz', category: 'extended' },
    { name: 'Twitch', url: 'twitch.tv', category: 'extended' },
    { name: 'YouTube', url: 'youtube.com', category: 'extended' },
    { name: 'Facebook', url: 'facebook.com', category: 'extended' },
    { name: 'TikTok', url: 'tiktok.com', category: 'extended' },
    { name: 'Reddit', url: 'reddit.com', category: 'extended' },
  ];

  /**
   * 执行网络延迟测试
   * @param testType 测试类型：'standard' 或 'comprehensive'
   */
  async runLatencyTest(testType: 'standard' | 'comprehensive' = 'standard'): Promise<LatencyTestResult> {
    logger.info(`Starting ${testType} latency test...`);
    
    // 根据测试类型筛选目标
    const targets = testType === 'standard' 
      ? this.testTargets.filter(t => t.category === 'standard')
      : this.testTargets;

    const results: LatencyResult[] = [];
    
    // 并发测试所有目标（限制并发数避免过载）
    const concurrency = 5;
    for (let i = 0; i < targets.length; i += concurrency) {
      const batch = targets.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(target => this.testSingleTarget(target))
      );
      results.push(...batchResults);
    }

    // 计算统计信息
    const summary = this.calculateSummary(results);
    
    const testResult: LatencyTestResult = {
      testType,
      results,
      summary,
      timestamp: new Date()
    };

    logger.info(`Latency test completed: ${summary.successful}/${summary.total} successful, avg: ${summary.averageLatency}ms`);
    
    return testResult;
  }

  /**
   * 测试单个目标的延迟
   */
  private async testSingleTarget(target: LatencyTestTarget): Promise<LatencyResult> {
    try {
      logger.debug(`Testing latency to ${target.name} (${target.url})`);
      
      // 使用ping命令测试延迟（发送3个包取平均值）
      const isWindows = os.platform() === 'win32';
      const pingCommand = isWindows
        ? `ping -n 3 ${target.url}`
        : `ping -c 3 -W 5 ${target.url}`;

      const { stdout, stderr } = await execAsync(pingCommand, {
        timeout: 15000 // 15秒超时
      });

      if (stderr) {
        logger.warn(`Ping warning for ${target.name}: ${stderr}`);
      }

      // 解析ping结果，提取平均延迟
      const latency = this.parsePingResult(stdout, isWindows);
      
      if (latency === null) {
        return {
          target: target.name,
          latency: null,
          status: 'failed',
          error: 'Unable to parse ping result'
        };
      }

      // 根据延迟分类状态
      const status = this.categorizeLatency(latency);

      return {
        target: target.name,
        latency,
        status
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to test latency to ${target.name}: ${errorMessage}`);
      
      return {
        target: target.name,
        latency: null,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * 解析ping命令的输出，提取平均延迟
   */
  private parsePingResult(output: string, isWindows: boolean): number | null {
    try {
      if (isWindows) {
        // Windows ping 输出（中英文均支持）
        const avgMatch = output.match(/(?:平均|Average)\s*=\s*(\d+)ms/i);
        if (avgMatch) {
          return parseFloat(avgMatch[1]);
        }

        const timeMatches = output.match(/时间[=<]\s*(\d+)ms|time[=<]\s*(\d+)ms/gi);
        if (timeMatches && timeMatches.length > 0) {
          const times = timeMatches.map((match) => {
            const timeMatch = match.match(/(\d+)\s*ms/);
            return timeMatch ? parseFloat(timeMatch[1]) : 0;
          });
          const avgTime =
            times.reduce((sum, time) => sum + time, 0) / times.length;
          return Math.round(avgTime * 100) / 100;
        }
      }

      // 查找包含平均延迟的行
      // Linux格式: rtt min/avg/max/mdev = 12.345/23.456/34.567/5.678 ms
      const rttMatch = output.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
      if (rttMatch) {
        return parseFloat(rttMatch[1]);
      }

      // macOS格式: round-trip min/avg/max/stddev = 12.345/23.456/34.567/5.678 ms
      const roundTripMatch = output.match(/round-trip min\/avg\/max\/stddev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
      if (roundTripMatch) {
        return parseFloat(roundTripMatch[1]);
      }

      // 备用解析：查找时间行
      const timeMatches = output.match(/time=([\d.]+) ms/g);
      if (timeMatches && timeMatches.length > 0) {
        const times = timeMatches.map(match => {
          const timeMatch = match.match(/time=([\d.]+) ms/);
          return timeMatch ? parseFloat(timeMatch[1]) : 0;
        });
        
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        return Math.round(avgTime * 100) / 100; // 保留两位小数
      }

      return null;
    } catch (error) {
      logger.error('Error parsing ping result:', error);
      return null;
    }
  }

  /**
   * 根据延迟值分类状态
   */
  private categorizeLatency(latency: number): 'excellent' | 'good' | 'poor' {
    if (latency < 50) return 'excellent';  // < 50ms - 优秀
    if (latency < 150) return 'good';      // 50-150ms - 良好
    return 'poor';                         // > 150ms - 较差
  }

  /**
   * 计算测试结果统计信息
   */
  private calculateSummary(results: LatencyResult[]) {
    const total = results.length;
    const successful = results.filter(r => r.status !== 'failed').length;
    const failed = total - successful;
    
    const successfulResults = results.filter(r => r.latency !== null);
    const averageLatency = successfulResults.length > 0 
      ? Math.round((successfulResults.reduce((sum, r) => sum + (r.latency || 0), 0) / successfulResults.length) * 100) / 100
      : 0;

    const excellentCount = results.filter(r => r.status === 'excellent').length;
    const goodCount = results.filter(r => r.status === 'good').length;
    const poorCount = results.filter(r => r.status === 'poor').length;

    return {
      total,
      successful,
      failed,
      averageLatency,
      excellentCount,
      goodCount,
      poorCount
    };
  }

  /**
   * 获取延迟等级的颜色和描述
   */
  static getLatencyGrade(status: LatencyResult['status']) {
    switch (status) {
      case 'excellent':
        return { color: 'green', emoji: '🟢', description: '优秀 - 适合游戏和视频通话' };
      case 'good':
        return { color: 'yellow', emoji: '🟡', description: '良好 - 适合网页浏览和视频' };
      case 'poor':
        return { color: 'red', emoji: '🔴', description: '较差 - 仅适合基本使用' };
      case 'failed':
        return { color: 'gray', emoji: '⚫', description: '失败 - 无法连接' };
      default:
        return { color: 'gray', emoji: '⚫', description: '未知' };
    }
  }
}

export const latencyTestService = new LatencyTestService();
