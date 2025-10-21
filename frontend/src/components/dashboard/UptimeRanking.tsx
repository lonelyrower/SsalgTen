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

const calculateUptimePercentage = (uptime: number, lastSeen: string): number => {
  if (!uptime || !lastSeen) return 0;

  // 计算从创建到现在的时间
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const totalSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000 + uptime;

  // 正常运行时间占比
  return Math.min((uptime / totalSeconds) * 100, 100);
};

export const UptimeRanking: React.FC<UptimeRankingProps> = ({ nodes }) => {
  const topNodes = useMemo(() => {
    return nodes
      .filter((n) => n.status === "online" && n.uptime && n.uptime > 0)
      .map((node) => ({
        ...node,
        uptimePercent: calculateUptimePercentage(
          node.uptime || 0,
          node.lastSeen || new Date().toISOString(),
        ),
      }))
      .sort((a, b) => (b.uptime || 0) - (a.uptime || 0))
      .slice(0, 8);
  }, [nodes]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Clock className="h-5 w-5 mr-2 text-primary" />
          正常运行时间排行
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top {topNodes.length}
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {topNodes.length > 0 ? (
          topNodes.map((node, index) => (
            <div
              key={node.id}
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
                <CountryFlagSvg country={node.country} className="w-6 h-6" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {node.name}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        style={{
                          width: `${node.uptimePercent}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                      {node.uptimePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-bold text-primary text-right">
                  {formatUptime(node.uptime || 0)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无正常运行时间数据</p>
          </div>
        )}
      </div>
    </div>
  );
};
