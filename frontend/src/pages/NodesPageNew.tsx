import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  Suspense,
  lazy,
} from "react";
import { useInView } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { PageHeader } from "@/components/layout/PageHeader";
import { useRealTime } from "@/hooks/useRealTime";
import { useConnectivityDiagnostics } from "@/hooks/useConnectivityDiagnostics";
import { ConnectivityDiagnostics } from "@/components/nodes/ConnectivityDiagnostics";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { NodeCard } from "@/components/nodes/NodeCard";
import { EnhancedNodeDetailsPanel } from "@/components/nodes/EnhancedNodeDetailsPanel";
import { ServerDetailsPanel } from "@/components/nodes/ServerDetailsPanel";
import { MultiViewToggle, type MultiViewMode } from "@/components/map/MultiViewToggle";
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
  const { hasRole } = useAuth();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showServerDetails, setShowServerDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<MultiViewMode>("list");
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatData | null>(
    null,
  );

  const { nodes, connected, refreshData } = useRealTime();
  const diagnostics = useConnectivityDiagnostics(connected);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  // 客户端延迟测试
  const { results: latencyResults } = useClientLatency();

  const getNodeLatency = (nodeId: string) => {
    const result = latencyResults.find((r) => r.nodeId === nodeId);
    return result?.latency ?? null;
  };

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setShowDiagnostics(false);
    setShowServerDetails(false);
  };

  const handleRunDiagnostics = () => {
    if (selectedNode) {
      setShowDiagnostics(true);
    }
  };

  const handleShowServerDetails = () => {
    if (selectedNode) {
      setShowServerDetails(true);
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
      console.error("Failed to fetch heartbeat data:", error);
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
      const matchesSearch =
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (node.ipv4 && node.ipv4.includes(searchTerm)) ||
        (node.ipv6 && node.ipv6.includes(searchTerm));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online" && node.status === "online") ||
        (statusFilter === "offline" && node.status === "offline");

      return matchesSearch && matchesStatus;
    });
  }, [nodes, searchTerm, statusFilter]);

  // 如果显示诊断界面
  if (showDiagnostics && selectedNode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ConnectivityDiagnostics
            checking={diagnostics.checking}
            apiReachable={diagnostics.apiReachable}
            socketConnected={diagnostics.socketConnected}
            authOk={diagnostics.authOk}
            nodesCount={diagnostics.nodesCount}
            lastCheckedAt={diagnostics.lastCheckedAt}
            issues={diagnostics.issues}
            onRefresh={diagnostics.refresh}
            isAdmin={hasRole("ADMIN")}
          />
          <Suspense
            fallback={<LoadingSpinner text="加载网络工具..." size="md" />}
          >
            <NetworkToolkit
              selectedNode={selectedNode}
              onClose={() => setShowDiagnostics(false)}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // 如果显示服务器详情面板
  if (showServerDetails && selectedNode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Button
            onClick={() => setShowServerDetails(false)}
            variant="outline"
            className="mb-4"
          >
            ← 返回节点列表
          </Button>
          <ServerDetailsPanel
            node={selectedNode}
            heartbeatData={heartbeatData || undefined}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <main
        ref={containerRef}
        className="relative max-w-7xl mx-auto px-4 py-8 space-y-6"
      >
        {/* Connectivity Diagnostics removed for nodes overview page */}

        {/* Page Header */}
        <PageHeader
          title="节点看板"
          description={`全局监控 ${nodes.length} 个节点 - 在线 ${nodes.filter((n) => n.status === "online").length} 台`}
          icon={Server}
          actions={
            <Button
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          }
        />

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索节点名称、位置、IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">全部状态</option>
              <option value="online">在线</option>
              <option value="offline">离线</option>
            </select>
            <MultiViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Main Content: Multi-View + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Multi View (List/2D Map/3D Globe) */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 min-h-[600px]">
              {viewMode === "list" ? (
                /* List View */
                <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {filteredNodes.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
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
                      />
                    ))
                  )}
                </div>
              ) : (
                /* Map Views (2D/3D) */
                <div className="h-[600px]">
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
                        showControlPanels={false}
                        className="h-full"
                      />
                    ) : (
                      <Globe3D
                        nodes={filteredNodes}
                        onNodeClick={handleNodeClick}
                      />
                    )}
                  </Suspense>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="lg:col-span-1">
            <EnhancedNodeDetailsPanel
              node={selectedNode}
              heartbeatData={heartbeatData}
              onRunDiagnostics={handleRunDiagnostics}
              onShowServerDetails={handleShowServerDetails}
              onViewLogs={() => {
                console.log("View logs for:", selectedNode);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
