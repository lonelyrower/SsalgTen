import React, { useState, useEffect } from "react";
import { apiService, type SystemOverviewData } from "@/services/api";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/hooks/useNotification";
import {
  Activity,
  Server,
  Database,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap,
  HardDrive,
  Trash2,
} from "lucide-react";

export const SystemOverview: React.FC = () => {
  const [stats, setStats] = useState<SystemOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [retainHours, setRetainHours] = useState<number>(24);

  const { addNotification } = useNotification();

  const cleanupOptions = [
    { value: 0, label: "清除全部历史心跳" },
    { value: 24, label: "保留最近 24 小时" },
    { value: 72, label: "保留最近 3 天" },
    { value: 168, label: "保留最近 7 天" },
  ];

  const fetchStats = async () => {
    try {
      setError(null);

      // 使用统一的系统概览API
      const response = await apiService.getSystemOverview();

      if (response.success && response.data) {
        setStats(response.data);
        setLastUpdate(new Date());
      } else {
        setError(response.error || "获取系统概览数据失败");
      }
    } catch (err) {
      console.error("Failed to fetch system overview:", err);
      setError("网络错误，无法获取系统概览");
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (cleanupLoading) return;

    const confirmMessage =
      retainHours && retainHours > 0
        ? `确认删除 ${retainHours} 小时前的心跳记录吗？此操作不可撤销。`
        : "确认清空所有历史心跳记录吗？此操作不可撤销。";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setCleanupLoading(true);
    try {
      const response = await apiService.cleanupHeartbeatLogs(
        retainHours && retainHours > 0 ? retainHours : undefined,
      );

      if (response.success) {
        addNotification({
          type: "success",
          title: "清理完成",
          message:
            response.message ||
            `已删除 ${response.data?.deleted ?? 0} 条心跳记录`,
        });
        await fetchStats();
      } else {
        addNotification({
          type: "error",
          title: "清理失败",
          message: response.error || "无法清理心跳记录，请稍后再试",
        });
      }
    } catch (err) {
      console.error("Cleanup heartbeat logs error:", err);
      addNotification({
        type: "error",
        title: "清理失败",
        message: "服务器请求失败，请稍后再试",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // 调整为每1分钟自动刷新，使运行时间更贴近实际
    const interval = setInterval(fetchStats, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} 天 ${hours} 小时`;
    if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  };

  const getHealthStatus = () => {
    if (!stats) return "unknown";
    const { nodes } = stats;
    const totalNodes = nodes.totalNodes;
    const onlineNodes = nodes.onlineNodes;

    if (totalNodes === 0) return "warning";
    const onlineRate = (onlineNodes / totalNodes) * 100;

    if (onlineRate >= 90) return "excellent";
    if (onlineRate >= 70) return "good";
    if (onlineRate >= 50) return "warning";
    return "critical";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard variant="danger" hover={false} className="text-center">
        <AlertCircle className="h-12 w-12 text-[hsl(var(--status-error-500))] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[hsl(var(--status-error-800))] dark:text-[hsl(var(--status-error-200))] mb-2">
          数据加载失败
        </h3>
        <p className="text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-300))] mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重新加载
        </Button>
      </GlassCard>
    );
  }

  if (!stats) return null;

  const healthStatus = getHealthStatus();
  const getHealthVariant = (status: string): "success" | "info" | "warning" | "danger" | "default" => {
    switch (status) {
      case "excellent":
        return "success";
      case "good":
        return "info";
      case "warning":
        return "warning";
      case "critical":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-8">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            系统统计总览
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            实时监控系统运行状况和关键指标
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              更新时间: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统健康状态卡片 */}
      <GlassCard variant={getHealthVariant(healthStatus)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-white/50 dark:bg-black/20">
              {healthStatus === "excellent" || healthStatus === "good" ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <AlertCircle className="h-8 w-8" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                系统健康状态:{" "}
                {healthStatus === "excellent"
                  ? "优秀"
                  : healthStatus === "good"
                    ? "良好"
                    : healthStatus === "warning"
                      ? "警告"
                      : healthStatus === "critical"
                        ? "严重"
                        : "未知"}
              </h3>
              <p className="opacity-80">
                {stats.nodes.onlineNodes}/{stats.nodes.totalNodes} 节点在线 (
                {stats.nodes.totalNodes > 0
                  ? (
                      (stats.nodes.onlineNodes / stats.nodes.totalNodes) *
                      100
                    ).toFixed(1)
                  : 0}
                %)
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">系统运行时间</div>
            <div className="text-lg font-semibold">
              {formatUptime(
                (stats.system.dbUptime ?? stats.system.uptime) || 0,
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 核心监控卡片 - 2列2行布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 节点统计 */}
        <GlassCard variant="info">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                节点总数
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.nodes.totalNodes}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              在线 {stats.nodes.onlineNodes}
            </span>
            <span className="flex items-center text-red-600 dark:text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              离线 {stats.nodes.offlineNodes}
            </span>
          </div>
        </GlassCard>

        {/* 心跳统计 */}
        <GlassCard variant="success">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                24小时心跳
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.heartbeats.last24h.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            平均 {stats.heartbeats.avgPerHour}/小时
          </div>
        </GlassCard>

        {/* 内存使用 */}
        <GlassCard variant="purple">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                内存使用
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.resources.memoryPercent}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <HardDrive className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Database className="h-4 w-4 mr-1" />
            {stats?.resources.memoryUsedMB}MB / {stats?.resources.memoryTotalMB}
            MB
          </div>
        </GlassCard>

        {/* CPU使用 */}
        <GlassCard variant="orange">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                CPU使用率
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.resources.cpuPercent}%
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Activity className="h-4 w-4 mr-1" />
            进程负载
          </div>
        </GlassCard>

        {/* 历史心跳清理 */}
        <GlassCard variant="warning" className="md:col-span-2" hover={false}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  历史心跳清理
                </h3>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                手动清理历史心跳记录，确保每个节点仅保留最新数据
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                className="min-w-[180px] px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-md)] bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                value={retainHours}
                onChange={(e) => setRetainHours(Number(e.target.value))}
                disabled={cleanupLoading}
              >
                {cleanupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant="destructive"
                size="sm"
                className="sm:min-w-[150px]"
                onClick={handleCleanup}
                disabled={cleanupLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {cleanupLoading ? "清理中..." : "立即清理"}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
