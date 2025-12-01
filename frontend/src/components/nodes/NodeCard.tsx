import { motion } from "framer-motion";
import { Activity, Globe, Cpu, MemoryStick } from "lucide-react";
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
      return "text-[hsl(var(--status-success-400))] bg-[hsl(var(--status-success-400)/0.2)] border-[hsl(var(--status-success-400)/0.5)]";
    case "offline":
      return "text-[hsl(var(--status-error-400))] bg-[hsl(var(--status-error-400)/0.2)] border-[hsl(var(--status-error-400)/0.5)]";
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
      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-300 ${
        isSelected
          ? isOnline
            ? "border-cyan-500 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/30 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:from-cyan-900/20 dark:to-blue-900/20"
            : "border-purple-500 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/30 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20"
          : isOnline
            ? "border-green-200 dark:border-green-900/30 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 hover:shadow-lg hover:-translate-y-0.5"
            : "border-red-200 dark:border-red-900/30 bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-900/10 dark:to-rose-900/10 hover:shadow-lg hover:-translate-y-0.5"
      }`}
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                  {node.name}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* ASN */}
            {node.asnNumber && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">ASN:</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {node.asnNumber}
                </span>
              </div>
            )}

            {/* IPv4 */}
            {node.ipv4 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">IPv4:</span>
                <span className="text-xs font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                  {node.ipv4}
                </span>
              </div>
            )}

            {/* 服务商 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">服务商:</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {node.provider}
              </span>
            </div>

            {/* IPv6 */}
            {node.ipv6 && node.ipv6.includes(":") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">IPv6:</span>
                <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 truncate">
                  {node.ipv6}
                </span>
              </div>
            )}

            {/* 延迟 */}
            {latency !== null && latency !== undefined && (
              <div className="flex items-center gap-2 col-span-2">
                <Activity className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">延迟:</span>
                <span
                  className={`font-bold text-sm ${
                    latency < 50
                      ? "text-green-600 dark:text-green-400"
                      : latency < 150
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {latency}ms
                </span>
              </div>
            )}
          </div>

          {/* CPU 和内存利用率 - 横跨整个卡片，始终显示 */}
          <div className="mt-3 space-y-2">
            {/* CPU */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" />
                  <span>CPU</span>
                </div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {cpuUsage > 0 ? `${cpuUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200/70 dark:bg-gray-700/70 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    cpuUsage > 80
                      ? "bg-red-500"
                      : cpuUsage > 60
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(cpuUsage, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* 内存 */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <MemoryStick className="h-3 w-3" />
                  <span>内存</span>
                </div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {memoryUsage > 0 ? `${memoryUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200/70 dark:bg-gray-700/70 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    memoryUsage > 80
                      ? "bg-red-500"
                      : memoryUsage > 60
                        ? "bg-yellow-500"
                        : "bg-purple-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(memoryUsage, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
