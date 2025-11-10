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
  X,
} from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NodeData } from "@/services/api";
import type { HeartbeatData } from "@/types/heartbeat";

interface EnhancedNodeDetailsPanelProps {
  node: NodeData | null;
  heartbeatData?: HeartbeatData | null;
  onShowDetails?: () => void;
  layout?: "sidebar" | "modal";
  onClose?: () => void;
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

// 简化操作系统显示
const simplifyOsString = (osType?: string, osVersion?: string): string => {
  if (!osType) return "未知";

  // 移除多余的内核和版本信息
  let simplified = osType;

  // 提取主要发行版名称和版本号
  // 例如: "Alpine Linux v3.21 #1 SMP..." -> "Alpine Linux v3.21"
  // "Ubuntu 24.04.1 LTS (Noble...)" -> "Ubuntu 24.04"

  // 移除 #1 SMP 及之后的内容
  simplified = simplified.replace(/#\d+\s+SMP.*$/i, '').trim();

  // 移除 LTS 后面括号内的内容
  simplified = simplified.replace(/\s*LTS\s*\([^)]+\)/i, ' LTS').trim();

  // 移除其他括号内容
  simplified = simplified.replace(/\([^)]+\)/g, '').trim();

  // 如果 osVersion 已经包含在 osType 中，直接返回
  if (osVersion && simplified.includes(osVersion)) {
    return simplified;
  }

