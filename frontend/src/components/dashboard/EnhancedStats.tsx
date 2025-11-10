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
      bg: "bg-blue-50 dark:bg-blue-900/30",
      icon: "text-blue-600 dark:text-blue-300",
      accent: "border-blue-200/70 dark:border-blue-600/50",
      glow: "from-blue-400/20 to-blue-500/10",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/30",
      icon: "text-green-600 dark:text-green-300",
      accent: "border-green-200/70 dark:border-green-600/50",
      glow: "from-green-400/20 to-green-500/10",
    },
    yellow: {
      bg: "bg-yellow-50 dark:bg-yellow-900/30",
      icon: "text-yellow-600 dark:text-yellow-300",
      accent: "border-yellow-200/70 dark:border-yellow-600/50",
      glow: "from-yellow-400/20 to-yellow-500/10",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-900/30",
      icon: "text-red-600 dark:text-red-300",
      accent: "border-red-200/70 dark:border-red-600/50",
      glow: "from-red-400/20 to-red-500/10",
    },
    cyan: {
      bg: "bg-cyan-50 dark:bg-cyan-900/30",
      icon: "text-cyan-600 dark:text-cyan-300",
      accent: "border-cyan-200/70 dark:border-cyan-600/50",
      glow: "from-cyan-400/20 to-cyan-500/10",
    },
    sky: {
      bg: "bg-sky-50 dark:bg-sky-900/30",
      icon: "text-sky-600 dark:text-sky-300",
      accent: "border-sky-200/70 dark:border-sky-600/50",
      glow: "from-sky-400/20 to-sky-500/10",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card
      className={`relative overflow-hidden bg-white dark:bg-gray-900 border shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-xl)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 group cursor-pointer ${colors.accent}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        borderWidth: 'var(--border-width-thin)',
      }}
    >
      {/* 悬停光晕效果 */}
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${colors.glow}`}
        style={{ borderRadius: 'var(--radius-lg)' }}
      />

      {/* 装饰性光点 */}
      <div
        className={`absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-15 group-hover:opacity-25 transition-opacity duration-300 ${colors.bg}`}
      />

      <div style={{ padding: 'var(--card-padding-lg)' }}>
        <div className="flex items-center">
          <div
            className={`flex-shrink-0 p-3 ${colors.bg} group-hover:scale-110 transition-transform duration-300 border border-white/60 dark:border-white/10 shadow-sm`}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className={`${colors.icon}`}>{icon}</div>
          </div>
          <div className="ml-4 flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 transition-transform duration-300 group-hover:scale-105 tabular-nums">
              {value}
            </p>
            {subValue && (
              <p className="text-sm font-medium text-gray-500 dark:text-gray-300 mt-1.5">
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
                  className={`flex items-center space-x-1 font-semibold ${
                    change > 0
                      ? "text-green-600 dark:text-green-300"
                      : change < 0
                        ? "text-red-600 dark:text-red-300"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <TrendingUp
                    className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${change < 0 ? "rotate-180" : ""}`}
                  />
                  <span className="font-bold">
                    {change > 0 ? "+" : ""}
                    {change}%
                  </span>
                </div>
              )}
              {changeLabel && (
                <span className="text-gray-500 dark:text-gray-300 text-xs font-medium">
                  {changeLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部装饰线 */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
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
