import React, { memo } from "react";
import { Card } from "@/components/ui/card";
import {
  Activity,
  Globe,
  Server,
  Wifi,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "red" | "cyan" | "sky";
  trend?: "up" | "down" | "stable";
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subValue,
  change,
  changeLabel,
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
      bg: "bg-[hsl(var(--status-success-50))] dark:bg-[hsl(var(--status-success-900)/0.2)]",
      icon: "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]",
      accent: "border-[hsl(var(--status-success-200))] dark:border-[hsl(var(--status-success-800))]",
    },
    yellow: {
      bg: "bg-[hsl(var(--status-warning-50))] dark:bg-[hsl(var(--status-warning-900)/0.2)]",
      icon: "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]",
      accent: "border-[hsl(var(--status-warning-200))] dark:border-[hsl(var(--status-warning-800))]",
    },
    red: {
      bg: "bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)]",
      icon: "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]",
      accent: "border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-800))]",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      icon: "text-cyan-600 dark:text-cyan-400",
      accent: "border-cyan-200 dark:border-cyan-800",
    },
    sky: {
      bg: "bg-sky-50 dark:bg-sky-900/20",
      icon: "text-sky-600 dark:text-sky-400",
      accent: "border-sky-200 dark:border-sky-800",
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

        {(change !== undefined || changeLabel) && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              {change !== undefined && (
                <div
                  className={`flex items-center space-x-1 ${
                    change > 0
                      ? "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]"
                      : change < 0
                        ? "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <TrendingUp
                    className={`h-4 w-4 ${change < 0 ? "rotate-180" : ""}`}
                  />
                  <span className="font-medium">
                    {change > 0 ? "+" : ""}
                    {change}%
                  </span>
                </div>
              )}
              {changeLabel && (
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {changeLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 装饰性渐变 */}
      <div
        className={`absolute top-0 right-0 w-16 h-16 ${colors.bg} rounded-bl-full opacity-20`}
      ></div>
    </Card>
  );
};

interface EnhancedStatsProps {
  totalNodes: number;
  onlineNodes: number;
  totalCountries: number;
  totalProviders: number;
  className?: string;
}

export const EnhancedStats: React.FC<EnhancedStatsProps> = memo(
  ({
    totalNodes,
    onlineNodes,
    totalCountries,
    totalProviders,
    className = "",
  }) => {
    const offlineNodes = totalNodes - onlineNodes;
    const uptime =
      totalNodes > 0 ? Math.round((onlineNodes / totalNodes) * 100) : 0;

    return (
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}
      >
        <StatsCard
          title="总节点数"
          value={totalNodes}
          subValue={`${onlineNodes} 在线 • ${offlineNodes} 离线`}
          icon={<Server className="h-6 w-6" />}
          color="blue"
          /* 使用静态说明，避免展示不真实的环比数据 */
          change={undefined}
          changeLabel={undefined}
        />

        <StatsCard
          title="系统可用性"
          value={`${uptime}%`}
          subValue={uptime >= 95 ? "优秀" : uptime >= 90 ? "良好" : "需要关注"}
          icon={
            uptime >= 95 ? (
              <CheckCircle className="h-6 w-6" />
            ) : uptime >= 90 ? (
              <Activity className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )
          }
          color={uptime >= 95 ? "green" : uptime >= 90 ? "yellow" : "red"}
          change={undefined}
          changeLabel={undefined}
        />

        <StatsCard
          title="覆盖国家/地区"
          value={totalCountries}
          subValue={`分布在 ${totalCountries} 个国家/地区`}
          icon={<Globe className="h-6 w-6" />}
          color="cyan"
          trend="stable"
          changeLabel={undefined}
        />

        <StatsCard
          title="服务提供商"
          value={totalProviders}
          subValue={`${totalProviders} 个不同的云服务商`}
          icon={<Wifi className="h-6 w-6" />}
          color="sky"
          trend="up"
          changeLabel={undefined}
        />
      </div>
    );
  },
);
