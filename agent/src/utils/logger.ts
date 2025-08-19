import { serverConfig } from '../config';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

const getCurrentLogLevel = (): LogLevel => {
  switch (serverConfig.logLevel.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
};

const currentLevel = getCurrentLogLevel();

const formatMessage = (level: string, message: string, ...args: any[]): string => {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ') : '';
  return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
};

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (currentLevel <= LogLevel.DEBUG) {
      console.debug(formatMessage('DEBUG', message, ...args));
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (currentLevel <= LogLevel.INFO) {
      console.log(formatMessage('INFO', message, ...args));
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(formatMessage('WARN', message, ...args));
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(formatMessage('ERROR', message, ...args));
    }
  }
};