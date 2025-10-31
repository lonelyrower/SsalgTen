import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { socketService } from "@/services/socketService";
import { compareNodes, compareStats, deepEqual } from "@/utils/deepCompare";
import { apiService } from "@/services/api";
import type { NodeData, NodeStats } from "@/services/api";

interface RealtimeData {
  nodes: NodeData[];
  stats: NodeStats;
  lastUpdate: string;
  connected: boolean;
  error: string | null;
}

const NODE_STATUS_VALUES = ["online", "offline", "maintenance"] as const;
type NodeStatusLiteral = (typeof NODE_STATUS_VALUES)[number];
type NodeStatusValue =
  | NodeStatusLiteral
  | string
  | { status?: NodeStatusLiteral | string };

interface NodesStatusUpdatePayload {
  nodes: NodeData[];
  stats: NodeStats;
  timestamp?: string;
}

interface RealtimeNodesPayload {
  success?: boolean;
  data?: NodeData[];
  timestamp?: string;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNodeStats = (value: unknown): value is NodeStats => {
  if (!isObjectRecord(value)) return false;
  const requiredKeys: Array<keyof NodeStats> = [
    "totalNodes",
    "onlineNodes",
    "offlineNodes",
    "totalCountries",
    "totalProviders",
  ];
  return requiredKeys.every((key) => typeof value[key] === "number");
};

const isNodeDataArray = (value: unknown): value is NodeData[] =>
  Array.isArray(value) &&
  value.every((item) => isObjectRecord(item) && typeof item.id === "string");

const normalizeStatus = (status: unknown): NodeStatusLiteral => {
  if (typeof status === "string") {
    const lower = status.toLowerCase() as NodeStatusLiteral;
    if (NODE_STATUS_VALUES.includes(lower)) {
      return lower;
    }
  }
  return "offline";
};

const normalizeNodesStatusPayload = (
  payload: unknown,
): NodesStatusUpdatePayload | null => {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const nodes = payload.nodes;
  const stats = payload.stats;
  if (!isNodeDataArray(nodes) || !isNodeStats(stats)) {
    return null;
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      status: normalizeStatus(node.status),
    })),
    stats,
    timestamp:
      typeof payload.timestamp === "string" ? payload.timestamp : undefined,
  };
};

const normalizeRealtimeNodesPayload = (
  payload: unknown,
): RealtimeNodesPayload | null => {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const result: RealtimeNodesPayload = {
    success: typeof payload.success === "boolean" ? payload.success : undefined,
    timestamp:
      typeof payload.timestamp === "string" ? payload.timestamp : undefined,
  };

  if (isNodeDataArray(payload.data)) {
    result.data = payload.data.map((node) => ({
      ...node,
      status: normalizeStatus(node.status),
    }));
  }

  return result;
};

const calculateStats = (nodes: NodeData[], previous?: NodeStats): NodeStats => {
  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((node) => node.status === "online").length;
  const offlineNodes = totalNodes - onlineNodes;
  const countries = new Set(nodes.map((node) => node.country));
  const providers = new Set(nodes.map((node) => node.provider));

  const stats: NodeStats = {
    totalNodes,
    onlineNodes,
    offlineNodes,
    totalCountries: countries.size,
    totalProviders: providers.size,
  };

  if (previous?.totalTraffic) {
    stats.totalTraffic = { ...previous.totalTraffic };
  }

  return stats;
};

