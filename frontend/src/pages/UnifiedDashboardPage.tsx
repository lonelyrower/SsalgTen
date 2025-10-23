import React, { useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { GeographicDistribution } from "@/components/dashboard/GeographicDistribution";
import { SystemMetrics } from "@/components/dashboard/SystemMetrics";
import { CostAnalysis } from "@/components/dashboard/CostAnalysis";
import { TrafficRanking } from "@/components/dashboard/TrafficRanking";
import { UptimeRanking } from "@/components/dashboard/UptimeRanking";
import { HealthRanking } from "@/components/dashboard/HealthRanking";
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
      <div className="fixed inset-0 flex flex-col bg-slate-100 transition-colors duration-300 dark:bg-slate-900">
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
    <div className="fixed inset-0 flex flex-col bg-slate-100 transition-colors duration-300 dark:bg-slate-900">
      <Header />

      <MobilePullToRefresh
        onRefresh={handleRefresh}
        className="flex-1 overflow-y-auto bg-slate-100 transition-colors duration-300 dark:bg-slate-900"
      >
        <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
          {/* 核心统计卡片 */}
          <section>
            <StatsCards {...memoizedStats} />
          </section>

          {/* 网格布局：6个统计区块 - 2列×3行 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 第1行左：系统资源概览 */}
            <div>
              <SystemMetrics nodes={nodes} />
            </div>

            {/* 第1行右：地理分布 */}
            <div>
              <GeographicDistribution nodes={nodes} compact={true} />
            </div>

            {/* 第2行左：流量排行 */}
            <div>
              <TrafficRanking nodes={nodes} />
            </div>

            {/* 第2行右：节点健康度排行 */}
            <div>
              <HealthRanking nodes={nodes} />
            </div>

            {/* 第3行左：正常运行时间排行 */}
            <div>
              <UptimeRanking nodes={nodes} />
            </div>

            {/* 第3行右：成本分析 */}
            <div>
              <CostAnalysis nodes={nodes} />
            </div>
          </div>
        </main>
      </MobilePullToRefresh>
    </div>
  );
};
