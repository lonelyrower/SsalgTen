import { useEffect, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { enhancedApiService } from '@/services/enhancedApiService';
import { socketService } from '@/services/socketService';

export const useApiNotifications = () => {
  const { showError, showSuccess } = useNotification();
  // 全局开关：关闭连接状态弹窗（断开/恢复/错误），仅保留 API 级别通知
  const ENABLE_CONNECTION_TOASTS = false;
  // 以下为原来的去抖控制，保留代码但默认不开启
  const lastConnectedRef = useRef<boolean | null>(null);
  const offlineTimerRef = useRef<number | null>(null);
  const lastErrorAtRef = useRef<number>(0);
  const hadOfflineToastRef = useRef<boolean>(false);
  const OFFLINE_NOTIFY_DELAY = 4000; // ms
  const ERROR_THROTTLE = 60000; // ms

  useEffect(() => {
    // 设置API错误处理回调
    enhancedApiService.setNotificationCallbacks({
      showError,
      showSuccess,
    });

    // 连接状态弹窗（默认关闭）
    if (!ENABLE_CONNECTION_TOASTS) {
      return;
    }

    const handleConnectionError = (error: Error) => {
      const now = Date.now();
      if (now - lastErrorAtRef.current < ERROR_THROTTLE) return;
      lastErrorAtRef.current = now;
      showError('连接错误', error.message);
    };

    const handleConnectionStatusChange = (connected: boolean) => {
      if (lastConnectedRef.current === null) {
        lastConnectedRef.current = connected;
        return;
      }

      if (offlineTimerRef.current) {
        window.clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }

      if (connected) {
        if (hadOfflineToastRef.current) {
          showSuccess('连接已恢复', '实时数据连接已建立');
        }
        hadOfflineToastRef.current = false;
      } else {
        offlineTimerRef.current = window.setTimeout(() => {
          // 改为不提示“连接断开”，若开启开关可改为提示
          // showWarning('连接断开', '实时数据连接已断开，正在尝试重连...');
          hadOfflineToastRef.current = true;
          offlineTimerRef.current = null;
        }, OFFLINE_NOTIFY_DELAY);
      }

      lastConnectedRef.current = connected;
    };

    socketService.onConnectionError(handleConnectionError);
    socketService.onConnectionStatusChange(handleConnectionStatusChange);

    return () => {
      socketService.removeConnectionErrorListener(handleConnectionError);
      socketService.removeConnectionStatusListener(handleConnectionStatusChange);
    };
  }, [showError, showSuccess]);
};
