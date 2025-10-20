import React, { useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { GeographicDistribution } from "@/components/dashboard/GeographicDistribution";
import { SystemMetrics } from "@/components/dashboard/SystemMetrics";
import { ProviderDistribution } from "@/components/dashboard/ProviderDistribution";
import { TrafficRanking } from "@/components/dashboard/TrafficRanking";
import { StatsCards } from "@/components/layout/StatsCards";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MobilePullToRefresh } from "@/components/ui/MobilePullToRefresh";
import { useRealTime } from "@/hooks/useRealTime";

/**
 * 统一监控中心页面
 * 展示核心统计、系统资源概览和地理分布
 */
export const UnifiedDashboardPage: React.FC = () => {
  const { nodes, stats, connected, refreshData } = useRealTime();

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
    <div className="min-h-screen mobile-safe bg-gray-50 dark:bg-gray-900">
      <Header />

      <MobilePullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <main className="max-w-7xl mx-auto mobile-container py-4 sm:py-8 mobile-safe space-y-6">
          {/* 核心统计卡片 */}
          <section>
            <StatsCards {...memoizedStats} />
          </section>

          {/* 网格布局：4个统计区块 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 系统资源概览 */}
            <div>
              <SystemMetrics nodes={nodes} />
            </div>

            {/* 地理分布 */}
            <div>
              <GeographicDistribution nodes={nodes} compact={true} />
            </div>

            {/* 服务商分布 */}
            <div>
              <ProviderDistribution nodes={nodes} />
            </div>

            {/* 流量排行 */}
            <div>
              <TrafficRanking nodes={nodes} />
            </div>
          </div>
        </main>
      </MobilePullToRefresh>
    </div>
  );
};
