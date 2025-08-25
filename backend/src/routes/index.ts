import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import { nodeController } from '../controllers/NodeController';
import { authController } from '../controllers/AuthController';
import { adminController } from '../controllers/AdminController';
import { systemConfigController } from '../controllers/SystemConfigController';
import { visitorController } from '../controllers/VisitorController';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';
import { loginLimiter, agentLimiter, publicLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { AgentRegisterSchema, AgentHeartbeatSchema, AgentDiagnosticSchema } from '../schemas/agent';
import { LoginSchema, ChangePasswordSchema, RefreshSchema } from '../schemas/auth';
import { CreateUserSchema, UpdateUserSchema, CreateNodeSchema, UpdateNodeSchema } from '../schemas/admin';
import { APP_VERSION } from '../utils/version';
import { diagnosticsProxyController } from '../controllers/DiagnosticsProxyController';

const router = Router();

// API 状态检查
router.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'SsalgTen API is running',
    data: {
      timestamp: new Date().toISOString(),
  version: APP_VERSION,
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
  version: APP_VERSION,
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
router.get('/nodes', publicLimiter, nodeController.getAllNodes.bind(nodeController));
router.get('/nodes/:id', publicLimiter, nodeController.getNodeById.bind(nodeController));
// 节点写操作仅限管理员
router.post('/nodes', authenticateToken, requireAdmin, nodeController.createNode.bind(nodeController));
router.put('/nodes/:id', authenticateToken, requireAdmin, nodeController.updateNode.bind(nodeController));
router.delete('/nodes/:id', authenticateToken, requireAdmin, nodeController.deleteNode.bind(nodeController));

// 节点诊断路由
router.get('/nodes/:id/diagnostics', nodeController.getNodeDiagnostics.bind(nodeController));

// 节点心跳数据路由
router.get('/nodes/:id/heartbeat', nodeController.getNodeHeartbeatData.bind(nodeController));
router.get('/nodes/:id/events', nodeController.getNodeEvents.bind(nodeController));

// 全局活动日志路由  
router.get('/activities', nodeController.getGlobalActivities.bind(nodeController));

// 诊断代理（可选，需启用开关）：仅认证用户
router.get('/diagnostics/:id/ping', authenticateToken, diagnosticsProxyController.ping.bind(diagnosticsProxyController));
router.get('/diagnostics/:id/traceroute', authenticateToken, diagnosticsProxyController.traceroute.bind(diagnosticsProxyController));
router.get('/diagnostics/:id/mtr', authenticateToken, diagnosticsProxyController.mtr.bind(diagnosticsProxyController));
router.get('/diagnostics/:id/speedtest', authenticateToken, diagnosticsProxyController.speedtest.bind(diagnosticsProxyController));
router.get('/diagnostics/:id/latency-test', authenticateToken, diagnosticsProxyController.latencyTest.bind(diagnosticsProxyController));

// 统计信息路由
router.get('/stats', publicLimiter, nodeController.getNodeStats.bind(nodeController));

// Agent相关路由
router.post('/agents/register', agentLimiter, validateBody(AgentRegisterSchema), nodeController.registerAgent.bind(nodeController));
router.post('/agents/:agentId/heartbeat', agentLimiter, validateBody(AgentHeartbeatSchema), nodeController.heartbeat.bind(nodeController));
router.post('/agents/:agentId/diagnostic', agentLimiter, validateBody(AgentDiagnosticSchema), nodeController.reportDiagnostic.bind(nodeController));
// 安装脚本/命令仅管理员可获取
router.get('/agents/install-script', authenticateToken, requireAdmin, nodeController.getInstallScript.bind(nodeController));
router.get('/agents/install-command', authenticateToken, requireAdmin, nodeController.getInstallCommand.bind(nodeController));

// 访问者IP信息路由（公开访问）
router.get('/visitor/info', publicLimiter, visitorController.getVisitorInfo.bind(visitorController));
router.get('/visitor/ip/:ip', publicLimiter, visitorController.getIPDetails.bind(visitorController));

// 认证相关路由
router.post('/auth/login', loginLimiter, validateBody(LoginSchema), authController.login.bind(authController));
router.post('/auth/logout', authController.logout.bind(authController));
// 刷新令牌不需要 access token（使用 refresh token 轮换）
router.post('/auth/refresh', loginLimiter, validateBody(RefreshSchema), authController.refreshToken.bind(authController));

// 用户相关路由（需要认证）
router.get('/auth/profile', authenticateToken, authController.getProfile.bind(authController));
router.put('/auth/password', authenticateToken, validateBody(ChangePasswordSchema), authController.changePassword.bind(authController));

// 管理员相关路由（需要管理员权限）
// 节点管理
router.get('/admin/nodes', authenticateToken, requireAdmin, nodeController.getAllNodes.bind(nodeController));
router.post('/admin/nodes', authenticateToken, requireAdmin, validateBody(CreateNodeSchema), adminController.createNode.bind(adminController));
router.put('/admin/nodes/:id', authenticateToken, requireAdmin, validateBody(UpdateNodeSchema), adminController.updateNode.bind(adminController));
router.delete('/admin/nodes/:id', authenticateToken, requireAdmin, adminController.deleteNode.bind(adminController));

// 用户管理
router.get('/admin/users', authenticateToken, requireAdmin, adminController.getAllUsers.bind(adminController));
router.post('/admin/users', authenticateToken, requireAdmin, validateBody(CreateUserSchema), adminController.createUser.bind(adminController));
router.put('/admin/users/:id', authenticateToken, requireAdmin, validateBody(UpdateUserSchema), adminController.updateUser.bind(adminController));
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

// API密钥管理（管理员专用）
router.get('/admin/api-key/info', authenticateToken, requireAdmin, nodeController.getApiKeyInfo.bind(nodeController));
router.post('/admin/api-key/regenerate', authenticateToken, requireAdmin, nodeController.regenerateApiKey.bind(nodeController));

export default router;
