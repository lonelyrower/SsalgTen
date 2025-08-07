import app from './app';
import { logger } from './utils/logger';
import { initSystemConfig } from './utils/initSystemConfig';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, async () => {
  logger.info(`🚀 SsalgTen API Server is running on http://${HOST}:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔍 Health check: http://${HOST}:${PORT}/api/health`);
  logger.info(`📖 API info: http://${HOST}:${PORT}/api/info`);
  logger.info(`🏠 Homepage: http://${HOST}:${PORT}/`);
  
  // 初始化系统配置
  try {
    await initSystemConfig();
    logger.info('✅ System configuration initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize system configuration:', error);
  }
});

// 优雅关闭处理
const gracefulShutdown = (signal: string): void => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info('🛑 Server closed');
    process.exit(0);
  });
};

// 监听关闭信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获异常处理
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});