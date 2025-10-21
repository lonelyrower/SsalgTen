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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
      {/* 透明悬浮 Header - pointer-events-none 让地图可交互，内部元素单独设置 pointer-events-auto */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <Header />
      </div>

      {/* 小型半透明标题卡片 - 左上角 */}
      <div className="absolute top-20 left-6 z-40 pointer-events-none">
        <div className="glass rounded-lg px-6 py-3 border border-white/20 backdrop-blur-md">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            全球节点监控平台
          </h1>
          <p className="text-gray-300 text-sm mt-1">
            实时监控 {nodes.length} 个节点
          </p>
        </div>
      </div>

      {/* 全屏地图 */}
      <main className="h-full w-full">
        <MapSection
          nodes={nodes}
          stats={stats}
          viewMode={viewMode}
          selectedNode={selectedNode}
          onViewModeChange={setViewMode}
          onNodeClick={handleNodeClick}
        />

        {error && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-full px-4">
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
