import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { corsMiddleware } from './middleware/cors';
import { logger } from './utils/logger';
import router from './routes';
import { ApiResponse } from './types';
import { APP_VERSION } from './utils/version';

// 加载环境变量
dotenv.config();

const app = express();

// 安全中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// CORS 配置
app.use(corsMiddleware);

// 日志中间件
if (process.env.ENABLE_MORGAN === 'true') {
  app.use(morgan('combined'));
}

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API 根路径信息
app.get('/', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'Welcome to SsalgTen API',
    data: {
      name: 'SsalgTen API Server',
  version: APP_VERSION,
      description: 'Multi-node network diagnostic aggregation system',
      documentation: '/api/info',
      health: '/api/health'
    }
  };
  res.json(response);
});

// API 路由
app.use('/api', router);

// 404 处理
app.use('*', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: 'API endpoint not found',
    data: {
      path: req.originalUrl,
      method: req.method,
      availableEndpoints: [
        'GET /',
        'GET /api/health',
        'GET /api/info',
        'GET /api/nodes',
        'GET /api/diagnostics'
      ]
    }
  };
  res.status(404).json(response);
});

// 全局错误处理
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      data: { 
        details: error.message,
        stack: error.stack 
      } 
    })
  };
  
  res.status(500).json(response);
});

export default app;