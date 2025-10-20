import React from "react";
import { Header } from "@/components/layout/Header";
import { NodeMonitoringSection } from "@/components/dashboard/NodeMonitoringSection";
import { GeographicDistribution } from "@/components/dashboard/GeographicDistribution";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MobilePullToRefresh } from "@/components/ui/MobilePullToRefresh";
import { useRealTime } from "@/hooks/useRealTime";

/**
 * 统一监控中心页面
 * 整合了旧版监控视图的核心能力
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
    <div className="min-h-screen mobile-safe">
      <Header />

      <MobilePullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <main className="max-w-7xl mx-auto mobile-container py-4 sm:py-8 mobile-safe">
          {/* 地理分布 */}
          <section className="mb-6 sm:mb-8">
            <GeographicDistribution nodes={nodes} />
          </section>

          {/* 节点监控区块 */}
          <section>
            <NodeMonitoringSection />
          </section>
        </main>
      </MobilePullToRefresh>
    </div>
  );
};
