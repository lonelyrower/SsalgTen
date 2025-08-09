import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import { nodeController } from '../controllers/NodeController';
import { authController } from '../controllers/AuthController';
import { adminController } from '../controllers/AdminController';
import { systemConfigController } from '../controllers/SystemConfigController';
import { visitorController } from '../controllers/VisitorController';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';

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
      repository: 'https://github.com/lonelyrower/SsalgTen',
      endpoints: {
        health: '/api/health',
        info: '/api/info',
        nodes: '/api/nodes',
        stats: '/api/stats',
        agent: '/api/agent',
        admin: '/api/admin',
        auth: '/api/auth'
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

// 访问者IP信息路由（公开访问）
router.get('/visitor/info', visitorController.getVisitorInfo.bind(visitorController));
router.get('/visitor/ip/:ip', visitorController.getIPDetails.bind(visitorController));

// 认证相关路由
router.post('/auth/login', authController.login.bind(authController));
router.post('/auth/logout', authController.logout.bind(authController));
router.post('/auth/refresh', authenticateToken, authController.refreshToken.bind(authController));

// 用户相关路由（需要认证）
router.get('/auth/profile', authenticateToken, authController.getProfile.bind(authController));
router.put('/auth/password', authenticateToken, authController.changePassword.bind(authController));

// 管理员相关路由（需要管理员权限）
// 节点管理
router.get('/admin/nodes', authenticateToken, requireAdmin, nodeController.getAllNodes.bind(nodeController));
router.post('/admin/nodes', authenticateToken, requireAdmin, adminController.createNode.bind(adminController));
router.put('/admin/nodes/:id', authenticateToken, requireAdmin, adminController.updateNode.bind(adminController));
router.delete('/admin/nodes/:id', authenticateToken, requireAdmin, adminController.deleteNode.bind(adminController));

// 用户管理
router.get('/admin/users', authenticateToken, requireAdmin, adminController.getAllUsers.bind(adminController));
router.post('/admin/users', authenticateToken, requireAdmin, adminController.createUser.bind(adminController));
router.put('/admin/users/:id', authenticateToken, requireAdmin, adminController.updateUser.bind(adminController));
router.delete('/admin/users/:id', authenticateToken, requireAdmin, adminController.deleteUser.bind(adminController));

// 系统统计
router.get('/admin/stats', authenticateToken, requireAdmin, adminController.getSystemStats.bind(adminController));

// 系统配置管理
router.get('/admin/configs', authenticateToken, requireAdmin, systemConfigController.getAllConfigs.bind(systemConfigController));
router.get('/admin/configs/categories', authenticateToken, requireAdmin, systemConfigController.getCategories.bind(systemConfigController));
router.get('/admin/configs/:key', authenticateToken, requireAdmin, systemConfigController.getConfig.bind(systemConfigController));
router.put('/admin/configs/:key', authenticateToken, requireAdmin, systemConfigController.updateConfig.bind(systemConfigController));
router.delete('/admin/configs/:key', authenticateToken, requireAdmin, systemConfigController.deleteConfig.bind(systemConfigController));
router.post('/admin/configs/batch', authenticateToken, requireAdmin, systemConfigController.batchUpdateConfigs.bind(systemConfigController));
router.post('/admin/configs/reset', authenticateToken, requireAdmin, systemConfigController.resetToDefaults.bind(systemConfigController));

// 访问者统计（管理员专用）
router.get('/admin/visitors/stats', authenticateToken, requireAdmin, visitorController.getVisitorStats.bind(visitorController));
router.get('/admin/visitors/cache', authenticateToken, requireAdmin, visitorController.getCacheStats.bind(visitorController));
router.post('/admin/visitors/cache/clear', authenticateToken, requireAdmin, visitorController.clearCache.bind(visitorController));

export default router;