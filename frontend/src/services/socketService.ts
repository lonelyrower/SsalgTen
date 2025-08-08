import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';

interface SocketService {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToNodes: (callback: (data: any) => void) => void;
  unsubscribeFromNodes: () => void;
  subscribeToDiagnostics: (nodeId: string, callback: (data: any) => void) => void;
  unsubscribeFromDiagnostics: (nodeId: string) => void;
  requestRealtimeNodes: () => void;
  onNodesStatusUpdate: (callback: (data: any) => void) => void;
  onNodeStatusChanged: (callback: (data: any) => void) => void;
  onRealtimeNodes: (callback: (data: any) => void) => void;
}

class SocketServiceImpl implements SocketService {
  socket: Socket | null = null;
  connected: boolean = false;
  private callbacks: { [event: string]: ((data: any) => void)[] } = {};

  connect = () => {
    if (this.socket?.connected) {
      return; // 已连接
    }

    const token = TokenManager.getToken();
    if (!token) {
      console.warn('无法建立Socket连接：缺少认证token');
      return;
    }

    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
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
      console.log('Socket.IO 连接成功');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('Socket.IO 连接断开:', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connected = false;
      console.error('Socket.IO 连接错误:', error);
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
      console.log('Socket.IO 连接已关闭');
    }
  };

  subscribeToNodes = (callback: (data: any) => void) => {
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

  subscribeToDiagnostics = (nodeId: string, callback: (data: any) => void) => {
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

  onNodesStatusUpdate = (callback: (data: any) => void) => {
    if (!this.socket) return;

    this.socket.on('nodes_status_update', callback);
  };

  onNodeStatusChanged = (callback: (data: any) => void) => {
    if (!this.socket) return;

    this.socket.on('node_status_changed', callback);
  };

  onRealtimeNodes = (callback: (data: any) => void) => {
    if (!this.socket) return;

    this.socket.on('realtime_nodes', callback);
  };
}

// 导出单例
export const socketService = new SocketServiceImpl();