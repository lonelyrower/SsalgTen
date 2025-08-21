import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/services/socketService';
import { compareNodes, compareStats } from '@/utils/deepCompare';
import { apiService } from '@/services/api';
import type { NodeData, NodeStats } from '@/services/api';

interface RealtimeData {
  nodes: NodeData[];
  stats: NodeStats;
  lastUpdate: string;
  connected: boolean;
}

export function useRealTime() {
  const { isAuthenticated } = useAuth();
  const pollTimer = useRef<number | null>(null);
  const [realtimeData, setRealtimeData] = useState<RealtimeData>({
    nodes: [],
    stats: {
      totalNodes: 0,
      onlineNodes: 0,
      offlineNodes: 0,
      unknownNodes: 0,
      totalCountries: 0,
      totalProviders: 0
    },
    lastUpdate: '',
    connected: false
  });

  // 节点状态更新处理（带深度比较优化）
  const handleNodesStatusUpdate = useCallback((data: any) => {
    if (data.nodes && data.stats) {
      // 规范化节点状态为小写，避免前后端大小写不一致
      const normalizedNodes = (data.nodes as NodeData[]).map(n => ({
        ...n,
        status: typeof n.status === 'string' ? (n.status as string).toLowerCase() as any : n.status
      }));

      setRealtimeData(prev => {
        const nodesChanged = !compareNodes(prev.nodes, normalizedNodes);
        const statsChanged = !compareStats(prev.stats, data.stats);

        if (!nodesChanged && !statsChanged) {
          return {
            ...prev,
            lastUpdate: data.timestamp || new Date().toISOString()
          };
        }

        return {
          ...prev,
          nodes: normalizedNodes,
          stats: data.stats,
          lastUpdate: data.timestamp || new Date().toISOString()
        };
      });
    }
  }, []);

  // 单个节点状态变化处理（带优化）
  const handleNodeStatusChanged = useCallback((data: any) => {
    if (data.nodeId && data.status) {
      setRealtimeData(prev => {
        const targetNode = prev.nodes.find(node => node.id === data.nodeId);
        
        // 检查节点状态是否真正发生变化
        const incomingStatus = typeof data.status === 'string' ? data.status : data.status.status;
        const normalizedStatus = typeof incomingStatus === 'string' ? incomingStatus.toLowerCase() : incomingStatus;
        if (targetNode && targetNode.status === normalizedStatus) {
          return {
            ...prev,
            lastUpdate: data.timestamp || new Date().toISOString()
          };
        }

        // 只有状态真正变化时才更新
        return {
          ...prev,
          nodes: prev.nodes.map(node => 
            node.id === data.nodeId 
              ? { ...node, ...(typeof data.status === 'object' ? data.status : {}), status: normalizedStatus }
              : node
          ),
          lastUpdate: data.timestamp || new Date().toISOString()
        };
      });
    }
  }, []);

  // 实时节点数据响应处理
  const handleRealtimeNodes = useCallback((data: any) => {
    if (data.success && data.data) {
      const nodes = (data.data as NodeData[]).map(n => ({
        ...n,
        status: typeof n.status === 'string' ? (n.status as string).toLowerCase() as any : n.status
      }));
      const stats = calculateStats(nodes);
      setRealtimeData(prev => ({
        ...prev,
        nodes,
        stats,
        lastUpdate: data.timestamp || new Date().toISOString()
      }));
    }
  }, []);

  // REST 兜底：当 Socket 未连接时，通过 HTTP 获取节点数据
  const fetchViaRest = useCallback(async () => {
    try {
      const resp = await apiService.getNodes();
      if (resp.success && resp.data) {
        const nodes = (resp.data as NodeData[]).map(n => ({
          ...n,
          status: typeof n.status === 'string' ? (n.status as string).toLowerCase() as any : n.status
        }));
        const stats = calculateStats(nodes);
        setRealtimeData(prev => ({
          ...prev,
          nodes,
          stats,
          lastUpdate: new Date().toISOString()
        }));
      }
    } catch (e) {
      // 静默失败，避免打扰用户
    }
  }, []);

  // 计算统计数据
  const calculateStats = (nodes: NodeData[]): NodeStats => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(node => node.status.toLowerCase() === 'online').length;
    const unknownNodes = nodes.filter(node => node.status.toLowerCase() === 'unknown').length;
    const offlineNodes = totalNodes - onlineNodes - unknownNodes;
    const countries = new Set(nodes.map(node => node.country));
    const providers = new Set(nodes.map(node => node.provider));

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      unknownNodes,
      totalCountries: countries.size,
      totalProviders: providers.size
    };
  };

  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      setRealtimeData(prev => ({ ...prev, connected: false }));
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    // 连接 Socket.IO
    socketService.connect();

    // 监听连接状态
    const checkConnection = () => {
      setRealtimeData(prev => ({ 
        ...prev, 
        connected: socketService.connected 
      }));
    };

    const intervalId = setInterval(checkConnection, 1000);

    // 设置事件监听器
    socketService.onNodesStatusUpdate(handleNodesStatusUpdate);
    socketService.onNodeStatusChanged(handleNodeStatusChanged);
    socketService.onRealtimeNodes(handleRealtimeNodes);

    // 订阅节点更新
    socketService.subscribeToNodes(handleNodesStatusUpdate);

    // 请求初始数据
    setTimeout(() => {
      socketService.requestRealtimeNodes();
    }, 500);

    // 当 Socket 未连接或断开时，启动 REST 轮询兜底
    if (!socketService.connected) {
      fetchViaRest();
      if (!pollTimer.current) {
        pollTimer.current = window.setInterval(() => {
          if (!socketService.connected) {
            fetchViaRest();
          }
        }, 15000);
      }
    }

    // 清理函数
    return () => {
      clearInterval(intervalId);
      socketService.unsubscribeFromNodes();
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [isAuthenticated, handleNodesStatusUpdate, handleNodeStatusChanged, handleRealtimeNodes, fetchViaRest]);

  // 当连接状态变化时，按需启动/停止 REST 轮询兜底
  useEffect(() => {
    if (!realtimeData.connected) {
      fetchViaRest();
      if (!pollTimer.current) {
        pollTimer.current = window.setInterval(() => {
          if (!socketService.connected) {
            fetchViaRest();
          }
        }, 15000);
      }
    } else {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeData.connected, fetchViaRest]);

  // 手动刷新数据
  const refreshData = useCallback(() => {
    if (socketService.connected) {
      socketService.requestRealtimeNodes();
    } else {
      fetchViaRest();
    }
  }, [fetchViaRest]);

  // 订阅特定节点的诊断数据
  const subscribeToDiagnostics = useCallback((nodeId: string, callback: (data: any) => void) => {
    socketService.subscribeToDiagnostics(nodeId, callback);
  }, []);

  // 取消订阅特定节点的诊断数据
  const unsubscribeFromDiagnostics = useCallback((nodeId: string) => {
    socketService.unsubscribeFromDiagnostics(nodeId);
  }, []);

  return {
    ...realtimeData,
    refreshData,
    subscribeToDiagnostics,
    unsubscribeFromDiagnostics
  };
}
