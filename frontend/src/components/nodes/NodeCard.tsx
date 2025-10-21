import { motion } from "framer-motion";
import { Server, Activity, Globe, Clock } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";
import { Badge } from "@/components/ui/badge";

interface NodeCardProps {
  node: NodeData;
  index: number;
  isInView: boolean;
  isSelected: boolean;
  onClick: () => void;
  latency?: number | null;
  showTimeline?: boolean;
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
}) => {
  const isOnline = node.status.toLowerCase() === "online";

  return (
    <motion.div
      className={`relative rounded-xl border-2 p-6 cursor-pointer transition-all duration-300 ${
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
      whileHover={{ x: 8 }}
    >
      <div className="flex items-start gap-4">
        {/* Timeline indicator */}
        {showTimeline && (
          <div className="flex flex-col items-center">
            <motion.div
              className="text-3xl"
              whileHover={{ scale: 1.2, rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              {getStatusIcon(node.status)}
            </motion.div>
            {index < 50 && (
              <div className="w-0.5 h-16 bg-gradient-to-b from-cyan-500 to-transparent mt-2" />
            )}
          </div>
        )}

        {/* Node info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {node.country && (
                <CountryFlagSvg country={node.country} className="w-8 h-8" />
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {node.name}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {node.city}, {node.country}
                </p>
              </div>
            </div>
            <Badge
              variant={node.status === "online" ? "success" : "destructive"}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(node.status)}`}
            >
              {node.status.toUpperCase()}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">提供商:</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {node.provider}
              </span>
            </div>
            {latency !== null && latency !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">延迟:</span>
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
            {node.ipv4 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">IPv4:</span>
                <span className="text-sm font-mono font-semibold text-cyan-600 dark:text-cyan-400 bg-white/50 dark:bg-gray-800/50 px-2 py-0.5 rounded">
                  {node.ipv4}
                </span>
              </div>
            )}
            {node.lastSeen && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {new Date(node.lastSeen).toLocaleString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          {node.status === "online" && (
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Server className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">在线</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">运行中</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
