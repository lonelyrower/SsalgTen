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
      className={`relative rounded-[var(--radius-xl)] border-2 p-4 cursor-pointer transition-all duration-[var(--duration-normal)] ${
        isSelected
          ? isOnline
            ? "border-[hsl(var(--secondary))] shadow-lg shadow-[hsl(var(--secondary))]/20 ring-2 ring-[hsl(var(--secondary))]/30 bg-gradient-to-br from-[hsl(var(--secondary))]/10 to-[hsl(var(--status-info-50))]/80 dark:from-[hsl(var(--secondary))]/20 dark:to-[hsl(var(--status-info-900))]/20"
            : "border-purple-500 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/30 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20"
          : isOnline
            ? "border-[hsl(var(--status-success-200))] dark:border-[hsl(var(--status-success-900))]/30 bg-gradient-to-br from-[hsl(var(--status-success-50))]/50 to-[hsl(var(--status-success-100))]/50 dark:from-[hsl(var(--status-success-900))]/10 dark:to-[hsl(var(--status-success-900))]/10 hover:shadow-lg hover:-translate-y-0.5"
            : "border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-900))]/30 bg-gradient-to-br from-[hsl(var(--status-error-50))]/50 to-[hsl(var(--status-error-100))]/50 dark:from-[hsl(var(--status-error-900))]/10 dark:to-[hsl(var(--status-error-900))]/10 hover:shadow-lg hover:-translate-y-0.5"
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
              <div className="w-0.5 h-12 bg-gradient-to-b from-[hsl(var(--secondary))] to-transparent mt-2" />
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
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))] mb-0.5">
                  {node.name}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
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

          {/* 信息网格 - 数据在标签同一行，超小屏单列 */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* ASN */}
            {node.asnNumber && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">ASN:</span>
                <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  {node.asnNumber}
                </span>
              </div>
            )}

            {/* IPv4 */}
            {node.ipv4 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">IPv4:</span>
                <span className="text-xs font-mono font-semibold text-[hsl(var(--secondary))]">
                  {node.ipv4}
                </span>
              </div>
            )}

            {/* 服务商 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">服务商:</span>
              <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                {node.provider}
              </span>
            </div>

            {/* IPv6 */}
            {node.ipv6 && node.ipv6.includes(":") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">IPv6:</span>
                <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 truncate">
                  {node.ipv6}
                </span>
              </div>
            )}

            {/* 延迟 */}
            {latency !== null && latency !== undefined && (
              <div className="flex items-center gap-2 col-span-2">
                <Activity className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">延迟:</span>
                <span
                  className={`font-bold text-sm ${
                    latency < 50
                      ? "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]"
                      : latency < 150
                        ? "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]"
                        : "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]"
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
              <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" />
                  <span>CPU</span>
                </div>
                <span className="font-semibold text-[hsl(var(--foreground))]">
                  {cpuUsage > 0 ? `${cpuUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    cpuUsage > 80
                      ? "bg-[hsl(var(--status-error-500))]"
                      : cpuUsage > 60
                        ? "bg-[hsl(var(--status-warning-500))]"
                        : "bg-[hsl(var(--status-success-500))]"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(cpuUsage, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* 内存 */}
            <div>
              <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
                <div className="flex items-center gap-1.5">
                  <MemoryStick className="h-3 w-3" />
                  <span>内存</span>
                </div>
                <span className="font-semibold text-[hsl(var(--foreground))]">
                  {memoryUsage > 0 ? `${memoryUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    memoryUsage > 80
                      ? "bg-[hsl(var(--status-error-500))]"
                      : memoryUsage > 60
                        ? "bg-[hsl(var(--status-warning-500))]"
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
