import { Router } from "express";
import { StreamingController } from "../controllers/StreamingController";
import { authenticateToken } from "../middleware/auth";
import { publicLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * 流媒体解锁相关路由
 */

// 获取流媒体解锁总览（前端页面）
router.get(
  "/streaming/overview",
  publicLimiter,
  StreamingController.getStreamingOverview,
);

// 获取流媒体节点摘要列表（前端页面，支持筛选）
router.get(
  "/streaming/nodes",
  publicLimiter,
  StreamingController.getStreamingNodeSummaries,
);

// 批量触发流媒体检测（需要认证）
router.post(
  "/streaming/test/bulk",
  authenticateToken,
  StreamingController.triggerBulkStreamingTest,
);

// 导出流媒体数据（需要认证）
router.get(
  "/streaming/export",
  authenticateToken,
  StreamingController.exportStreamingData,
);

// 获取节点的流媒体解锁状态
router.get("/nodes/:nodeId/streaming", StreamingController.getNodeStreaming);

// 触发节点的流媒体检测
router.post(
  "/nodes/:nodeId/streaming/test",
  StreamingController.triggerStreamingTest,
);

// Agent 上报流媒体检测结果
router.post("/streaming/results", StreamingController.saveStreamingResults);

// 根据流媒体服务筛选节点
router.get(
  "/nodes/streaming/:service",
  StreamingController.getNodesByStreaming,
);

// 获取流媒体解锁统计
router.get("/streaming/stats", StreamingController.getStreamingStats);

export default router;
