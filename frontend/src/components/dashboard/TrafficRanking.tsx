import React, { useMemo } from "react";
import { TrendingUp, ArrowUp, ArrowDown, Award } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";

interface TrafficRankingProps {
  nodes: NodeData[];
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const TrafficRanking: React.FC<TrafficRankingProps> = ({ nodes }) => {
  const topNodes = useMemo(() => {
    // 过滤出有流量数据的节点并计算总流量
    const nodesWithTraffic = nodes
      .filter((n) => n.status === "online")
      .map((node) => {
        const upload = Number(node.totalUpload || node.periodUpload || 0);
        const download = Number(node.totalDownload || node.periodDownload || 0);
        const totalTraffic = upload + download;

        return {
          ...node,
          upload,
          download,
          totalTraffic,
        };
      })
      .filter((n) => n.totalTraffic > 0) // 只显示有流量的节点
      .sort((a, b) => b.totalTraffic - a.totalTraffic)
      .slice(0, 8);

    return nodesWithTraffic;
  }, [nodes]);

  return (
    <div className="group relative h-full overflow-hidden rounded-[var(--radius-2xl)] border-2 border-[hsl(var(--status-info-200))]/60 dark:border-[hsl(var(--status-info-400))]/60 bg-gradient-to-br from-[hsl(var(--status-info-50))] via-[hsl(var(--card))] to-[hsl(var(--status-info-100))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--status-info-50))]/60 dark:to-[hsl(var(--status-info-100))]/60 shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100 bg-gradient-to-br from-[hsl(var(--status-info-400))]/15 via-transparent to-[hsl(var(--status-info-300))]/15" />
      <div className="absolute -top-12 -right-16 h-28 w-28 rounded-full bg-[hsl(var(--status-info-300))]/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--status-info-500))]/15 text-[hsl(var(--status-info-600))] dark:bg-[hsl(var(--status-info-400))]/20 dark:text-[hsl(var(--status-info-600))]">
            <TrendingUp className="h-5 w-5" />
          </span>
          流量排行
        </h3>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          Top {topNodes.length}
        </div>
      </div>

      <div className="relative space-y-3 flex-1 overflow-y-auto pr-1">
        {topNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))]">
            <p className="text-sm">暂无流量数据</p>
          </div>
        ) : (
          topNodes.map((node, index) => (
          <div
            key={node.id}
            className="flex items-center justify-between rounded-xl border border-[hsl(var(--status-info-200))]/70 dark:border-[hsl(var(--status-info-200))]/40 bg-[hsl(var(--card))]/80 dark:bg-[hsl(var(--card))]/50 px-3.5 py-3 backdrop-blur-sm transition-all hover:border-[hsl(var(--status-info-300))] dark:hover:border-[hsl(var(--status-info-400))]/40"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                {index < 3 ? (
                  <Award
                    className={`h-5 w-5 ${
                      index === 0
                        ? "text-[hsl(var(--status-warning-500))]"
                        : index === 1
                          ? "text-[hsl(var(--muted-foreground))]"
                            : "text-[hsl(var(--status-warning-600))]"
                    }`}
                  />
                ) : (
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] w-5">
                    #{index + 1}
                  </span>
                )}
              </div>
              <CountryFlagSvg country={node.country} className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                  {node.name}
                </p>
                <div className="flex items-center justify-center space-x-2 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center">
                    <ArrowUp className="h-3 w-3 mr-0.5 text-[hsl(var(--status-success-500))]" />
                    {formatBytes(node.upload)}
                  </span>
                  <span className="flex items-center">
                    <ArrowDown className="h-3 w-3 mr-0.5 text-[hsl(var(--status-info-500))]" />
                    {formatBytes(node.download)}
                  </span>
                </div>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-[hsl(var(--status-info-600))] dark:text-[hsl(var(--status-info-600))]">
                {formatBytes(node.totalTraffic)}
              </p>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
};
