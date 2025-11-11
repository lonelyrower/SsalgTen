import React, { useMemo } from "react";
import { Clock, Award } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";

interface UptimeRankingProps {
  nodes: NodeData[];
}

const formatUptime = (seconds: number): string => {
  if (!seconds) return "N/A";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    return `${days}天${hours}小时`;
  }
  return `${hours}小时`;
};

const calculateUptimePercentage = (
  uptime: number,
  createdAt: string,
): number => {
  if (!uptime || !createdAt) return 0;

  // 计算从创建到现在的总时间
  const now = new Date();
  const createdDate = new Date(createdAt);
  const totalSeconds = (now.getTime() - createdDate.getTime()) / 1000;

  // 如果总时间异常，返回0
  if (totalSeconds <= 0) return 0;

  // 如果uptime大于总时间，可能是时钟问题或数据异常，使用总时间作为上限
  const actualUptime = Math.min(uptime, totalSeconds);

  // 正常运行时间占比
  const percentage = (actualUptime / totalSeconds) * 100;
  return Math.max(0, Math.min(percentage, 100));
};

export const UptimeRanking: React.FC<UptimeRankingProps> = ({ nodes }) => {
  const topNodes = useMemo(() => {
    return nodes
      .filter((n) => n.status === "online" && n.uptime && n.uptime > 0)
      .map((node) => ({
        ...node,
        uptimePercent: calculateUptimePercentage(
          node.uptime || 0,
          node.createdAt || new Date().toISOString(),
        ),
      }))
      .sort((a, b) => (b.uptime || 0) - (a.uptime || 0))
      .slice(0, 8);
  }, [nodes]);

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border-2 border-[hsl(var(--success))]/30 surface-elevated shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-[hsl(var(--success))]/10 via-transparent to-[hsl(var(--success))]/5" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-[hsl(var(--success))]/20 blur-3xl" />
      <div className="relative mb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]">
              <Clock className="h-5 w-5" />
            </span>
            正常运行时间排行
          </h3>
          <div className="text-sm text-muted-foreground">
            Top {topNodes.length}
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {topNodes.length > 0 ? (
            topNodes.map((node, index) => (
              <div
                key={node.id}
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--success))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm transition-all hover:border-[hsl(var(--success))]/40"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {index < 3 ? (
                      <Award
                        className={`h-5 w-5 ${
                          index === 0
                            ? "text-[hsl(var(--warning))]"
                            : index === 1
                              ? "text-muted-foreground"
                              : "text-[hsl(var(--info))]"
                        }`}
                      />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground w-5">
                        #{index + 1}
                      </span>
                    )}
                  </div>
                  <CountryFlagSvg country={node.country} className="w-6 h-6" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {node.name}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex-1 h-2 bg-[hsl(var(--success))]/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(var(--success))]"
                          style={{
                            width: `${node.uptimePercent}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {node.uptimePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-bold text-[hsl(var(--success))] text-right">
                    {formatUptime(node.uptime || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 text-[hsl(var(--success))]/60" />
              <p>暂无正常运行时间数据</p>
            </div>
          )}
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="text-[hsl(var(--success))]">💡</span>
            <p>显示节点从创建以来的在线时间占比</p>
          </div>
        </div>
      </div>
    </div>
  );
};
