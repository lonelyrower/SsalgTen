/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  Thermometer,
  Server,
  Gauge,
} from "lucide-react";
import type { HeartbeatData } from "@/types/heartbeat";

interface ServerDetailsPanelProps {
  node: {
    id: string;
    name: string;
    hostname?: string;
    country: string;
    city: string;
    provider: string;
    status: string;
    osType?: string;
    osVersion?: string;
    ipv4?: string;
    ipv6?: string;
  };
  heartbeatData?: HeartbeatData;
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatUptime = (seconds?: number): string => {
  if (!seconds) return "Unknown";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const getHealthBadge = (
  health?: string,
  value?: number,
  threshold?: number,
) => {
  if (
    health === "Good" ||
    (value !== undefined && threshold !== undefined && value < threshold)
  ) {
    return (
      <Badge variant="success" className="text-xs">
        健康
      </Badge>
    );
  } else if (
    health === "Warning" ||
    (value !== undefined && threshold !== undefined && value < threshold * 1.5)
  ) {
    return (
      <Badge variant="warning" className="text-xs">
        警告
      </Badge>
    );
  } else if (health) {
    return (
      <Badge variant="destructive" className="text-xs">
        异常
      </Badge>
    );
  }
  return null;
};

export const ServerDetailsPanel: React.FC<ServerDetailsPanelProps> = memo(
  ({ node, heartbeatData, className }) => {
    const [rxSeries, setRxSeries] = React.useState<number[]>([]);
    const [txSeries, setTxSeries] = React.useState<number[]>([]);

    // 聚合所有网卡速率，形成总吞吐量曲线（保留最近20个样本）
    React.useEffect(() => {
      if (heartbeatData?.networkInfo && heartbeatData.networkInfo.length > 0) {
        const totalRx = heartbeatData.networkInfo.reduce(
          (acc: number, n: any) =>
            acc + (typeof n.rxBps === "number" ? n.rxBps : 0),
          0,
        );
        const totalTx = heartbeatData.networkInfo.reduce(
          (acc: number, n: any) =>
            acc + (typeof n.txBps === "number" ? n.txBps : 0),
          0,
        );
        setRxSeries((prev) => {
          const next = [...prev, totalRx];
          return next.slice(Math.max(0, next.length - 20));
        });
        setTxSeries((prev) => {
          const next = [...prev, totalTx];
          return next.slice(Math.max(0, next.length - 20));
        });
      }
    }, [heartbeatData?.networkInfo]);

    const Sparkline: React.FC<{ data: number[]; color: string }> = ({
      data,
      color,
    }) => {
      if (!data || data.length === 0) return null;
      const width = 160;
      const height = 36;
      const max = Math.max(...data, 1);
      const points = data
        .map((v, i) => {
          const x = (i / (data.length - 1)) * width;
          const y = height - (v / max) * height;
          return `${x},${y}`;
        })
        .join(" ");
      return (
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
          />
        </svg>
      );
    };

    return (
      <div className={className}>
        {/* 系统信息内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 系统概览 - 使用 info 变体（蓝色） */}
            <GlassCard variant="info">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <Server className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span>系统概览</span>
                </h3>
                <Badge
                  variant={
                    node.status === "online" ? "success" : "destructive"
                  }
                >
                  {node.status === "online" ? "在线" : "离线"}
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">主机名</p>
                    <p className="font-medium text-gray-900 dark:text-white">{node.hostname || node.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">操作系统</p>
                    <p className="font-medium text-gray-900 dark:text-white">{node.osType || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">系统版本</p>
                    <p className="font-medium text-gray-900 dark:text-white">{node.osVersion || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">运行时间</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatUptime(heartbeatData?.uptime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">地理位置</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {node.city}, {node.country}
                    </p>
                  </div>
                  {heartbeatData?.virtualization && (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 text-center">虚拟化</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {heartbeatData.virtualization.type}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* CPU 信息 - 使用 orange 变体（橙色） */}
            <GlassCard variant="orange">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Cpu className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span>CPU</span>
                </h3>
                {heartbeatData?.cpuInfo && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {heartbeatData.cpuInfo.usage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">使用率</p>
                  </div>
                )}
              </div>
              <div>
                {heartbeatData?.cpuInfo ? (
                  <div className="space-y-3">
                    <div className="pb-3 border-b border-orange-200/30 dark:border-orange-700/30">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {heartbeatData.cpuInfo.model}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {heartbeatData.cpuInfo.cores} 核心 · {heartbeatData.cpuInfo.threads} 线程 · {heartbeatData.cpuInfo.frequency}MHz · {heartbeatData.cpuInfo.architecture}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {heartbeatData.cpuInfo.temperature && (
                        <div className="flex items-center space-x-2">
                          <Thermometer className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">温度</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {heartbeatData.cpuInfo.temperature}°C
                            </p>
                          </div>
                        </div>
                      )}
                      {heartbeatData.loadAverage && heartbeatData.loadAverage.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Gauge className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">负载(1m)</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {heartbeatData.loadAverage[0]?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    暂无CPU信息
                  </p>
                )}
              </div>
            </GlassCard>

            {/* 内存信息 - 使用 purple 变体（紫色） */}
            <GlassCard variant="purple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <MemoryStick className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>内存</span>
                </h3>
                {heartbeatData?.memoryInfo && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {heartbeatData.memoryInfo.usage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">使用率</p>
                  </div>
                )}
              </div>
              <div>
                {heartbeatData?.memoryInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">总容量</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(heartbeatData.memoryInfo.total / 1024).toFixed(1)} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">已使用</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(heartbeatData.memoryInfo.used / 1024).toFixed(1)} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">可用</p>
                        <p className="font-medium text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]">
                          {(heartbeatData.memoryInfo.available / 1024).toFixed(1)} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">空闲</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(heartbeatData.memoryInfo.free / 1024).toFixed(1)} GB
                        </p>
                      </div>
                    </div>

                    {(heartbeatData.memoryInfo.type || heartbeatData.memoryInfo.speed) && (
                      <div className="pt-3 border-t border-purple-200/30 dark:border-purple-700/30">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {heartbeatData.memoryInfo.type && (
                            <div>
                              <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">类型</p>
                              <Badge variant="secondary" className="text-xs">
                                {heartbeatData.memoryInfo.type}
                              </Badge>
                            </div>
                          )}
                          {heartbeatData.memoryInfo.speed && (
                            <div>
                              <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">频率</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {heartbeatData.memoryInfo.speed} MT/s
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    暂无内存信息
                  </p>
                )}
              </div>
            </GlassCard>

            {/* 磁盘信息 - 使用 warning 变体（黄色） */}
            <GlassCard variant="warning">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-[hsl(var(--status-warning-100))] dark:bg-[hsl(var(--status-warning-900)/0.3)] rounded-lg">
                    <HardDrive className="h-5 w-5 text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]" />
                  </div>
                  <span>磁盘</span>
                </h3>
                {heartbeatData?.diskInfo && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {heartbeatData.diskInfo.usage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">使用率</p>
                  </div>
                )}
              </div>
              <div>
                {heartbeatData?.diskInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">总容量</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {heartbeatData.diskInfo.total} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">已使用</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {heartbeatData.diskInfo.used} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">可用空间</p>
                        <p className="font-medium text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]">
                          {heartbeatData.diskInfo.free} GB
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">类型</p>
                        {heartbeatData.diskInfo.type ? (
                          <Badge
                            variant={
                              heartbeatData.diskInfo.type === "SSD"
                                ? "success"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {heartbeatData.diskInfo.type}
                          </Badge>
                        ) : (
                          <p className="font-medium text-gray-900 dark:text-white">未知</p>
                        )}
                      </div>
                    </div>

                    {(heartbeatData.diskInfo.model || heartbeatData.diskInfo.temperature || heartbeatData.diskInfo.health) && (
                      <div className="pt-3 border-t border-yellow-200/30 dark:border-yellow-700/30 space-y-2">
                        {heartbeatData.diskInfo.model && (
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">型号</p>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">
                              {heartbeatData.diskInfo.model}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {heartbeatData.diskInfo.health && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">健康:</span>
                              {getHealthBadge(heartbeatData.diskInfo.health)}
                            </div>
                          )}
                          {heartbeatData.diskInfo.temperature && (
                            <div className="flex items-center space-x-2">
                              <Thermometer className="h-4 w-4 text-[hsl(var(--status-warning-500))] dark:text-[hsl(var(--status-warning-400))]" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {heartbeatData.diskInfo.temperature}°C
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    暂无磁盘信息
                  </p>
                )}
              </div>
            </GlassCard>

            {/* 网络信息 - 使用 success 变体（绿色） */}
            <GlassCard variant="success">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-[hsl(var(--status-success-100))] dark:bg-[hsl(var(--status-success-900)/0.3)] rounded-lg">
                    <Network className="h-5 w-5 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" />
                  </div>
                  <span>网络</span>
                </h3>
              </div>
              <div>
                <div className="space-y-3">
                  {/* 基础网络信息 */}
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    {node.ipv4 && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">IPv4 地址</p>
                        <p className="font-medium font-mono text-gray-900 dark:text-white">{node.ipv4}</p>
                      </div>
                    )}
                    {node.ipv6 && node.ipv6.includes(":") && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">IPv6 地址</p>
                        <p className="font-medium font-mono text-xs text-gray-900 dark:text-white break-all">
                          {node.ipv6}
                        </p>
                      </div>
                    )}
                    {(node as any).asnNumber && (
                      <div className="pt-3 border-t border-green-200/30 dark:border-green-700/30">
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">ASN 信息</p>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">ASN</span>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {(node as any).asnNumber}
                            </p>
                          </div>
                          {(node as any).asnName && (
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">名称</span>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {(node as any).asnName}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 网络流量统计 */}
                  {heartbeatData?.networkInfo &&
                    heartbeatData.networkInfo.length > 0 && (
                      <div className="pt-3 border-t border-green-200/30 dark:border-green-700/30">
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">流量统计</p>
                        {/* 总吞吐量显示 */}
                        <div className="flex items-center justify-between mb-3 p-2 bg-[hsl(var(--status-success-50)/0.5)] dark:bg-[hsl(var(--status-success-900)/0.1)] rounded-lg">
                          <div className="flex items-center space-x-3 text-xs">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">接收 ↓</span>
                              <p className="text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] font-medium">
                                {formatBps(rxSeries[rxSeries.length - 1])}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">发送 ↑</span>
                              <p className="text-blue-600 dark:text-blue-400 font-medium">
                                {formatBps(txSeries[txSeries.length - 1])}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <Sparkline data={rxSeries} color="#16a34a" />
                          <Sparkline data={txSeries} color="#2563eb" />
                        </div>
                        <div className="space-y-2">
                          {heartbeatData.networkInfo.map((net, index) => (
                            <div
                              key={index}
                              className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 p-3 rounded-lg border border-green-200/30 dark:border-green-700/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm text-gray-900 dark:text-white">
                                  {net.interface}
                                </span>
                                {net.speed && (
                                  <Badge variant="outline" className="text-xs">
                                    {net.speed} Mbps {net.duplex}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400 mb-1">接收</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {formatBytes(net.bytesReceived)}
                                  </p>
                                  <p className="text-gray-500 dark:text-gray-400">
                                    {net.packetsReceived.toLocaleString()} 包
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 dark:text-gray-400 mb-1">发送</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {formatBytes(net.bytesSent)}
                                  </p>
                                  <p className="text-gray-500 dark:text-gray-400">
                                    {net.packetsSent.toLocaleString()} 包
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </GlassCard>

            {/* 进程和服务 - 使用 danger 变体（红色） */}
            <GlassCard variant="danger">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <div className="p-2 bg-[hsl(var(--status-error-100))] dark:bg-[hsl(var(--status-error-900)/0.3)] rounded-lg">
                    <Activity className="h-5 w-5 text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]" />
                  </div>
                  <span>进程和服务</span>
                </h3>
                {heartbeatData?.processInfo && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {heartbeatData.processInfo.total}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">总进程</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {/* 进程信息 */}
                {heartbeatData?.processInfo && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">进程统计</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center p-3 bg-[hsl(var(--status-error-50)/0.5)] dark:bg-[hsl(var(--status-error-900)/0.1)] rounded-lg border border-[hsl(var(--status-error-200)/0.3)] dark:border-[hsl(var(--status-error-700)/0.3)]">
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">运行中</p>
                        <p className="font-bold text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] text-lg">
                          {heartbeatData.processInfo.running}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">睡眠</p>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">
                          {heartbeatData.processInfo.sleeping}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-[hsl(var(--status-error-50)/0.5)] dark:bg-[hsl(var(--status-error-900)/0.1)] rounded-lg border border-[hsl(var(--status-error-200)/0.3)] dark:border-[hsl(var(--status-error-700)/0.3)]">
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">僵尸</p>
                        <p
                          className={`font-bold text-lg ${heartbeatData.processInfo.zombie > 0 ? "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]" : "text-gray-900 dark:text-white"}`}
                        >
                          {heartbeatData.processInfo.zombie}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 系统服务 */}
                {heartbeatData?.services &&
                  (() => {
                    // 只显示检测到的服务（值为 true 的）
                    const activeServices = Object.entries(
                      heartbeatData.services,
                    ).filter(([k, v]) => !k.endsWith("Detail") && v === true);

                    if (activeServices.length === 0) return null;

                    return (
                      <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/30 space-y-3">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">系统服务</p>
                          <div className="grid grid-cols-3 gap-2">
                            {activeServices.map(([service]) => (
                              <div
                                key={service}
                                className="flex items-center space-x-2 p-2 bg-[hsl(var(--status-success-50)/0.5)] dark:bg-[hsl(var(--status-success-900)/0.1)] rounded-lg border border-[hsl(var(--status-success-200)/0.3)] dark:border-[hsl(var(--status-success-700)/0.3)]"
                              >
                                <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-success-500))] animate-pulse"></div>
                                <span className="text-xs capitalize text-gray-900 dark:text-white font-medium">
                                  {service}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Xray 自检 */}
                        {(() => {
                          const svc: any = heartbeatData.services;
                          const detail = svc?.xrayDetail;
                          if (!detail) return null;
                          return (
                            <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
                                Xray 自检
                              </p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">进程</p>
                                  <Badge
                                    variant={
                                      detail.running ? "success" : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {detail.running ? "存在" : "未检测到"}
                                  </Badge>
                                </div>
                                <div className="p-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">TCP连通</p>
                                  <Badge
                                    variant={
                                      detail.tcpOk ? "success" : "destructive"
                                    }
                                    className="text-xs"
                                  >
                                    {detail.tcpOk ? "正常" : "失败"}
                                  </Badge>
                                </div>
                                <div className="p-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">监听地址</p>
                                  <p className="font-medium font-mono text-xs text-gray-900 dark:text-white">
                                    {detail.host}:{detail.port}
                                  </p>
                                </div>
                                {detail.tls !== undefined && (
                                  <div className="p-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">TLS握手</p>
                                    <Badge
                                      variant={
                                        detail.tlsOk ? "success" : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {detail.tlsOk ? "成功" : "未启用"}
                                    </Badge>
                                  </div>
                                )}
                                {detail.sni && (
                                  <div className="col-span-2 p-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-slate-200/30 dark:border-slate-700/30">
                                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">SNI</p>
                                    <p className="font-medium font-mono text-xs text-gray-900 dark:text-white break-all">
                                      {detail.sni}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
                                提示：如 Agent 运行在 bridge 网络，已透过 /host/proc 识别宿主进程。
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
              </div>
            </GlassCard>
          </div>
      </div>
    );
  },
);

const formatBps = (bps?: number): string => {
  if (bps === undefined || bps === null) return "-";
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let val = bps;
  let idx = 0;
  while (val >= 1000 && idx < units.length - 1) {
    val = val / 1000;
    idx++;
  }
  return `${val.toFixed(2)} ${units[idx]}`;
};
