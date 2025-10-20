import { motion } from "framer-motion";
import { useState } from "react";
import {
  Server,
  Globe,
  MapPin,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  Calendar,
  Zap,
  Terminal,
  BarChart3,
} from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NodeData } from "@/services/api";
import type { HeartbeatData } from "@/types/heartbeat";

interface EnhancedNodeDetailsPanelProps {
  node: NodeData | null;
  heartbeatData?: HeartbeatData | null;
  onRunDiagnostics?: () => void;
  onViewLogs?: () => void;
  onShowServerDetails?: () => void;
}

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

const DetailItem = ({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  mono?: boolean;
}) => {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-700/30 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-400" />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <span
        className={`text-white font-semibold text-sm ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
};

const ResourceBar = ({
  label,
  value,
  color,
  unit = "%",
}: {
  label: string;
  value: number;
  color: "cyan" | "purple" | "green" | "yellow" | "red";
  unit?: string;
}) => {
  const colorMap = {
    cyan: "bg-cyan-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span>{label}</span>
        <span className="font-semibold">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${colorMap[color]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

export const EnhancedNodeDetailsPanel: React.FC<
  EnhancedNodeDetailsPanelProps
> = ({
  node,
  heartbeatData,
  onRunDiagnostics,
  onViewLogs,
  onShowServerDetails,
}) => {
  const [activeTab, setActiveTab] = useState<"info" | "resources">("info");

  if (!node) {
    return (
      <motion.div
        className="sticky top-24 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-3xl p-8 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center py-12">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🌍
          </motion.div>
          <p className="text-gray-400">选择一个节点查看详情</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="sticky top-24 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-3xl p-8 backdrop-blur-sm"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      key={node.id}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-5xl">{getStatusIcon(node.status)}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {node.country && (
              <CountryFlagSvg country={node.country} className="w-6 h-6" />
            )}
            <h3 className="text-2xl font-black text-white">{node.name}</h3>
          </div>
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {node.city}, {node.country}
          </p>
        </div>
        <Badge variant={node.status === "online" ? "success" : "destructive"}>
          {node.status.toUpperCase()}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-gray-800/50 rounded-lg">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "info"
              ? "bg-cyan-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700/50"
          }`}
        >
          <Server className="h-4 w-4 inline mr-2" />
          基本信息
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "resources"
              ? "bg-cyan-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700/50"
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          资源监控
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "info" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <DetailItem label="服务商" value={node.provider} icon={Globe} />
            {node.ipv4 && (
              <DetailItem
                label="IPv4 地址"
                value={node.ipv4}
                icon={Network}
                mono
              />
            )}
            {node.ipv6 && node.ipv6.includes(":") && (
              <DetailItem
                label="IPv6 地址"
                value={<span className="text-xs break-all">{node.ipv6}</span>}
                icon={Network}
                mono
              />
            )}
            {node.osType && (
              <DetailItem
                label="操作系统"
                value={`${node.osType}${node.osVersion ? ` ${node.osVersion}` : ""}`}
                icon={Terminal}
              />
            )}
            {node.lastSeen && (
              <DetailItem
                label="最后在线"
                value={new Date(node.lastSeen).toLocaleString("zh-CN")}
                icon={Clock}
              />
            )}
            {node.createdAt && (
              <DetailItem
                label="注册时间"
                value={new Date(node.createdAt).toLocaleDateString("zh-CN")}
                icon={Calendar}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {heartbeatData?.cpuInfo ||
            heartbeatData?.memoryInfo ||
            heartbeatData?.diskInfo ? (
              <>
                {heartbeatData?.cpuInfo && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-cyan-400" />
                      CPU 使用率
                    </h4>
                    <ResourceBar
                      label="处理器"
                      value={heartbeatData.cpuInfo.usage || 0}
                      color={
                        (heartbeatData.cpuInfo.usage || 0) > 80
                          ? "red"
                          : (heartbeatData.cpuInfo.usage || 0) > 60
                            ? "yellow"
                            : "green"
                      }
                    />
                  </div>
                )}

                {heartbeatData?.memoryInfo && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-purple-400" />
                      内存使用
                    </h4>
                    <ResourceBar
                      label="内存"
                      value={
                        heartbeatData.memoryInfo.total
                          ? (heartbeatData.memoryInfo.used /
                              heartbeatData.memoryInfo.total) *
                            100
                          : 0
                      }
                      color={
                        heartbeatData.memoryInfo.total &&
                        (heartbeatData.memoryInfo.used /
                          heartbeatData.memoryInfo.total) *
                          100 >
                          80
                          ? "red"
                          : heartbeatData.memoryInfo.total &&
                              (heartbeatData.memoryInfo.used /
                                heartbeatData.memoryInfo.total) *
                                100 >
                                60
                            ? "yellow"
                            : "purple"
                      }
                    />
                  </div>
                )}

                {heartbeatData?.diskInfo && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-yellow-400" />
                      磁盘使用
                    </h4>
                    <ResourceBar
                      label="存储空间"
                      value={
                        heartbeatData.diskInfo.total
                          ? (heartbeatData.diskInfo.used /
                              heartbeatData.diskInfo.total) *
                            100
                          : 0
                      }
                      color={
                        heartbeatData.diskInfo.total &&
                        (heartbeatData.diskInfo.used /
                          heartbeatData.diskInfo.total) *
                          100 >
                          80
                          ? "red"
                          : heartbeatData.diskInfo.total &&
                              (heartbeatData.diskInfo.used /
                                heartbeatData.diskInfo.total) *
                                100 >
                                60
                            ? "yellow"
                            : "cyan"
                      }
                    />
                  </div>
                )}

                {heartbeatData?.uptime && (
                  <div className="pt-4 border-t border-gray-700/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-green-400" />
                        运行时间
                      </span>
                      <span className="text-white font-semibold">
                        {Math.floor(heartbeatData.uptime / 86400)}天
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无资源监控数据</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 space-y-3">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onRunDiagnostics}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
            disabled={node.status !== "online"}
          >
            <Zap className="h-4 w-4 mr-2" />
            运行网络诊断
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onShowServerDetails}
              variant="outline"
              className="w-full border-gray-600 hover:bg-gray-700"
              disabled={node.status !== "online"}
            >
              <Terminal className="h-4 w-4 mr-2" />
              系统详情
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onViewLogs}
              variant="outline"
              className="w-full border-gray-600 hover:bg-gray-700"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              查看日志
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
