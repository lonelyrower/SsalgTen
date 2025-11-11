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
      return "node-status-online";
    case "offline":
      return "node-status-offline";
    default:
      return "node-status-unknown";
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
          ? "card-selected-gradient ring-2 ring-[hsl(var(--brand-cyan))]/30"
          : isOnline
            ? "card-online-gradient hover:shadow-lg hover:-translate-y-0.5"
            : "card-offline-gradient hover:shadow-lg hover:-translate-y-0.5"
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
              <div className="w-0.5 h-12 bg-gradient-to-b from-[hsl(var(--brand-cyan))] to-transparent mt-2" />
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

          {/* 信息网格 - 数据在标签同一行 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
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
                <span className="text-xs text-muted-foreground">IPv4:</span>
                <span className="text-xs font-mono font-semibold text-[hsl(var(--brand-cyan))]">
                  {node.ipv4}
                </span>
              </div>
            )}

            {/* 服务商 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">服务商:</span>
              <span className="text-sm font-semibold text-foreground truncate">
                {node.provider}
              </span>
            </div>

            {/* IPv6 */}
            {node.ipv6 && node.ipv6.includes(":") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">IPv6:</span>
                <span className="text-xs font-mono font-semibold text-secondary truncate">
                  {node.ipv6}
                </span>
              </div>
            )}

            {/* 延迟 */}
            {latency !== null && latency !== undefined && (
              <div className="flex items-center gap-2 col-span-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">延迟:</span>
                <span
                  className={`font-bold text-sm ${
                    latency < 50
                      ? "text-[hsl(var(--success))]"
                      : latency < 150
                        ? "text-[hsl(var(--warning))]"
                        : "text-[hsl(var(--error))]"
                  }`}
                >
                  {latency}ms
                </span>
              </div>
            )}
          </div>

          {/* CPU 和内存利用率 - 横跨整个卡片，始终显示 */}
          <div className="mt-4 space-y-3">
            {/* CPU */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 transition-transform duration-300 group-hover/progress:scale-110" />
                  <span>CPU</span>
                </div>
                <span className="font-semibold text-foreground">
                  {cpuUsage > 0 ? `${cpuUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-muted/70 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    cpuUsage > 80
                      ? "bg-[hsl(var(--error))]"
                      : cpuUsage > 60
                        ? "bg-[hsl(var(--warning))]"
                        : "bg-[hsl(var(--success))]"
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
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <div className="flex items-center gap-1.5">
                  <MemoryStick className="h-3.5 w-3.5 transition-transform duration-300 group-hover/progress:scale-110" />
                  <span>内存</span>
                </div>
                <span className="font-semibold text-foreground">
                  {memoryUsage > 0 ? `${memoryUsage.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-muted/70 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    memoryUsage > 80
                      ? "bg-[hsl(var(--error))]"
                      : memoryUsage > 60
                        ? "bg-[hsl(var(--warning))]"
                        : "bg-secondary"
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
