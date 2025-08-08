import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/services/socketService';
import { compareNodes, compareStats } from '@/utils/deepCompare';
import type { NodeData, NodeStats } from '@/services/api';

interface RealtimeData {
  nodes: NodeData[];
  stats: NodeStats;
  lastUpdate: string;
  connected: boolean;
}

export function useRealTime() {
  const { isAuthenticated } = useAuth();
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
      setRealtimeData(prev => {
        // 只有数据真正发生变化时才更新
        const nodesChanged = !compareNodes(prev.nodes, data.nodes);
        const statsChanged = !compareStats(prev.stats, data.stats);
        
        if (!nodesChanged && !statsChanged) {
          // 只更新时间戳，不触发组件重新渲染
          return {
            ...prev,
            lastUpdate: data.timestamp || new Date().toISOString()
          };
        }

        return {
          ...prev,
          nodes: data.nodes,
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
        if (targetNode && targetNode.status === data.status.status) {
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
              ? { ...node, ...data.status }
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
      const nodes = data.data;
      const stats = calculateStats(nodes);
      setRealtimeData(prev => ({
        ...prev,
        nodes,
        stats,
        lastUpdate: data.timestamp || new Date().toISOString()
      }));
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

    // 清理函数
    return () => {
      clearInterval(intervalId);
      socketService.unsubscribeFromNodes();
    };
  }, [isAuthenticated, handleNodesStatusUpdate, handleNodeStatusChanged, handleRealtimeNodes]);

  // 手动刷新数据
  const refreshData = useCallback(() => {
    if (socketService.connected) {
      socketService.requestRealtimeNodes();
    }
  }, []);

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