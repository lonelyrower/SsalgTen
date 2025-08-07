import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import os from 'os';
import { logger } from '../utils/logger';
import { networkConfig, securityConfig } from '../config';

const execAsync = promisify(exec);

export interface PingResult {
  host: string;
  alive: boolean;
  time: number;
  min: number;
  max: number;
  avg: number;
  packetLoss: number;
  output: string;
}

export interface TracerouteHop {
  hop: number;
  ip: string;
  hostname?: string;
  rtt1?: number;
  rtt2?: number;
  rtt3?: number;
}

export interface TracerouteResult {
  target: string;
  hops: TracerouteHop[];
  totalHops: number;
  output: string;
}

export interface SpeedtestResult {
  download: number; // Mbps
  upload: number;   // Mbps
  ping: number;     // ms
  server: string;
  location: string;
  timestamp: string;
}

export class NetworkService {
  
  // 验证目标地址是否安全
  private validateTarget(target: string): boolean {
    // 检查是否在阻止列表中
    for (const blocked of securityConfig.blockedTargets) {
      if (target.includes(blocked) || target === blocked) {
        return false;
      }
    }

    // 检查是否在允许列表中
    if (securityConfig.allowedTargets.includes('*')) {
      return true;
    }

    return securityConfig.allowedTargets.some(allowed => 
      target.includes(allowed) || target === allowed
    );
  }

