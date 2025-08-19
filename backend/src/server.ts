import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { logger } from './utils/logger';
import { initSystemConfig } from './utils/initSystemConfig';
import { setupSocketHandlers } from './sockets/socketHandlers';
import { apiKeyService } from './services/ApiKeyService';

// 强制要求安全的 JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret') {
  logger.error('JWT_SECRET 未设置或使用不安全的默认值，请设置一个足够复杂的随机密钥 (env JWT_SECRET)');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// 创建 HTTP 服务器和 Socket.IO 实例
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 设置 Socket.IO 处理程序
setupSocketHandlers(io);

// 将 io 实例添加到 app 中以便在路由中使用
app.set('io', io);

const server = httpServer.listen(PORT, async () => {
  logger.info(`🚀 SsalgTen API Server is running on http://${HOST}:${PORT}`);
  logger.info(`🌐 Socket.IO server is ready for real-time connections`);
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

  // 初始化API密钥系统
  try {
    const systemApiKey = await apiKeyService.initializeSystemApiKey();
    const securityCheck = await apiKeyService.checkApiKeySecurity();
  await apiKeyService.purgeExpiredPreviousKey();
    
    logger.info('🔑 API key system initialized');
    
    if (!securityCheck.isSecure) {
      logger.warn('⚠️ API密钥安全检查警告:');
      securityCheck.warnings.forEach(warning => {
        logger.warn(`  - ${warning}`);
      });
      logger.warn('建议操作:');
      securityCheck.recommendations.forEach(rec => {
        logger.warn(`  - ${rec}`);
      });
    } else {
      logger.info('✅ API key security check passed');
    }
  } catch (error) {
    logger.error('❌ Failed to initialize API key system:', error);
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