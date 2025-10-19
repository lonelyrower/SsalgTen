import { Router } from "express";
import { ServicesController } from "../controllers/ServicesController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { publicLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * 服务总览相关路由
 */

// 获取服务总览统计（公开）
router.get(
  "/services/overview",
  publicLimiter,
  ServicesController.getServicesOverview,
);

// 获取所有服务（公开，支持筛选）
router.get("/services", publicLimiter, ServicesController.getAllServices);

// 获取服务按节点分组（公开）
router.get(
  "/services/grouped",
  publicLimiter,
  ServicesController.getNodeServicesGrouped,
);

// 更新服务信息（需要管理员权限）
router.put(
  "/services/:id",
  authenticateToken,
  requireAdmin,
  ServicesController.updateService,
);

// 删除服务（需要管理员权限）
router.delete(
  "/services/:id",
  authenticateToken,
  requireAdmin,
  ServicesController.deleteService,
);

// 导出服务数据（需要认证）
router.get(
  "/services/export",
  authenticateToken,
  ServicesController.exportServices,
);

export default router;
