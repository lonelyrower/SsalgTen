import { nodeService } from "../services/NodeService";
import { logger } from "./logger";

const CLEANUP_INTERVAL_HOURS = parseInt(
  process.env.CLEANUP_INTERVAL_HOURS || "1", // Run cleanup every 1 hour
);
const HEARTBEAT_RETENTION_DAYS = parseInt(
  process.env.HEARTBEAT_RETENTION_DAYS || "1", // Keep only 1 day of heartbeat data
);
const OFFLINE_CHECK_INTERVAL_MINUTES = parseInt(
  process.env.OFFLINE_CHECK_INTERVAL_MINUTES || "5",
);
const OFFLINE_THRESHOLD_MINUTES = parseInt(
  process.env.OFFLINE_THRESHOLD_MINUTES || "30",
);

let started = false;

export const startSchedulers = () => {
  if (started) return;
  started = true;

  logger.info(`[Scheduler] 启动定时任务:`);
  logger.info(
    `  - 每 ${CLEANUP_INTERVAL_HOURS}h 清理超过 ${HEARTBEAT_RETENTION_DAYS} 天的旧记录`,
  );
  logger.info(
    `  - 每 ${OFFLINE_CHECK_INTERVAL_MINUTES} 分钟检查离线节点 (超过 ${OFFLINE_THRESHOLD_MINUTES} 分钟无心跳)`,
  );

  // 清理旧记录的定时任务
  setInterval(
    async () => {
      try {
        await nodeService.cleanupOldRecords(HEARTBEAT_RETENTION_DAYS);
      } catch (e) {
        logger.warn("[Scheduler] 清理任务失败", e);
      }
    },
    CLEANUP_INTERVAL_HOURS * 3600 * 1000,
  ).unref();

  // 检查离线节点的定时任务
  setInterval(
    async () => {
      try {
        // 先尝试恢复卡在离线状态的节点
        await nodeService.forceRecoveryOnlineNodes();
        // 然后检查真正需要离线的节点
        await nodeService.checkOfflineNodes(OFFLINE_THRESHOLD_MINUTES);
      } catch (e) {
        logger.warn("[Scheduler] 节点状态检查失败", e);
      }
    },
    OFFLINE_CHECK_INTERVAL_MINUTES * 60 * 1000,
  ).unref();
};
