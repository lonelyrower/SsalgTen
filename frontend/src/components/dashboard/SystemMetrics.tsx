import React, { useMemo } from "react";
import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { NodeData } from "@/services/api";

interface SystemMetricsProps {
  nodes: NodeData[];
}

interface ResourceBarProps {
  label: string;
  value: number;
  color: "cyan" | "purple" | "green" | "yellow" | "orange";
}

const ResourceBar: React.FC<ResourceBarProps> = ({ label, value, color }) => {
  const colorMap = {
    cyan: "bg-cyan-500",
    purple: "bg-purple-500",
    green: "bg-[hsl(var(--status-success-500))]",
    yellow: "bg-[hsl(var(--status-warning-500))]",
    orange: "bg-orange-500",
  };

  const textColorMap = {
    cyan: "text-cyan-600 dark:text-cyan-300",
    purple: "text-purple-600 dark:text-purple-300",
    green: "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-300))]",
    yellow: "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-300))]",
    orange: "text-orange-600 dark:text-orange-300",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-slate-500 dark:text-slate-300">{label}</span>
        <span className={`font-semibold ${textColorMap[color]}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-800/70 overflow-hidden">
        <motion.div
          className={`h-full ${colorMap[color]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

export const SystemMetrics: React.FC<SystemMetricsProps> = ({ nodes }) => {
  const metrics = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter((n) => n.status === "online");

    if (totalNodes === 0) {
      return {
        avgCpu: 0,
        avgMemory: 0,
        avgDisk: 0,
        avgLoad: 0,
        avgUptimeDays: 0,
        healthRate: 0,
        onlineRate: 0,
        ipv6CoverageRate: 0,
        totalCpu: 0,
        totalMemory: 0,
        nodesWithData: 0,
      };
    }

    // 过滤出有资源数据的节点
    const nodesWithCpu = onlineNodes.filter(
      (n) => n.cpuUsage !== null && n.cpuUsage !== undefined,
    );
    const nodesWithMemory = onlineNodes.filter(
      (n) => n.memoryUsage !== null && n.memoryUsage !== undefined,
    );
    const nodesWithDisk = onlineNodes.filter(
      (n) => n.diskUsage !== null && n.diskUsage !== undefined,
    );
    const nodesWithLoad = onlineNodes.filter(
      (n) => n.loadAverage && Array.isArray(n.loadAverage) && n.loadAverage.length > 0,
    );

    // 计算平均CPU使用率
    const avgCpu =
      nodesWithCpu.length > 0
        ? nodesWithCpu.reduce((acc, node) => acc + (node.cpuUsage || 0), 0) /
          nodesWithCpu.length
        : 0;

    // 计算平均内存使用率
    const avgMemory =
      nodesWithMemory.length > 0
        ? nodesWithMemory.reduce(
            (acc, node) => acc + (node.memoryUsage || 0),
            0,
          ) / nodesWithMemory.length
        : 0;

    // 计算平均磁盘使用率
    const avgDisk =
      nodesWithDisk.length > 0
        ? nodesWithDisk.reduce((acc, node) => acc + (node.diskUsage || 0), 0) /
          nodesWithDisk.length
        : 0;

    // 计算平均系统负载（使用1分钟负载平均值）
    const avgLoad =
      nodesWithLoad.length > 0
        ? nodesWithLoad.reduce((acc, node) => {
            const load = node.loadAverage?.[0] || 0;
            return acc + load;
          }, 0) / nodesWithLoad.length
        : 0;

    // 计算平均正常运行时间（转换为天）
    const nodesWithUptime = onlineNodes.filter((n) => n.uptime && n.uptime > 0);
    const avgUptimeDays =
      nodesWithUptime.length > 0
        ? nodesWithUptime.reduce((acc, node) => acc + (node.uptime || 0), 0) /
          nodesWithUptime.length /
          86400 // 转换为天
        : 0;

    // 计算资源健康度（低于80%为健康，只统计有数据的节点）
    const nodesWithCompleteData = onlineNodes.filter(
      (n) =>
        n.cpuUsage !== null &&
        n.cpuUsage !== undefined &&
        n.memoryUsage !== null &&
        n.memoryUsage !== undefined &&
        n.diskUsage !== null &&
        n.diskUsage !== undefined,
    );
    const healthyNodes = nodesWithCompleteData.filter(
      (n) =>
        (n.cpuUsage || 0) < 80 &&
        (n.memoryUsage || 0) < 80 &&
        (n.diskUsage || 0) < 80,
    );
    const healthRate =
      nodesWithCompleteData.length > 0
        ? (healthyNodes.length / nodesWithCompleteData.length) * 100
        : 0;

    // 计算在线率
    const onlineRate = (onlineNodes.length / totalNodes) * 100;

    // 计算 IPv6 覆盖率（基于在线节点）
    const onlineNodesWithIpv6 = onlineNodes.filter(
      (n) => n.ipv6 && n.ipv6.trim() !== "",
    );
    const ipv6CoverageRate =
      onlineNodes.length > 0
        ? (onlineNodesWithIpv6.length / onlineNodes.length) * 100
        : 0;

    return {
      avgCpu,
      avgMemory,
      avgDisk,
      avgLoad,
      avgUptimeDays,
      healthRate,
      onlineRate,
      ipv6CoverageRate,
      totalCpu: avgCpu * onlineNodes.length,
      totalMemory: avgMemory * onlineNodes.length,
      nodesWithData: Math.max(
        nodesWithCpu.length,
        nodesWithMemory.length,
        nodesWithDisk.length,
      ),
    };
  }, [nodes]);

  return (
    <div className="group relative h-full overflow-hidden rounded-[var(--radius-2xl)] border-2 border-cyan-200/60 dark:border-cyan-700/60 bg-gradient-to-br from-cyan-50 via-white to-blue-50 dark:from-slate-800 dark:via-cyan-950/60 dark:to-blue-950/60 shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] p-6 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15" />
      <div className="absolute -top-12 -right-16 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200">
            <Zap className="h-5 w-5" />
          </span>
          系统资源概览
        </h3>
        <div className="text-sm text-slate-500 dark:text-slate-300">
          {metrics.nodesWithData > 0 ? `${metrics.nodesWithData} 节点` : "无数据"}
        </div>
      </div>

      <div className="relative space-y-4 flex-1 overflow-y-auto pr-1">
        <ResourceBar label="CPU 使用率" value={metrics.avgCpu} color="cyan" />
        <ResourceBar
          label="内存使用率"
          value={metrics.avgMemory}
          color="purple"
        />
        <ResourceBar
          label="磁盘使用率"
          value={metrics.avgDisk}
          color="orange"
        />
        <ResourceBar
          label="节点健康度"
          value={metrics.healthRate}
          color="green"
        />
        <ResourceBar
          label="在线率"
          value={metrics.onlineRate}
          color="cyan"
        />
        <ResourceBar
          label="IPv6 覆盖率"
          value={metrics.ipv6CoverageRate}
          color="purple"
        />

        {/* 额外的统计信息 */}
        <div className="pt-4 mt-4 border-t border-slate-200/70 dark:border-slate-700/60">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {metrics.avgUptimeDays.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                平均运行天数
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--status-success-500))]">
                {metrics.avgLoad.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                系统负载
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
