import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/layout/StatsCards';
import { EnhancedWorldMap } from '@/components/map/EnhancedWorldMap';
import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import { useAuth } from '@/contexts/AuthContext';
import { useNodes } from '@/hooks/useNodes';
import { Activity, Globe } from 'lucide-react';
import type { NodeData } from '@/services/api';

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const { nodes, stats, loading, error } = useNodes();
  const { user } = useAuth();
  const mapHolderRef = useRef<HTMLDivElement | null>(null);
  const [mapInView, setMapInView] = useState(false);

  const handleNodeClick = useCallback((node: NodeData) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  }, []);

  // 视口懒加载地图：仅当地图容器进入视口时才渲染地图，提升首页首屏性能
  useEffect(() => {
    if (mapInView) return;
    const el = mapHolderRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setMapInView(true);
          io.disconnect();
          break;
        }
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mapInView]);


  // 缓存统计数据以防止不必要的重新渲染
  const memoizedStats = useMemo(() => ({
    totalNodes: stats?.totalNodes || 0,
    onlineNodes: stats?.onlineNodes || 0,
    totalCountries: stats?.totalCountries || 0,
    totalProviders: stats?.totalProviders || 0
  }), [stats?.totalNodes, stats?.onlineNodes, stats?.totalCountries, stats?.totalProviders]);

  // 如果正在加载，显示加载状态
  if (loading && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-cyan-900/20">
        <Header />
        <LoadingSpinner 
          fullScreen 
          text="正在加载节点数据..." 
          size="xl"
          variant="elegant"
        />
      </div>
    );
  }

  // 如果有错误，显示错误状态
  if (error && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50 dark:from-gray-900 dark:via-red-900/20 dark:to-orange-900/20">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="server"
            title="数据加载失败"
            message={error.includes('HTTP error') 
              ? "无法连接到后端服务器，请确保服务器正在运行。" 
              : error
            }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-cyan-50/30 dark:from-gray-900 dark:via-blue-900/10 dark:to-cyan-900/10">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 移除了首页横幅以减少占用空间 */}
        
        {/* 统计卡片 */}
        <div className="mb-8">
          <StatsCards {...memoizedStats} />
        </div>
        
        {/* 地图区域（视口懒加载） */}
        <div className="mb-8" ref={mapHolderRef}>
          <GlassCard variant="gradient" animated={true} className="p-6">
            {/* 标题区域 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl backdrop-blur-sm">
                    <Globe className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold gradient-text">
                      全球节点网络
                    </h2>
                    <p className="text-gray-600 dark:text-white/70 text-sm font-medium flex items-center">
                      <Activity className="h-4 w-4 mr-2 text-green-400" />
                      实时监控全球网络节点状态和性能
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 状态指示器 */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-green-400" />
                  <span className="font-medium text-gray-900 dark:text-white/90">在线 {stats?.onlineNodes || 0}</span>
                </div>
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-red-400" />
                  <span className="font-medium text-gray-900 dark:text-white/90">离线 {stats?.offlineNodes || 0}</span>
                </div>
                <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
                  <div className="status-indicator bg-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white/90">未知 {stats?.unknownNodes || 0}</span>
                </div>
              </div>
            </div>
            
            {/* 地图容器 */}
            <div className="map-container relative h-[600px]">
              {mapInView ? (
                <EnhancedWorldMap 
                  nodes={nodes} 
                  onNodeClick={handleNodeClick} 
                  selectedNode={selectedNode}
                  showHeatmap={false}
                  className="h-full"
                />
              ) : (
                <LoadingSpinner text="地图准备中..." size="lg" className="h-full" />
              )}
            </div>
          </GlassCard>
        </div>

        {/* 选中节点信息 */}
        {selectedNode && (
          <div className="mb-8">
            <GlassCard variant="tech" animated={true} glow={true} className="p-6">
              <div>
                <div className="flex-1">
                  {/* 节点头部信息 */}
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="relative">
                      <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl backdrop-blur-sm border border-white/20">
                        <Activity className="h-8 w-8 text-blue-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 status-indicator bg-green-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold gradient-text">
                        {selectedNode.name}
                      </h3>
                      <p className="text-gray-600 dark:text-white/70 text-sm font-medium flex items-center">
                        <Globe className="h-4 w-4 mr-2 text-purple-400" />
                        已选中网络节点 • 正在监控
                      </p>
                    </div>
                  </div>
                  
                  {/* 节点详细信息网格 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="glass rounded-lg p-4 border border-white/20 relative group text-center">
                      <div className="text-xs text-gray-500 dark:text-white/60 mb-2 font-medium">地理位置</div>
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <CountryFlagSvg country={selectedNode.country} />
                        <div className="font-bold text-gray-900 dark:text-white/90 text-lg">
                          {selectedNode.city}, {selectedNode.country}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <div className="glass rounded-lg p-4 border border-white/20 relative group">
                      <div className="text-xs text-gray-500 dark:text-white/60 mb-2 font-medium">服务提供商</div>
                      <div className="font-bold text-gray-900 dark:text-white/90 text-lg">
                        {selectedNode.provider}
                      </div>
                      <div className="absolute top-2 right-2 w-2 h-2 bg-purple-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <div className="glass rounded-lg p-4 border border-white/20 relative group">
                      <div className="text-xs text-gray-500 dark:text-white/60 mb-2 font-medium">运行状态</div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          selectedNode.status === 'online' 
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                            : selectedNode.status === 'offline' 
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}>
                          {selectedNode.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity animate-pulse" />
                    </div>
                    
                    {user && selectedNode.ipv4 && (
                      <div className="glass rounded-lg p-4 border border-white/20 relative group">
                        <div className="text-xs text-gray-500 dark:text-white/60 mb-2 font-medium">IPv4 地址</div>
                        <div className="font-mono text-sm text-cyan-300 font-bold">
                          {selectedNode.ipv4}
                        </div>
                        <div className="absolute top-2 right-2 w-2 h-2 bg-cyan-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    
                    {selectedNode.lastSeen && (
                      <div className="glass rounded-lg p-4 border border-white/20 relative group">
                        <div className="text-xs text-gray-500 dark:text-white/60 mb-2 font-medium">最后在线时间</div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white/90">
                          {new Date(selectedNode.lastSeen).toLocaleString('zh-CN')}
                        </div>
                        <div className="absolute top-2 right-2 w-2 h-2 bg-orange-400 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
              
              {/* 底部装饰效果 */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent data-flow" />
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
