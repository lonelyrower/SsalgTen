import { Router } from "express";
import { ServicesController } from "../controllers/ServicesController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { publicLimiter, agentLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * 服务总览相关路由
 *
 * IMPORTANT: Specific routes MUST come before general routes!
 * Express matches routes in order, so /services/overview must be defined before /services/:id
 */

// 获取服务总览统计（公开） - MUST be before /services
router.get(
  "/services/overview",
  publicLimiter,
  ServicesController.getServicesOverview,
);

// 获取服务按节点分组（公开） - MUST be before /services
router.get(
  "/services/grouped",
  publicLimiter,
  ServicesController.getNodeServicesGrouped,
);

// 导出服务数据（需要认证） - MUST be before /services/:id
router.get(
  "/services/export",
  authenticateToken,
  ServicesController.exportServices,
);

// 获取所有服务（公开，支持筛选） - General route, comes after specific ones
router.get("/services", publicLimiter, ServicesController.getAllServices);

// 更新服务信息（需要管理员权限） - :id route comes last
router.put(
  "/services/:id",
  authenticateToken,
  requireAdmin,
  ServicesController.updateService,
);

// 删除服务（需要管理员权限） - :id route comes last
router.delete(
  "/services/:id",
  authenticateToken,
  requireAdmin,
  ServicesController.deleteService,
);

// Agent 上报服务检测结果（使用 Agent 限流器）
router.post(
  "/services/report",
  agentLimiter,
  ServicesController.reportServices,
);

// 触发节点服务扫描（需要管理员权限）
router.post(
  "/nodes/:nodeId/services/scan",
  authenticateToken,
  requireAdmin,
  ServicesController.triggerServiceScan,
);

export default router;
