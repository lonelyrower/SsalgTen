import { lazy, Suspense } from "react";
import { ViewModeToggle } from "@/components/map/ViewModeToggle";
import { Globe } from "lucide-react";
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
const MapSkeleton = ({ mode = "generic" }: { mode?: "generic" | "3d" }) => (
  <div className="w-full h-full min-h-[320px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-pulse">
        <Globe className="w-16 h-16 mx-auto text-primary" />
      </div>
      <p className="text-muted-foreground">
        {mode === "3d" ? "正在按需加载 3D Cesium 模块..." : "正在加载地图组件..."}
      </p>
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
  const handleViewModeChange = (mode: "2d" | "3d") => {
    onViewModeChange(mode);
  };

  return (
    <div className="relative h-full w-full">
      {/* 右上角：2D/3D 切换 + 状态统计悬浮卡片 - z-[60] 确保在 Header (z-50) 之上 */}
      <div className="absolute top-20 right-4 z-[60] flex items-center gap-3">
        {/* 2D/3D 切换按钮 */}
        <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />

        {/* 状态统计小卡片 */}
        <div className="hidden md:flex items-center gap-2 glass px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <div className="status-indicator bg-green-400" />
            <span className="font-medium text-white text-sm">
              {stats?.onlineNodes || 0}
            </span>
          </div>
          <div className="w-px h-4 bg-white/30" />
          <div className="flex items-center space-x-2">
            <div className="status-indicator bg-red-400" />
            <span className="font-medium text-white text-sm">
              {stats?.offlineNodes || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 地图容器 - 全屏 */}
      <div className="map-container relative h-full w-full">
        <Suspense
          fallback={<MapSkeleton mode={viewMode === "3d" ? "3d" : "generic"} />}
        >
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
    </div>
  );
};
