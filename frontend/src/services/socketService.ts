import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';

interface SocketService {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToNodes: (callback: (data: unknown) => void) => void;
  unsubscribeFromNodes: () => void;
  subscribeToDiagnostics: (nodeId: string, callback: (data: unknown) => void) => void;
  unsubscribeFromDiagnostics: (nodeId: string) => void;
  requestRealtimeNodes: () => void;
  onNodesStatusUpdate: (callback: (data: unknown) => void) => void;
  onNodeStatusChanged: (callback: (data: unknown) => void) => void;
  onRealtimeNodes: (callback: (data: unknown) => void) => void;
  onConnectionError: (callback: (error: Error) => void) => void;
  onConnectionStatusChange: (callback: (connected: boolean) => void) => void;
  removeConnectionErrorListener: (callback: (error: Error) => void) => void;
  removeConnectionStatusListener: (callback: (connected: boolean) => void) => void;
}

class SocketServiceImpl implements SocketService {
  socket: Socket | null = null;
  connected: boolean = false;
  private callbacks: { [event: string]: ((data: unknown) => void)[] } = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private connectionErrorCallbacks: ((error: Error) => void)[] = [];
  private connectionStatusCallbacks: ((connected: boolean) => void)[] = [];

  connect = () => {
    if (this.socket?.connected) {
      return; // 已连接
    }

    const token = TokenManager.getToken();
    if (!token) {
      console.warn('无法建立Socket连接：缺少认证token');
      return;
    }

    // Get the base URL and extract the server URL (without /api)
    const getServerUrl = (): string => {
      // Check runtime config first
      if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
        const apiUrl = window.APP_CONFIG.API_BASE_URL;
        return apiUrl.replace('/api', '');
      }
      // Fallback to build-time env var or default
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      return apiBaseUrl.replace('/api', '');
    };
    
    const serverUrl = getServerUrl();
    
    this.socket = io(serverUrl, {
      auth: {
        token
      },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('Socket.IO 连接成功', { url: serverUrl });
      this.notifyConnectionStatus(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('Socket.IO 连接断开:', reason);
      this.notifyConnectionStatus(false);
      
      // 只在非手动断开时尝试重连
      if (reason !== 'io client disconnect') {
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.connected = false;
      console.error('Socket.IO 连接错误:', error);
      console.log('连接URL:', serverUrl);
      console.log('Token长度:', token?.length || 0);
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.notifyConnectionError(errorObj);
      this.handleReconnect();
    });

    // 重新连接时重新订阅
    this.socket.on('connect', () => {
      if (this.callbacks['nodes_updates']) {
        this.subscribeToNodes(() => {});
      }
    });
  };

  disconnect = () => {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.callbacks = {};
      this.reconnectAttempts = 0;
      console.log('Socket.IO 连接已关闭');
    }
  };

  private handleReconnect = () => {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Socket重连失败，已达到最大重试次数 (${this.maxReconnectAttempts})`);
      const error = new Error(`连接失败，已重试 ${this.maxReconnectAttempts} 次`);
      this.notifyConnectionError(error);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Socket重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})，${delay}ms后重试`);
    
    setTimeout(() => {
      if (!this.connected && this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
      }
    }, delay);
  };

  private notifyConnectionError = (error: Error) => {
    this.connectionErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        console.error('连接错误回调执行失败:', e);
      }
    });
  };

  private notifyConnectionStatus = (connected: boolean) => {
    this.connectionStatusCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (e) {
        console.error('连接状态回调执行失败:', e);
      }
    });
  };

  onConnectionError = (callback: (error: Error) => void) => {
    this.connectionErrorCallbacks.push(callback);
  };

  onConnectionStatusChange = (callback: (connected: boolean) => void) => {
    this.connectionStatusCallbacks.push(callback);
  };

  removeConnectionErrorListener = (callback: (error: Error) => void) => {
    const index = this.connectionErrorCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionErrorCallbacks.splice(index, 1);
    }
  };

  removeConnectionStatusListener = (callback: (connected: boolean) => void) => {
    const index = this.connectionStatusCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionStatusCallbacks.splice(index, 1);
    }
  };

  subscribeToNodes = (callback: (data: unknown) => void) => {
    if (!this.socket) {
      console.warn('Socket未连接，无法订阅节点更新');
      return;
    }

    this.socket.emit('subscribe_nodes');
    this.callbacks['nodes_updates'] = this.callbacks['nodes_updates'] || [];
    this.callbacks['nodes_updates'].push(callback);
  };

  unsubscribeFromNodes = () => {
    if (!this.socket) return;

    this.socket.emit('unsubscribe_nodes');
    delete this.callbacks['nodes_updates'];
  };

  subscribeToDiagnostics = (nodeId: string, callback: (data: unknown) => void) => {
    if (!this.socket) {
      console.warn('Socket未连接，无法订阅诊断更新');
      return;
    }

    this.socket.emit('subscribe_diagnostics', nodeId);
    const eventKey = `diagnostics_${nodeId}`;
    this.callbacks[eventKey] = this.callbacks[eventKey] || [];
    this.callbacks[eventKey].push(callback);
  };

  unsubscribeFromDiagnostics = (nodeId: string) => {
    if (!this.socket) return;

    this.socket.emit('unsubscribe_diagnostics', nodeId);
    delete this.callbacks[`diagnostics_${nodeId}`];
  };

  requestRealtimeNodes = () => {
    if (!this.socket) {
      console.warn('Socket未连接，无法请求实时节点数据');
      return;
    }

    this.socket.emit('get_realtime_nodes');
  };

  onNodesStatusUpdate = (callback: (data: unknown) => void) => {
    if (!this.socket) return;

    this.socket.on('nodes_status_update', callback);
  };

  onNodeStatusChanged = (callback: (data: unknown) => void) => {
    if (!this.socket) return;

    this.socket.on('node_status_changed', callback);
  };

  onRealtimeNodes = (callback: (data: unknown) => void) => {
    if (!this.socket) return;

    this.socket.on('realtime_nodes', callback);
  };
}

// 导出单例
export const socketService = new SocketServiceImpl();