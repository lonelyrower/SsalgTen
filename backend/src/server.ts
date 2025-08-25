import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { logger } from './utils/logger';
import { initSystemConfig } from './utils/initSystemConfig';
import { setupSocketHandlers } from './sockets/socketHandlers';
import { setIO } from './sockets/ioRegistry';
import { apiKeyService } from './services/ApiKeyService';
import { APP_VERSION } from './utils/version';
import { startSchedulers } from './utils/scheduler';

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
setIO(io);

// 将 io 实例添加到 app 中以便在路由中使用
app.set('io', io);

const server = httpServer.listen(PORT, async () => {
  logger.info(`🚀 SsalgTen API Server v${APP_VERSION} is running on http://${HOST}:${PORT}`);
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
    logger.info(`🔑 当前系统API密钥: ${systemApiKey ? systemApiKey.substring(0, 10) + '...' : 'null'}`);
    
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
    
    // 显示API密钥信息供调试
    try {
      const apiKeyInfo = await apiKeyService.getApiKeyInfo();
      logger.info(`🔑 API密钥详情:`);
      logger.info(`  - 密钥ID: ${apiKeyInfo.id}`);
      logger.info(`  - 创建时间: ${apiKeyInfo.createdAt.toISOString()}`);
      logger.info(`  - 使用次数: ${apiKeyInfo.usageCount}`);
      logger.info(`  - 最后使用: ${apiKeyInfo.lastUsed ? apiKeyInfo.lastUsed.toISOString() : '从未使用'}`);
    } catch (infoError) {
      logger.warn('获取API密钥详情失败:', infoError);
    }
    
  } catch (error) {
    logger.error('❌ Failed to initialize API key system:', error);
    logger.error('尝试回退到环境变量API密钥...');
    
    const fallbackKey = process.env.DEFAULT_AGENT_API_KEY || 'default-agent-api-key';
    logger.warn(`🔄 使用回退API密钥: ${fallbackKey.substring(0, 10)}...`);
  }

  // 启动定时清理任务
  startSchedulers();
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
