import React, { useMemo } from "react";
import { Building2, Award } from "lucide-react";
import type { NodeData } from "@/services/api";

interface ProviderDistributionProps {
  nodes: NodeData[];
}

export const ProviderDistribution: React.FC<ProviderDistributionProps> = ({
  nodes,
}) => {
  const providerStats = useMemo(() => {
    const providerMap = new Map<
      string,
      { online: number; offline: number; total: number }
    >();

    nodes.forEach((node) => {
      const provider = node.provider || "Unknown";
      const current = providerMap.get(provider) || {
        online: 0,
        offline: 0,
        total: 0,
      };

      if (node.status.toLowerCase() === "online") {
        current.online++;
      } else {
        current.offline++;
      }
      current.total++;

      providerMap.set(provider, current);
    });

    return Array.from(providerMap.entries())
      .map(([provider, stats]) => ({
        provider,
        online: stats.online,
        offline: stats.offline,
        total: stats.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [nodes]);

  return (
    <div className="group relative h-full overflow-hidden rounded-[var(--radius-2xl)] border-2 border-amber-200/60 dark:border-amber-700/60 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-slate-800 dark:via-amber-950/60 dark:to-orange-950/60 shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100 bg-gradient-to-br from-amber-400/15 via-transparent to-orange-500/15" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
            <Building2 className="h-5 w-5" />
          </span>
          服务商分布
        </h3>
        <div className="text-sm text-slate-500 dark:text-slate-300">
          Top {providerStats.length}
        </div>
      </div>

      <div className="relative space-y-3 flex-1 overflow-y-auto pr-1">
        {providerStats.map((item, index) => (
          <div
            key={item.provider}
            className="flex items-center justify-between rounded-xl border border-amber-100/70 dark:border-amber-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm transition-all hover:border-amber-200 dark:hover:border-amber-400/40"
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {item.provider}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 h-2 bg-amber-100/80 dark:bg-amber-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{
                        width: `${(item.online / item.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-3">
              <span className="text-xs font-semibold text-[hsl(var(--status-success-600))]">
                {item.online}
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-semibold text-rose-500">
                {item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
