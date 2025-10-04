import fs from 'fs';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const readFile = promisify(fs.readFile);
const exec = promisify(require('child_process').exec);

export interface NetworkStats {
  interface: string;
  rxBytes: number;      // 接收字节数
  txBytes: number;      // 发送字节数
  rxPackets: number;    // 接收包数
  txPackets: number;    // 发送包数
  timestamp: Date;
}

export interface TrafficRate {
  interface: string;
  rxRate: number;       // 接收速率 (Mbps)
  txRate: number;       // 发送速率 (Mbps)
  rxPacketRate: number; // 包速率 (pps)
  txPacketRate: number; // 包速率 (pps)
}

export interface ConnectionStats {
  total: number;
  established: number;
  synRecv: number;      // SYN_RECV (可能的SYN flood)
  timeWait: number;
  closeWait: number;
  listening: number;
}

export interface NetworkAlert {
  type: 'traffic_spike' | 'connection_flood' | 'bandwidth_abuse' | 'port_scan';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
}

export interface NetworkMonitorConfig {
  enabled: boolean;
  primaryInterface: string;           // 主网络接口
  trafficThreshold: number;            // 流量阈值 (Mbps)
  connectionThreshold: number;         // 连接数阈值
  synFloodThreshold: number;           // SYN_RECV阈值
  sampleInterval: number;              // 采样间隔 (ms)
}

const defaultConfig: NetworkMonitorConfig = {
  enabled: (process.env.NETWORK_MONITOR_ENABLED || 'false').toLowerCase() === 'true',
  primaryInterface: process.env.PRIMARY_INTERFACE || 'eth0',
  trafficThreshold: parseInt(process.env.TRAFFIC_THRESHOLD_MBPS || '100', 10),
  connectionThreshold: parseInt(process.env.CONNECTION_THRESHOLD || '1000', 10),
  synFloodThreshold: parseInt(process.env.SYN_FLOOD_THRESHOLD || '100', 10),
  sampleInterval: parseInt(process.env.NETWORK_SAMPLE_INTERVAL || '5000', 10), // 5秒
};

// 历史数据缓存
let lastStats: NetworkStats | null = null;

/**
 * 获取网络接口列表
 */
async function getNetworkInterfaces(): Promise<string[]> {
  try {
    if (process.platform === 'linux') {
      const content = await readFile('/proc/net/dev', 'utf8');
      const lines = content.split('\n').slice(2); // 跳过前两行标题
      const interfaces: string[] = [];

      for (const line of lines) {
        const match = line.trim().match(/^(\w+):/);
        if (match) {
          const iface = match[1];
          // 排除lo和docker接口
          if (iface !== 'lo' && !iface.startsWith('docker') && !iface.startsWith('veth')) {
            interfaces.push(iface);
          }
        }
      }

      return interfaces;
    } else {
      // Windows: 使用netsh
      const { stdout } = await exec('netsh interface show interface');
      const interfaces: string[] = [];
      const lines = stdout.split('\n').slice(3);

      for (const line of lines) {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 4 && parts[0] === 'Enabled') {
          interfaces.push(parts[3]);
        }
      }

      return interfaces;
    }
  } catch (error) {
    logger.error('Failed to get network interfaces:', error);
    return [];
  }
}

/**
 * 读取Linux网络接口统计
 */
async function getLinuxNetworkStats(iface: string): Promise<NetworkStats | null> {
  try {
    const content = await readFile('/proc/net/dev', 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes(`${iface}:`)) {
        const parts = line.split(/\s+/).filter(p => p);
        // 格式: interface: rx_bytes rx_packets ... tx_bytes tx_packets ...
        return {
          interface: iface,
          rxBytes: parseInt(parts[1]) || 0,
          rxPackets: parseInt(parts[2]) || 0,
          txBytes: parseInt(parts[9]) || 0,
          txPackets: parseInt(parts[10]) || 0,
          timestamp: new Date(),
        };
      }
    }

    return null;
  } catch (error) {
    logger.error(`Failed to read stats for ${iface}:`, error);
    return null;
  }
}

/**
 * 读取Windows网络接口统计
 */
