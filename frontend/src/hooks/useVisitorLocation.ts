import { useState, useEffect, useCallback } from 'react';
import { ipService, type IPLocationData } from '../services/ipService';
import type { NodeData } from '../services/api';

export interface VisitorLocationState {
  location: IPLocationData | null;
  loading: boolean;
  error: string | null;
  matchedNodeId: string | null;  // 如果访客 IP 与某个节点匹配，存储节点 ID
  matchedNode: NodeData | null;   // 匹配的节点完整数据
}

/**
 * 访客位置自定义 Hook
 * 用于获取访客的地理位置信息，并检测是否与节点 IP 重合
 */
export function useVisitorLocation(nodes: NodeData[] = []) {
  const [state, setState] = useState<VisitorLocationState>({
    location: null,
    loading: true,
    error: null,
    matchedNodeId: null,
    matchedNode: null,
  });

  // 获取访客位置信息
  const fetchLocation = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const location = await ipService.getVisitorLocation();

      setState(prev => ({
        ...prev,
        location,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to get visitor location:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      }));
    }
  }, []);

  // 检查 IP 匹配
  useEffect(() => {
    if (!state.location || nodes.length === 0) {
      return;
    }

    const visitorIP = state.location.ip;
    const nodeIPs = nodes.map(node => ({ ipv4: node.ipv4, ipv6: node.ipv6 }));
    const matchIndex = ipService.checkIPMatch(visitorIP, nodeIPs);

    if (matchIndex >= 0) {
      const matchedNode = nodes[matchIndex];
      setState(prev => ({
        ...prev,
        matchedNodeId: matchedNode.id,
        matchedNode,
      }));
    } else {
      setState(prev => ({
        ...prev,
        matchedNodeId: null,
        matchedNode: null,
      }));
    }
  }, [state.location, nodes]);

  // 初始化时获取位置
  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // 刷新位置信息
  const refresh = useCallback(() => {
    ipService.clearCache();
    fetchLocation();
  }, [fetchLocation]);

  return {
    ...state,
    refresh,
  };
}

export default useVisitorLocation;