  // 否则组合显示
  return osVersion ? `${simplified} ${osVersion}`.trim() : simplified;
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
    <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))] last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[hsl(var(--info))]" />
        <span className="text-[hsl(var(--muted-foreground))] text-sm whitespace-nowrap">{label}</span>
      </div>
      <span
        className={`text-[hsl(var(--foreground))] font-semibold text-sm ${mono ? "font-mono" : ""}`}
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
      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] mb-2">
        <span>{label}</span>
        <span className="font-semibold text-[hsl(var(--foreground))]">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-[hsl(var(--muted))]/70 rounded-full overflow-hidden">
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
  onShowDetails,
  layout = "sidebar",
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"info" | "resources">("info");
  const isModalLayout = layout === "modal";

  if (!node) {
    return (
      <motion.div
        className={`group relative ${
          isModalLayout
            ? "max-h-[60vh] w-full rounded-2xl p-6"
            : "sticky top-24 lg:h-[800px] rounded-2xl p-8 hover:-translate-y-0.5 hover:shadow-xl"
        } overflow-hidden border-2 border-primary/60 bg-gradient-to-br from-primary/10 via-[hsl(var(--surface-base))] to-primary/5 shadow-lg transition-all duration-300 flex flex-col`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-primary/15 via-transparent to-primary/10" />
        <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative text-center py-12">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🌍
          </motion.div>
          <p className="text-[hsl(var(--muted-foreground))]">选择一个节点查看详情</p>
        </div>
      </motion.div>
    );
  }

  // 根据节点状态选择颜色主题
  const isOnline = node.status === "online";
  const themeColors = isOnline
    ? {
        border: "border-[hsl(var(--info))]/30",
        bg: "from-[hsl(var(--info))]/10 via-[hsl(var(--surface-base))] to-[hsl(var(--info))]/5",
        glow: "from-[hsl(var(--info))]/15 via-transparent to-[hsl(var(--info))]/10",
        glowCircle: "bg-[hsl(var(--info))]/20",
      }
    : {
        border: "border-[hsl(var(--error))]/30",
        bg: "from-[hsl(var(--error))]/10 via-[hsl(var(--surface-base))] to-[hsl(var(--error))]/5",
        glow: "from-[hsl(var(--error))]/15 via-transparent to-[hsl(var(--error))]/10",
        glowCircle: "bg-[hsl(var(--error))]/20",
      };

  return (
    <motion.div
      className={`group relative w-full overflow-y-auto overflow-x-hidden border-2 ${themeColors.border} bg-gradient-to-br ${themeColors.bg} shadow-lg transition-all duration-300 flex flex-col ${
        isModalLayout
          ? "max-h-[85vh] rounded-t-3xl p-6"
          : "sticky top-24 lg:h-[800px] rounded-2xl p-8 hover:-translate-y-0.5 hover:shadow-xl"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      key={node.id}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${themeColors.glow}`} />
      <div className={`absolute -top-12 -right-16 h-32 w-32 rounded-full ${themeColors.glowCircle} blur-3xl`} />
      {/* Header */}
      <div className="relative flex items-start gap-4 mb-6">
        <span className="text-5xl">{getStatusIcon(node.status)}</span>
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <h3 className="text-2xl font-black text-[hsl(var(--foreground))] flex-1 break-words">
              {node.name}
            </h3>
            <Badge
              variant={node.status === "online" ? "success" : "destructive"}
              className={node.status === "online"
                ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30"
                : "bg-[hsl(var(--error))]/20 text-[hsl(var(--error))] border border-[hsl(var(--error))]/30"
              }
            >
              {node.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="relative flex gap-2 mb-6 p-1 bg-[hsl(var(--muted))]/70 rounded-lg">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "info"
              ? "bg-[hsl(var(--info))] text-white shadow-md"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
          }`}
        >
          <Server className="h-4 w-4 inline mr-2" />
          基本信息
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "resources"
              ? "bg-[hsl(var(--info))] text-white shadow-md"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
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
            <div className="pb-2 mb-2 border-b border-[hsl(var(--border))]">
              <h4 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">地址信息</h4>
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
            <div className="pb-2 mb-2 border-b border-[hsl(var(--border))]">
              <h4 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">网络信息</h4>
              {node.asnNumber && (
                <DetailItem
                  label="ASN"
                  value={node.asnNumber}
                  icon={Hash}
                />
              )}
              <DetailItem label="服务商" value={node.provider} icon={Globe} />
            </div>

            {/* 系统信息区域 */}
            <div>
              <h4 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">系统信息</h4>
              {node.osType && (
                <DetailItem
                  label="操作系统"
                  value={simplifyOsString(node.osType, node.osVersion)}
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
                    <h4 className="text-sm font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[hsl(var(--info))]" />
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
                    <h4 className="text-sm font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-primary" />
                      内存使用
                    </h4>
                    <ResourceBar
                      label="内存"
                      value={
                        heartbeatData.memoryInfo.total
                          ? Number(((heartbeatData.memoryInfo.used /
                              heartbeatData.memoryInfo.total) *
                            100).toFixed(2))
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
                    <h4 className="text-sm font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-[hsl(var(--warning))]" />
                      磁盘使用
                    </h4>
                    <ResourceBar
                      label="存储空间"
                      value={
                        heartbeatData.diskInfo.total
                          ? Number(((heartbeatData.diskInfo.used /
                              heartbeatData.diskInfo.total) *
                            100).toFixed(2))
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
                  <div className="pt-4 border-t border-[hsl(var(--border))]">
                    <h4 className="text-sm font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-[hsl(var(--info))]" />
                      网络流量
                    </h4>
                    {(() => {
                      // 合并所有网卡的流量数据
                      const totalRx = heartbeatData.networkInfo.reduce((sum, ni) => sum + (ni.bytesReceived || 0), 0);
                      const totalTx = heartbeatData.networkInfo.reduce((sum, ni) => sum + (ni.bytesSent || 0), 0);
                      const totalRxBps = heartbeatData.networkInfo.reduce((sum, ni) => sum + (ni.rxBps || 0), 0);
                      const totalTxBps = heartbeatData.networkInfo.reduce((sum, ni) => sum + (ni.txBps || 0), 0);

                      return (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[hsl(var(--muted-foreground))]">↓ 接收:</span>
                            <span className="text-[hsl(var(--foreground))] font-medium">
                              {(totalRx / 1024 / 1024 / 1024).toFixed(2)} GB
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[hsl(var(--muted-foreground))]">↑ 发送:</span>
                            <span className="text-[hsl(var(--foreground))] font-medium">
                              {(totalTx / 1024 / 1024 / 1024).toFixed(2)} GB
                            </span>
                          </div>
                          {(totalRxBps > 0 || totalTxBps > 0) && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-[hsl(var(--muted-foreground))]">速率 ↓:</span>
                                <span className="text-[hsl(var(--success))] font-medium">
                                  {totalRxBps > 0 ? `${(totalRxBps / 1024 / 1024).toFixed(2)} MB/s` : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[hsl(var(--muted-foreground))]">速率 ↑:</span>
                                <span className="text-[hsl(var(--info))] font-medium">
                                  {totalTxBps > 0 ? `${(totalTxBps / 1024 / 1024).toFixed(2)} MB/s` : '-'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {heartbeatData?.uptime && (
                  <div className="pt-4 border-t border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[hsl(var(--success))]" />
                        运行时间
                      </span>
                      <span className="text-[hsl(var(--foreground))] font-semibold">
                        {Math.floor(heartbeatData.uptime / 86400)}天
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无资源监控数据</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Action Button - unified entry point */}
      <div className="mt-6 flex-shrink-0">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onShowDetails}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-lg"
          >
            <Zap className="h-4 w-4 mr-2" />
            查看详情
          </Button>
        </motion.div>
        <p className="text-xs text-center text-[hsl(var(--muted-foreground))] mt-2">
          包含网络诊断、系统详情、运行日志等
        </p>
      </div>
    </motion.div>
  );
};
