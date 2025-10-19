import React from 'react';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { NodeMonitoringSection } from '@/components/dashboard/NodeMonitoringSection';
import { GeographicDistribution } from '@/components/dashboard/GeographicDistribution';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MobilePullToRefresh } from '@/components/ui/MobilePullToRefresh';
import { useRealTime } from '@/hooks/useRealTime';
import { TrendingUp } from 'lucide-react';

/**
 * 统一监控中心页面
 * 整合了旧版监控视图的核心能力
 */
export const UnifiedDashboardPage: React.FC = () => {
  const { nodes, stats, lastUpdate, connected, refreshData } = useRealTime();

  // 下拉刷新处理
  const handleRefresh = async () => {
    if (refreshData) {
      await refreshData();
    }
  };

  // 如果没有连接且没有数据，显示加载状态
  if (!connected && nodes.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <LoadingSpinner
          fullScreen
          text="正在连接实时服务器..."
          size="xl"
          variant="elegant"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen mobile-safe">
      <Header />

      <MobilePullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <main className="max-w-7xl mx-auto mobile-container py-4 sm:py-8 mobile-safe">
          {/* 页面头部 */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 border-b-2 border-blue-500/20 dark:border-blue-400/20 px-4 py-3 rounded-t-lg">
              <div className="flex items-center justify-between">
                {/* 左侧：图标 + 标题 */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    统一监控中心
                  </h1>
                </div>

                {/* 右侧：状态指示器 */}
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    connected
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span>{connected ? '实时连接' : '连接断开'}</span>
                  </div>
                  {lastUpdate && (
                    <div className="hidden sm:flex text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                      {new Date(lastUpdate).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 系统概览区块 - 统计卡片 */}
          <section className="mb-6 sm:mb-8">
            <EnhancedStats
              totalNodes={stats?.totalNodes || 0}
              onlineNodes={stats?.onlineNodes || 0}
              totalCountries={stats?.totalCountries || 0}
              totalProviders={stats?.totalProviders || 0}
              className=""
            />
          </section>

          {/* 地理分布 */}
          <section className="mb-6 sm:mb-8">
            <GeographicDistribution nodes={nodes} />
          </section>

          {/* 节点监控区块 */}
          <section>
            <NodeMonitoringSection />
          </section>

          {/* 连接状态提示 */}
          {!connected && nodes.length > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="text-yellow-500 mr-2">⚠️</div>
                <div>
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-100">实时连接已断开</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    当前显示的是缓存数据，正在尝试重新连接...
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </MobilePullToRefresh>
    </div>
  );
};
