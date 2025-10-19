import { Router } from "express";
import { StreamingController } from "../controllers/StreamingController";

const router = Router();

/**
 * 流媒体解锁相关路由
 */

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
