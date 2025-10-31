import { useCallback, useEffect, useMemo, useState } from "react";
import { TokenManager, apiService } from "@/services/api";

export interface ConnectivityDiagnostics {
  checking: boolean;
  apiReachable: boolean;
  socketConnected: boolean;
  authOk: boolean;
  nodesCount: number | null;
  lastCheckedAt?: string;
  issues: string[];
  refresh: () => void;
}

export function useConnectivityDiagnostics(
  socketConnected: boolean,
): ConnectivityDiagnostics {
  const [checking, setChecking] = useState(false);
  const [apiReachable, setApiReachable] = useState<boolean>(false);
  const [nodesCount, setNodesCount] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | undefined>(
    undefined,
  );

  const authOk = useMemo(() => {
    const token = TokenManager.getToken();
    return !!token && !TokenManager.isTokenExpired(token!);
  }, []);

  const runChecks = useCallback(async () => {
    setChecking(true);
    try {
      // Check API health
      const health = await apiService.healthCheck();
      setApiReachable(!!health?.success);

      // Try to fetch nodes (public endpoint)
      const nodesResp = await apiService.getNodes();
      if (nodesResp.success && Array.isArray(nodesResp.data)) {
        setNodesCount(nodesResp.data.length);
      } else {
        setNodesCount(null);
      }

      setLastCheckedAt(new Date().toISOString());
    } catch {
      setApiReachable(false);
      setNodesCount(null);
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks, socketConnected]);

  const issues = useMemo(() => {
    const items: string[] = [];
    if (!authOk) {
      items.push("未登录或令牌已失效：请重新登录。");
    }
    if (!apiReachable) {
      items.push("后端 API 不可达：检查 API_BASE_URL / 反向代理 / 后端服务。");
    }
    if (!socketConnected) {
      items.push(
        "实时连接未建立：检查 CORS_ORIGIN / FRONTEND_URL 配置是否匹配前端地址。",
      );
    }
    if (apiReachable && nodesCount === 0) {
      items.push(
        "系统暂无任何节点：确认 Agent 的 AGENT_API_KEY 与后端系统 API 密钥一致，且 Agent 可访问后端。",
      );
    }
    return items;
  }, [authOk, apiReachable, socketConnected, nodesCount]);

  return {
    checking,
    apiReachable,
    socketConnected,
    authOk,
    nodesCount,
    lastCheckedAt,
    issues,
    refresh: runChecks,
  };
}
