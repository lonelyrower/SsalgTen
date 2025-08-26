import { useEffect, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { enhancedApiService } from '@/services/enhancedApiService';
import { socketService } from '@/services/socketService';

export const useApiNotifications = () => {
  const { showError, showSuccess, showWarning, showInfo } = useNotification();
  // 抑制“闪断”提示：仅当离线持续超过阈值才提示；并避免初次连接弹窗
  const lastConnectedRef = useRef<boolean | null>(null);
  const offlineTimerRef = useRef<number | null>(null);
  const lastErrorAtRef = useRef<number>(0);
  const hadOfflineToastRef = useRef<boolean>(false);
  const OFFLINE_NOTIFY_DELAY = 4000; // ms，离线超过此时长才提示
  const ERROR_THROTTLE = 60000; // ms，同类错误节流

  useEffect(() => {
    // 设置API错误处理回调
    enhancedApiService.setNotificationCallbacks({
      showError,
      showSuccess,
    });

    // 设置Socket连接状态通知
    const handleConnectionError = (error: Error) => {
      const now = Date.now();
      if (now - lastErrorAtRef.current < ERROR_THROTTLE) return;
      lastErrorAtRef.current = now;
      showError('连接错误', error.message);
    };

    const handleConnectionStatusChange = (connected: boolean) => {
      // 初次挂载：不提示“已恢复”
      if (lastConnectedRef.current === null) {
        lastConnectedRef.current = connected;
        return;
      }

      // 清理未触发的离线提示定时器
      if (offlineTimerRef.current) {
        window.clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }

      if (connected) {
        // 只有在之前真的提示过“离线”后，才提示“已恢复”
        if (hadOfflineToastRef.current) {
          showSuccess('连接已恢复', '实时数据连接已建立');
        }
        hadOfflineToastRef.current = false;
      } else {
        // 延迟一段时间再提示离线，避免短暂闪断造成打扰
        offlineTimerRef.current = window.setTimeout(() => {
          showWarning('连接断开', '实时数据连接已断开，正在尝试重连...');
          hadOfflineToastRef.current = true;
          offlineTimerRef.current = null;
        }, OFFLINE_NOTIFY_DELAY);
      }

      lastConnectedRef.current = connected;
    };

    socketService.onConnectionError(handleConnectionError);
    socketService.onConnectionStatusChange(handleConnectionStatusChange);

    // 清理函数
    return () => {
      socketService.removeConnectionErrorListener(handleConnectionError);
      socketService.removeConnectionStatusListener(handleConnectionStatusChange);
    };
  }, [showError, showSuccess, showWarning, showInfo]);
};
