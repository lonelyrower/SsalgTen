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
    <div className="group relative h-full overflow-hidden rounded-2xl border-2 border-[hsl(var(--warning))]/30 surface-elevated shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-[hsl(var(--warning))]/10 via-transparent to-[hsl(var(--warning))]/5" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-[hsl(var(--warning))]/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">
            <Building2 className="h-5 w-5" />
          </span>
          服务商分布
        </h3>
        <div className="text-sm text-muted-foreground">
          Top {providerStats.length}
        </div>
      </div>

      <div className="relative space-y-3 flex-1 overflow-y-auto pr-1">
        {providerStats.map((item, index) => (
          <div
            key={item.provider}
            className="flex items-center justify-between rounded-xl border border-[hsl(var(--warning))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm transition-all hover:border-[hsl(var(--warning))]/40"
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.provider}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 h-2 bg-[hsl(var(--success))]/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[hsl(var(--success))]"
                      style={{
                        width: `${(item.online / item.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-3">
              <span className="text-xs font-semibold text-[hsl(var(--success))]">
                {item.online}
              </span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs font-semibold text-foreground">
                {item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
