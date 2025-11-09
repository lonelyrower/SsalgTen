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
    <div className={`group relative h-full overflow-hidden rounded-2xl border-2 border-[hsl(var(--warning))]/30 surface-elevated shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-6 flex flex-col ${className}`}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-[hsl(var(--warning))]/10 via-transparent to-[hsl(var(--warning))]/5" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-[hsl(var(--warning))]/20 blur-3xl" />

      {/* 标题 */}
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">
            <DollarSign className="h-5 w-5" />
          </span>
          成本分析
        </h3>
        <div className="text-sm text-muted-foreground">
          {nodesWithCost.length === nodes.filter(n => n.status === "online").length
            ? `${nodesWithCost.length} 节点`
            : `${nodesWithCost.length}/${nodes.filter(n => n.status === "online").length} 节点`}
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className="relative space-y-4 flex-1 overflow-y-auto pr-1">
        {nodesWithCost.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 text-[hsl(var(--warning))]/60" />
            <p>暂无在线节点成本数据</p>
            <p className="text-xs mt-2">在系统管理中为在线节点添加月度成本信息</p>
          </div>
        ) : (
          <>
            {/* 核心统计数据 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 月度总成本 */}
              <div className="rounded-xl border border-[hsl(var(--warning))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--warning))] font-medium">
                    月度总成本
                  </span>
                  <TrendingUp className="h-3 w-3 text-[hsl(var(--warning))]" />
                </div>
                <div className="text-xl font-bold text-[hsl(var(--warning))]">
                  ${totalCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  年度约 ${(totalCost * 12).toFixed(0)}
                </div>
              </div>

              {/* 平均每节点 */}
              <div className="rounded-xl border border-[hsl(var(--warning))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--warning))] font-medium">
                    平均每节点
                  </span>
                </div>
                <div className="text-xl font-bold text-[hsl(var(--warning))]">
                  ${avgCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  /月
                </div>
              </div>

              {/* 最高成本节点 */}
              <div className="rounded-xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--error))] font-medium">
                    最高成本
                  </span>
                  <TrendingUp className="h-3 w-3 text-[hsl(var(--error))]" />
                </div>
                <div className="text-xl font-bold text-[hsl(var(--error))]">
                  ${maxCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate" title={maxCostNode?.name}>
                  {maxCostNode?.name || "未知"}
                </div>
              </div>

              {/* 最低成本节点 */}
              <div className="rounded-xl border border-[hsl(var(--success))]/20 bg-[hsl(var(--surface-elevated))]/80 px-3.5 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[hsl(var(--success))] font-medium">
                    最低成本
                  </span>
                  <TrendingDown className="h-3 w-3 text-[hsl(var(--success))]" />
                </div>
                <div className="text-xl font-bold text-[hsl(var(--success))]">
                  ${minCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate" title={minCostNode?.name}>
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
                        <span className="text-foreground font-medium">
                          {range.label}
                        </span>
                        <span className="text-muted-foreground">
                          {range.count} 节点 ({range.percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            index === 0
                              ? "bg-[hsl(var(--success))]"
                              : index === 1
                              ? "bg-[hsl(var(--info))]"
                              : index === 2
                              ? "bg-[hsl(var(--warning))]"
                              : "bg-[hsl(var(--error))]"
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
                        className="rounded-lg border border-[hsl(var(--warning))]/20 bg-[hsl(var(--surface-elevated))]/60 px-2.5 py-2 hover:bg-[hsl(var(--warning))]/10 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="flex items-center flex-shrink-0">
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
                            <span
                              className="text-xs text-foreground font-medium truncate"
                              title={node.name}
                            >
                              {node.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-[hsl(var(--warning))] flex-shrink-0">
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
            <div className="pt-3 border-t border-border">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-[hsl(var(--warning))]">💡</span>
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
