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
  return (
    <motion.div
      className={`relative bg-gradient-to-br from-gray-800/40 to-gray-900/40 border rounded-2xl p-6 backdrop-blur-sm cursor-pointer transition-all duration-300 ${
        isSelected
          ? "border-cyan-500 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/30"
          : "border-gray-700/50 hover:border-gray-600/50 hover:shadow-md"
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
                <h3 className="text-xl font-bold text-white mb-1">
                  {node.name}
                </h3>
                <p className="text-sm text-gray-400 flex items-center gap-1">
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
              <span className="text-gray-500 text-sm">提供商:</span>
              <span className="text-gray-300 text-sm truncate">
                {node.provider}
              </span>
            </div>
            {latency !== null && latency !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">延迟:</span>
                <span
                  className={`font-semibold text-sm ${
                    latency < 50
                      ? "text-green-400"
                      : latency < 150
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {latency}ms
                </span>
              </div>
            )}
            {node.ipv4 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">IPv4:</span>
                <span className="text-cyan-400 font-mono text-xs">
                  {node.ipv4}
                </span>
              </div>
            )}
            {node.lastSeen && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-gray-400 text-xs">
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
                <Server className="h-4 w-4 text-cyan-400" />
                <span className="text-xs text-gray-400">在线</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-green-400" />
                <span className="text-xs text-gray-400">运行中</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
