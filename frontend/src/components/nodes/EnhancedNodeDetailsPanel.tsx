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
  Hash,
  ArrowUpDown,
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
    <div className="flex items-center justify-between py-3 border-b border-slate-200/70 dark:border-slate-700/30 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
        <span className="text-slate-600 dark:text-slate-400 text-sm">{label}</span>
      </div>
      <span
        className={`text-slate-900 dark:text-slate-900 dark:text-white font-semibold text-sm ${mono ? "font-mono" : ""}`}
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
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
        <span>{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-slate-200/70 dark:bg-slate-800/70 rounded-full overflow-hidden">
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
        className="group sticky top-24 relative lg:h-[800px] overflow-hidden rounded-2xl border-2 border-violet-200/60 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-800 dark:via-violet-950/60 dark:to-indigo-950/60 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-8 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-indigo-400/15 via-transparent to-violet-500/15" />
        <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="relative text-center py-12">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🌍
          </motion.div>
          <p className="text-slate-600 dark:text-slate-300">选择一个节点查看详情</p>
        </div>
      </motion.div>
    );
  }

  // 根据节点状态选择颜色主题
  const isOnline = node.status === "online";
  const themeColors = isOnline
    ? {
        border: "border-cyan-200/60 dark:border-cyan-700/60",
        bg: "from-cyan-50 via-white to-blue-50 dark:from-slate-800 dark:via-cyan-950/60 dark:to-blue-950/60",
        glow: "from-cyan-400/15 via-transparent to-blue-500/15",
        glowCircle: "bg-cyan-400/20",
      }
    : {
        border: "border-rose-200/60 dark:border-rose-700/60",
        bg: "from-rose-50 via-white to-pink-50 dark:from-slate-800 dark:via-rose-950/60 dark:to-pink-950/60",
        glow: "from-rose-400/15 via-transparent to-pink-500/15",
        glowCircle: "bg-rose-400/20",
      };

  return (
    <motion.div
      className={`group sticky top-24 relative lg:h-[800px] overflow-y-auto overflow-x-hidden rounded-2xl border-2 ${themeColors.border} bg-gradient-to-br ${themeColors.bg} shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl p-8 flex flex-col`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      key={node.id}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${themeColors.glow}`} />
      <div className={`absolute -top-12 -right-16 h-32 w-32 rounded-full ${themeColors.glowCircle} blur-3xl`} />
      {/* Header */}
      <div className="relative flex items-center gap-4 mb-6">
        <span className="text-5xl">{getStatusIcon(node.status)}</span>
        <div className="flex-1">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{node.name}</h3>
        </div>
        <Badge
          variant={node.status === "online" ? "success" : "destructive"}
          className={node.status === "online"
            ? "bg-green-500/20 text-green-700 dark:text-green-200 border border-green-500/30"
            : "bg-red-500/20 text-red-700 dark:text-red-200 border border-red-500/30"
          }
        >
          {node.status.toUpperCase()}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="relative flex gap-2 mb-6 p-1 bg-slate-200/70 dark:bg-slate-800/50 rounded-lg">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "info"
              ? "bg-cyan-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50"
          }`}
        >
          <Server className="h-4 w-4 inline mr-2" />
          基本信息
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "resources"
              ? "bg-cyan-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50"
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          资源监控
        </button>
      </div>

      {/* Content - scrollable area */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {activeTab === "info" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            {/* 地址信息区域 */}
            <div className="pb-2 mb-2 border-b border-slate-200/70 dark:border-slate-700/30">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">地址信息</h4>
              <DetailItem
                label="位置"
                value={
                  <div className="flex items-center gap-2">
                    {node.country && (
                      <CountryFlagSvg country={node.country} className="w-4 h-4" />
                    )}
                    <span>{node.city}, {node.country}</span>
                  </div>
                }
                icon={MapPin}
              />
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
            </div>

            {/* 网络信息区域 */}
            <div className="pb-2 mb-2 border-b border-slate-200/70 dark:border-slate-700/30">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">网络信息</h4>
              <DetailItem label="服务商" value={node.provider} icon={Globe} />
              {node.asnNumber && (
                <DetailItem
                  label="ASN"
                  value={node.asnName ? `${node.asnNumber} (${node.asnName})` : node.asnNumber}
                  icon={Hash}
                />
              )}
            </div>

            {/* 系统信息区域 */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">系统信息</h4>
              {node.osType && (
                <DetailItem
                  label="操作系统"
                  value={(() => {
                    // 如果 osVersion 已经包含在 osType 中，只显示 osType
                    if (node.osVersion && node.osType.includes(node.osVersion)) {
                      return node.osType;
                    }
                    // 否则组合显示
                    return `${node.osType}${node.osVersion ? ` ${node.osVersion}` : ""}`;
                  })()}
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
            </div>
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
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
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
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
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
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
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

                {/* 网络流量 */}
                {heartbeatData?.networkInfo && heartbeatData.networkInfo.length > 0 && (
                  <div className="pt-4 border-t border-slate-200/70 dark:border-slate-700/30">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-blue-400" />
                      网络流量
                    </h4>
                    {heartbeatData.networkInfo.slice(0, 3).map((netInfo, idx) => (
                      <div key={idx} className="mb-3 last:mb-0">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                          {netInfo.interface}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">↓ 接收:</span>
                            <span className="text-slate-900 dark:text-white font-medium">
                              {(netInfo.bytesReceived / 1024 / 1024 / 1024).toFixed(2)} GB
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">↑ 发送:</span>
                            <span className="text-slate-900 dark:text-white font-medium">
                              {(netInfo.bytesSent / 1024 / 1024 / 1024).toFixed(2)} GB
                            </span>
                          </div>
                          {(netInfo.rxBps !== undefined || netInfo.txBps !== undefined) && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">速率 ↓:</span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {netInfo.rxBps ? `${(netInfo.rxBps / 1024 / 1024).toFixed(2)} MB/s` : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">速率 ↑:</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {netInfo.txBps ? `${(netInfo.txBps / 1024 / 1024).toFixed(2)} MB/s` : '-'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {heartbeatData?.uptime && (
                  <div className="pt-4 border-t border-slate-200/70 dark:border-slate-700/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-green-400" />
                        运行时间
                      </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {Math.floor(heartbeatData.uptime / 86400)}天
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无资源监控数据</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Action Buttons - fixed at bottom */}
      <div className="mt-6 space-y-3 flex-shrink-0">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onRunDiagnostics}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-900 dark:text-white font-semibold"
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
              className="w-full border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
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
              className="w-full border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
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
