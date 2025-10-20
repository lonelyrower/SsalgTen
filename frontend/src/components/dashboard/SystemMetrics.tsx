import React, { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Cpu, HardDrive, Gauge, Zap } from "lucide-react";
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
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
  };

  const textColorMap = {
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
    orange: "text-orange-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-400">{label}</span>
        <span className={`font-bold ${textColorMap[color]}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-700 dark:bg-gray-800 rounded-full overflow-hidden">
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
    const onlineNodes = nodes.filter((n) => n.status === "online");

    if (onlineNodes.length === 0) {
      return {
        avgCpu: 0,
        avgMemory: 0,
        avgDisk: 0,
        avgLoad: 0,
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

    // 计算平均负载（基于uptime，这里简单处理）
    // 如果后端提供了loadAverage，应该使用那个数据
    const avgLoad = 0; // 暂时设为0，等待后端提供真实的系统负载数据

    return {
      avgCpu,
      avgMemory,
      avgDisk,
      avgLoad,
      totalCpu: avgCpu * onlineNodes.length,
      totalMemory: avgMemory * onlineNodes.length,
      nodesWithData: Math.max(
        nodesWithCpu.length,
        nodesWithMemory.length,
        nodesWithDisk.length,
      ),
    };
  }, [nodes]);

  const metricsCards = [
    {
      title: "平均 CPU 使用率",
      value: `${metrics.avgCpu.toFixed(1)}%`,
      icon: <Cpu className="h-6 w-6 text-cyan-400" />,
      gradient: "from-cyan-500 to-blue-500",
      bgGradient: "from-cyan-500/10 to-blue-500/10",
    },
    {
      title: "平均内存使用率",
      value: `${metrics.avgMemory.toFixed(1)}%`,
      icon: <HardDrive className="h-6 w-6 text-purple-400" />,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
    },
    {
      title: "平均磁盘使用率",
      value: `${metrics.avgDisk.toFixed(1)}%`,
      icon: <HardDrive className="h-6 w-6 text-orange-400" />,
      gradient: "from-orange-500 to-amber-500",
      bgGradient: "from-orange-500/10 to-amber-500/10",
    },
    {
      title: "平均系统负载",
      value: metrics.avgLoad.toFixed(2),
      icon: <Gauge className="h-6 w-6 text-green-400" />,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricsCards.map((metric, index) => (
          <GlassCard
            key={index}
            variant="tech"
            animated={false}
            glow={false}
            className="p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-lg bg-white/10">{metric.icon}</div>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {metric.title}
            </h3>
            <div className="text-3xl font-bold text-foreground">
              {metric.value}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Detailed Resource Bars */}
      <GlassCard variant="gradient" animated={false} className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary/15 rounded-xl backdrop-blur-sm">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold gradient-text">系统资源概览</h2>
            <p className="text-muted-foreground text-sm">
              {metrics.nodesWithData > 0
                ? `基于 ${metrics.nodesWithData} 个在线节点的实时资源数据`
                : "等待节点上报资源数据..."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            label="系统负载 (归一化)"
            value={Math.min((metrics.avgLoad / 4) * 100, 100)}
            color="green"
          />
        </div>
      </GlassCard>
    </div>
  );
};
