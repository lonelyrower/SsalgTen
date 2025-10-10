import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { GeographicDistribution } from '@/components/dashboard/GeographicDistribution';
import { LatencyOverviewCard } from '@/components/latency/LatencyOverviewCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MobilePullToRefresh } from '@/components/ui/MobilePullToRefresh';
import { useRealTime } from '@/hooks/useRealTime';
import { TrendingUp } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { } = useAuth();
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
        {/* 页面头部 - 紧凑设计 */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 border-b-2 border-blue-500/20 dark:border-blue-400/20 px-4 py-3">
            <div className="flex items-center justify-between">
              {/* 左侧：图标 + 标题 */}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  监控面板
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


        {/* 监控概览内容 */}
        <>
          {/* 增强统计卡片 */}
          <EnhancedStats
            totalNodes={stats?.totalNodes || 0}
            onlineNodes={stats?.onlineNodes || 0}
            totalCountries={stats?.totalCountries || 0}
            totalProviders={stats?.totalProviders || 0}
            className="mb-6 sm:mb-8"
          />

          {/* 延迟概览和地理分布 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
            {/* 延迟概览卡片 */}
            <div className="h-full">
              <LatencyOverviewCard className="h-full flex flex-col" />
            </div>

            {/* 地理分布 */}
            <div className="h-full">
              <GeographicDistribution nodes={nodes} className="h-full flex flex-col" />
            </div>
          </div>
        </>

        {/* 连接状态提示 */}
        {!connected && nodes.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
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
