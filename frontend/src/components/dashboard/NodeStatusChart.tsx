import React, { useEffect, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, Server } from "lucide-react";

interface NodeStatusChartProps {
  onlineNodes: number;
  offlineNodes: number;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, total }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="surface-elevated p-3 rounded-lg shadow-lg border border-border">
        <p className="font-medium text-foreground">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          数量: {data.value} (
          {total > 0 ? Math.round((data.value / total) * 100) : 0}%)
        </p>
      </div>
    );
  }
  return null;
};

export const NodeStatusChart: React.FC<NodeStatusChartProps> = ({
  onlineNodes,
  offlineNodes,
  className = "",
}) => {
  const data = [
    { name: "在线节点", value: onlineNodes, color: "hsl(var(--success))" },
    { name: "离线节点", value: offlineNodes, color: "hsl(var(--error))" },
  ];

  const total = onlineNodes + offlineNodes;
  const progressRef = useRef<HTMLDivElement>(null);
  const availabilityPercent = useMemo(
    () =>
      total > 0 ? Math.min(100, Math.max(0, (onlineNodes / total) * 100)) : 0,
    [onlineNodes, total],
  );

  useEffect(() => {
    const progressElement = progressRef.current;
    if (!progressElement) return;

    progressElement.style.width = `${availabilityPercent}%`;
  }, [availabilityPercent]);

  return (
    <div
      className={`surface-elevated rounded-lg shadow-lg p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Activity className="h-5 w-5 mr-2 text-[hsl(var(--info))]" />
          节点状态分布
        </h3>
        <div className="text-sm text-muted-foreground">
          总计: {total} 个节点
        </div>
      </div>

      {total > 0 ? (
        <div className="flex items-center space-x-6">
          {/* 饼图 */}
          <div className="flex-shrink-0 w-[200px] h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 图例和统计 */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-[hsl(var(--success))]/10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--success))]"></div>
                  <span className="text-sm font-medium text-[hsl(var(--success))]">
                    在线节点
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[hsl(var(--success))]">
                    {onlineNodes}
                  </div>
                  <div className="text-xs text-[hsl(var(--success))]">
                    {total > 0 ? Math.round((onlineNodes / total) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[hsl(var(--error))]/10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--error))]"></div>
                  <span className="text-sm font-medium text-[hsl(var(--error))]">
                    离线节点
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[hsl(var(--error))]">
                    {offlineNodes}
                  </div>
                  <div className="text-xs text-[hsl(var(--error))]">
                    {total > 0 ? Math.round((offlineNodes / total) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* 可用率指示器 */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  系统可用率
                </span>
                <span className="text-sm font-bold text-foreground">
                  {total > 0 ? Math.round((onlineNodes / total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  ref={progressRef}
                  className="bg-[hsl(var(--success))] h-2 rounded-full transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <div className="text-center">
            <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无节点数据</p>
          </div>
        </div>
      )}
    </div>
  );
};
