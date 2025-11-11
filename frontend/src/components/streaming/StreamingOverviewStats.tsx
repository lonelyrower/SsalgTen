import React, { memo } from "react";
import type { StreamingOverview } from "@/types/streaming";
import { Card } from "../ui/card";
import { Server, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface StreamingOverviewStatsProps {
  overview: StreamingOverview;
}

interface StatsCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "error" | "info";
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subValue,
  icon,
  color,
}) => {
  const colorClasses = {
    primary: {
      bg: "bg-[hsl(var(--info))]/10",
      icon: "text-[hsl(var(--info))]",
      accent: "border-[hsl(var(--info))]/30",
    },
    success: {
      bg: "bg-[hsl(var(--success))]/10",
      icon: "text-[hsl(var(--success))]",
      accent: "border-[hsl(var(--success))]/30",
    },
    warning: {
      bg: "bg-[hsl(var(--warning))]/10",
      icon: "text-[hsl(var(--warning))]",
      accent: "border-[hsl(var(--warning))]/30",
    },
    error: {
      bg: "bg-[hsl(var(--error))]/10",
      icon: "text-[hsl(var(--error))]",
      accent: "border-[hsl(var(--error))]/30",
    },
    info: {
      bg: "bg-[hsl(var(--brand-cyan))]/10",
      icon: "text-[hsl(var(--brand-cyan))]",
      accent: "border-[hsl(var(--brand-cyan))]/30",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card
      className={`relative overflow-hidden surface-elevated border ${colors.accent} shadow-lg hover:shadow-xl transition-all duration-300 group`}
    >
      <div className="p-6">
        <div className="flex items-center">
          <div
            className={`flex-shrink-0 p-3 ${colors.bg} group-hover:scale-110 transition-transform duration-300`}
            style={{ borderRadius: 'var(--radius-xl)' }}
          >
            <div className={`${colors.icon}`}>{icon}</div>
          </div>
          <div className="ml-4 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {value}
            </p>
            {subValue && (
              <p className="text-sm text-muted-foreground mt-1">
                {subValue}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 装饰性渐变 */}
      <div
        className={`absolute top-0 right-0 w-16 h-16 ${colors.bg} opacity-20`}
        style={{ borderBottomLeftRadius: 'var(--radius-2xl)' }}
      ></div>
    </Card>
  );
};

export const StreamingOverviewStats: React.FC<StreamingOverviewStatsProps> = memo(({
  overview,
}) => {
  const formatTime = (isoString: string) => {
    try {
      return formatDistanceToNow(new Date(isoString), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  };

  // 根据解锁率确定颜色
  const unlockRateColor = overview.globalUnlockRate >= 80
    ? "success"
    : overview.globalUnlockRate >= 50
    ? "warning"
    : "error";

  // 根据过期节点数确定颜色
  const expiredColor = overview.expiredNodes === 0
    ? "success"
    : overview.expiredNodes <= 3
    ? "warning"
    : "error";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 总节点数 */}
      <StatsCard
        title="总节点数"
        value={overview.totalNodes}
        subValue="已配置的节点"
        icon={<Server className="h-6 w-6" />}
        color="primary"
      />

      {/* 全局解锁率 */}
      <StatsCard
        title="全局解锁率"
        value={`${Math.round(overview.globalUnlockRate)}%`}
        subValue="平均解锁成功率"
        icon={<TrendingUp className="h-6 w-6" />}
        color={unlockRateColor}
      />

      {/* 最新检测时间 */}
      <StatsCard
        title="最新检测时间"
        value={formatTime(overview.lastScanTime)}
        subValue={new Date(overview.lastScanTime).toLocaleString("zh-CN")}
        icon={<Clock className="h-6 w-6" />}
        color="info"
      />

      {/* 过期节点 */}
      <StatsCard
        title="数据过期节点"
        value={overview.expiredNodes}
        subValue="超过 24 小时未检测"
        icon={<AlertTriangle className="h-6 w-6" />}
        color={expiredColor}
      />
    </div>
  );
});
