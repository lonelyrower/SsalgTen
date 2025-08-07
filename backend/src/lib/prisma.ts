import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Prisma客户端单例
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  errorFormat: 'pretty'
});

// 在开发环境下使用全局变量避免热重载时重复创建实例
if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

// 优雅关闭处理
const gracefulShutdown = async () => {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  logger.info('Database disconnected');
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { prisma };
export default prisma;