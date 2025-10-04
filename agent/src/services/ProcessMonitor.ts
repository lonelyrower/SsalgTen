import { promisify } from 'util';
import { logger } from '../utils/logger';

const exec = promisify(require('child_process').exec);

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  user: string;
  command: string;
  path?: string;
}

export interface SuspiciousProcess {
  process: ProcessInfo;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface ProcessMonitorConfig {
  enabled: boolean;
  cpuThreshold: number;        // CPU使用率阈值 (%)
  memoryThreshold: number;     // 内存使用率阈值 (%)
  suspiciousPaths: string[];   // 可疑路径列表
  whitelistProcesses: string[]; // 白名单进程
  checkInterval: number;        // 检查间隔 (ms)
}

const defaultConfig: ProcessMonitorConfig = {
  enabled: (process.env.PROCESS_MONITOR_ENABLED || 'false').toLowerCase() === 'true',
  cpuThreshold: parseInt(process.env.PROCESS_CPU_THRESHOLD || '80', 10),
  memoryThreshold: parseInt(process.env.PROCESS_MEM_THRESHOLD || '70', 10),
  suspiciousPaths: (process.env.SUSPICIOUS_PATHS || '/tmp,/dev/shm,/var/tmp').split(','),
  whitelistProcesses: (process.env.WHITELIST_PROCESSES || 'node,systemd,docker,containerd').split(','),
  checkInterval: parseInt(process.env.PROCESS_CHECK_INTERVAL || '60000', 10), // 1分钟
};

/**
 * 获取所有进程信息
 */
async function getAllProcesses(): Promise<ProcessInfo[]> {
  try {
    if (process.platform === 'win32') {
      // Windows: 使用 wmic
      const { stdout } = await exec(
        'wmic process get ProcessId,Name,PercentProcessorTime,WorkingSetSize,ExecutablePath /format:csv'
      );
      return parseWindowsProcesses(stdout);
    } else {
      // Linux/Unix: 使用 ps
      const { stdout } = await exec(
        "ps aux --no-headers | awk '{print $1,$2,$3,$4,$11}'"
      );
      return parseUnixProcesses(stdout);
    }
  } catch (error) {
    logger.error('Failed to get processes:', error);
    return [];
  }
}

/**
 * 解析Windows进程输出
 */
function parseWindowsProcesses(output: string): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  const lines = output.trim().split('\n').slice(1); // 跳过标题行

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 5) {
      try {
        const [, path, name, cpu, pid, mem] = parts;
        if (!pid || pid === 'ProcessId') continue;

        processes.push({
          pid: parseInt(pid),
          name: name || 'Unknown',
          cpu: parseFloat(cpu) || 0,
          memory: parseFloat(mem) / 1024 / 1024 || 0, // 转换为MB
          user: 'SYSTEM',
          command: name,
          path: path || undefined,
        });
      } catch (e) {
        // 跳过解析失败的行
      }
    }
  }

  return processes;
}

/**
 * 解析Unix进程输出
 */
function parseUnixProcesses(output: string): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      try {
        const [user, pid, cpu, mem, ...commandParts] = parts;
        const command = commandParts.join(' ');

        processes.push({
          pid: parseInt(pid),
          name: command.split(' ')[0].split('/').pop() || 'Unknown',
          cpu: parseFloat(cpu),
          memory: parseFloat(mem),
          user,
          command,
          path: command.includes('/') ? command.split(' ')[0] : undefined,
        });
      } catch (e) {
        // 跳过解析失败的行
      }
    }
  }

  return processes;
}

/**
 * 检测高资源占用进程
 */
function detectHighResourceUsage(
  processes: ProcessInfo[],
  config: ProcessMonitorConfig
): SuspiciousProcess[] {
  const suspicious: SuspiciousProcess[] = [];

  for (const proc of processes) {
    // 跳过白名单进程
    if (config.whitelistProcesses.some(wp => proc.name.includes(wp))) {
      continue;
    }

    // 检测高CPU占用
    if (proc.cpu > config.cpuThreshold) {
      suspicious.push({
        process: proc,
        reason: `High CPU usage: ${proc.cpu.toFixed(1)}%`,
        severity: proc.cpu > 95 ? 'critical' : 'high',
        timestamp: new Date(),
      });
    }

    // 检测高内存占用
    if (proc.memory > config.memoryThreshold) {
      suspicious.push({
        process: proc,
        reason: `High memory usage: ${proc.memory.toFixed(1)}%`,
        severity: proc.memory > 90 ? 'critical' : 'high',
        timestamp: new Date(),
      });
    }
  }

  return suspicious;
}

/**
 * 检测可疑路径进程
 */
