import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/layout/StatsCards';
import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import { useAuth } from '@/hooks/useAuth';
import { useRealTime } from '@/hooks/useRealTime';
import { Activity, Globe } from 'lucide-react';
import { ViewModeToggle } from '@/components/map/ViewModeToggle';
import type { NodeData } from '@/services/api';

// 懒加载地图组件以提升首屏加载速度
// 使用动态导入和预加载策略
const EnhancedWorldMap = lazy(() => 
  import('@/components/map/EnhancedWorldMap').then(module => ({ 
    default: module.EnhancedWorldMap 
  }))
);

const Globe3D = lazy(() => 
  import('@/components/map/Globe3D').then(module => ({ 
    default: module.Globe3D 
  }))
);

// 地图加载骨架屏组件
const MapSkeleton = () => (
  <div className="w-full h-[600px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-pulse">
          <Globe className="w-16 h-16 mx-auto text-primary" />
        </div>
      <p className="text-muted-foreground">正在加载地图组件...</p>
    </div>
  </div>
);

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const { nodes, stats, connected } = useRealTime();
  const { user } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const error: string | null = null;

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
  const memoizedStats = useMemo(() => ({
    totalNodes: stats?.totalNodes || 0,
    onlineNodes: stats?.onlineNodes || 0,
    totalCountries: stats?.totalCountries || 0,
    totalProviders: stats?.totalProviders || 0,
    securityEvents: stats?.securityEvents || 0 // 安全事件统计（SSH暴力破解等）
  }), [stats?.totalNodes, stats?.onlineNodes, stats?.totalCountries, stats?.totalProviders, stats?.securityEvents]);

  // 如果正在加载，显示加载状态
  if (isInitialLoad && nodes.length === 0 && !loadTimeout) {
    return (
      <div className="min-h-screen">
        <Header />
        <LoadingSpinner
          fullScreen
          text={connected ? "正在加载节点数据..." : "正在连接服务器..."}
          size="xl"
          variant="elegant"
        />
      </div>
    );
  }

  // 如果有错误，显示错误状态
  if (error && nodes.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="server"
            title="数据加载失败"
            message="无法连接到后端服务器，请确保服务器正在运行。"
            showRetry={true}
            showHome={true}
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
        {/* 移除了首页横幅以减少占用空间 */}
        
        {/* 统计卡片 */}
        <div className="mb-8">
          <StatsCards {...memoizedStats} />
        </div>
        
        {/* 地图区域 */}
        <div className="mb-8">
          <GlassCard variant="gradient" animated={true} className="p-6">
            {/* 标题区域 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/15 rounded-xl backdrop-blur-sm">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold gradient-text">
                      全球节点网络
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium flex items-center">
                      <Activity className="h-4 w-4 mr-2 text-green-400" />
                      实时监控全球网络节点状态和性能
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 状态指示器 + 视图切换按钮 */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {/* 2D/3D 切换按钮 */}
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
                
                {/* 状态统计 */}
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-green-400" />
                  <span className="font-medium text-foreground">在线 {stats?.onlineNodes || 0}</span>
                </div>
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-red-400" />
                  <span className="font-medium text-foreground">离线 {stats?.offlineNodes || 0}</span>
                </div>
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-gray-400" />
                  <span className="font-medium text-foreground">未知 {(stats?.totalNodes || 0) - (stats?.onlineNodes || 0) - (stats?.offlineNodes || 0)}</span>
                </div>
              </div>
            </div>
            
            {/* 地图容器 - 使用优化的加载策略 */}
            <div className="map-container relative h-[600px]">
              <Suspense fallback={<MapSkeleton />}>
                {viewMode === '2d' ? (
                  <EnhancedWorldMap
                    nodes={nodes}
                    onNodeClick={handleNodeClick}
                    selectedNode={selectedNode}
                    className="h-full"
                    showControlPanels={false}
                  />
                ) : (
                  <Globe3D
                    nodes={nodes}
                    onNodeClick={handleNodeClick}
                  />
                )}
              </Suspense>
            </div>
          </GlassCard>
        </div>

        {/* 选中节点信息 */}
        {selectedNode && (
          <div className="mb-8">
            <GlassCard variant="tech" animated={false} glow={false} className="p-6">
              <div>
                <div className="flex-1">
                  {/* 节点头部信息 - 简化版 */}
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="relative">
                <div className="p-3 bg-primary/15 rounded-xl border border-white/10">
                  <Activity className="h-8 w-8 text-primary" />
                      </div>
                      {/* 只为在线节点保留脉冲动画 */}
                      {selectedNode.status === 'online' && (
                        <div className="absolute -top-1 -right-1 status-indicator bg-green-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold gradient-text">
                        {selectedNode.name}
                      </h3>
                      <p className="text-muted-foreground text-sm font-medium flex items-center">
                        <Activity className="h-4 w-4 mr-2 text-purple-400" />
                        已选中网络节点 • 正在监控
                      </p>
                    </div>
                  </div>
                  
                  {/* 节点详细信息 - 分组优化 */}
                  <div className="space-y-6">
                    {/* 基础信息组 */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">基础信息</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="glass rounded-lg p-4 border border-white/10">
                          <div className="text-xs text-muted-foreground/70 mb-1.5">地理位置</div>
                          <div className="flex items-center space-x-2">
                            <CountryFlagSvg country={selectedNode.country} />
                            <div className="font-semibold text-foreground text-sm">
                              {selectedNode.city}, {selectedNode.country}
                            </div>
                          </div>
                        </div>
                        
                        <div className="glass rounded-lg p-4 border border-white/10">
                          <div className="text-xs text-muted-foreground/70 mb-1.5">服务提供商</div>
                          <div className="font-semibold text-foreground text-sm">
                            {selectedNode.provider}
                          </div>
                        </div>
                        
                        <div className="glass rounded-lg p-4 border border-white/10">
                          <div className="text-xs text-muted-foreground/70 mb-1.5">运行状态</div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                            selectedNode.status === 'online' 
                              ? 'status-badge-online' 
                              : selectedNode.status === 'offline' 
                              ? 'status-badge-offline'
                              : 'status-badge-warning'
                          }`}>
                            {selectedNode.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 网络信息组 - 仅登录用户可见 */}
                    {user && (selectedNode.ipv4 || (selectedNode.ipv6 && selectedNode.ipv6.includes(':') && selectedNode.ipv6.length > 15)) && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">网络配置</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedNode.ipv4 && (
                            <div className="glass rounded-lg p-4 border border-white/10">
                              <div className="text-xs text-muted-foreground/70 mb-1.5">IPv4 地址</div>
                              <div className="font-mono text-sm text-primary font-semibold">
                                {selectedNode.ipv4}
                              </div>
                            </div>
                          )}

                          {selectedNode.ipv6 && selectedNode.ipv6.includes(':') && selectedNode.ipv6.length > 15 && (
                            <div className="glass rounded-lg p-4 border border-white/10">
                              <div className="text-xs text-muted-foreground/70 mb-1.5">IPv6 地址</div>
                              <div className="font-mono text-sm text-accent font-semibold break-all">
                                {selectedNode.ipv6}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* 状态信息组 */}
                    {selectedNode.lastSeen && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">状态记录</h4>
                        <div className="glass rounded-lg p-4 border border-white/10">
                          <div className="text-xs text-muted-foreground/70 mb-1.5">最后在线时间</div>
                          <div className="font-medium text-sm text-foreground">
                            {new Date(selectedNode.lastSeen).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </GlassCard>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-500 mr-2">⚠️</div>
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-100">Connection Error</h3>
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
