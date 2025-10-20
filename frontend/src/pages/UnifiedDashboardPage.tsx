import React from "react";
import { Header } from "@/components/layout/Header";
import { GeographicDistribution } from "@/components/dashboard/GeographicDistribution";
import { SystemMetrics } from "@/components/dashboard/SystemMetrics";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MobilePullToRefresh } from "@/components/ui/MobilePullToRefresh";
import { useRealTime } from "@/hooks/useRealTime";

/**
 * 统一监控中心页面
 * 展示系统资源概览和地理分布
 */
export const UnifiedDashboardPage: React.FC = () => {
  const { nodes, connected, refreshData } = useRealTime();

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
          {/* 两列布局：系统资源概览 + 地理分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：系统资源概览 */}
            <section>
              <SystemMetrics nodes={nodes} />
            </section>

            {/* 右侧：地理分布 */}
            <section>
              <GeographicDistribution nodes={nodes} compact={true} />
            </section>
          </div>
        </main>
      </MobilePullToRefresh>
    </div>
  );
};
