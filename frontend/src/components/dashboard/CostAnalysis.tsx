import React, { memo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Award } from "lucide-react";
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

  // 计算统计数据
  const totalCost = nodesWithCost.reduce((sum, node) => sum + (node.monthlyCost || 0), 0);
  const avgCost = nodesWithCost.length > 0 ? totalCost / nodesWithCost.length : 0;
  const maxCost = nodesWithCost.length > 0 ? Math.max(...nodesWithCost.map((n) => n.monthlyCost || 0)) : 0;
  const minCost = nodesWithCost.length > 0 ? Math.min(...nodesWithCost.map((n) => n.monthlyCost || 0)) : 0;

  // 找到最高/最低成本的节点
  const maxCostNode = nodesWithCost.find((n) => n.monthlyCost === maxCost);
  const minCostNode = nodesWithCost.find((n) => n.monthlyCost === minCost);

  // 成本分布区间
  const ranges: CostRange[] = [
    { label: "$0-3", min: 0, max: 3, count: 0, percentage: 0 },
    { label: "$3-5", min: 3, max: 5, count: 0, percentage: 0 },
    { label: "$5-10", min: 5, max: 10, count: 0, percentage: 0 },
    { label: "$10+", min: 10, max: Infinity, count: 0, percentage: 0 },
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
    range.percentage = nodesWithCost.length > 0 ? (range.count / nodesWithCost.length) * 100 : 0;
  });

  // 过滤掉数量为0的区间
  const activeRanges = ranges.filter((r) => r.count > 0);

  // 获取成本最高的前8个节点
  const topCostNodes = [...nodesWithCost]
    .sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0))
    .slice(0, 8);

  return (
    <div className={`group relative h-full overflow-hidden rounded-[var(--radius-2xl)] border-2 border-orange-200/60 dark:border-orange-700/60 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-800 dark:via-orange-950/60 dark:to-amber-950/60 shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] p-6 flex flex-col ${className}`}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100 bg-gradient-to-br from-orange-400/15 via-transparent to-amber-500/15" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-orange-300/20 blur-3xl" />

      {/* 标题 */}
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-200">
            <DollarSign className="h-5 w-5" />
          </span>
          成本分析
        </h3>
        <div className="text-sm text-slate-500 dark:text-slate-300">
          {nodesWithCost.length === nodes.filter(n => n.status === "online").length
            ? `${nodesWithCost.length} 节点`
            : `${nodesWithCost.length}/${nodes.filter(n => n.status === "online").length} 节点`}
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className="relative space-y-4 flex-1 overflow-y-auto pr-1">
        {nodesWithCost.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <DollarSign className="h-12 w-12 mx-auto mb-2 text-orange-400/60" />
            <p>暂无在线节点成本数据</p>
            <p className="text-xs mt-2">在系统管理中为在线节点添加月度成本信息</p>
          </div>
        ) : (
          <>
            {/* 核心统计数据 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 月度总成本 */}
              <div className="rounded-xl border border-orange-100/70 dark:border-orange-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    月度总成本
                  </span>
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                </div>
                <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                  ${totalCost.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  年度约 ${(totalCost * 12).toFixed(0)}
                </div>
              </div>

              {/* 平均每节点 */}
              <div className="rounded-xl border border-orange-100/70 dark:border-orange-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    平均每节点
                  </span>
                </div>
                <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                  ${avgCost.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  /月
                </div>
              </div>

              {/* 最高成本节点 */}
              <div className="rounded-xl border border-orange-100/70 dark:border-orange-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))] font-medium">
                    最高成本
                  </span>
                  <TrendingUp className="h-3 w-3 text-[hsl(var(--status-error-500))]" />
                </div>
                <div className="text-xl font-bold text-[hsl(var(--status-error-700))] dark:text-[hsl(var(--status-error-300))]">
                  ${maxCost.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={maxCostNode?.name}>
                  {maxCostNode?.name || "未知"}
                </div>
              </div>

              {/* 最低成本节点 */}
              <div className="rounded-xl border border-orange-100/70 dark:border-orange-900/40 bg-white/80 dark:bg-white/10 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] font-medium">
                    最低成本
                  </span>
                  <TrendingDown className="h-3 w-3 text-[hsl(var(--status-success-500))]" />
                </div>
                <div className="text-xl font-bold text-[hsl(var(--status-success-700))] dark:text-[hsl(var(--status-success-300))]">
                  ${minCost.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={minCostNode?.name}>
                  {minCostNode?.name || "未知"}
                </div>
              </div>
            </div>

            {/* 成本分布 */}
            {activeRanges.length > 0 && (
              <div className="pt-3">
                <div className="space-y-2.5">
                  {activeRanges.map((range, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          {range.label}
                        </span>
                        <span className="text-slate-500 dark:text-slate-500">
                          {range.count} 节点 ({range.percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-orange-100/80 dark:bg-orange-900/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            index === 0
                              ? "bg-gradient-to-r from-green-500 to-emerald-500"
                              : index === 1
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                              : index === 2
                              ? "bg-gradient-to-r from-orange-500 to-amber-500"
                              : "bg-gradient-to-r from-red-500 to-rose-500"
                          }`}
                          style={{ width: `${range.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 8 成本节点 */}
            {topCostNodes.length > 0 && (
              <div className="pt-3">
                <div className="grid grid-cols-2 gap-2">
                  {topCostNodes.map((node, index) => {
                    return (
                      <div
                        key={node.id}
                        className="rounded-lg border border-orange-100/70 dark:border-orange-900/40 bg-white/60 dark:bg-white/5 px-2.5 py-2 hover:bg-orange-50/80 dark:hover:bg-orange-900/20 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="flex items-center flex-shrink-0">
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
                            <span
                              className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate"
                              title={node.name}
                            >
                              {node.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">
                            ${(node.monthlyCost || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 总结提示 */}
            <div className="pt-3 border-t border-orange-100/50 dark:border-orange-900/30">
              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-orange-400">💡</span>
                <p>
                  {totalCost > 100
                    ? `当前月度成本较高，建议关注高成本节点的使用效率`
                    : totalCost > 50
                    ? `成本控制良好，继续保持`
                    : `成本较低，系统运行经济高效`}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
