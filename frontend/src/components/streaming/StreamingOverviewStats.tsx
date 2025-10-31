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
  color: "blue" | "green" | "yellow" | "red" | "cyan";
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subValue,
  icon,
  color,
}) => {
  const colorClasses = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      icon: "text-blue-600 dark:text-blue-400",
      accent: "border-blue-200 dark:border-blue-800",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      icon: "text-green-600 dark:text-green-400",
      accent: "border-green-200 dark:border-green-800",
    },
    yellow: {
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      icon: "text-yellow-600 dark:text-yellow-400",
      accent: "border-yellow-200 dark:border-yellow-800",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-900/20",
      icon: "text-red-600 dark:text-red-400",
      accent: "border-red-200 dark:border-red-800",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      icon: "text-cyan-600 dark:text-cyan-400",
      accent: "border-cyan-200 dark:border-cyan-800",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card
      className={`relative overflow-hidden bg-white dark:bg-gray-800 border ${colors.accent} shadow-lg hover:shadow-xl transition-all duration-300 group`}
    >
      <div className="p-6">
        <div className="flex items-center">
          <div
            className={`flex-shrink-0 p-3 rounded-xl ${colors.bg} group-hover:scale-110 transition-transform duration-300`}
          >
            <div className={`${colors.icon}`}>{icon}</div>
          </div>
          <div className="ml-4 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {value}
            </p>
            {subValue && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {subValue}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 装饰性渐变 */}
      <div
        className={`absolute top-0 right-0 w-16 h-16 ${colors.bg} rounded-bl-full opacity-20`}
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
    ? "green"
    : overview.globalUnlockRate >= 50
    ? "yellow"
    : "red";

  // 根据过期节点数确定颜色
  const expiredColor = overview.expiredNodes === 0
    ? "green"
    : overview.expiredNodes <= 3
    ? "yellow"
    : "red";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 总节点数 */}
      <StatsCard
        title="总节点数"
        value={overview.totalNodes}
        subValue="已配置的节点"
        icon={<Server className="h-6 w-6" />}
        color="blue"
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
        color="cyan"
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
