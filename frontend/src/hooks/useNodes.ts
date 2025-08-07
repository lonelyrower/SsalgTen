import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api';
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

  // 获取节点数据
  const fetchNodes = useCallback(async () => {
    try {
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
        setNodes(transformedNodes);
      } else {
        setError(nodesResponse.error || 'Failed to fetch nodes');
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
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
        await fetchNodes(); // 重新获取数据
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
        await fetchNodes(); // 重新获取数据
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
        await fetchNodes(); // 重新获取数据
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

  // 定期刷新数据 (每30秒)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNodes();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNodes]);

  return {
    nodes,
    stats,
    loading,
    error,
    refetch: fetchNodes,
    createNode,
    updateNode,
    deleteNode
  };
};