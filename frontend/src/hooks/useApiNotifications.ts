import { useEffect } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { enhancedApiService } from '@/services/enhancedApiService';
import { socketService } from '@/services/socketService';

export const useApiNotifications = () => {
  const { showError, showSuccess, showWarning, showInfo } = useNotification();

  useEffect(() => {
    // 设置API错误处理回调
    enhancedApiService.setNotificationCallbacks({
      showError,
      showSuccess,
    });

    // 设置Socket连接状态通知
    const handleConnectionError = (error: Error) => {
      showError('连接错误', error.message);
    };

    const handleConnectionStatusChange = (connected: boolean) => {
      if (connected) {
        showSuccess('连接已恢复', '实时数据连接已建立');
      } else {
        showWarning('连接断开', '实时数据连接已断开，正在尝试重连...');
      }
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