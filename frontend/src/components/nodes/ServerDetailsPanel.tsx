import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  Activity, 
  Thermometer,
  Cloud,
  Server,
  Shield,
  Database,
  Globe,
  Gauge
} from 'lucide-react';

interface SystemInfo {
  cpu?: {
    model: string;
    cores: number;
    threads: number;
    frequency: number;
    usage: number;
    temperature?: number;
    architecture: string;
  };
  memory?: {
    total: number;
    used: number;
    free: number;
    available: number;
    usage: number;
    type?: string;
    speed?: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
    usage: number;
    type?: string;
    model?: string;
    health?: string;
    temperature?: number;
  };
  network?: Array<{
    interface: string;
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    speed?: number;
    duplex?: string;
  }>;
  processes?: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  virtualization?: {
    type: string;
    provider?: string;
  };
  services?: {
    docker?: boolean;
    nginx?: boolean;
    apache?: boolean;
    mysql?: boolean;
    postgresql?: boolean;
    redis?: boolean;
  };
  loadAverage?: number[];
}

interface HeartbeatData {
  uptime?: number;
  cpuInfo?: SystemInfo['cpu'];
  memoryInfo?: SystemInfo['memory'];
  diskInfo?: SystemInfo['disk'];
  networkInfo?: SystemInfo['network'];
  processInfo?: SystemInfo['processes'];
  virtualization?: SystemInfo['virtualization'];
  services?: SystemInfo['services'];
  loadAverage?: number[];
}

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
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatUptime = (seconds?: number): string => {
  if (!seconds) return 'Unknown';
  
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

const getUsageColor = (usage: number): string => {
  if (usage >= 90) return 'text-red-600 dark:text-red-400';
  if (usage >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
};

const getHealthBadge = (health?: string, value?: number, threshold?: number) => {
  if (health === 'Good' || (value !== undefined && threshold !== undefined && value < threshold)) {
    return <Badge variant="success" className="text-xs">健康</Badge>;
  } else if (health === 'Warning' || (value !== undefined && threshold !== undefined && value < threshold * 1.5)) {
    return <Badge variant="warning" className="text-xs">警告</Badge>;
  } else if (health) {
    return <Badge variant="destructive" className="text-xs">异常</Badge>;
  }
  return null;
};

export const ServerDetailsPanel: React.FC<ServerDetailsPanelProps> = ({ 
  node, 
  heartbeatData,
  className 
}) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* 系统概览 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <Server className="h-4 w-4" />
            <span>系统概览</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">主机名</p>
              <p className="font-medium">{node.hostname || node.name}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">状态</p>
              <Badge variant={node.status === 'online' ? 'success' : 'destructive'}>
                {node.status === 'online' ? '在线' : '离线'}
              </Badge>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">操作系统</p>
              <p className="font-medium">{node.osType || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">版本</p>
              <p className="font-medium">{node.osVersion || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">运行时间</p>
              <p className="font-medium">{formatUptime(heartbeatData?.uptime)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">地理位置</p>
              <p className="font-medium">{node.city}, {node.country}</p>
            </div>
          </div>
          
          {/* 虚拟化信息 */}
          {heartbeatData?.virtualization && (
            <div className="pt-2 border-t">
              <div className="flex items-center space-x-2 mb-2">
                <Cloud className="h-4 w-4" />
                <span className="text-sm font-medium">虚拟化</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">{heartbeatData.virtualization.type}</Badge>
                {heartbeatData.virtualization.provider && (
                  <Badge variant="outline">{heartbeatData.virtualization.provider}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CPU 信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <Cpu className="h-4 w-4" />
            <span>CPU</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {heartbeatData?.cpuInfo ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">{heartbeatData.cpuInfo.model}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {heartbeatData.cpuInfo.cores} 核心 / {heartbeatData.cpuInfo.threads} 线程 @ {heartbeatData.cpuInfo.frequency}MHz
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">使用率</p>
                  <p className={`font-medium ${getUsageColor(heartbeatData.cpuInfo.usage)}`}>
                    {heartbeatData.cpuInfo.usage.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">架构</p>
                  <p className="font-medium">{heartbeatData.cpuInfo.architecture}</p>
                </div>
              </div>
              
              {heartbeatData.cpuInfo.temperature && (
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Thermometer className="h-4 w-4" />
                  <span className="text-sm">温度: {heartbeatData.cpuInfo.temperature}°C</span>
                  {getHealthBadge(undefined, heartbeatData.cpuInfo.temperature, 80)}
                </div>
              )}
              
              {heartbeatData.loadAverage && heartbeatData.loadAverage.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center space-x-2 mb-1">
                    <Gauge className="h-4 w-4" />
                    <span className="text-sm font-medium">负载平均值</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    1min: {heartbeatData.loadAverage[0]?.toFixed(2)}, 
                    5min: {heartbeatData.loadAverage[1]?.toFixed(2)}, 
                    15min: {heartbeatData.loadAverage[2]?.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">暂无CPU信息</p>
          )}
        </CardContent>
      </Card>

      {/* 内存信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <MemoryStick className="h-4 w-4" />
            <span>内存</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {heartbeatData?.memoryInfo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">总容量</p>
                  <p className="font-medium">{(heartbeatData.memoryInfo.total / 1024).toFixed(1)} GB</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">已使用</p>
                  <p className={`font-medium ${getUsageColor(heartbeatData.memoryInfo.usage)}`}>
                    {(heartbeatData.memoryInfo.used / 1024).toFixed(1)} GB ({heartbeatData.memoryInfo.usage.toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">可用</p>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {(heartbeatData.memoryInfo.available / 1024).toFixed(1)} GB
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">空闲</p>
                  <p className="font-medium">
                    {(heartbeatData.memoryInfo.free / 1024).toFixed(1)} GB
                  </p>
                </div>
              </div>
              
              {(heartbeatData.memoryInfo.type || heartbeatData.memoryInfo.speed) && (
                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {heartbeatData.memoryInfo.type && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">类型</p>
                        <Badge variant="secondary">{heartbeatData.memoryInfo.type}</Badge>
                      </div>
                    )}
                    {heartbeatData.memoryInfo.speed && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">频率</p>
                        <p className="font-medium">{heartbeatData.memoryInfo.speed} MT/s</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">暂无内存信息</p>
          )}
        </CardContent>
      </Card>

      {/* 磁盘信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <HardDrive className="h-4 w-4" />
            <span>磁盘</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {heartbeatData?.diskInfo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">总容量</p>
                  <p className="font-medium">{heartbeatData.diskInfo.total} GB</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">已使用</p>
                  <p className={`font-medium ${getUsageColor(heartbeatData.diskInfo.usage)}`}>
                    {heartbeatData.diskInfo.used} GB ({heartbeatData.diskInfo.usage.toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">可用空间</p>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {heartbeatData.diskInfo.free} GB
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">类型</p>
                  {heartbeatData.diskInfo.type ? (
                    <Badge variant={heartbeatData.diskInfo.type === 'SSD' ? 'success' : 'secondary'}>
                      {heartbeatData.diskInfo.type}
                    </Badge>
                  ) : (
                    <p className="font-medium">未知</p>
                  )}
                </div>
              </div>
              
              {heartbeatData.diskInfo.model && (
                <div className="pt-2 border-t">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">型号</p>
                  <p className="font-medium text-sm">{heartbeatData.diskInfo.model}</p>
                </div>
              )}
              
              <div className="pt-2 border-t flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {heartbeatData.diskInfo.health && (
                    <>
                      <span className="text-sm">健康状态:</span>
                      {getHealthBadge(heartbeatData.diskInfo.health)}
                    </>
                  )}
                </div>
                {heartbeatData.diskInfo.temperature && (
                  <div className="flex items-center space-x-2">
                    <Thermometer className="h-4 w-4" />
                    <span className="text-sm">{heartbeatData.diskInfo.temperature}°C</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">暂无磁盘信息</p>
          )}
        </CardContent>
      </Card>

      {/* 网络信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <Network className="h-4 w-4" />
            <span>网络</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 基础网络信息 */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              {node.ipv4 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">IPv4</p>
                  <p className="font-medium font-mono">{node.ipv4}</p>
                </div>
              )}
              {node.ipv6 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">IPv6</p>
                  <p className="font-medium font-mono text-xs">{node.ipv6}</p>
                </div>
              )}
            </div>

            {/* 网络流量统计 */}
            {heartbeatData?.networkInfo && heartbeatData.networkInfo.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">流量统计</p>
                <div className="space-y-2">
                  {heartbeatData.networkInfo.map((net, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{net.interface}</span>
                        {net.speed && (
                          <Badge variant="outline" className="text-xs">
                            {net.speed} Mbps {net.duplex}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">接收</p>
                          <p className="font-medium">{formatBytes(net.bytesReceived)}</p>
                          <p className="text-gray-500">{net.packetsReceived.toLocaleString()} 包</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">发送</p>
                          <p className="font-medium">{formatBytes(net.bytesSent)}</p>
                          <p className="text-gray-500">{net.packetsSent.toLocaleString()} 包</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 进程和服务 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <Activity className="h-4 w-4" />
            <span>进程和服务</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 进程信息 */}
          {heartbeatData?.processInfo && (
            <div>
              <p className="text-sm font-medium mb-2">进程统计</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">总进程数</p>
                  <p className="font-medium">{heartbeatData.processInfo.total}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">运行中</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{heartbeatData.processInfo.running}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">睡眠</p>
                  <p className="font-medium">{heartbeatData.processInfo.sleeping}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">僵尸进程</p>
                  <p className={`font-medium ${heartbeatData.processInfo.zombie > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {heartbeatData.processInfo.zombie}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 系统服务 */}
          {heartbeatData?.services && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">系统服务</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(heartbeatData.services).map(([service, isActive]) => (
                  <div key={service} className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-xs capitalize">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};