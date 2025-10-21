import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { MapSection } from "@/components/home/MapSection";
import { NodeDetailsPopover } from "@/components/home/NodeDetailsPopover";
import { ErrorBanner } from "@/components/home/ErrorBanner";
import { useAuth } from "@/hooks/useAuth";
import { useRealTime } from "@/hooks/useRealTime";
import type { NodeData } from "@/services/api";

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const { nodes, stats, connected, error } = useRealTime();
  const { user } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);

  const handleNodeClick = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  const handleNodeClose = useCallback(() => {
    setSelectedNode(null);
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

  if (isInitialLoad && nodes.length === 0 && !loadTimeout) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
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
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
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
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
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

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
      <Header />
      <main className="relative flex-1 overflow-hidden">
        <MapSection
          nodes={nodes}
          stats={stats}
          viewMode={viewMode}
          selectedNode={selectedNode}
          onViewModeChange={setViewMode}
          onNodeClick={handleNodeClick}
        />

        {error && (
          <div className="pointer-events-auto absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4">
            <ErrorBanner error={error} />
          </div>
        )}
      </main>

      {selectedNode && (
        <NodeDetailsPopover
          node={selectedNode}
          showNetworkInfo={!!user}
          onClose={handleNodeClose}
        />
      )}
    </div>
  );
};

