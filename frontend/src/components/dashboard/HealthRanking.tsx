import React, { useMemo } from "react";
import { Heart, AlertTriangle } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";

interface HealthRankingProps {
  nodes: NodeData[];
}

// 计算节点健康分数 (0-100)
const calculateHealthScore = (node: NodeData): number => {
  let score = 100;

  // CPU使用率扣分 (超过80%严重扣分)
  if (node.cpuUsage !== null && node.cpuUsage !== undefined) {
    if (node.cpuUsage > 90) score -= 30;
    else if (node.cpuUsage > 80) score -= 20;
    else if (node.cpuUsage > 70) score -= 10;
    else if (node.cpuUsage > 60) score -= 5;
  }

  // 内存使用率扣分
  if (node.memoryUsage !== null && node.memoryUsage !== undefined) {
    if (node.memoryUsage > 90) score -= 30;
    else if (node.memoryUsage > 80) score -= 20;
    else if (node.memoryUsage > 70) score -= 10;
    else if (node.memoryUsage > 60) score -= 5;
  }

  // 磁盘使用率扣分
  if (node.diskUsage !== null && node.diskUsage !== undefined) {
    if (node.diskUsage > 95) score -= 20;
    else if (node.diskUsage > 90) score -= 15;
    else if (node.diskUsage > 80) score -= 8;
    else if (node.diskUsage > 70) score -= 3;
  }

  // 离线状态严重扣分
  if (node.status !== "online") {
    score = 0;
  }

  return Math.max(0, Math.min(100, score));
};

const getHealthColor = (score: number): string => {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-blue-500";
  if (score >= 50) return "text-yellow-500";
  if (score >= 30) return "text-orange-500";
  return "text-red-500";
};

const getHealthGradient = (score: number): string => {
  if (score >= 90) return "from-green-500 to-emerald-500";
  if (score >= 70) return "from-blue-500 to-cyan-500";
  if (score >= 50) return "from-yellow-500 to-amber-500";
  if (score >= 30) return "from-orange-500 to-red-500";
  return "from-red-500 to-rose-500";
};

const getHealthLabel = (score: number): string => {
  if (score >= 90) return "优秀";
  if (score >= 70) return "良好";
  if (score >= 50) return "一般";
  if (score >= 30) return "较差";
  return "异常";
};

export const HealthRanking: React.FC<HealthRankingProps> = ({ nodes }) => {
  const rankedNodes = useMemo(() => {
    return nodes
      .filter((n) => n.status === "online")
      .map((node) => ({
        ...node,
        healthScore: calculateHealthScore(node),
      }))
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, 8);
  }, [nodes]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Heart className="h-5 w-5 mr-2 text-primary" />
          节点健康度排行
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Top {rankedNodes.length}
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {rankedNodes.length > 0 ? (
          rankedNodes.map((node, index) => (
            <div
              key={node.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-6">
                  #{index + 1}
                </span>
                <CountryFlagSvg country={node.country} className="w-6 h-6" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {node.name}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getHealthGradient(node.healthScore)}`}
                        style={{
                          width: `${node.healthScore}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                    <span>
                      CPU: {node.cpuUsage?.toFixed(1) || "N/A"}%
                    </span>
                    <span>
                      内存: {node.memoryUsage?.toFixed(1) || "N/A"}%
                    </span>
                    <span>
                      磁盘: {node.diskUsage?.toFixed(1) || "N/A"}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="ml-3 text-right">
                <p className={`text-lg font-bold ${getHealthColor(node.healthScore)}`}>
                  {node.healthScore.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">
                  {getHealthLabel(node.healthScore)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无健康度数据</p>
          </div>
        )}
      </div>
    </div>
  );
};
