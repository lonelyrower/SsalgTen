import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  Activity, 
  Thermometer,
  Cloud,
  Server,
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
    caddy?: boolean;
    xray?: boolean;
    singbox?: boolean;
    openvpn?: boolean;
    wireguard?: boolean;
    tailscale?: boolean;
    frps?: boolean;
    frpc?: boolean;
    // 允许其他扩展服务键
    [key: string]: boolean | undefined;
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
  visitorInfo?: {
    ip: string;
    asn?: {
      asn: string;
      name: string;
      org: string;
      route: string;
      type: string;
    }
  };
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

export const ServerDetailsPanel: React.FC<ServerDetailsPanelProps> = memo(({ 
  node, 
  heartbeatData,
  visitorInfo,
  className 
}) => {
  const [rxSeries, setRxSeries] = React.useState<number[]>([]);
  const [txSeries, setTxSeries] = React.useState<number[]>([]);

  // 聚合所有网卡速率，形成总吞吐量曲线（保留最近20个样本）
  React.useEffect(() => {
    if (heartbeatData?.networkInfo && heartbeatData.networkInfo.length > 0) {
      const totalRx = heartbeatData.networkInfo.reduce((acc: number, n: any) => acc + (typeof n.rxBps === 'number' ? n.rxBps : 0), 0);
      const totalTx = heartbeatData.networkInfo.reduce((acc: number, n: any) => acc + (typeof n.txBps === 'number' ? n.txBps : 0), 0);
      setRxSeries(prev => {
        const next = [...prev, totalRx];
        return next.slice(Math.max(0, next.length - 20));
      });
      setTxSeries(prev => {
        const next = [...prev, totalTx];
        return next.slice(Math.max(0, next.length - 20));
      });
    }
  }, [heartbeatData?.networkInfo]);

  const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    if (!data || data.length === 0) return null;
    const width = 160;
    const height = 36;
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      </svg>
    );
  };
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
              {/* 访问者信息 */}
              {visitorInfo?.ip && (
                <div className="mb-2">
                  <p className="text-gray-600 dark:text-gray-400">访问者 IP</p>
                  <div className="flex items-center justify-between">
                    <p className="font-medium font-mono">{visitorInfo.ip}</p>
                    {visitorInfo.asn && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        ASN: {visitorInfo.asn.asn} · {visitorInfo.asn.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {node.ipv4 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">IPv4</p>
                  <p className="font-medium font-mono">{node.ipv4}</p>
                </div>
              )}
              {node.ipv6 && node.ipv6 !== node.ipv4 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">IPv6</p>
                  <p className="font-medium font-mono text-xs">{node.ipv6}</p>
                </div>
              )}
              {(node as any).asnNumber && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">ASN 信息</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">ASN 号</span>
                      <p className="font-medium">{(node as any).asnNumber}</p>
                    </div>
                    {(node as any).asnName && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">名称</span>
                        <p className="font-medium">{(node as any).asnName}</p>
                      </div>
                    )}
                    {(node as any).asnOrg && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">组织</span>
                        <p className="font-medium">{(node as any).asnOrg}</p>
                      </div>
                    )}
                    {(node as any).asnRoute && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">路由</span>
                        <p className="font-medium font-mono">{(node as any).asnRoute}</p>
                      </div>
                    )}
                    {(node as any).asnType && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">类型</span>
                        <p className="font-medium">{(node as any).asnType}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 网络流量统计 */}
            {heartbeatData?.networkInfo && heartbeatData.networkInfo.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">流量统计</p>
                {/* 总吞吐量曲线 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600 dark:text-gray-400">总接收/发送速率</div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-green-600">{formatBps(rxSeries[rxSeries.length - 1])} RX</span>
                    <span className="text-blue-600">{formatBps(txSeries[txSeries.length - 1])} TX</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <Sparkline data={rxSeries} color="#16a34a" />
                  <Sparkline data={txSeries} color="#2563eb" />
                </div>
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
                          {typeof (net as any).rxBps === 'number' && (
                            <p className="text-gray-500">速率: {formatBps((net as any).rxBps)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">发送</p>
                          <p className="font-medium">{formatBytes(net.bytesSent)}</p>
                          <p className="text-gray-500">{net.packetsSent.toLocaleString()} 包</p>
                          {typeof (net as any).txBps === 'number' && (
                            <p className="text-gray-500">速率: {formatBps((net as any).txBps)}</p>
                          )}
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
            <div className="pt-2 border-t space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">系统服务</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(heartbeatData.services).filter(([k]) => !k.endsWith('Detail')).map(([service, isActive]) => (
                    <div key={service} className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-xs capitalize">{service}</span>
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
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Xray 自检</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">进程</p>
                        <Badge variant={detail.running ? 'success' : 'secondary'} className="text-xs">
                          {detail.running ? '存在' : '未检测到'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">监听</p>
                        <p className="font-medium">{detail.host}:{detail.port}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">TCP连通</p>
                        <Badge variant={detail.tcpOk ? 'success' : 'destructive'} className="text-xs">
                          {detail.tcpOk ? '正常' : '失败'}
                        </Badge>
                      </div>
                      {detail.tls !== undefined && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">TLS握手</p>
                          <Badge variant={detail.tlsOk ? 'success' : 'secondary'} className="text-xs">
                            {detail.tlsOk ? '成功' : '未启用/失败'}
                          </Badge>
                        </div>
                      )}
                      {detail.sni && (
                        <div className="col-span-2">
                          <p className="text-gray-600 dark:text-gray-400">SNI</p>
                          <p className="font-medium font-mono text-xs">{detail.sni}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">提示：如 Agent 运行在 bridge 网络，已透过 /host/proc 识别宿主进程。</p>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

const formatBps = (bps?: number): string => {
  if (bps === undefined || bps === null) return '-';
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  let val = bps;
  let idx = 0;
  while (val >= 1000 && idx < units.length - 1) {
    val = val / 1000;
    idx++;
  }
  return `${val.toFixed(2)} ${units[idx]}`;
};
