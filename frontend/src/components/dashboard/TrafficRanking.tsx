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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          流量排行
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top {topNodes.length}
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {topNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">暂无流量数据</p>
          </div>
        ) : (
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
                <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                  <span className="flex items-center">
                    <ArrowUp className="h-3 w-3 mr-0.5 text-green-500" />
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
              <p className="text-sm font-bold text-primary">
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
