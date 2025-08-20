import { nodeService } from '../services/NodeService';
import { logger } from './logger';

const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24');
const HEARTBEAT_RETENTION_DAYS = parseInt(process.env.HEARTBEAT_RETENTION_DAYS || '30');

let started = false;

export const startSchedulers = () => {
  if (started) return;
  started = true;
  logger.info(`[Scheduler] 启动定时任务: 每 ${CLEANUP_INTERVAL_HOURS}h 清理超过 ${HEARTBEAT_RETENTION_DAYS} 天的旧记录`);
  setInterval(async () => {
    try {
      await nodeService.cleanupOldRecords(HEARTBEAT_RETENTION_DAYS);
    } catch (e) {
      logger.warn('[Scheduler] 清理任务失败', e);
    }
  }, CLEANUP_INTERVAL_HOURS * 3600 * 1000).unref();
};
