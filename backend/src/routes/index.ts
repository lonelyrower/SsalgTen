import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';

const router = Router();

// API 状态检查
router.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'SsalgTen API is running',
    data: {
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    }
  };
  res.json(response);
});

// API 信息
router.get('/info', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      name: 'SsalgTen API',
      version: '0.1.0',
      description: 'Multi-node network diagnostic aggregation system',
      author: 'SsalgTen Team',
      repository: 'https://github.com/yourusername/SsalgTen',
      endpoints: {
        health: '/api/health',
        info: '/api/info',
        nodes: '/api/nodes',
        diagnostics: '/api/diagnostics',
        admin: '/api/admin'
      },
      features: [
        'Multi-node network diagnostics',
        'Real-time world map visualization',
        'Ping, Traceroute, MTR, Speedtest support',
        'Agent-based architecture',
        'RESTful API interface'
      ]
    }
  };
  res.json(response);
});

// 节点相关路由（占位符）
router.get('/nodes', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: [],
    message: 'Node management endpoints - Coming soon'
  };
  res.json(response);
});

// 诊断相关路由（占位符）
router.get('/diagnostics', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: [],
    message: 'Diagnostic tool endpoints - Coming soon'
  };
  res.json(response);
});

export default router;