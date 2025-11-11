import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  Suspense,
  lazy,
} from "react";
import { logger } from "@/utils/logger";
import { useInView } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useRealTime } from "@/hooks/useRealTime";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { NodeCard } from "@/components/nodes/NodeCard";
import { EnhancedNodeDetailsPanel } from "@/components/nodes/EnhancedNodeDetailsPanel";
import { MultiViewToggle, type MultiViewMode } from "@/components/map/MultiViewToggle";
import { useMobile } from "@/hooks/useMobile";
import type { NodeData } from "@/services/api";
import type { HeartbeatData } from "@/types/heartbeat";
import { apiService } from "@/services/api";
import { socketService } from "@/services/socketService";
import { useClientLatency } from "@/hooks/useClientLatency";
import { Search, RefreshCw, Filter, Server } from "lucide-react";

type StatusFilter = "all" | "online" | "offline";

const NetworkToolkit = lazy(() =>
  import("@/components/diagnostics/NetworkToolkit").then((module) => ({
    default: module.NetworkToolkit,
  })),
);

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

export const NodesPageNew: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<MultiViewMode>("list");
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatData | null>(
    null,
  );
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);

  const { nodes, connected, refreshData } = useRealTime();
  const { isMobile } = useMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  // 客户端延迟测试
  const { results: latencyResults } = useClientLatency();

  const getNodeLatency = (nodeId: string) => {
    const result = latencyResults.find((r) => r.nodeId === nodeId);
    return result?.latency ?? null;
  };

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setShowDetails(false);
    if (isMobile) {
      setIsMobileDetailsOpen(true);
    }
  };

  const handleShowDetails = () => {
    if (selectedNode) {
      if (isMobile) {
        setIsMobileDetailsOpen(false);
      }
      setShowDetails(true);
    }
  };

  const handleRefresh = () => {
    refreshData();
  };

  // 获取节点心跳数据
  const fetchHeartbeatData = async (nodeId: string) => {
    try {
      const response = await apiService.getNodeHeartbeatData(nodeId);
      if (response.success && response.data) {
        setHeartbeatData(response.data as HeartbeatData);
      } else {
        setHeartbeatData(null);
      }
    } catch (error) {
      logger.error("Failed to fetch heartbeat data:", error);
      setHeartbeatData(null);
    }
  };

  // 当选中节点时获取心跳数据
  useEffect(() => {
    if (selectedNode) {
      fetchHeartbeatData(selectedNode.id);
    } else {
      setHeartbeatData(null);
    }
  }, [selectedNode]);

  // WebSocket 订阅心跳数据
  useEffect(() => {
    if (selectedNode && connected) {
      const id = selectedNode.id;
      const handler = (payload: { nodeId: string; data: unknown }) => {
        if (payload?.nodeId === id) {
          setHeartbeatData(
            (payload.data as HeartbeatData | null | undefined) ?? null,
          );
        }
      };
      socketService.subscribeToNodeHeartbeat(id, handler);
      socketService.requestLatestHeartbeat(id);

      return () => {
        socketService.unsubscribeFromNodeHeartbeat(id);
      };
    }
  }, [selectedNode, connected]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        node.name.toLowerCase().includes(searchLower) ||
        node.country.toLowerCase().includes(searchLower) ||
        node.city.toLowerCase().includes(searchLower) ||
        node.provider.toLowerCase().includes(searchLower) ||
        (node.ipv4 && node.ipv4.includes(searchTerm)) ||
        (node.ipv6 && node.ipv6.includes(searchTerm)) ||
        (node.asnNumber && node.asnNumber.toLowerCase().includes(searchLower)) ||
        (node.asnName && node.asnName.toLowerCase().includes(searchLower));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online" && node.status === "online") ||
        (statusFilter === "offline" && node.status === "offline");

      return matchesSearch && matchesStatus;
    });
  }, [nodes, searchTerm, statusFilter]);

  useEffect(() => {
    if (!isMobile && isMobileDetailsOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobileDetailsOpen(false);
    }
  }, [isMobile, isMobileDetailsOpen]);

  useEffect(() => {
    if (!isMobileDetailsOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileDetailsOpen]);

  // 如果显示详情页面（包含诊断工具、系统详情、日志等）
  if (showDetails && selectedNode) {
    return (
      <div className="fixed inset-0 flex flex-col bg-background">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 py-6 w-full">
            {/* 页面标题栏 - 带返回按钮 */}
            <div className="mb-6 flex items-center gap-4">
              <Button
                onClick={() => setShowDetails(false)}
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                ← 返回
              </Button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  节点详情
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedNode.name} ({selectedNode.city}, {selectedNode.country})
                </p>
              </div>
            </div>

            <Suspense
              fallback={<LoadingSpinner text="加载详情..." size="md" />}
            >
              <NetworkToolkit selectedNode={selectedNode} heartbeatData={heartbeatData || undefined} />
            </Suspense>
          </main>
        </div>
      </div>
    );
  }


  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <Header />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 py-8 w-full flex flex-col gap-6 min-h-full">
        {/* Search and Filters - Enhanced Design */}
        <div className="relative surface-elevated/80 backdrop-blur-sm rounded-xl border border-border/60 shadow-lg p-4">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--brand-cyan))]/5 via-[hsl(var(--brand-blue))]/5 to-primary/5 rounded-xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row gap-4">
            {/* Search input with enhanced styling */}
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-[hsl(var(--brand-cyan))] transition-colors" />
              <input
                type="text"
                placeholder="搜索节点名称、位置、IP、ASN、服务商..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-[hsl(var(--brand-cyan))] focus:border-[hsl(var(--brand-cyan))] transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Action buttons group */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Refresh button */}
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">刷新</span>
              </Button>

              {/* Status filter with icon */}
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-transparent focus:outline-none text-sm font-medium text-foreground cursor-pointer"
                >
                  <option value="all">全部状态</option>
                  <option value="online">在线</option>
                  <option value="offline">离线</option>
                </select>
              </div>

              {/* View mode toggle */}
              <MultiViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>

        {/* Main Content: Multi-View + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start flex-1">
          {/* Left Panel - Multi View (List/2D Map/3D Globe) */}
          <div className="lg:col-span-2 h-full">
            <div className="surface-elevated rounded-xl shadow-lg p-6 flex flex-col h-full lg:h-[800px]">
              {viewMode === "list" ? (
                /* List View */
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 pt-2 scrollbar-thin scrollbar-thumb-primary scrollbar-track-transparent">
                  {filteredNodes.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Server className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>未找到匹配的节点</p>
                    </div>
                  ) : (
                    filteredNodes.map((node, index) => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        index={index}
                        isInView={isInView}
                        isSelected={selectedNode?.id === node.id}
                        onClick={() => handleNodeClick(node)}
                        latency={getNodeLatency(node.id)}
                        heartbeatData={selectedNode?.id === node.id ? heartbeatData : null}
                      />
                    ))
                  )}
                </div>
              ) : (
                /* Map Views (2D/3D) */
                <div className="flex-1 min-h-0">
                  <Suspense
                    fallback={
                      <LoadingSpinner
                        text="加载地图..."
                        size="lg"
                        className="h-full"
                      />
                    }
                  >
                    {viewMode === "2d" ? (
                      <EnhancedWorldMap
                        nodes={filteredNodes}
                        onNodeClick={handleNodeClick}
                        selectedNode={selectedNode}
                        showHeatmap={false}
                        showVisitorLocation={false}
                        className="h-full"
                      />
                    ) : (
                      <Globe3D
                        nodes={filteredNodes}
                        onNodeClick={handleNodeClick}
                        showVisitorLocation={false}
                      />
                    )}
                  </Suspense>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="hidden lg:block lg:col-span-1">
            <EnhancedNodeDetailsPanel
              node={selectedNode}
              heartbeatData={heartbeatData}
              onShowDetails={handleShowDetails}
            />
          </div>
        </div>
        </main>
      </div>
      {isMobile && selectedNode && isMobileDetailsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setIsMobileDetailsOpen(false)}
            aria-label="关闭节点详情"
          />
          <div className="relative z-10">
            <EnhancedNodeDetailsPanel
              node={selectedNode}
              heartbeatData={heartbeatData}
              onShowDetails={handleShowDetails}
              layout="modal"
              onClose={() => setIsMobileDetailsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