async function getWindowsNetworkStats(iface: string): Promise<NetworkStats | null> {
  try {
    const { stdout } = await exec(`netsh interface ipv4 show subinterfaces level=verbose "${iface}"`);
    const lines = stdout.split('\n');

    let rxBytes = 0;
    let txBytes = 0;

    for (const line of lines) {
      if (line.includes('Bytes Received')) {
        rxBytes = parseInt(line.split(':')[1]?.trim() || '0');
      }
      if (line.includes('Bytes Sent')) {
        txBytes = parseInt(line.split(':')[1]?.trim() || '0');
      }
    }

    return {
      interface: iface,
      rxBytes,
      rxPackets: 0, // Windows不提供包数统计
      txBytes,
      txPackets: 0,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error(`Failed to read Windows stats for ${iface}:`, error);
    return null;
  }
}

/**
 * 获取网络统计
 */
async function getNetworkStats(iface: string): Promise<NetworkStats | null> {
  if (process.platform === 'linux') {
    return getLinuxNetworkStats(iface);
  } else {
    return getWindowsNetworkStats(iface);
  }
}

/**
 * 计算流量速率
 */
function calculateTrafficRate(current: NetworkStats, previous: NetworkStats): TrafficRate {
  const timeDelta = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000; // 秒

  if (timeDelta === 0) {
    return {
      interface: current.interface,
      rxRate: 0,
      txRate: 0,
      rxPacketRate: 0,
      txPacketRate: 0,
    };
  }

  const rxBytes = current.rxBytes - previous.rxBytes;
  const txBytes = current.txBytes - previous.txBytes;
  const rxPackets = current.rxPackets - previous.rxPackets;
  const txPackets = current.txPackets - previous.txPackets;

  return {
    interface: current.interface,
    rxRate: (rxBytes * 8) / timeDelta / 1000000, // 转换为Mbps
    txRate: (txBytes * 8) / timeDelta / 1000000,
    rxPacketRate: rxPackets / timeDelta,
    txPacketRate: txPackets / timeDelta,
  };
}

/**
 * 获取连接统计（Linux）
 */
async function getConnectionStats(): Promise<ConnectionStats> {
  try {
    if (process.platform !== 'linux') {
      return {
        total: 0,
        established: 0,
        synRecv: 0,
        timeWait: 0,
        closeWait: 0,
        listening: 0,
      };
    }

    const { stdout } = await exec('cat /proc/net/tcp /proc/net/tcp6 2>/dev/null || true');
    const lines = stdout.split('\n').slice(1); // 跳过标题行

    const stats: ConnectionStats = {
      total: 0,
      established: 0,
      synRecv: 0,
      timeWait: 0,
      closeWait: 0,
      listening: 0,
    };

    // TCP状态码映射（十六进制）
    const stateMap: { [key: string]: keyof ConnectionStats } = {
      '01': 'established', // ESTABLISHED
      '02': 'synRecv',     // SYN_SENT
      '03': 'synRecv',     // SYN_RECV
      '06': 'timeWait',    // TIME_WAIT
      '08': 'closeWait',   // CLOSE_WAIT
      '0A': 'listening',   // LISTEN
    };

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const state = parts[3];
        const stateKey = stateMap[state];
        if (stateKey) {
          stats[stateKey]++;
        }
        stats.total++;
      }
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get connection stats:', error);
    return {
      total: 0,
      established: 0,
      synRecv: 0,
      timeWait: 0,
      closeWait: 0,
      listening: 0,
    };
  }
}

/**
 * 检测流量异常
 */
function detectTrafficAnomaly(
  rate: TrafficRate,
  config: NetworkMonitorConfig
): NetworkAlert | null {
  const totalRate = rate.rxRate + rate.txRate;

  if (totalRate > config.trafficThreshold) {
    return {
      type: 'traffic_spike',
      severity: totalRate > config.trafficThreshold * 2 ? 'critical' : 'high',
      message: `High network traffic detected: ${totalRate.toFixed(2)} Mbps`,
      details: {
        interface: rate.interface,
        rxRate: rate.rxRate.toFixed(2),
        txRate: rate.txRate.toFixed(2),
        threshold: config.trafficThreshold,
      },
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * 检测连接洪水
 */
function detectConnectionFlood(
  connStats: ConnectionStats,
  config: NetworkMonitorConfig
): NetworkAlert | null {
  // 检测SYN flood
  if (connStats.synRecv > config.synFloodThreshold) {
    return {
      type: 'connection_flood',
      severity: 'critical',
      message: `Potential SYN flood attack: ${connStats.synRecv} SYN_RECV connections`,
      details: {
        synRecv: connStats.synRecv,
        total: connStats.total,
        threshold: config.synFloodThreshold,
      },
      timestamp: new Date(),
    };
  }

  // 检测连接总数过高
  if (connStats.total > config.connectionThreshold) {
    return {
      type: 'connection_flood',
      severity: 'high',
      message: `High connection count: ${connStats.total} connections`,
      details: {
        total: connStats.total,
        established: connStats.established,
        threshold: config.connectionThreshold,
      },
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * 主监控对象
 */
export const networkMonitor = {
  config: defaultConfig,

  /**
   * 执行网络监控检查
   */
  async monitor(): Promise<{
    enabled: boolean;
    stats: NetworkStats | null;
    trafficRate: TrafficRate | null;
    connectionStats: ConnectionStats | null;
    alerts: NetworkAlert[];
  }> {
    if (!this.config.enabled) {
      return {
        enabled: false,
        stats: null,
        trafficRate: null,
        connectionStats: null,
        alerts: [],
      };
    }

    try {
      const alerts: NetworkAlert[] = [];

      // 获取当前统计
      const currentStats = await getNetworkStats(this.config.primaryInterface);
      if (!currentStats) {
        return {
          enabled: true,
          stats: null,
          trafficRate: null,
          connectionStats: null,
          alerts: [],
        };
      }

      // 计算流量速率
      let trafficRate: TrafficRate | null = null;
      if (lastStats && lastStats.interface === currentStats.interface) {
        trafficRate = calculateTrafficRate(currentStats, lastStats);

        // 检测流量异常
        const trafficAlert = detectTrafficAnomaly(trafficRate, this.config);
        if (trafficAlert) {
          alerts.push(trafficAlert);
        }
      }

      // 获取连接统计
      const connectionStats = await getConnectionStats();

      // 检测连接洪水
      const connAlert = detectConnectionFlood(connectionStats, this.config);
      if (connAlert) {
        alerts.push(connAlert);
      }

      // 更新历史数据
      lastStats = currentStats;

      logger.debug(`Network monitor check completed: ${alerts.length} alerts`);

      return {
        enabled: true,
        stats: currentStats,
        trafficRate,
        connectionStats,
        alerts,
      };
    } catch (error) {
      logger.error('Network monitor failed:', error);
      return {
        enabled: true,
        stats: null,
        trafficRate: null,
        connectionStats: null,
        alerts: [],
      };
    }
  },

  /**
   * 获取可用的网络接口列表
   */
  async getInterfaces(): Promise<string[]> {
    return getNetworkInterfaces();
  },

  /**
   * 获取当前配置
   */
  getConfig(): NetworkMonitorConfig {
    return { ...this.config };
  },

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<NetworkMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Network monitor config updated:', this.config);
  },
};
