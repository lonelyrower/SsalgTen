import { useState, useMemo, useCallback, useEffect } from "react";
import { Globe2, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCards } from "@/components/layout/StatsCards";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { MapSection } from "@/components/home/MapSection";
import { NodeDetailsCard } from "@/components/home/NodeDetailsCard";
import { ErrorBanner } from "@/components/home/ErrorBanner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRealTime } from "@/hooks/useRealTime";
import type { NodeData } from "@/services/api";

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const { nodes, stats, connected, error, refreshData } = useRealTime();
  const { user } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);

  const handleNodeClick = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  useEffect(() => {
    if (nodes.length > 0) {
      setIsInitialLoad(false);
      setLoadTimeout(false);
    }
  }, [nodes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitialLoad && nodes.length === 0) {
        console.warn("Data loading timeout, showing page anyway");
        setIsInitialLoad(false);
        setLoadTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [isInitialLoad, nodes.length]);

  const memoizedStats = useMemo(
    () => ({
      totalNodes: stats?.totalNodes || 0,
      onlineNodes: stats?.onlineNodes || 0,
      totalCountries: stats?.totalCountries || 0,
      totalProviders: stats?.totalProviders || 0,
      totalTraffic: stats?.totalTraffic,
    }),
    [
      stats?.totalNodes,
      stats?.onlineNodes,
      stats?.totalCountries,
      stats?.totalProviders,
      stats?.totalTraffic,
    ],
  );

  if (isInitialLoad && nodes.length === 0 && !loadTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <LoadingSpinner
          fullScreen
          text={connected ? "正在加载节点数据..." : "正在尝试连接服务器..."}
          size="xl"
          variant="elegant"
        />
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="server"
            title="数据加载失败"
            message={error}
            showRetry
            showHome
            onRetry={() => window.location.reload()}
            size="lg"
          />
        </main>
      </div>
    );
  }

  if (loadTimeout && nodes.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="network"
            title="暂无节点数据"
            message={
              connected
                ? "系统已连接，但当前没有可用的节点信息。稍后刷新页面或联系管理员。"
                : "正在尝试连接服务器，请稍后重试..."
            }
            showRetry
            showHome={false}
            onRetry={() => window.location.reload()}
            size="lg"
          />
        </main>
      </div>
    );
  }

  const welcomeName = user?.name || user?.username || "访客";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="全局监控面板"
          description={`欢迎回来，${welcomeName}`}
          icon={Globe2}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refreshData}
            >
              <RefreshCw
                className={`h-4 w-4 ${!connected ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            {connected
              ? `当前共有 ${memoizedStats.totalNodes} 个节点在线监控，其中 ${memoizedStats.onlineNodes} 个处于在线状态。`
              : "正在尝试重新连接实时数据通道，请稍候..."}
          </p>
        </PageHeader>

        <StatsCards {...memoizedStats} />

        <MapSection
          nodes={nodes}
          stats={stats}
          viewMode={viewMode}
          selectedNode={selectedNode}
          onViewModeChange={setViewMode}
          onNodeClick={handleNodeClick}
        />

        {selectedNode && (
          <NodeDetailsCard node={selectedNode} showNetworkInfo={!!user} />
        )}

        {error && <ErrorBanner error={error} />}
      </main>
    </div>
  );
};
