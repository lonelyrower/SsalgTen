import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export interface FileInfo {
  path: string;
  hash: string;
  size: number;
  mtime: Date;
  permissions: string;
}

export interface FileChange {
  path: string;
  changeType: 'modified' | 'created' | 'deleted' | 'permissions';
  severity: 'low' | 'medium' | 'high' | 'critical';
  oldInfo?: FileInfo;
  newInfo?: FileInfo;
  timestamp: Date;
}

export interface FileMonitorConfig {
  enabled: boolean;
  monitorPaths: string[];     // 监控的文件/目录列表
  excludePaths: string[];     // 排除的路径
  checkInterval: number;       // 检查间隔 (ms)
  hashAlgorithm: string;       // 哈希算法
}

const defaultConfig: FileMonitorConfig = {
  enabled: (process.env.FILE_MONITOR_ENABLED || 'false').toLowerCase() === 'true',
  monitorPaths: (process.env.MONITOR_PATHS || '/etc/passwd,/etc/shadow,/etc/ssh/sshd_config,/etc/crontab,/etc/hosts').split(','),
  excludePaths: (process.env.EXCLUDE_PATHS || '').split(',').filter(p => p),
  checkInterval: parseInt(process.env.FILE_CHECK_INTERVAL || '300000', 10), // 5分钟
  hashAlgorithm: process.env.HASH_ALGORITHM || 'sha256',
};

// 文件基线数据库（首次扫描结果）
const baseline: Map<string, FileInfo> = new Map();
let baselineInitialized = false;

/**
 * 计算文件哈希
 */
async function calculateFileHash(filePath: string, algorithm: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  } catch (error) {
    throw new Error(`Failed to hash ${filePath}: ${error}`);
  }
}

/**
 * 获取文件信息
 */
async function getFileInfo(filePath: string, algorithm: string): Promise<FileInfo | null> {
  try {
    const stats = await stat(filePath);

    // 只处理常规文件
    if (!stats.isFile()) {
      return null;
    }

    const hash = await calculateFileHash(filePath, algorithm);

    return {
      path: filePath,
      hash,
      size: stats.size,
      mtime: stats.mtime,
      permissions: (stats.mode & parseInt('777', 8)).toString(8),
    };
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null; // 文件不存在
    }
    logger.error(`Failed to get file info for ${filePath}:`, error);
    return null;
  }
}

/**
 * 扫描目录
 */
