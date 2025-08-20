import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/services/api';
import { compareNodes, compareStats } from '@/utils/deepCompare';
import type { NodeData, NodeStats } from '@/services/api';

interface UseNodesResult {
  nodes: NodeData[];
  stats: NodeStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNode: (nodeData: Omit<NodeData, 'id' | 'agentId' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateNode: (id: string, nodeData: Partial<NodeData>) => Promise<boolean>;
  deleteNode: (id: string) => Promise<boolean>;
}

export const useNodes = (): UseNodesResult => {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const lastNodesData = useRef<NodeData[]>([]);
  const lastStatsData = useRef<NodeStats | null>(null);

  // 获取节点数据（优化版本 - 避免不必要的重新渲染）
  const fetchNodes = useCallback(async (forceUpdate = false) => {
    try {
      // 限制请求频率，避免过度请求
      const now = Date.now();
      if (!forceUpdate && now - lastFetchTime.current < 5000) {
        return; // 5秒内不重复请求
      }
      lastFetchTime.current = now;

      setLoading(true);
      setError(null);

      const [nodesResponse, statsResponse] = await Promise.all([
        apiService.getNodes(),
        apiService.getStats()
      ]);

      if (nodesResponse.success && nodesResponse.data) {
        // 转换状态格式以匹配前端接口
        const transformedNodes = nodesResponse.data.map((node: any) => ({
          ...node,
          status: node.status.toLowerCase() as 'online' | 'offline' | 'unknown' | 'maintenance'
        }));

        // 只有数据真正变化时才更新状态
        if (!compareNodes(lastNodesData.current, transformedNodes)) {
          lastNodesData.current = transformedNodes;
          setNodes(transformedNodes);
        }
      } else {
        setError(nodesResponse.error || 'Failed to fetch nodes');
      }

      if (statsResponse.success && statsResponse.data) {
        // 只有统计数据真正变化时才更新状态
        if (!compareStats(lastStatsData.current, statsResponse.data)) {
          lastStatsData.current = statsResponse.data;
          setStats(statsResponse.data);
        }
      } else {
        console.warn('Failed to fetch stats:', statsResponse.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建节点
  const createNode = useCallback(async (nodeData: Omit<NodeData, 'id' | 'agentId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const response = await apiService.createNode(nodeData);
      
      if (response.success && response.data) {
        await fetchNodes(true); // 强制更新数据
        return true;
      } else {
        setError(response.error || 'Failed to create node');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node');
      return false;
    }
  }, [fetchNodes]);

  // 更新节点
  const updateNode = useCallback(async (id: string, nodeData: Partial<NodeData>): Promise<boolean> => {
    try {
      const response = await apiService.updateNode(id, nodeData);
      
      if (response.success && response.data) {
        await fetchNodes(true); // 强制更新数据
        return true;
      } else {
        setError(response.error || 'Failed to update node');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update node');
      return false;
    }
  }, [fetchNodes]);

  // 删除节点
  const deleteNode = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteNode(id);
      
      if (response.success) {
        await fetchNodes(true); // 强制更新数据
        return true;
      } else {
        setError(response.error || 'Failed to delete node');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node');
      return false;
    }
  }, [fetchNodes]);

  // 初始化数据获取
  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // 定期刷新数据 (每60秒，降低频率避免闪烁)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNodes(false); // 不强制更新，让优化逻辑处理
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNodes]);

  return {
    nodes,
    stats,
    loading,
    error,
    refetch: () => fetchNodes(true),
    createNode,
    updateNode,
    deleteNode
  };
};