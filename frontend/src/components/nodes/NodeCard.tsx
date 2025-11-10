import { motion } from "framer-motion";
import { Globe, Cpu, MemoryStick } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";
import type { HeartbeatData } from "@/types/heartbeat";
import { Badge } from "@/components/ui/badge";

interface NodeCardProps {
  node: NodeData;
  index: number;
  isInView: boolean;
  isSelected: boolean;
  onClick: () => void;
  latency?: number | null;
  showTimeline?: boolean;
  heartbeatData?: HeartbeatData | null;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "online":
      return "text-green-400 bg-green-400/20 border-green-400/50";
    case "offline":
      return "text-red-400 bg-red-400/20 border-red-400/50";
    default:
      return "text-gray-400 bg-gray-400/20 border-gray-400/50";
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "online":
      return "🟢";
    case "offline":
      return "🔴";
    default:
      return "⚪";
  }
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  index,
  isInView,
  isSelected,
  onClick,
  latency,
  showTimeline = true,
  heartbeatData,
}) => {
  const isOnline = node.status.toLowerCase() === "online";

  // 计算 CPU 和内存使用率 - 优先使用心跳数据，否则使用节点自身数据
  const cpuUsage = heartbeatData?.cpuInfo?.usage ?? node.cpuUsage ?? 0;
  const memoryUsage = heartbeatData?.memoryInfo?.usage ?? node.memoryUsage ?? 0;

  return (
    <motion.div
      className={`group relative cursor-pointer transition-all duration-300 ${
        isSelected
          ? isOnline
            ? "border-cyan-500 shadow-[var(--shadow-xl)] shadow-cyan-500/20 ring-2 ring-cyan-500/30 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:from-cyan-900/30 dark:to-blue-900/30"
            : "border-purple-500 shadow-[var(--shadow-xl)] shadow-purple-500/20 ring-2 ring-purple-500/30 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30"
          : isOnline
            ? "border-green-200 dark:border-green-700/50 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 active:scale-[0.98]"
            : "border-red-200 dark:border-red-700/50 bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-900/20 dark:to-rose-900/20 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 active:scale-[0.98]"
      }`}
      style={{
        borderRadius: 'var(--radius-lg)',
        borderWidth: 'var(--border-width-thin)',
        padding: 'var(--card-padding-md)',
      }}
      initial={{ opacity: 0, x: -50 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Timeline indicator */}
        {showTimeline && (
          <div className="flex flex-col items-center">
            <motion.div
              className="text-2xl"
              whileHover={{ scale: 1.2, rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              {getStatusIcon(node.status)}
            </motion.div>
            {index < 50 && (
              <div className="w-0.5 h-12 bg-gradient-to-b from-cyan-500 to-transparent mt-2" />
            )}
          </div>
        )}

        {/* Node info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5">
              {node.country && (
                <CountryFlagSvg country={node.country} className="w-7 h-7" />
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5 transition-colors duration-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                  {node.name}
                </h3>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {node.city}, {node.country}
                </p>
              </div>
            </div>
            <Badge
              variant={node.status === "online" ? "success" : "destructive"}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(node.status)}`}
            >
              {node.status.toUpperCase()}
            </Badge>
          </div>

          {/* 信息网格 - 数据在标签同一行 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {/* ASN */}
            {node.asnNumber && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">ASN:</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {node.asnNumber}
                </span>
              </div>
            )}

            {/* IPv4 */}
            {node.ipv4 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">IPv4:</span>
                <span className="text-xs font-mono font-semibold text-cyan-600 dark:text-cyan-300">
                  {node.ipv4}
                </span>
              </div>
            )}

            {/* 服务商 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">服务商:</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {node.provider}
              </span>
            </div>

            {/* IPv6 */}
            {node.ipv6 && node.ipv6.includes(":") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">IPv6:</span>
                <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-300 truncate">
                  {node.ipv6}
                </span>
              </div>
            )}
          </div>

          {/* CPU 和内存利用率 - 横跨整个卡片，始终显示 */}
          <div className="mt-4 space-y-3">
            {/* CPU */}
            <div className="group/progress">
              <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 transition-transform duration-300 group-hover/progress:scale-110" />
                  <span>CPU</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-gray-50 tabular-nums">
                  {cpuUsage > 0 ? `${cpuUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="relative h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    cpuUsage > 80
                      ? "bg-gradient-to-r from-red-500 to-red-600"
                      : cpuUsage > 60
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-green-500 to-emerald-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(cpuUsage, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  whileHover={{ opacity: 0.9 }}
                />
                {/* 脉冲警告效果 - 使用率 > 80% */}
                {cpuUsage > 80 && (
                  <div className="absolute inset-0 animate-pulse bg-red-500/10 rounded-full" />
                )}
              </div>
            </div>

            {/* 内存 */}
            <div className="group/progress">
              <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MemoryStick className="h-3.5 w-3.5 transition-transform duration-300 group-hover/progress:scale-110" />
                  <span>内存</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-gray-50 tabular-nums">
                  {memoryUsage > 0 ? `${memoryUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="relative h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    memoryUsage > 80
                      ? "bg-gradient-to-r from-red-500 to-red-600"
                      : memoryUsage > 60
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-purple-500 to-indigo-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(memoryUsage, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  whileHover={{ opacity: 0.9 }}
                />
                {/* 脉冲警告效果 - 使用率 > 80% */}
                {memoryUsage > 80 && (
                  <div className="absolute inset-0 animate-pulse bg-red-500/10 rounded-full" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
