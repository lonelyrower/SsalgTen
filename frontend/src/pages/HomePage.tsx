import { useState, useMemo, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/layout/StatsCards';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { HomeWelcomeBanner } from '@/components/home/HomeWelcomeBanner';
import { MapSection } from '@/components/home/MapSection';
import { NodeDetailsCard } from '@/components/home/NodeDetailsCard';
import { ErrorBanner } from '@/components/home/ErrorBanner';
import { useAuth } from '@/hooks/useAuth';
import { useRealTime } from '@/hooks/useRealTime';
import type { NodeData } from '@/services/api';

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const { nodes, stats, connected, error } = useRealTime();
  const { user } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);

  const handleNodeClick = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  // 当数据加载后，取消初始加载状态
  useEffect(() => {
    if (nodes.length > 0) {
      setIsInitialLoad(false);
      setLoadTimeout(false);
    }
  }, [nodes]);

  // 添加加载超时机制（10秒后即使没有数据也显示页面）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitialLoad && nodes.length === 0) {
        console.warn('Data loading timeout, showing page anyway');
        setIsInitialLoad(false);
        setLoadTimeout(true);
      }
    }, 10000); // 10秒超时

    return () => clearTimeout(timer);
  }, [isInitialLoad, nodes.length]);

  // 缓存统计数据以防止不必要的重新渲染
  const memoizedStats = useMemo(
    () => ({
      totalNodes: stats?.totalNodes || 0,
      onlineNodes: stats?.onlineNodes || 0,
      totalCountries: stats?.totalCountries || 0,
      totalProviders: stats?.totalProviders || 0,
      totalTraffic: stats?.totalTraffic
    }),
    [
      stats?.totalNodes,
      stats?.onlineNodes,
      stats?.totalCountries,
      stats?.totalProviders,
      stats?.totalTraffic
    ]
  );

  // 如果正在加载，显示加载状态
  if (isInitialLoad && nodes.length === 0 && !loadTimeout) {
    return (
      <div className="min-h-screen">
        <Header />
        <LoadingSpinner
          fullScreen
          text={connected ? '正在加载节点数据...' : '正在连接服务器...'}
          size="xl"
          variant="elegant"
        />
      </div>
    );
  }

  // 如果有错误且没有数据，显示错误状态
  if (error && nodes.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="server"
            title="数据加载失败"
            message={error}
            showRetry={true}
            showHome={true}
            onRetry={() => window.location.reload()}
            size="lg"
          />
        </main>
      </div>
    );
  }

  // 如果超时且没有数据（无错误），显示"暂无数据"提示
  if (loadTimeout && nodes.length === 0 && !error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="network"
            title="暂无节点数据"
            message={
              connected
                ? '系统已连接，但当前没有可用的节点数据。请稍后刷新页面或联系管理员。'
                : '正在尝试连接服务器，请稍候...'
            }
            showRetry={true}
            showHome={false}
            onRetry={() => window.location.reload()}
            size="lg"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 欢迎信息 */}
        <div className="mb-8">
          <HomeWelcomeBanner userName={user?.name || user?.username} />
        </div>

        {/* 统计卡片 */}
        <div className="mb-8">
          <StatsCards {...memoizedStats} />
        </div>

        {/* 地图区域 */}
        <div className="mb-8">
          <MapSection
            nodes={nodes}
            stats={stats}
            viewMode={viewMode}
            selectedNode={selectedNode}
            onViewModeChange={setViewMode}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* 选中节点信息 */}
        {selectedNode && (
          <div className="mb-8">
            <NodeDetailsCard node={selectedNode} showNetworkInfo={!!user} />
          </div>
        )}

        {/* 错误提示 */}
        {error && <ErrorBanner error={error} />}
      </main>
    </div>
  );
};
