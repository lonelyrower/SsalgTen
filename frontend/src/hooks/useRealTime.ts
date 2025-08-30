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
  const flushTimer = useRef<number | null>(null);
  const pendingFull = useRef<any | null>(null);
  const pendingChanges = useRef<Map<string, any>>(new Map());
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
  const scheduleFlush = useCallback((delay = 250) => {
    if (flushTimer.current) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      setRealtimeData(prev => {
        // 优先使用全量更新
        if (pendingFull.current) {
          const full = pendingFull.current;
          pendingFull.current = null;
          const normalizedNodes = (full.nodes as NodeData[]).map(n => ({
            ...n,
            status: typeof n.status === 'string' ? (n.status as string).toLowerCase() as any : n.status
          }));
          const nodesChanged = !compareNodes(prev.nodes, normalizedNodes);
          const statsChanged = !compareStats(prev.stats, full.stats);
          if (!nodesChanged && !statsChanged) {
            return { ...prev, lastUpdate: full.timestamp || new Date().toISOString() };
          }
          return {
            ...prev,
            nodes: normalizedNodes,
            stats: full.stats,
            lastUpdate: full.timestamp || new Date().toISOString()
          };
        }

        // 增量更改合并
        if (pendingChanges.current.size > 0) {
          const changes = pendingChanges.current;
          pendingChanges.current = new Map();
          const nextNodes = prev.nodes.map(node => {
            const patch = changes.get(node.id);
            if (!patch) return node;
            const incomingStatus = typeof patch.status === 'string' ? patch.status : patch.status?.status;
            const normalizedStatus = typeof incomingStatus === 'string' ? incomingStatus.toLowerCase() : incomingStatus;
            return { ...node, ...(typeof patch.status === 'object' ? patch.status : {}), status: normalizedStatus } as NodeData;
          });
          // 重新计算统计
          const nextStats = calculateStats(nextNodes);
          return {
            ...prev,
            nodes: nextNodes,
            stats: nextStats,
            lastUpdate: new Date().toISOString()
          };
        }

        return prev;
      });
    }, delay);
  }, []);

  const handleNodesStatusUpdate = useCallback((data: any) => {
    if (data.nodes && data.stats) {
      pendingFull.current = data;
      pendingChanges.current.clear();
      scheduleFlush(200);
    }
  }, [scheduleFlush]);

  // 单个节点状态变化处理（带优化）
  const handleNodeStatusChanged = useCallback((data: any) => {
    if (data.nodeId && data.status) {
      // 若存在全量更新待处理，则无需记录增量
      if (!pendingFull.current) {
        pendingChanges.current.set(data.nodeId, { status: data.status });
      }
      scheduleFlush(250);
    }
  }, [scheduleFlush]);

  // 实时节点数据响应处理
  const handleRealtimeNodes = useCallback((data: any) => {
    if (data.success && data.data) {
      pendingFull.current = { nodes: data.data, stats: calculateStats(data.data as NodeData[]), timestamp: data.timestamp };
      pendingChanges.current.clear();
      scheduleFlush(150);
    }
  }, [scheduleFlush]);

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
