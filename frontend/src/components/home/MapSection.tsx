import { lazy, Suspense } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ViewModeToggle } from "@/components/map/ViewModeToggle";
import { Globe, Activity } from "lucide-react";
import type { NodeData, NodeStats } from "@/services/api";

// 懒加载地图组件
const EnhancedWorldMap = lazy(() =>
  import("@/components/map/EnhancedWorldMap").then((module) => ({
    default: module.EnhancedWorldMap,
  })),
);

const Globe3D = lazy(() =>
  import("@/components/map/Globe3D").then((module) => ({
    default: module.Globe3D,
  })),
);

// 地图加载骨架屏
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

interface MapSectionProps {
  nodes: NodeData[];
  stats: NodeStats;
  viewMode: "2d" | "3d";
  selectedNode: NodeData | null;
  onViewModeChange: (mode: "2d" | "3d") => void;
  onNodeClick: (node: NodeData) => void;
}

export const MapSection: React.FC<MapSectionProps> = ({
  nodes,
  stats,
  viewMode,
  selectedNode,
  onViewModeChange,
  onNodeClick,
}) => {
  return (
    <GlassCard variant="gradient" animated={true} className="p-6">
      {/* 标题区域 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/15 rounded-xl backdrop-blur-sm">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold gradient-text">全球节点网络</h2>
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
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />

          {/* 状态统计 */}
          <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
            <div className="status-indicator bg-green-400" />
            <span className="font-medium text-foreground">
              在线 {stats?.onlineNodes || 0}
            </span>
          </div>
          <div className="flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
            <div className="status-indicator bg-red-400" />
            <span className="font-medium text-foreground">
              离线 {stats?.offlineNodes || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 地图容器 */}
      <div className="map-container relative h-[600px]">
        <Suspense fallback={<MapSkeleton />}>
          {viewMode === "2d" ? (
            <EnhancedWorldMap
              nodes={nodes}
              onNodeClick={onNodeClick}
              selectedNode={selectedNode}
              className="h-full"
              showControlPanels={false}
            />
          ) : (
            <Globe3D nodes={nodes} onNodeClick={onNodeClick} />
          )}
        </Suspense>
      </div>
    </GlassCard>
  );
};
