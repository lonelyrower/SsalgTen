import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { nodeController } from '@/controllers/NodeController';

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
        stats: '/api/stats',
        agent: '/api/agent',
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

// 节点管理路由
router.get('/nodes', nodeController.getAllNodes.bind(nodeController));
router.get('/nodes/:id', nodeController.getNodeById.bind(nodeController));
router.post('/nodes', nodeController.createNode.bind(nodeController));
router.put('/nodes/:id', nodeController.updateNode.bind(nodeController));
router.delete('/nodes/:id', nodeController.deleteNode.bind(nodeController));

// 节点诊断路由
router.get('/nodes/:id/diagnostics', nodeController.getNodeDiagnostics.bind(nodeController));

// 统计信息路由
router.get('/stats', nodeController.getNodeStats.bind(nodeController));

// Agent相关路由
router.post('/agent/register', nodeController.registerAgent.bind(nodeController));
router.post('/agent/:agentId/heartbeat', nodeController.heartbeat.bind(nodeController));
router.post('/agent/:agentId/diagnostic', nodeController.reportDiagnostic.bind(nodeController));

export default router;