import { Router } from "express";
import { StreamingController } from "../controllers/StreamingController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { publicLimiter, streamingTestLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * 流媒体解锁相关路由
 *
 * IMPORTANT: Specific routes MUST come before general routes!
 * Express matches routes in order.
 */

// 获取流媒体解锁总览（前端页面） - Specific route first
router.get(
  "/streaming/overview",
  publicLimiter,
  StreamingController.getStreamingOverview,
);

// 获取流媒体节点摘要列表（前端页面，支持筛选） - Specific route
router.get(
  "/streaming/nodes",
  publicLimiter,
  StreamingController.getStreamingNodeSummaries,
);

// 获取流媒体解锁统计 - Specific route
router.get("/streaming/stats", StreamingController.getStreamingStats);

// Agent 上报流媒体检测结果 - Specific route
router.post("/streaming/results", StreamingController.saveStreamingResults);

// 批量触发流媒体检测（需要认证） - Specific route
router.post(
  "/streaming/test/bulk",
  streamingTestLimiter,
  authenticateToken,
  StreamingController.triggerBulkStreamingTest,
);

// 导出流媒体数据（需要认证） - Specific route
router.get(
  "/streaming/export",
  authenticateToken,
  StreamingController.exportStreamingData,
);

// 根据流媒体服务筛选节点 - Specific route (has :service param)
router.get(
  "/nodes/streaming/:service",
  StreamingController.getNodesByStreaming,
);

// 获取节点的流媒体解锁状态 - :nodeId param route
router.get("/nodes/:nodeId/streaming", StreamingController.getNodeStreaming);

// 触发节点的流媒体检测 - :nodeId param route
router.post(
  "/nodes/:nodeId/streaming/test",
  streamingTestLimiter,
  authenticateToken,
  requireAdmin,
  StreamingController.triggerStreamingTest,
);

export default router;
