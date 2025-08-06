import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { config, serverConfig } from './config';
import { getSystemInfo } from './utils/system';

// 加载环境变量
dotenv.config();

const app = express();

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
        'system-monitoring'
      ],
      endpoints: {
        health: '/health',
        info: '/info',
        ping: '/api/ping',
        traceroute: '/api/traceroute',
        mtr: '/api/mtr',
        speedtest: '/api/speedtest'
      }
    }
  });
});

// API 路由占位符
app.get('/api/ping/:target', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Ping API endpoint - Coming soon',
    target: req.params.target
  });
});

app.get('/api/traceroute/:target', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Traceroute API endpoint - Coming soon',
    target: req.params.target
  });
});

app.get('/api/mtr/:target', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MTR API endpoint - Coming soon',
    target: req.params.target
  });
});

app.get('/api/speedtest', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Speedtest API endpoint - Coming soon'
  });
});

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
      'GET /api/speedtest'
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
const server = app.listen(serverConfig.port, () => {
  logger.info(`🤖 SsalgTen Agent started successfully`);
  logger.info(`📡 Agent ID: ${config.id}`);
  logger.info(`🏷️  Node Name: ${config.name}`);
  logger.info(`📍 Location: ${config.location.city}, ${config.location.country}`);
  logger.info(`🏢 Provider: ${config.provider}`);
  logger.info(`🌐 Server: http://localhost:${serverConfig.port}`);
  logger.info(`🔗 Master: ${config.masterUrl}`);
  logger.info(`⚡ Environment: ${serverConfig.nodeEnv}`);
});

// 优雅关闭
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info('🛑 Agent server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));