  // Ping 诊断 - 使用系统命令
  async ping(target: string, count?: number): Promise<PingResult> {
    if (!this.validateTarget(target)) {
      throw new Error(`Target ${target} is not allowed`);
    }

    const pingCount = count || networkConfig.pingCount;
    
    try {
      logger.debug(`Starting ping to ${target} with ${pingCount} packets`);
      
      const isWindows = os.platform() === 'win32';
      const command = isWindows 
        ? `ping -n ${pingCount} ${target}`
        : `ping -c ${pingCount} ${target}`;

      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        logger.warn('Ping stderr:', stderr);
      }

      const result = this.parsePingOutput(stdout, isWindows);
      
      logger.debug(`Ping completed for ${target}: ${result.avg}ms avg`);
      
      return {
        ...result,
        host: target,
        output: stdout
      };
    } catch (error) {
      logger.error(`Ping failed for ${target}:`, error);
      
      return {
        host: target,
        alive: false,
        time: -1,
        min: -1,
        max: -1,
        avg: -1,
        packetLoss: 100,
        output: `Ping failed: ${error}`
      };
    }
  }

  // 解析 ping 输出 (支持 Windows 和 Linux)
  private parsePingOutput(output: string, isWindows: boolean): Omit<PingResult, 'host' | 'output'> {
    const result = {
      alive: false,
      time: -1,
      min: -1,
      max: -1,
      avg: -1,
      packetLoss: 100
    };
    
    try {
      if (isWindows) {
        // Windows ping 输出解析
        // 示例: "平均 = 23ms" 或 "Average = 23ms"
        const avgMatch = output.match(/(?:平均|Average)\s*=\s*(\d+)ms/i);
        if (avgMatch) {
          result.avg = parseInt(avgMatch[1]);
          result.time = result.avg;
          result.alive = true;
        }

        // 最小和最大值
        const minMaxMatch = output.match(/最短\s*=\s*(\d+)ms.*最长\s*=\s*(\d+)ms|Minimum\s*=\s*(\d+)ms.*Maximum\s*=\s*(\d+)ms/i);
        if (minMaxMatch) {
          result.min = parseInt(minMaxMatch[1] || minMaxMatch[3]);
          result.max = parseInt(minMaxMatch[2] || minMaxMatch[4]);
        }

        // 丢包率 "丢失 = 0 (0% 丢失)" 或 "Lost = 0 (0% loss)"
        const lossMatch = output.match(/\((\d+)%\s*(?:丢失|loss)\)/i);
        if (lossMatch) {
          result.packetLoss = parseInt(lossMatch[1]);
        } else {
          result.packetLoss = 0; // 如果找不到，假设无丢包
        }
      } else {
        // Linux ping 输出解析
        // 示例: "rtt min/avg/max/mdev = 23.123/25.456/28.789/1.234 ms"
        const statsMatch = output.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/[\d.]+ ms/);
        if (statsMatch) {
          result.min = parseFloat(statsMatch[1]);
          result.avg = parseFloat(statsMatch[2]);
          result.max = parseFloat(statsMatch[3]);
          result.time = result.avg;
          result.alive = true;
        }

        // 丢包率 "4 packets transmitted, 4 received, 0% packet loss"
        const lossMatch = output.match(/(\d+)% packet loss/);
        if (lossMatch) {
          result.packetLoss = parseInt(lossMatch[1]);
        }
      }

      // 如果找到任何有效的时间数据，认为主机在线
      if (result.avg > 0) {
        result.alive = true;
      }
    } catch (error) {
      logger.warn('Failed to parse ping output:', error);
    }

    return result;
  }

  // Traceroute 诊断 - 使用系统命令
  async traceroute(target: string, maxHops?: number): Promise<TracerouteResult> {
    if (!this.validateTarget(target)) {
      throw new Error(`Target ${target} is not allowed`);
    }

    const maxHopsLimit = maxHops || networkConfig.tracerouteMaxHops;
    
    try {
      logger.debug(`Starting traceroute to ${target} with max ${maxHopsLimit} hops`);
      
      const isWindows = os.platform() === 'win32';
      const command = isWindows 
        ? `tracert -h ${maxHopsLimit} ${target}`
        : `traceroute -m ${maxHopsLimit} ${target}`;

      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      
      if (stderr && !stderr.includes('to')) {
        logger.warn('Traceroute stderr:', stderr);
      }

      const hops = this.parseTracerouteOutput(stdout, isWindows);
      
      logger.debug(`Traceroute completed for ${target}: ${hops.length} hops`);
      
      return {
        target,
        hops,
        totalHops: hops.length,
        output: stdout
      };
    } catch (error) {
      logger.error(`Traceroute failed for ${target}:`, error);
      throw new Error(`Traceroute failed: ${error}`);
    }
  }

  // 解析 traceroute 输出
  private parseTracerouteOutput(output: string, isWindows: boolean): TracerouteHop[] {
    const hops: TracerouteHop[] = [];
    const lines = output.split('\n');
    
    try {
      for (const line of lines) {
        if (isWindows) {
          // Windows tracert 格式：  1     1 ms     1 ms     1 ms  192.168.1.1
          const match = line.match(/^\s*(\d+)\s+(?:(\d+) ms\s*)?(?:(\d+) ms\s*)?(?:(\d+) ms\s*)?([\d.]+|[a-zA-Z0-9.-]+)/);
          if (match && match[1]) {
            const hopNum = parseInt(match[1]);
            const target = match[5]?.trim();
            
            if (target && !target.includes('*') && !target.includes('超时')) {
              hops.push({
                hop: hopNum,
                ip: target,
                rtt1: match[2] ? parseInt(match[2]) : undefined,
                rtt2: match[3] ? parseInt(match[3]) : undefined,
                rtt3: match[4] ? parseInt(match[4]) : undefined,
              });
            }
          }
        } else {
          // Linux traceroute 格式： 1  gateway (192.168.1.1)  0.123 ms  0.456 ms  0.789 ms
          const match = line.match(/^\s*(\d+)\s+(.+?)\s+\(([^)]+)\)\s+([\d.]+) ms(?:\s+([\d.]+) ms)?(?:\s+([\d.]+) ms)?/);
          if (match) {
            hops.push({
              hop: parseInt(match[1]),
              hostname: match[2].trim(),
              ip: match[3],
              rtt1: parseFloat(match[4]),
              rtt2: match[5] ? parseFloat(match[5]) : undefined,
              rtt3: match[6] ? parseFloat(match[6]) : undefined,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse traceroute output:', error);
    }

    return hops;
  }

  // MTR 网络质量测试 - Windows 使用组合方式
  async mtr(target: string, count?: number): Promise<any> {
    if (!this.validateTarget(target)) {
      throw new Error(`Target ${target} is not allowed`);
    }

    const mtrCount = count || networkConfig.mtrCount;
    
    try {
      logger.debug(`Starting MTR-like test to ${target} with ${mtrCount} cycles`);
      
      const isWindows = os.platform() === 'win32';
      
      if (isWindows) {
        // Windows: 使用 tracert + 多次 ping 模拟 MTR
        logger.info('Using tracert + ping combination for MTR on Windows');
        
        const [tracerouteResult, pingResult] = await Promise.all([
          this.traceroute(target, 15), // 限制跳数
          this.ping(target, mtrCount)
        ]);
        
        return {
          target,
          type: 'windows-combined',
          traceroute: tracerouteResult,
          ping: pingResult,
          cycles: mtrCount,
          summary: {
            avgLatency: pingResult.avg,
            packetLoss: pingResult.packetLoss,
            totalHops: tracerouteResult.totalHops
          }
        };
      } else {
        // Linux: 尝试使用系统的 mtr 命令
        try {
          const command = `mtr -r -c ${mtrCount} --json ${target}`;
          const { stdout, stderr } = await execAsync(command);
          
          if (stderr) {
            logger.warn('MTR stderr:', stderr);
          }

          return {
            target,
            type: 'native-mtr',
            result: JSON.parse(stdout),
            cycles: mtrCount
          };
        } catch (mtrError) {
          logger.warn('Native MTR failed, falling back to combined method');
          
          // 回退到组合方式
          const [tracerouteResult, pingResult] = await Promise.all([
            this.traceroute(target),
            this.ping(target, mtrCount)
          ]);
          
          return {
            target,
            type: 'linux-fallback',
            traceroute: tracerouteResult,
            ping: pingResult,
            cycles: mtrCount
          };
        }
      }
    } catch (error) {
      logger.error(`MTR failed for ${target}:`, error);
      throw new Error(`MTR failed: ${error}`);
    }
  }

  // Speedtest - 使用 HTTP API 方式
  async speedtest(serverId?: string): Promise<SpeedtestResult> {
    try {
      logger.info('Starting speedtest using HTTP method...');
      
      // 使用简单的下载测试来估算速度
      const downloadResult = await this.performDownloadTest();
      const pingResult = await this.ping('8.8.8.8', 3);
      
      return {
        download: downloadResult.downloadSpeed,
        upload: downloadResult.uploadSpeed,
        ping: pingResult.avg,
        server: 'HTTP Test Server',
        location: 'Global CDN',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Speedtest failed:', error);
      throw new Error(`Speedtest failed: ${error}`);
    }
  }

  // 简单的下载速度测试
  private async performDownloadTest(): Promise<{ downloadSpeed: number; uploadSpeed: number }> {
    try {
      // 下载测试 - 使用公共文件
      const testUrl = 'https://speed.cloudflare.com/__down?bytes=10000000'; // 10MB
      const startTime = Date.now();
      
      const response = await axios.get(testUrl, {
        timeout: 30000,
        responseType: 'arraybuffer'
      });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // 秒
      const bytes = response.data.byteLength;
      const downloadSpeed = Math.round((bytes * 8) / duration / 1000000); // Mbps
      
      // 简单的上传测试估算（通常是下载速度的 10-50%）
      const uploadSpeed = Math.round(downloadSpeed * 0.3);
      
      logger.debug(`Download test: ${downloadSpeed} Mbps, estimated upload: ${uploadSpeed} Mbps`);
      
      return {
        downloadSpeed,
        uploadSpeed
      };
    } catch (error) {
      logger.warn('Download test failed, using fallback values');
      return {
        downloadSpeed: -1,
        uploadSpeed: -1
      };
    }
  }

  // 获取本机网络信息
  async getNetworkInfo(): Promise<any> {
    try {
      const isWindows = os.platform() === 'win32';
      
      if (isWindows) {
        // Windows: 使用 ipconfig
        const { stdout } = await execAsync('ipconfig /all');
        return { 
          platform: 'windows',
          output: stdout,
          interfaces: this.parseWindowsNetworkInfo(stdout)
        };
      } else {
        // Linux: 使用 ip 命令
        const { stdout } = await execAsync('ip route show && ip addr show');
        return {
          platform: 'linux', 
          output: stdout
        };
      }
    } catch (error) {
      logger.warn('Failed to get network info:', error);
      return { 
        error: 'Network info unavailable',
        platform: os.platform()
      };
    }
  }

  // 解析 Windows 网络信息
  private parseWindowsNetworkInfo(output: string): any[] {
    const interfaces = [];
    const lines = output.split('\n');
    
    let currentInterface: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检测新的网络适配器
      if (trimmed.includes('适配器') || trimmed.includes('adapter')) {
        if (currentInterface) {
          interfaces.push(currentInterface);
        }
        currentInterface = {
          name: trimmed,
          ipv4: null,
          ipv6: null,
          gateway: null
        };
      }
      
      // IPv4 地址
      if (trimmed.includes('IPv4') && trimmed.includes(':')) {
        const ipMatch = trimmed.match(/:\s*([\d.]+)/);
        if (ipMatch && currentInterface) {
          currentInterface.ipv4 = ipMatch[1];
        }
      }
      
      // 默认网关
      if (trimmed.includes('默认网关') || trimmed.includes('Default Gateway')) {
        const gatewayMatch = trimmed.match(/:\s*([\d.]+)/);
        if (gatewayMatch && currentInterface) {
          currentInterface.gateway = gatewayMatch[1];
        }
      }
    }
    
    if (currentInterface) {
      interfaces.push(currentInterface);
    }
    
    return interfaces.filter(iface => iface.ipv4); // 只返回有 IP 的接口
  }

  // 简单的网络连接测试
  async testConnectivity(): Promise<{ [key: string]: boolean }> {
    const testTargets = [
      { name: 'google', host: '8.8.8.8' },
      { name: 'cloudflare', host: '1.1.1.1' },
      { name: 'quad9', host: '9.9.9.9' }
    ];

    const results: { [key: string]: boolean } = {};
    
    for (const target of testTargets) {
      try {
        const pingResult = await this.ping(target.host, 1);
        results[target.name] = pingResult.alive && pingResult.avg > 0;
      } catch (error) {
        results[target.name] = false;
      }
    }
    
    return results;
  }
}

export const networkService = new NetworkService();