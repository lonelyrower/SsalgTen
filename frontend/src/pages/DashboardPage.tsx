import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { GeographicDistribution } from '@/components/dashboard/GeographicDistribution';
import { LatencyOverviewCard } from '@/components/latency/LatencyOverviewCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MobilePullToRefresh } from '@/components/ui/MobilePullToRefresh';
import { useRealTime } from '@/hooks/useRealTime';
import { MapPin, Settings, Shield, BarChart, TrendingUp } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-cyan-900/20">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-900 dark:via-indigo-900/10 dark:to-purple-900/10 mobile-safe">
      <Header />

      <MobilePullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <main className="max-w-7xl mx-auto mobile-container py-4 sm:py-8 mobile-safe">
        {/* 欢迎信息和实时状态 */}
        <div className="mb-6 sm:mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6 mobile-safe">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-400/5 dark:via-purple-400/5 dark:to-pink-400/5"></div>
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex-shrink-0">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="min-w-0 mobile-text-readable">
                  <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-indigo-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent truncate">
                    欢迎回来, {user?.name || user?.username}!
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                    SsalgTen 网络监控管理系统 - {user?.role === 'ADMIN' ? '管理员' : user?.role === 'OPERATOR' ? '操作员' : '查看者'}
                  </p>
                </div>
              </div>
            
              {/* 实时连接状态指示器 */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mobile-safe">
                <div className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full shadow-sm transition-all duration-200 text-xs sm:text-sm ${
                  connected
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''} shadow-sm`}></div>
                  <span className="font-semibold whitespace-nowrap">
                    {connected ? '实时连接' : '连接断开'}
                  </span>
                </div>
                {lastUpdate && (
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 sm:px-3 py-1 rounded-full">
                    更新: {new Date(lastUpdate).toLocaleTimeString()}
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
          <div className="mobile-grid-auto gap-4 sm:gap-6 mb-6">
            {/* 延迟概览卡片 */}
            <div>
              <LatencyOverviewCard />
            </div>

            {/* 地理分布 */}
            <div>
              <GeographicDistribution nodes={nodes} />
            </div>
          </div>


          {/* 快速操作 */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 sm:p-6 mobile-safe">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速操作</h3>
            <div className="mobile-grid-auto gap-3 sm:gap-4">
              <a
                href="/nodes"
                className="flex items-center p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow mobile-touch-target mobile-safe"
              >
                <MapPin className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">节点管理</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">管理和诊断节点</div>
                </div>
              </a>

              <a
                href="/admin"
                className="flex items-center p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow mobile-touch-target mobile-safe"
              >
                <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">系统管理</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">用户和系统设置</div>
                </div>
              </a>

              <a
                href="/security"
                className="flex items-center p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow mobile-touch-target mobile-safe"
              >
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">安全中心</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">安全日志和告警</div>
                </div>
              </a>

              <div className="flex items-center p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm opacity-75 mobile-safe">
                <BarChart className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-500 dark:text-gray-400 text-sm sm:text-base">数据分析</div>
                  <div className="text-xs text-gray-400">即将推出</div>
                </div>
              </div>
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
