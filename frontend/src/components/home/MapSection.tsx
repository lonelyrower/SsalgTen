import { lazy, Suspense } from "react";
import { ViewModeToggle } from "@/components/map/ViewModeToggle";
import { Globe, Eye, EyeOff } from "lucide-react";
import type { NodeData, NodeStats } from "@/services/api";
import { useVisitorLocationVisibility } from "@/hooks/useVisitorLocationVisibility";

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
  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
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
  const { isVisible: isVisitorLocationVisible, toggleVisibility: toggleVisitorLocation } = useVisitorLocationVisibility();

  const handleViewModeChange = (mode: "2d" | "3d") => {
    onViewModeChange(mode);
  };

  return (
    <div className="relative h-full w-full bg-black">
      {/* Top controls (centered) - Two-row layout */}
      <div className="pointer-events-none absolute top-4 sm:top-6 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
        {/* Row 1: View Mode Toggle */}
        <div className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md shadow-lg dark:bg-black/40">
          <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />
        </div>

        {/* Row 2: Node Statistics & Visitor Location Toggle */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs leading-none backdrop-blur-md shadow-lg dark:bg-black/40">
          <div className="flex items-center gap-1.5 text-white">
            <span className="status-indicator bg-green-400" />
            <span className="font-medium">
              {stats?.onlineNodes ?? 0}
            </span>
          </div>
          <span className="h-4 w-px bg-white/30" />
          <div className="flex items-center gap-1.5 text-white">
            <span className="status-indicator bg-red-400" />
            <span className="font-medium">{stats?.offlineNodes ?? 0}</span>
          </div>
          <span className="h-4 w-px bg-white/30" />
          <button
            onClick={toggleVisitorLocation}
            className="flex items-center gap-1 text-white hover:text-pink-300 transition-colors"
            title={isVisitorLocationVisible ? "隐藏我的位置" : "显示我的位置"}
            aria-label={isVisitorLocationVisible ? "隐藏访客位置" : "显示访客位置"}
          >
            {isVisitorLocationVisible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="absolute inset-0">
        <Suspense
          fallback={<MapSkeleton mode={viewMode === "3d" ? "3d" : "generic"} />}
        >
          {viewMode === "2d" ? (
            <EnhancedWorldMap
              nodes={nodes}
              onNodeClick={onNodeClick}
              selectedNode={selectedNode}
              className="h-full w-full"
              layout="fullscreen"
              showVisitorLocation={true}
            />
          ) : (
            <Globe3D nodes={nodes} onNodeClick={onNodeClick} showVisitorLocation={true} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