export function useRealTime() {
  const { isAuthenticated } = useAuth();
  const pollTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const connectionTimeoutTimer = useRef<number | null>(null);
  const pendingFull = useRef<NodesStatusUpdatePayload | null>(null);
  const pendingChanges = useRef<Map<string, NodeStatusValue>>(
    new Map<string, NodeStatusValue>(),
  );
  const [realtimeData, setRealtimeData] = useState<RealtimeData>({
    nodes: [],
    stats: {
      totalNodes: 0,
      onlineNodes: 0,
      offlineNodes: 0,
      totalCountries: 0,
      totalProviders: 0,
    },
    lastUpdate: "",
    connected: false,
    error: null,
  });
  const realtimeDataRef = useRef<RealtimeData>(realtimeData);

  useEffect(() => {
    realtimeDataRef.current = realtimeData;
  }, [realtimeData]);

  // 节点状态更新处理（带深度比较优化）
  const scheduleFlush = useCallback((delay = 250) => {
    if (flushTimer.current) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      setRealtimeData((prev) => {
        // 优先使用全量更新
        if (pendingFull.current) {
          const full = pendingFull.current;
          pendingFull.current = null;
          const normalizedNodes = full.nodes.map((node) => ({ ...node }));
          const nextStats = full.stats ? { ...full.stats } : { ...prev.stats };
          if (!nextStats.totalTraffic && prev.stats.totalTraffic) {
            nextStats.totalTraffic = { ...prev.stats.totalTraffic };
          }
          const nodesChanged = !compareNodes(prev.nodes, normalizedNodes);
          const statsChanged = !compareStats(prev.stats, nextStats);
          const trafficChanged = !deepEqual(
            prev.stats.totalTraffic ?? null,
            nextStats.totalTraffic ?? null,
          );
          if (!nodesChanged && !statsChanged && !trafficChanged) {
            return {
              ...prev,
              lastUpdate: full.timestamp || new Date().toISOString(),
            };
          }
          return {
            ...prev,
            nodes: normalizedNodes,
            stats: nextStats,
            lastUpdate: full.timestamp || new Date().toISOString(),
          };
        }

        // 增量更改合并
        if (pendingChanges.current.size > 0) {
          const changes = pendingChanges.current;
          pendingChanges.current = new Map<string, NodeStatusValue>();
          const nextNodes = prev.nodes.map((node) => {
            const patch = changes.get(node.id);
            if (patch === undefined) return node;
            const patchRecord: Record<string, unknown> =
              typeof patch === "object" && patch !== null
                ? { ...(patch as Record<string, unknown>) }
                : {};
            const statusSource =
              "status" in patchRecord ? patchRecord.status : patch;
            if ("status" in patchRecord) {
              delete (patchRecord as { status?: unknown }).status;
            }
            const normalizedStatus = normalizeStatus(statusSource);
            return { ...node, ...patchRecord, status: normalizedStatus };
          });
          // 重新计算统计
          const nextStats = calculateStats(nextNodes, prev.stats);
          return {
            ...prev,
            nodes: nextNodes,
            stats: nextStats,
            lastUpdate: new Date().toISOString(),
          };
        }

        return prev;
      });
    }, delay);
  }, []);

  const handleNodesStatusUpdate = useCallback(
    (payload: unknown) => {
      const normalized = normalizeNodesStatusPayload(payload);
      if (!normalized) {
        return;
      }
      pendingFull.current = normalized;
      pendingChanges.current.clear();
      scheduleFlush(200);
    },
    [scheduleFlush],
  );

  // 单个节点状态变化处理（带优化）
  const handleNodeStatusChanged = useCallback(
    (payload: unknown) => {
      if (!isObjectRecord(payload)) {
        return;
      }
      const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : null;
      const status = payload.status as NodeStatusValue | undefined;
      if (!nodeId || typeof status === "undefined") {
        return;
      }
      if (!pendingFull.current) {
        pendingChanges.current.set(nodeId, status);
      }
      scheduleFlush(250);
    },
    [scheduleFlush],
  );

  // 实时节点数据响应处理
  const handleRealtimeNodes = useCallback(
    (payload: unknown) => {
      const normalized = normalizeRealtimeNodesPayload(payload);
      if (!normalized?.data || normalized.data.length === 0) {
        return;
      }
      const previousStats = realtimeDataRef.current?.stats;
      pendingFull.current = {
        nodes: normalized.data,
        stats: calculateStats(normalized.data, previousStats),
        timestamp: normalized.timestamp,
      };
      pendingChanges.current.clear();
      scheduleFlush(150);
    },
    [scheduleFlush],
  );

  // REST 兜底：当 Socket 未连接时，通过 HTTP 获取节点数据
  const fetchViaRest = useCallback(async () => {
    try {
      const resp = await apiService.getNodes();
      if (resp.success && resp.data) {
        const nodes = (resp.data as NodeData[]).map((node) => ({
          ...node,
          status: normalizeStatus(node.status),
        }));
        setRealtimeData((prev) => ({
          ...prev,
          nodes,
          stats: calculateStats(nodes, prev.stats),
          lastUpdate: new Date().toISOString(),
          error: null, // 清除错误状态
        }));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "无法连接到后端服务器";
      console.warn("Failed to fetch nodes via REST fallback:", error);
      setRealtimeData((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      setRealtimeData((prev) => ({ ...prev, connected: false, error: null }));
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      if (connectionTimeoutTimer.current) {
        clearTimeout(connectionTimeoutTimer.current);
        connectionTimeoutTimer.current = null;
      }
      return;
    }

    // 连接 Socket.IO
    socketService.connect();

    // 设置连接超时检测（15秒后如果仍未连接且无数据，设置错误）
    connectionTimeoutTimer.current = window.setTimeout(() => {
      setRealtimeData((prev) => {
        if (!prev.connected && prev.nodes.length === 0 && !prev.error) {
          return {
            ...prev,
            error:
              "连接超时：无法建立实时连接，正在尝试通过备用方式获取数据...",
          };
        }
        return prev;
      });
    }, 15000);

    // 监听连接状态
    const checkConnection = () => {
      const isConnected = socketService.connected;
      setRealtimeData((prev) => {
        // 如果从断连恢复到连接状态，清除错误并清除超时
        if (!prev.connected && isConnected) {
          if (connectionTimeoutTimer.current) {
            clearTimeout(connectionTimeoutTimer.current);
            connectionTimeoutTimer.current = null;
          }
          return {
            ...prev,
            connected: isConnected,
            error: null,
          };
        }
        return {
          ...prev,
          connected: isConnected,
        };
      });
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
      if (connectionTimeoutTimer.current) {
        clearTimeout(connectionTimeoutTimer.current);
        connectionTimeoutTimer.current = null;
      }
    };
  }, [
    isAuthenticated,
    handleNodesStatusUpdate,
    handleNodeStatusChanged,
    handleRealtimeNodes,
    fetchViaRest,
  ]);

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
  const subscribeToDiagnostics = useCallback(
    (nodeId: string, callback: (data: unknown) => void) => {
      socketService.subscribeToDiagnostics(nodeId, callback);
    },
    [],
  );

  // 取消订阅特定节点的诊断数据
  const unsubscribeFromDiagnostics = useCallback((nodeId: string) => {
    socketService.unsubscribeFromDiagnostics(nodeId);
  }, []);

  return {
    ...realtimeData,
    refreshData,
    subscribeToDiagnostics,
    unsubscribeFromDiagnostics,
  };
}
