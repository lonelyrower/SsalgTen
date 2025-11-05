import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { StreamingPlatformCards } from "@/components/streaming/StreamingPlatformCards";
import { StreamingNodeList } from "@/components/streaming/StreamingNodeList";
import { StreamingNodeTable } from "@/components/streaming/StreamingNodeTable";
import type {
  StreamingOverview,
  NodeStreamingSummary,
  StreamingFilters as FilterType,
  StreamingStatus,
} from "@/types/streaming";
import { STREAMING_DATA_EXPIRY_THRESHOLD, STREAMING_SERVICE_ORDER, STREAMING_SERVICES } from "@/types/streaming";
import { apiService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Grid, List, Film, Filter, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNotification } from "@/hooks/useNotification";

type ViewMode = "grid" | "list";

export const StreamingPage: React.FC = () => {
  const { showError, showSuccess } = useNotification();

  const [overview, setOverview] = useState<StreamingOverview | null>(null);
  const [nodes, setNodes] = useState<NodeStreamingSummary[]>([]);
  const [filters, setFilters] = useState<FilterType>({ showExpired: true });
  const [searchInput, setSearchInput] = useState<string>("");
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

      // 关键字搜索 - 使用 searchInput 而不是 filters.keyword
      if (searchInput) {
        const keyword = searchInput.toLowerCase();
        if (!node.nodeName.toLowerCase().includes(keyword)) {
          return false;
        }
      }

      // 过期数据筛选
      if (filters.showExpired === false) {
        const expiredFlag =
          typeof node.isExpired === "boolean"
            ? node.isExpired
            : (() => {
                if (!node.lastScanned) return true;
                try {
                  return (
                    new Date(node.lastScanned).getTime() <
                    Date.now() - STREAMING_DATA_EXPIRY_THRESHOLD
                  );
                } catch {
                  return true;
                }
              })();
        if (expiredFlag) {
          return false;
        }
      }

      return true;
    });
  }, [nodes, filters, searchInput]);

  // 加载数据
  // ��������
  const loadOverview = useCallback(async () => {
    try {
      const overviewRes = await apiService.getStreamingOverview();
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else if (overviewRes.error) {
        throw new Error(overviewRes.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "��ȡ��ý������ʧ��";
      setOverview((prev) => {
        if (prev) {
          return prev;
        }
        return {
          totalNodes: 0,
          lastScanTime: new Date().toISOString(),
          expiredNodes: 0,
          platformStats: STREAMING_SERVICE_ORDER.map((svc) => ({
            service: svc,
            name: STREAMING_SERVICES[svc]?.name ?? svc.toUpperCase(),
            icon: STREAMING_SERVICES[svc]?.icon ?? "",
            unlocked: 0,
            originalOnly: 0,
            pending: 0,
            restricted: 0,
            noPremium: 0,
            china: 0,
            appOnly: 0,
            webOnly: 0,
            idc: 0,
            failed: 0,
            unknown: 0,
            total: 0,
            unlockRate: 0,
          })),
          globalUnlockRate: 0,
        };
      });
      showError(message);
    }
  }, [showError]);

  const loadNodeSummaries = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        setError(null);
        if (!silent) {
          setLoading(true);
        }
        // 不传递任何筛选参数,获取所有数据,在前端进行筛选
        const nodesRes = await apiService.getStreamingNodeSummaries();
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
    },
    [showError],
  );

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const silent = !isInitialLoadRef.current;
    void loadNodeSummaries({ silent }).finally(() => {
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNodeSummaries]);

  useEffect(() => {
    setTestingMap({});
  }, [filters]);

  // 搜索只在前端进行,不触发API调用
  // (keyword字段仍然会被前端筛选逻辑使用,但不会传给后端)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadOverview(),
      loadNodeSummaries({ silent: true }),
    ]);
  }, [loadOverview, loadNodeSummaries]);

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
        await Promise.all([
          loadNodeSummaries({ silent: true }),
          loadOverview(),
        ]);
      } else {
        showError(resp.error || "触发流媒体检测失败");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "触发流媒体检测失败");
    } finally {
      setBulkTriggering(false);
    }
  }, [filteredNodes, loadNodeSummaries, loadOverview, showError, showSuccess]);

  const handleRetestNode = useCallback(
    async (nodeId: string) => {
      setTestingMap((prev) => ({ ...prev, [nodeId]: true }));
      try {
        const resp = await apiService.triggerStreamingTest(nodeId);
        if (resp.success) {
          showSuccess(resp.data?.message || "已触发节点流媒体检测");
          await Promise.all([
            loadNodeSummaries({ silent: true }),
            loadOverview(),
          ]);
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
    [loadNodeSummaries, loadOverview, showError, showSuccess],
  );

  const handleNavigateNode = useCallback(
    (nodeId: string) => {
      navigate(`/nodes?id=${nodeId}&tab=streaming`);
    },
    [navigate],
  );

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
        {/* Search and Filters - Enhanced Design */}
        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-lg p-4">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 rounded-2xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row gap-4">
            {/* Search input with enhanced styling */}
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
              <input
                type="text"
                placeholder="搜索节点名称..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:focus:border-cyan-400 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            {/* Action buttons group */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Country filter */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={filters.country || "all"}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      country: e.target.value === "all" ? undefined : e.target.value,
                    }))
                  }
                  className="bg-transparent focus:outline-none text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                  aria-label="筛选国家"
                >
                  <option value="all">全部国家</option>
                  {availableCountries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch test button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerAll}
                disabled={bulkTriggering || filteredNodes.length === 0}
                className="gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600"
              >
                <Film className={`h-4 w-4 ${bulkTriggering ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{bulkTriggering ? "检测中..." : "批量检测"}</span>
              </Button>

              {/* Refresh button */}
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{refreshing ? "刷新中..." : "刷新"}</span>
              </Button>

              {/* View mode toggle */}
              <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === "list"
                      ? "bg-cyan-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  title="列表视图"
                  aria-label="切换到列表视图"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === "grid"
                      ? "bg-cyan-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  title="卡片视图"
                  aria-label="切换到卡片视图"
                >
                  <Grid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>


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
            {/* 平台卡片 - 始终显示 */}
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
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchInput
                        ? `未找到匹配的节点 "${searchInput}"`
                        : "没有找到符合条件的节点"}
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
                    selectedService={filters.platform}
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
