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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Building2 className="h-5 w-5 mr-2 text-primary" />
          服务商分布
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top {providerStats.length}
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {providerStats.map((item, index) => (
          <div
            key={item.provider}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-5">
                    #{index + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.provider}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
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
              <span className="text-xs text-green-600 font-semibold">
                {item.online}
              </span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-red-600 font-semibold">
                {item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
