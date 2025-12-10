import React from "react";
import {
  SERVICE_TYPE_CONFIG,
  type ServiceType,
  type ServicesOverviewStats as StatsType,
} from "@/types/services";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Server, Play, Square, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface ServicesOverviewStatsProps {
  stats: StatsType;
}

export const ServicesOverviewStats: React.FC<ServicesOverviewStatsProps> = ({
  stats,
}) => {
  const runningPercentage =
    stats.totalServices > 0
      ? Math.round((stats.runningServices / stats.totalServices) * 100)
      : 0;

  const lastUpdatedLabel = (() => {
    try {
      return formatDistanceToNow(new Date(stats.lastUpdated), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  })();

  const serviceTypeBadges = Object.entries(stats.servicesByType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => {
      const config = SERVICE_TYPE_CONFIG[type as ServiceType];
      return (
        <span
          key={type}
          className="px-2 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-xs font-medium"
        >
          {(config?.name ?? type) as string} · {count}
        </span>
      );
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总节点数 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Server className="h-4 w-4" />
              总节点数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[hsl(var(--foreground))]">
              {stats.totalNodes}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {stats.expiredNodes > 0 && (
                <span className="text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]">
                  {stats.expiredNodes} 个数据过期
                </span>
              )}
              {stats.expiredNodes === 0 && "全部节点正常"}
            </p>
          </CardContent>
        </Card>

        {/* 服务总量 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Server className="h-4 w-4" />
              服务总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[hsl(var(--foreground))]">
              {stats.totalServices}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              最近同步 {lastUpdatedLabel}
            </p>
          </CardContent>
        </Card>

        {/* 运行中 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Play className="h-4 w-4" />
              运行中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]">
              {stats.runningServices}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {runningPercentage}% 占比
            </p>
          </CardContent>
        </Card>

        {/* 停止 / 异常 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              <Square className="h-4 w-4" />
              停止 / 异常
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="text-2xl font-bold text-[hsl(var(--muted-foreground))]">
                  {stats.stoppedServices}
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  未运行的服务
                </p>
              </div>
              <div
                className={`text-2xl font-bold ${
                  stats.failedServices === 0
                    ? "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]"
                    : "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]"
                }`}
              >
                {stats.failedServices}
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              需要关注
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            类型分布
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          {serviceTypeBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">{serviceTypeBadges}</div>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">暂无服务数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
