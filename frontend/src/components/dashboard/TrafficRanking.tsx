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
    <div className="group relative h-full overflow-hidden rounded-2xl border-2 border-sky-200/60 dark:border-sky-700/60 bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-slate-800 dark:via-sky-950/60 dark:to-blue-950/60 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-sky-400/15 via-transparent to-blue-500/15" />
      <div className="absolute -top-12 -right-16 h-28 w-28 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">
            <TrendingUp className="h-5 w-5" />
          </span>
          流量排行
        </h3>
        <div className="text-sm text-slate-500 dark:text-slate-300">
          Top {topNodes.length}
        </div>
      </div>

      <div className="relative space-y-3 flex-1 overflow-y-auto pr-1">
        {topNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <p className="text-sm">暂无流量数据</p>
          </div>
        ) : (
          topNodes.map((node, index) => (
          <div
            key={node.id}
            className="flex items-center justify-between rounded-xl border border-sky-100/70 dark:border-sky-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm transition-all hover:border-sky-200 dark:hover:border-sky-400/40"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                {index < 3 ? (
                  <Award
                    className={`h-5 w-5 ${
                      index === 0
                        ? "text-yellow-500"
                        : index === 1
                          ? "text-gray-400"
                            : "text-orange-600"
                    }`}
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-5">
                    #{index + 1}
                  </span>
                )}
              </div>
              <CountryFlagSvg country={node.country} className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {node.name}
                </p>
                <div className="flex items-center justify-center space-x-2 mt-1 text-xs text-slate-500 dark:text-slate-300">
                  <span className="flex items-center">
                    <ArrowUp className="h-3 w-3 mr-0.5 text-[hsl(var(--status-success-500))]" />
                    {formatBytes(node.upload)}
                  </span>
                  <span className="flex items-center">
                    <ArrowDown className="h-3 w-3 mr-0.5 text-blue-500" />
                    {formatBytes(node.download)}
                  </span>
                </div>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-blue-600 dark:text-blue-300">
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