function detectSuspiciousPath(
  processes: ProcessInfo[],
  config: ProcessMonitorConfig
): SuspiciousProcess[] {
  const suspicious: SuspiciousProcess[] = [];

  for (const proc of processes) {
    if (!proc.path) continue;

    // 检查是否在可疑路径中
    const isSuspicious = config.suspiciousPaths.some(suspPath =>
      proc.path?.startsWith(suspPath)
    );

    if (isSuspicious) {
      suspicious.push({
        process: proc,
        reason: `Process running from suspicious path: ${proc.path}`,
        severity: 'high',
        timestamp: new Date(),
      });
    }
  }

  return suspicious;
}

/**
 * 检测隐藏进程（进程名包含特殊字符或空格）
 */
function detectHiddenProcesses(processes: ProcessInfo[]): SuspiciousProcess[] {
  const suspicious: SuspiciousProcess[] = [];

  for (const proc of processes) {
    // 检测可疑的进程名
    const suspiciousPatterns = [
      /^\s+$/,           // 纯空格
      /^\./,             // 以点开头
      /[^\x20-\x7E]/,    // 非可见ASCII字符
      /^-/,              // 以破折号开头
    ];

    const isSuspicious = suspiciousPatterns.some(pattern =>
      pattern.test(proc.name)
    );

    if (isSuspicious) {
      suspicious.push({
        process: proc,
        reason: `Suspicious process name: "${proc.name}"`,
        severity: 'medium',
        timestamp: new Date(),
      });
    }
  }

  return suspicious;
}

/**
 * 检测挖矿进程（常见挖矿程序特征）
 */
function detectCryptoMiners(processes: ProcessInfo[]): SuspiciousProcess[] {
  const suspicious: SuspiciousProcess[] = [];

  // 常见挖矿程序关键词
  const minerKeywords = [
    'xmrig',
    'minerd',
    'cpuminer',
    'cgminer',
    'bfgminer',
    'ethminer',
    'phoenixminer',
    'claymore',
    'nicehash',
    'stratum',
    'monero',
    'cryptonight',
  ];

  for (const proc of processes) {
    const commandLower = proc.command.toLowerCase();
    const nameLower = proc.name.toLowerCase();

    const isMiner = minerKeywords.some(
      keyword => commandLower.includes(keyword) || nameLower.includes(keyword)
    );

    if (isMiner) {
      suspicious.push({
        process: proc,
        reason: `Potential cryptocurrency miner detected: ${proc.name}`,
        severity: 'critical',
        timestamp: new Date(),
      });
    }
  }

  return suspicious;
}

/**
 * 主监控函数
 */
export const processMonitor = {
  config: defaultConfig,

  /**
   * 执行完整的进程扫描
   */
  async scanProcesses(): Promise<{
    enabled: boolean;
    totalProcesses: number;
    suspiciousProcesses: SuspiciousProcess[];
    summary: {
      highCpu: number;
      highMemory: number;
      suspiciousPath: number;
      hidden: number;
      miners: number;
    };
  }> {
    if (!this.config.enabled) {
      return {
        enabled: false,
        totalProcesses: 0,
        suspiciousProcesses: [],
        summary: { highCpu: 0, highMemory: 0, suspiciousPath: 0, hidden: 0, miners: 0 },
      };
    }

    try {
      const processes = await getAllProcesses();
      const suspicious: SuspiciousProcess[] = [];

      // 执行各类检测
      suspicious.push(...detectHighResourceUsage(processes, this.config));
      suspicious.push(...detectSuspiciousPath(processes, this.config));
      suspicious.push(...detectHiddenProcesses(processes));
      suspicious.push(...detectCryptoMiners(processes));

      // 去重（同一进程可能触发多个规则）
      const uniqueSuspicious = Array.from(
        new Map(suspicious.map(s => [s.process.pid, s])).values()
      );

      // 统计摘要
      const summary = {
        highCpu: suspicious.filter(s => s.reason.includes('High CPU')).length,
        highMemory: suspicious.filter(s => s.reason.includes('High memory')).length,
        suspiciousPath: suspicious.filter(s => s.reason.includes('suspicious path')).length,
        hidden: suspicious.filter(s => s.reason.includes('Suspicious process name')).length,
        miners: suspicious.filter(s => s.reason.includes('miner')).length,
      };

      logger.debug(`Process scan completed: ${processes.length} total, ${uniqueSuspicious.length} suspicious`);

      return {
        enabled: true,
        totalProcesses: processes.length,
        suspiciousProcesses: uniqueSuspicious,
        summary,
      };
    } catch (error) {
      logger.error('Process scan failed:', error);
      return {
        enabled: true,
        totalProcesses: 0,
        suspiciousProcesses: [],
        summary: { highCpu: 0, highMemory: 0, suspiciousPath: 0, hidden: 0, miners: 0 },
      };
    }
  },

  /**
   * 获取当前配置
   */
  getConfig(): ProcessMonitorConfig {
    return { ...this.config };
  },

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ProcessMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Process monitor config updated:', this.config);
  },
};
