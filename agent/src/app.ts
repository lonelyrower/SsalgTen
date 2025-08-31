import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { config, serverConfig } from './config';
import { getSystemInfo } from './utils/system';
import { diagnosticController } from './controllers/DiagnosticController';
import { registrationService } from './services/RegistrationService';

// 加载环境变量
dotenv.config();

const app = express();

// Allow insecure TLS for outbound requests when explicitly enabled.
// Temporary workaround for environments with incomplete cert chains.
if ((process.env.AGENT_TLS_INSECURE || '').toLowerCase() === 'true' || process.env.AGENT_TLS_INSECURE === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  logger.warn('AGENT_TLS_INSECURE is enabled; TLS certificate verification is disabled for outbound requests');
}

// 启动前安全检查：禁止使用默认API Key
if (!process.env.AGENT_API_KEY || process.env.AGENT_API_KEY === 'default-api-key') {
  logger.error('AGENT_API_KEY 未设置或仍为默认值，请设置一个安全的随机密钥后再启动 (env AGENT_API_KEY)');
  process.exit(1);
}

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 基础路由
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'SsalgTen Agent is running',
    agent: {
      id: config.id,
      name: config.name,
      location: config.location,
      provider: config.provider,
      version: '0.1.0'
    },
    timestamp: new Date().toISOString()
  });
});

// 健康检查
app.get('/health', async (req: Request, res: Response) => {
  try {
    const systemInfo = await getSystemInfo();
    
    res.json({
      success: true,
      status: 'healthy',
      agent: {
        id: config.id,
        name: config.name,
        version: '0.1.0',
        uptime: process.uptime()
      },
      system: systemInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'System information unavailable'
    });
  }
});

// Agent 信息
app.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      agent: {
        id: config.id,
        name: config.name,
        location: config.location,
        provider: config.provider,
        masterUrl: config.masterUrl,
        version: '0.1.0'
      },
      capabilities: [
        'ping',
        'traceroute', 
        'mtr',
        'speedtest',
        'latency-test',
        'system-monitoring'
      ],
      endpoints: {
        health: '/health',
        info: '/info',
        ping: '/api/ping/:target',
        traceroute: '/api/traceroute/:target',
        mtr: '/api/mtr/:target',
        speedtest: '/api/speedtest',
        latencyTest: '/api/latency-test',
        networkInfo: '/api/network-info',
        connectivity: '/api/connectivity'
      }
    }
  });
});

// 网络诊断 API 路由
app.get('/api/ping/:target', diagnosticController.ping.bind(diagnosticController));
app.get('/api/traceroute/:target', diagnosticController.traceroute.bind(diagnosticController));
app.get('/api/mtr/:target', diagnosticController.mtr.bind(diagnosticController));
app.get('/api/speedtest', diagnosticController.speedtest.bind(diagnosticController));
app.get('/api/latency-test', diagnosticController.latencyTest.bind(diagnosticController));
app.get('/api/network-info', diagnosticController.networkInfo.bind(diagnosticController));
app.get('/api/connectivity', diagnosticController.connectivity.bind(diagnosticController));

// 404 处理
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /info',
      'GET /api/ping/:target',
      'GET /api/traceroute/:target',
      'GET /api/mtr/:target',
      'GET /api/speedtest',
      'GET /api/latency-test',
      'GET /api/network-info',
      'GET /api/connectivity'
    ]
  });
});

// 全局错误处理
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(serverConfig.nodeEnv === 'development' && { 
      details: error.message 
    })
  });
});

// 启动服务器
const server = app.listen(serverConfig.port, async () => {
  logger.info(`🤖 SsalgTen Agent started successfully`);
  logger.info(`📡 Agent ID: ${config.id}`);
  logger.info(`🏷️  Node Name: ${config.name}`);
  logger.info(`📍 Location: ${config.location.city}, ${config.location.country}`);
  logger.info(`🏢 Provider: ${config.provider}`);
  logger.info(`🌐 Server: http://localhost:${serverConfig.port}`);
  logger.info(`🔗 Master: ${config.masterUrl}`);
  logger.info(`⚡ Environment: ${serverConfig.nodeEnv}`);
  
  // 延迟注册以确保服务器完全启动
  setTimeout(async () => {
    logger.info('🔄 Attempting to register with master server...');
    
    try {
      const result = await registrationService.retryRegistration(3, 5000);
      
      if (result.success) {
        logger.info(`✅ Registration successful! Node: ${result.nodeName} (${result.location})`);
      } else {
        logger.error(`❌ Registration failed: ${result.error}`);
        logger.warn('⚠️  Agent will continue running but will not appear in the master server.');
        logger.warn('📋 Please ensure:');
        logger.warn('   1. Master server is running and accessible');
        logger.warn('   2. This agent is registered in the master server admin panel');
        logger.warn('   3. Network connectivity to the master server');
      }
    } catch (error) {
      logger.error('💥 Unexpected registration error:', error);
    }
  }, 2000);
});

// 优雅关闭
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  // 停止注册服务
  await registrationService.shutdown();
  
  server.close(() => {
    logger.info('🛑 Agent server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
