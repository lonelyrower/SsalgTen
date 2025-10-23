import React, { memo } from "react";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import type { NodeData } from "@/services/api";

interface CostAnalysisProps {
  nodes: NodeData[];
  className?: string;
}

interface CostRange {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export const CostAnalysis: React.FC<CostAnalysisProps> = memo(({ nodes, className = "" }) => {
  // 筛选有成本数据的在线节点
  const nodesWithCost = nodes.filter(
    (node) =>
      node.status === "online" &&
      node.monthlyCost !== undefined &&
      node.monthlyCost !== null &&
      node.monthlyCost > 0
  );

  // 如果没有成本数据，显示提示
  if (nodesWithCost.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center mb-4">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mr-3">
            <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            成本分析
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            暂无在线节点成本数据
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
            在系统管理中为在线节点添加月度成本信息
          </p>
        </div>
      </Card>
    );
  }

  // 计算统计数据
  const totalCost = nodesWithCost.reduce((sum, node) => sum + (node.monthlyCost || 0), 0);
  const avgCost = totalCost / nodesWithCost.length;
  const maxCost = Math.max(...nodesWithCost.map((n) => n.monthlyCost || 0));
  const minCost = Math.min(...nodesWithCost.map((n) => n.monthlyCost || 0));

  // 找到最高/最低成本的节点
  const maxCostNode = nodesWithCost.find((n) => n.monthlyCost === maxCost);
  const minCostNode = nodesWithCost.find((n) => n.monthlyCost === minCost);

  // 成本分布区间
  const ranges: CostRange[] = [
    { label: "$0-10", min: 0, max: 10, count: 0, percentage: 0 },
    { label: "$10-20", min: 10, max: 20, count: 0, percentage: 0 },
    { label: "$20-50", min: 20, max: 50, count: 0, percentage: 0 },
    { label: "$50+", min: 50, max: Infinity, count: 0, percentage: 0 },
  ];

  // 统计每个区间的节点数量
  nodesWithCost.forEach((node) => {
    const cost = node.monthlyCost || 0;
    for (const range of ranges) {
      if (cost >= range.min && cost < range.max) {
        range.count++;
        break;
      }
    }
  });

  // 计算百分比
  ranges.forEach((range) => {
    range.percentage = (range.count / nodesWithCost.length) * 100;
  });

  // 过滤掉数量为0的区间
  const activeRanges = ranges.filter((r) => r.count > 0);

  return (
    <Card className={`p-6 ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mr-3">
            <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            成本分析
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          在线 {nodesWithCost.length}/{nodes.filter(n => n.status === "online").length} 个节点
        </span>
      </div>

      {/* 核心统计数据 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* 月度总成本 */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              月度总成本
            </span>
            <TrendingUp className="h-3 w-3 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            ${totalCost.toFixed(2)}
          </div>
          <div className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1">
            年度约 ${(totalCost * 12).toFixed(0)}
          </div>
        </div>

        {/* 平均每节点 */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              平均每节点
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            ${avgCost.toFixed(2)}
          </div>
          <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
            /月
          </div>
        </div>

        {/* 最高成本节点 */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              最高成本
            </span>
            <TrendingUp className="h-3 w-3 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
            ${maxCost.toFixed(2)}
          </div>
          <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1 truncate" title={maxCostNode?.name}>
            {maxCostNode?.name || "未知"}
          </div>
        </div>

        {/* 最低成本节点 */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              最低成本
            </span>
            <TrendingDown className="h-3 w-3 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            ${minCost.toFixed(2)}
          </div>
          <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 truncate" title={minCostNode?.name}>
            {minCostNode?.name || "未知"}
          </div>
        </div>
      </div>

      {/* 成本分布 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          成本分布
        </h4>
        <div className="space-y-3">
          {activeRanges.map((range, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  {range.label}
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                  {range.count} 个节点 ({range.percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    index === 0
                      ? "bg-green-500"
                      : index === 1
                      ? "bg-blue-500"
                      : index === 2
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${range.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 总结提示 */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="text-gray-400">💡</span>
          <p>
            {totalCost > 100
              ? `当前月度成本较高，建议关注高成本节点的使用效率`
              : totalCost > 50
              ? `成本控制良好，继续保持`
              : `成本较低，系统运行经济高效`}
          </p>
        </div>
      </div>
    </Card>
  );
});
