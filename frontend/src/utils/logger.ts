/**
 * 统一的日志工具
 *
 * 在开发环境输出所有日志，生产环境只输出 error
 * 使用方法：
 * import { logger } from '@/utils/logger';
 * logger.log('调试信息');
 * logger.warn('警告信息');
 * logger.error('错误信息');
 */

const isDev = import.meta.env.DEV;

interface LoggerConfig {
  enabled: boolean;
  prefix: string;
}

class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enabled: isDev,
      prefix: '[App]',
      ...config,
    };
  }

  /**
   * 普通日志 - 仅开发环境
   */
  log(...args: any[]) {
    if (this.config.enabled) {
      console.log(this.config.prefix, ...args);
    }
  }

  /**
   * 信息日志 - 仅开发环境
   */
  info(...args: any[]) {
    if (this.config.enabled) {
      console.info(this.config.prefix, ...args);
    }
  }

  /**
   * 警告日志 - 仅开发环境
   */
  warn(...args: any[]) {
    if (this.config.enabled) {
      console.warn(this.config.prefix, ...args);
    }
  }

  /**
   * 错误日志 - 始终输出（生产环境也需要）
   */
  error(...args: any[]) {
    console.error(this.config.prefix, ...args);
  }

  /**
   * 调试日志 - 仅开发环境
   */
  debug(...args: any[]) {
    if (this.config.enabled) {
      console.debug(this.config.prefix, ...args);
    }
  }

  /**
   * 分组日志 - 仅开发环境
   */
  group(label: string, ...args: any[]) {
    if (this.config.enabled) {
      console.group(this.config.prefix, label);
      args.forEach(arg => console.log(arg));
      console.groupEnd();
    }
  }

  /**
   * 表格日志 - 仅开发环境
   */
  table(data: any) {
    if (this.config.enabled) {
      console.table(data);
    }
  }
}

// 默认导出实例
export const logger = new Logger();

// 导出构造函数，允许创建自定义 logger
export { Logger };
