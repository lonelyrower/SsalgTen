import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { ServicesTable } from "@/components/services/ServicesTable";
import { NodeServicesView } from "@/components/services/NodeServicesView";
import {
  SERVICE_DATA_EXPIRY_THRESHOLD,
  type NodeService,
  type NodeServicesOverview,
  type ServiceFilters as FilterType,
  type ServiceViewMode,
} from "@/types/services";
import { apiService } from "@/services/api";
import { useNotification } from "@/hooks/useNotification";
import { RefreshCw, LayoutGrid, Table as TableIcon, Search, Filter, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isBaseService } from "@/components/services/service-utils";

export const ServicesPage: React.FC = () => {
  const { showError } = useNotification();
  const navigate = useNavigate();

  const [services, setServices] = useState<NodeService[]>([]);
  const [nodeOverviews, setNodeOverviews] = useState<NodeServicesOverview[]>(
    [],
  );
  const [filters, setFilters] = useState<FilterType>({ showExpired: true });
  const [searchInput, setSearchInput] = useState<string>("");
  const [viewMode, setViewMode] = useState<ServiceViewMode>("list");
  const [showBasicServices, setShowBasicServices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取可用的节点列表
  const availableNodes = useMemo(() => {
    const nodes = new Map<string, string>();
    services.forEach((service) => {
      if (service.nodeName) {
        nodes.set(service.nodeId, service.nodeName);
      }
    });
    return Array.from(nodes.entries()).map(([id, name]) => ({ id, name }));
  }, [services]);

  const matchesServiceFilters = useCallback(
    (service: NodeService, now: number) => {
      const lastUpdatedTime = new Date(service.lastUpdated).getTime();
      const isExpired =
        Number.isFinite(lastUpdatedTime) &&
        now - lastUpdatedTime > SERVICE_DATA_EXPIRY_THRESHOLD;

      if (filters.nodeId && service.nodeId !== filters.nodeId) return false;
      if (filters.serviceType && service.type !== filters.serviceType)
        return false;
      if (filters.status) {
        if (filters.status === "failed" && service.status !== "unknown") {
          return false;
        }
        if (filters.status === "expired" && !isExpired) {
          return false;
        }
        if (
          filters.status !== "failed" &&
          filters.status !== "expired" &&
          service.status !== filters.status
        ) {
          return false;
        }
      }
      if (
        filters.deploymentType &&
        service.deploymentType !== filters.deploymentType
      )
        return false;
      if (
        filters.priority !== undefined &&
        service.priority !== filters.priority
      )
        return false;

      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const matchName = service.name.toLowerCase().includes(keyword);
        const matchDomain = service.access?.domain
          ?.toLowerCase()
          .includes(keyword);
        const matchPort = service.access?.port?.toString().includes(keyword);
        if (!matchName && !matchDomain && !matchPort) return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasTags = filters.tags.some((tag) => service.tags?.includes(tag));
        if (!hasTags) return false;
      }

      if (filters.showExpired === false && isExpired) return false;

      return true;
    },
    [filters],
  );

  // 筛选后的服务
  const filteredServices = useMemo(() => {
    const now = Date.now();
    return services.filter(
      (service) =>
        (showBasicServices || !isBaseService(service)) &&
        matchesServiceFilters(service, now),
    );
  }, [services, showBasicServices, matchesServiceFilters]);

  // 筛选后的节点视图
  const filteredNodeOverviews = useMemo(() => {
    if (viewMode !== "node") return [];
    const now = Date.now();
    return nodeOverviews
      .map((overview) => {
        const servicesForNode = overview.services.filter(
          (service) =>
            (showBasicServices || !isBaseService(service)) &&
            matchesServiceFilters(service, now),
        );

        const lastReportedIso =
          servicesForNode.length > 0
            ? servicesForNode[0].lastUpdated
            : overview.lastReported;
        const lastReportedTime = new Date(lastReportedIso).getTime();
        const isExpired =
          servicesForNode.length === 0 ||
          !Number.isFinite(lastReportedTime) ||
          now - lastReportedTime > SERVICE_DATA_EXPIRY_THRESHOLD;

        return {
          ...overview,
          services: servicesForNode,
          totalServices: servicesForNode.length,
          runningServices: servicesForNode.filter(
            (s) => s.status === "running",
          ).length,
          stoppedServices: servicesForNode.filter(
            (s) => s.status === "stopped",
          ).length,
          failedServices: servicesForNode.filter(
            (s) => s.status === "unknown",
          ).length,
          lastReported: lastReportedIso,
          isExpired,
        };
      })
      .filter((overview) => {
        if (filters.nodeId && overview.nodeId !== filters.nodeId) return false;
        if (filters.showExpired === false && overview.isExpired) return false;
        return true;
      });
  }, [
    nodeOverviews,
    filters,
    viewMode,
    showBasicServices,
    matchesServiceFilters,
  ]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [servicesRes, nodeRes] = await Promise.all([
        apiService.getAllServices(filters),
        apiService.getNodeServicesGrouped(),
      ]);

      if (servicesRes.success && servicesRes.data) {
        setServices(servicesRes.data);
      } else {
        throw new Error(servicesRes.error || "获取服务列表失败");
      }

      if (nodeRes.success && nodeRes.data) {
        setNodeOverviews(nodeRes.data);
      } else {
        throw new Error(nodeRes.error || "获取节点服务数据失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, keyword: searchInput || undefined }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleNodeClick = (nodeId: string) => {
    navigate(`/nodes?id=${nodeId}&tab=services`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 py-8 w-full">
            <LoadingSpinner size="lg" text="加载服务数据..." />
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 py-8 w-full">
            <ErrorState
              message={error || "无法加载数据"}
              onRetry={handleRefresh}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-6 w-full">
        {/* Search and Filters - Simplified */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="搜索服务名称、域名、端口..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>

            {/* Action buttons group */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Node filter - only show in list view or when there are multiple nodes */}
              {viewMode === "list" && availableNodes.length > 1 && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <select
                    value={filters.nodeId || "all"}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        nodeId: e.target.value === "all" ? undefined : e.target.value,
                      }))
                    }
                    className="bg-transparent focus:outline-none text-sm text-gray-900 dark:text-gray-100 cursor-pointer"
                    aria-label="筛选节点"
                  >
                    <option value="all">全部节点</option>
                    {availableNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Refresh button */}
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{refreshing ? "刷新中..." : "刷新"}</span>
              </Button>

              {/* Basic services toggle */}
              <Button
                onClick={() => setShowBasicServices((prev) => !prev)}
                variant={showBasicServices ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {showBasicServices ? "隐藏基础组件" : "显示基础组件"}
                </span>
              </Button>

              {/* View mode toggle */}
              <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-cyan-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  title="列表视图"
                  aria-label="切换到列表视图"
                >
                  <TableIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("node")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "node"
                      ? "bg-cyan-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  title="节点视图"
                  aria-label="切换到节点视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 服务内容 */}
        <div>

          {viewMode === "list" ? (
            filteredServices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    没有找到符合条件的服务
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ServicesTable
                services={filteredServices}
              />
            )
          ) : filteredNodeOverviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  没有找到符合条件的节点
                </p>
              </CardContent>
            </Card>
          ) : (
            <NodeServicesView
              nodeOverviews={filteredNodeOverviews}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
        </main>
      </div>
    </div>
  );
};
