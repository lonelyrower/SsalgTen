import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { StreamingOverviewStats } from "@/components/streaming/StreamingOverviewStats";
import { StreamingStatusLegend } from "@/components/streaming/StreamingStatusLegend";
import { StreamingPlatformMatrix } from "@/components/streaming/StreamingPlatformMatrix";
import { StreamingNodeList } from "@/components/streaming/StreamingNodeList";
import { StreamingNodeTable } from "@/components/streaming/StreamingNodeTable";
import { StreamingFilters } from "@/components/streaming/StreamingFilters";
import type {
  StreamingOverview,
  NodeStreamingSummary,
  StreamingFilters as FilterType,
} from "@/types/streaming";
import { STREAMING_SERVICE_ORDER } from "@/types/streaming";
import { apiService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Grid, List, Film } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNotification } from "@/hooks/useNotification";

type ViewMode = "grid" | "list";

export const StreamingPage: React.FC = () => {
  const { showError, showSuccess } = useNotification();

  const [overview, setOverview] = useState<StreamingOverview | null>(null);
  const [nodes, setNodes] = useState<NodeStreamingSummary[]>([]);
  const [filters, setFilters] = useState<FilterType>({ showExpired: true });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkTriggering, setBulkTriggering] = useState(false);
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();

  // 获取可用的国家列表
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    nodes.forEach((node) => countries.add(node.country));
    return Array.from(countries).sort();
  }, [nodes]);

  // 筛选后的节点
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // 平台筛选
      if (filters.platform) {
        const hasService = node.services.some(
          (s) => s.service === filters.platform,
        );
        if (!hasService) return false;
      }

      // 状态筛选
      if (filters.status) {
        const hasStatus = node.services.some(
          (s) => s.status === filters.status,
        );
        if (!hasStatus) return false;
      }

      // 国家筛选
      if (filters.country && node.country !== filters.country) {
        return false;
      }

      // 解锁区域筛选
      if (filters.region) {
        const hasRegion = node.services.some((s) =>
          s.region?.toLowerCase().includes(filters.region!.toLowerCase()),
        );
        if (!hasRegion) return false;
      }

      // 关键字搜索
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        if (!node.nodeName.toLowerCase().includes(keyword)) {
          return false;
        }
      }

      // 过期数据筛选
      if (filters.showExpired === false && node.isExpired) {
        return false;
      }

      return true;
    });
  }, [nodes, filters]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, nodesRes] = await Promise.all([
        apiService.getStreamingOverview(),
        apiService.getStreamingNodeSummaries(filters),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else {
        throw new Error(overviewRes.error || "获取流媒体总览失败");
      }

      if (nodesRes.success && nodesRes.data) {
        setNodes(nodesRes.data);
      } else {
        throw new Error(nodesRes.error || "获取节点数据失败");
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

  useEffect(() => {
    setTestingMap({});
  }, [filters]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleTriggerAll = useCallback(async () => {
    const nodeIds = filteredNodes.map((node) => node.nodeId);
    if (nodeIds.length === 0) {
      showError("当前筛选条件下没有可检测的节点");
      return;
    }
    try {
      setBulkTriggering(true);
      const resp = await apiService.triggerBulkStreamingTest(nodeIds);
      if (resp.success) {
        const queued = resp.data?.queued ?? nodeIds.length;
        const total = resp.data?.total ?? nodeIds.length;
        const failureCount = resp.data?.failures?.length ?? 0;
        const baseMessage =
          resp.message ||
          resp.data?.message ||
          `已触发 ${queued}/${total} 个节点的检测`;
        const finalMessage =
          failureCount > 0
            ? `${baseMessage}，失败 ${failureCount} 个`
            : baseMessage;
        showSuccess(finalMessage);
        await loadData();
      } else {
        showError(resp.error || "触发流媒体检测失败");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "触发流媒体检测失败");
    } finally {
      setBulkTriggering(false);
    }
  }, [filteredNodes, loadData, showError, showSuccess]);

  const handleRetestNode = useCallback(
    async (nodeId: string) => {
      setTestingMap((prev) => ({ ...prev, [nodeId]: true }));
      try {
        const resp = await apiService.triggerStreamingTest(nodeId);
        if (resp.success) {
          showSuccess(resp.data?.message || "已触发节点流媒体检测");
          await loadData();
        } else {
          showError(resp.error || "触发节点检测失败");
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : "触发节点检测失败");
      } finally {
        setTestingMap((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
      }
    },
    [loadData, showError, showSuccess],
  );

  const handleNavigateNode = useCallback(
    (nodeId: string) => {
      navigate(`/nodes?id=${nodeId}&tab=streaming`);
    },
    [navigate],
  );
  const handleExport = async (format: "json" | "csv" | "markdown") => {
    try {
      const result = await apiService.exportStreamingData(format, filters);
      if (result.success && result.data) {
        const url = URL.createObjectURL(result.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName || `streaming-export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess("导出成功");
      } else {
        throw new Error(result.error || "导出失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      showError(message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 py-8 w-full">
            <LoadingSpinner size="lg" text="加载流媒体数据..." />
          </main>
        </div>
      </div>
    );
  }

  if (error || !overview) {
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
        {/* 页面标题 */}
        <PageHeader
          title="流媒体解锁"
          description={`监控节点流媒体服务解锁状态 - 共 ${overview.totalNodes} 个节点`}
          icon={Film}
          actions={
            <>
              {/* 视图切换 */}
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title="网格视图"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title="列表视图"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleTriggerAll}
                disabled={bulkTriggering || filteredNodes.length === 0}
              >
                <Film
                  className={`h-4 w-4 ${bulkTriggering ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {bulkTriggering ? "检测中..." : "手动检测"}
                </span>
              </Button>

              {/* 导出 */}
              <div className="relative group">
                <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">导出</span>
                </button>
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport("json")}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport("csv")}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg"
                  >
                    Markdown
                  </button>
                </div>
              </div>

              {/* 刷新 */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {refreshing ? "刷新中..." : "刷新"}
                </span>
              </button>
            </>
          }
        />

        {/* 总览统计 */}
        <StreamingOverviewStats overview={overview} />

        {/* 状态说明 & 平台统计矩阵 */}
        <div className="space-y-4">
          <StreamingStatusLegend />
          <StreamingPlatformMatrix
            stats={[...overview.platformStats].sort(
              (a, b) =>
                STREAMING_SERVICE_ORDER.indexOf(a.service) -
                STREAMING_SERVICE_ORDER.indexOf(b.service),
            )}
          />
        </div>

        {/* 筛选器 */}
        <StreamingFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableCountries={availableCountries}
        />

        {/* 节点列表 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              节点列表
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                (共 {filteredNodes.length} 个节点)
              </span>
            </h2>
          </div>

          {filteredNodes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  没有找到符合条件的节点
                </p>
              </CardContent>
            </Card>
          ) : (
            viewMode === "grid" ? (
              <StreamingNodeList
                nodes={filteredNodes}
                onRetest={handleRetestNode}
                testingMap={testingMap}
              />
            ) : (
              <StreamingNodeTable
                nodes={filteredNodes}
                services={STREAMING_SERVICE_ORDER}
                onRetest={handleRetestNode}
                testingMap={testingMap}
                onNodeClick={handleNavigateNode}
              />
            )
          )}
        </div>
        </main>
      </div>
    </div>
  );
};