async function scanDirectory(
  dirPath: string,
  algorithm: string,
  excludePaths: string[]
): Promise<Map<string, FileInfo>> {
  const results = new Map<string, FileInfo>();

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 检查是否在排除列表中
      if (excludePaths.some(exclude => fullPath.startsWith(exclude))) {
        continue;
      }

      if (entry.isFile()) {
        const info = await getFileInfo(fullPath, algorithm);
        if (info) {
          results.set(fullPath, info);
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // 递归扫描子目录（跳过隐藏目录）
        const subResults = await scanDirectory(fullPath, algorithm, excludePaths);
        subResults.forEach((value, key) => results.set(key, value));
      }
    }
  } catch (error) {
    logger.error(`Failed to scan directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * 扫描所有监控路径
 */
async function scanMonitoredPaths(
  paths: string[],
  algorithm: string,
  excludePaths: string[]
): Promise<Map<string, FileInfo>> {
  const results = new Map<string, FileInfo>();

  for (const monitorPath of paths) {
    try {
      const stats = await stat(monitorPath);

      if (stats.isFile()) {
        const info = await getFileInfo(monitorPath, algorithm);
        if (info) {
          results.set(monitorPath, info);
        }
      } else if (stats.isDirectory()) {
        const dirResults = await scanDirectory(monitorPath, algorithm, excludePaths);
        dirResults.forEach((value, key) => results.set(key, value));
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`Failed to scan ${monitorPath}:`, error);
      }
    }
  }

  return results;
}

/**
 * 比较文件变化
 */
function detectChanges(
  current: Map<string, FileInfo>,
  baseline: Map<string, FileInfo>
): FileChange[] {
  const changes: FileChange[] = [];

  // 检测修改和新增
  current.forEach((currentInfo, filePath) => {
    const baselineInfo = baseline.get(filePath);

    if (!baselineInfo) {
      // 新文件
      changes.push({
        path: filePath,
        changeType: 'created',
        severity: isCriticalFile(filePath) ? 'high' : 'medium',
        newInfo: currentInfo,
        timestamp: new Date(),
      });
    } else {
      // 检查哈希变化
      if (currentInfo.hash !== baselineInfo.hash) {
        changes.push({
          path: filePath,
          changeType: 'modified',
          severity: isCriticalFile(filePath) ? 'critical' : 'high',
          oldInfo: baselineInfo,
          newInfo: currentInfo,
          timestamp: new Date(),
        });
      }

      // 检查权限变化
      if (currentInfo.permissions !== baselineInfo.permissions) {
        changes.push({
          path: filePath,
          changeType: 'permissions',
          severity: isCriticalFile(filePath) ? 'high' : 'medium',
          oldInfo: baselineInfo,
          newInfo: currentInfo,
          timestamp: new Date(),
        });
      }
    }
  });

  // 检测删除
  baseline.forEach((baselineInfo, filePath) => {
    if (!current.has(filePath)) {
      changes.push({
        path: filePath,
        changeType: 'deleted',
        severity: isCriticalFile(filePath) ? 'critical' : 'high',
        oldInfo: baselineInfo,
        timestamp: new Date(),
      });
    }
  });

  return changes;
}

/**
 * 判断是否为关键文件
 */
function isCriticalFile(filePath: string): boolean {
  const criticalPatterns = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
    '/etc/ssh/',
    '/root/.ssh/',
    '/etc/crontab',
    '/etc/hosts',
    '/boot/',
  ];

  return criticalPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * 文件监控主对象
 */
export const fileMonitor = {
  config: defaultConfig,

  /**
   * 初始化基线
   */
  async initializeBaseline(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      logger.info('Initializing file integrity baseline...');

      const results = await scanMonitoredPaths(
        this.config.monitorPaths,
        this.config.hashAlgorithm,
        this.config.excludePaths
      );

      baseline.clear();
      results.forEach((value, key) => baseline.set(key, value));

      baselineInitialized = true;
      logger.info(`Baseline initialized with ${baseline.size} files`);
    } catch (error) {
      logger.error('Failed to initialize baseline:', error);
    }
  },

  /**
   * 执行完整性检查
   */
  async checkIntegrity(): Promise<{
    enabled: boolean;
    baselineInitialized: boolean;
    filesMonitored: number;
    changes: FileChange[];
    summary: {
      modified: number;
      created: number;
      deleted: number;
      permissions: number;
    };
  }> {
    if (!this.config.enabled) {
      return {
        enabled: false,
        baselineInitialized: false,
        filesMonitored: 0,
        changes: [],
        summary: { modified: 0, created: 0, deleted: 0, permissions: 0 },
      };
    }

    // 如果基线未初始化，先初始化
    if (!baselineInitialized) {
      await this.initializeBaseline();
      return {
        enabled: true,
        baselineInitialized: true,
        filesMonitored: baseline.size,
        changes: [],
        summary: { modified: 0, created: 0, deleted: 0, permissions: 0 },
      };
    }

    try {
      // 扫描当前状态
      const currentState = await scanMonitoredPaths(
        this.config.monitorPaths,
        this.config.hashAlgorithm,
        this.config.excludePaths
      );

      // 检测变化
      const changes = detectChanges(currentState, baseline);

      // 统计摘要
      const summary = {
        modified: changes.filter(c => c.changeType === 'modified').length,
        created: changes.filter(c => c.changeType === 'created').length,
        deleted: changes.filter(c => c.changeType === 'deleted').length,
        permissions: changes.filter(c => c.changeType === 'permissions').length,
      };

      logger.debug(`File integrity check: ${changes.length} changes detected`);

      return {
        enabled: true,
        baselineInitialized: true,
        filesMonitored: baseline.size,
        changes,
        summary,
      };
    } catch (error) {
      logger.error('File integrity check failed:', error);
      return {
        enabled: true,
        baselineInitialized: true,
        filesMonitored: baseline.size,
        changes: [],
        summary: { modified: 0, created: 0, deleted: 0, permissions: 0 },
      };
    }
  },

  /**
   * 更新基线（接受当前状态为新基线）
   */
  async updateBaseline(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.initializeBaseline();
  },

  /**
   * 获取当前配置
   */
  getConfig(): FileMonitorConfig {
    return { ...this.config };
  },

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<FileMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('File monitor config updated:', this.config);
  },
};
