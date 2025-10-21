import { lazy, Suspense, useState } from "react";
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
type ConnectionInfo = {
  effectiveType?: string;
  downlink?: number;
};

type ExtendedNavigator = Navigator & {
  connection?: ConnectionInfo;
  mozConnection?: ConnectionInfo;
  webkitConnection?: ConnectionInfo;
};

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
  const [globeReady, setGlobeReady] = useState(viewMode !== "3d");

  const performanceHint = (() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return null;
    }

    const nav = navigator as ExtendedNavigator;
    const connection =
      nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

    if (connection?.effectiveType) {
      const type = connection.effectiveType.toLowerCase();
      if (type.includes("2g") || type.includes("3g") || type.includes("slow")) {
        return "limited" as const;
      }

      return "good" as const;
    }

    const prefersLargeScreen = window.matchMedia("(min-width: 1024px)").matches;
    return prefersLargeScreen ? ("good" as const) : ("limited" as const);
  })();

  const handleViewModeChange = (mode: "2d" | "3d") => {
    if (mode === "3d") {
      setGlobeReady(false);
    }
    onViewModeChange(mode);
  };

  const show3DEncouragement = performanceHint === "good" && viewMode === "2d";
  const show3DWarning = performanceHint === "limited" && viewMode === "3d";
  const showCesiumInfo = viewMode === "2d" || show3DWarning;

  return (
    <GlassCard
      variant="gradient"
      animated
      hoverTransform={false}
      className="p-4 sm:p-6 lg:p-8"
    >
      {/* 标题区域 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
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
          <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />

      {/* 状态统计 */}
      <div className="hidden md:flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
        <div className="status-indicator bg-green-400" />
        <span className="font-medium text-foreground">
              在线 {stats?.onlineNodes || 0}
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-2 glass px-4 py-2 rounded-full border border-white/20">
            <div className="status-indicator bg-red-400" />
            <span className="font-medium text-foreground">
              离线 {stats?.offlineNodes || 0}
            </span>
          </div>
        </div>
      </div>

      {showCesiumInfo && (
        <div className="mt-3 space-y-1 text-xs leading-relaxed">
          <p className="text-muted-foreground">
            3D 模式会按需加载 Cesium 模块，首次切换可能需要数秒，请耐心等待加载提示完成。
          </p>
          {show3DEncouragement && (
            <p className="text-primary/80 font-medium">
              检测到当前设备性能良好，欢迎切换体验沉浸式 3D 地球。
            </p>
          )}
          {show3DWarning && (
            <p className="text-amber-400 dark:text-amber-300 font-medium">
              当前网络带宽较低，3D 加载可能较慢，可随时切换回 2D 模式。
            </p>
          )}
          {viewMode === "3d" && !globeReady && (
            <p className="text-muted-foreground/80">
              Cesium 资源加载完成后将自动显示 3D 地球。
            </p>
          )}
        </div>
      )}

      {/* 地图容器 */}
      <div className="map-container relative h-[400px] sm:h-[520px] lg:min-h-[calc(100vh-18rem)] lg:h-auto">
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
            <Globe3D
              nodes={nodes}
              onNodeClick={onNodeClick}
              onReady={() => setGlobeReady(true)}
            />
          )}
        </Suspense>
      </div>
    </GlassCard>
  );
};
