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
  color: "primary" | "success" | "warning" | "error" | "info" | "brand";
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
    primary: {
      bg: "bg-[hsl(var(--primary))]/10",
      icon: "text-[hsl(var(--primary))]",
      accent: "border-[hsl(var(--primary))]/30",
      glow: "from-[hsl(var(--primary))]/10 via-transparent to-[hsl(var(--primary))]/5",
    },
    success: {
      bg: "bg-[hsl(var(--success))]/10",
      icon: "text-[hsl(var(--success))]",
      accent: "border-[hsl(var(--success))]/30",
      glow: "from-[hsl(var(--success))]/10 via-transparent to-[hsl(var(--success))]/5",
    },
    warning: {
      bg: "bg-[hsl(var(--warning))]/10",
      icon: "text-[hsl(var(--warning))]",
      accent: "border-[hsl(var(--warning))]/30",
      glow: "from-[hsl(var(--warning))]/10 via-transparent to-[hsl(var(--warning))]/5",
    },
    error: {
      bg: "bg-[hsl(var(--error))]/10",
      icon: "text-[hsl(var(--error))]",
      accent: "border-[hsl(var(--error))]/30",
      glow: "from-[hsl(var(--error))]/10 via-transparent to-[hsl(var(--error))]/5",
    },
    info: {
      bg: "bg-[hsl(var(--info))]/10",
      icon: "text-[hsl(var(--info))]",
      accent: "border-[hsl(var(--info))]/30",
      glow: "from-[hsl(var(--info))]/10 via-transparent to-[hsl(var(--info))]/5",
    },
    brand: {
      bg: "bg-[hsl(var(--brand-cyan))]/10",
      icon: "text-[hsl(var(--brand-cyan))]",
      accent: "border-[hsl(var(--brand-cyan))]/30",
      glow: "from-[hsl(var(--brand-cyan))]/10 via-transparent to-[hsl(var(--brand-cyan))]/5",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card
      className={`relative overflow-hidden surface-elevated border ${colors.accent} shadow-lg hover:shadow-xl transition-all duration-300 group`}
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
            className={`flex-shrink-0 p-3 ${colors.bg} group-hover:scale-110 transition-transform duration-300 border border-border/60 shadow-sm`}
            style={{ borderRadius: 'var(--radius-md)' }}
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

        {(change !== undefined || changeLabel) && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              {change !== undefined && (
                <div
                  className={`flex items-center space-x-1 font-semibold ${
                    change > 0
                      ? "text-[hsl(var(--success))]"
                      : change < 0
                        ? "text-[hsl(var(--error))]"
                        : "text-muted-foreground"
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
                <span className="text-muted-foreground text-xs">
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
          color="primary"
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
          color={uptime >= 95 ? "success" : uptime >= 90 ? "warning" : "error"}
          change={undefined}
          changeLabel={undefined}
        />

        <StatsCard
          title="覆盖国家/地区"
          value={totalCountries}
          subValue={`分布在 ${totalCountries} 个国家/地区`}
          icon={<Globe className="h-6 w-6" />}
          color="info"
          trend="stable"
          changeLabel={undefined}
        />

        <StatsCard
          title="服务提供商"
          value={totalProviders}
          subValue={`${totalProviders} 个不同的云服务商`}
          icon={<Wifi className="h-6 w-6" />}
          color="brand"
          trend="up"
          changeLabel={undefined}
        />
      </div>
    );
  },
);
