import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { StreamingOverviewStats } from "@/components/streaming/StreamingOverviewStats";
import { StreamingPlatformCards } from "@/components/streaming/StreamingPlatformCards";
import { StreamingNodeList } from "@/components/streaming/StreamingNodeList";
import { StreamingNodeTable } from "@/components/streaming/StreamingNodeTable";
import type {
  StreamingOverview,
  NodeStreamingSummary,
  StreamingFilters as FilterType,
  StreamingStatus,
} from "@/types/streaming";
import { STREAMING_SERVICE_ORDER } from "@/types/streaming";
import { apiService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Grid, List, Film, Filter, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNotification } from "@/hooks/useNotification";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        {/* 操作和筛选栏 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 左侧：搜索和筛选 */}
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              {/* 搜索框 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索节点名称..."
                  value={filters.keyword || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, keyword: e.target.value }))
                  }
                  className="w-full pl-10 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
                {filters.keyword && (
                  <button
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, keyword: "" }))
                    }
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* 国家筛选 */}
              <Select
                value={filters.country || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    country: value === "all" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="选择国家" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部国家</SelectItem>
                  {availableCountries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 状态筛选 */}
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value === "all" ? undefined : (value as StreamingStatus),
                  }))
                }
              >
                <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="yes">完全解锁</SelectItem>
                  <SelectItem value="no">区域限制</SelectItem>
                  <SelectItem value="failed">检测失败</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-3">
              {/* 视图切换 */}
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title="表格视图"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title="卡片视图"
                >
                  <Grid className="h-4 w-4" />
                </button>
              </div>

              {/* 手动检测 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerAll}
                disabled={bulkTriggering || filteredNodes.length === 0}
                className="gap-2"
              >
                <Film
                  className={`h-4 w-4 ${bulkTriggering ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {bulkTriggering ? "检测中..." : "批量检测"}
                </span>
              </Button>

              {/* 导出 */}
              <div className="relative group">
                <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm text-sm">
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {refreshing ? "刷新中..." : "刷新"}
                </span>
              </button>
            </div>
          </div>

          {/* 当前筛选条件提示 */}
          {(filters.platform || filters.country || filters.status || filters.keyword) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">当前筛选:</span>
              {filters.platform && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                  平台: {filters.platform}
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, platform: undefined }))}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.country && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                  国家: {filters.country}
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, country: undefined }))}
                    className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                  状态: {filters.status}
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, status: undefined }))}
                    className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.keyword && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm">
                  关键字: {filters.keyword}
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, keyword: undefined }))}
                    className="hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => setFilters({ showExpired: true })}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                清除全部
              </button>
            </div>
          )}
        </div>

        {/* 总览统计 */}
        <StreamingOverviewStats overview={overview} />

        {/* 如果完全没有数据，显示友好提示 */}
        {nodes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Film className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                暂无流媒体检测数据
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                系统还未收集到流媒体解锁数据。请确保：
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-left max-w-md mx-auto space-y-2">
                <li>• Agent 已正常启动并连接到主服务器</li>
                <li>• Agent 会在启动后 1 分钟内执行首次检测</li>
                <li>• 之后每 24 小时自动执行一次检测</li>
                <li>• 也可以点击"批量检测"按钮手动触发检测</li>
              </ul>
              {overview.totalNodes > 0 && (
                <Button
                  onClick={handleTriggerAll}
                  disabled={bulkTriggering}
                  className="gap-2"
                >
                  <Film className={`h-4 w-4 ${bulkTriggering ? "animate-spin" : ""}`} />
                  {bulkTriggering ? "检测中..." : "立即开始检测"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 平台卡片 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                平台统计（点击筛选）
              </h3>
              <StreamingPlatformCards
                stats={[...overview.platformStats].sort(
                  (a, b) =>
                    STREAMING_SERVICE_ORDER.indexOf(a.service) -
                    STREAMING_SERVICE_ORDER.indexOf(b.service),
                )}
                onSelect={(service) =>
                  setFilters((prev) => ({
                    ...prev,
                    platform: prev.platform === service ? undefined : service,
                  }))
                }
                selectedService={filters.platform}
              />
            </div>

            {/* 节点列表 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  节点解锁详情
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({filteredNodes.length} 个节点)
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
          </>
        )}
        </main>
      </div>
    </div>
  );
};
