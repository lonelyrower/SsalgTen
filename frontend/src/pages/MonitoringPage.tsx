import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useRealTime } from '@/hooks/useRealTime';
import { Server, Cpu, HardDrive, Activity, Clock, MapPin, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';

// Remove the custom interface since useRealTime provides the data structure we need

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'online':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'offline':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'online':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    case 'offline':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    default:
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  }
};

const formatUptime = (uptime: number | null) => {
  if (!uptime || uptime <= 0) return '--';
  const days = Math.floor(uptime / (24 * 3600));
  const hours = Math.floor((uptime % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// 目前未显示原始内存/磁盘容量，去除未使用的格式化函数以避免编译告警

const ProgressBar: React.FC<{ 
  value: number | null | undefined; 
  color: 'blue' | 'green' | 'yellow' | 'red'; 
  size?: 'sm' | 'md' 
}> = ({ value, color, size = 'md' }) => {
  const percentage = value || 0;
  const height = size === 'sm' ? 'h-2' : 'h-3';
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className={`w-full ${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
      <div 
        className={`${height} ${colorClasses[color]} transition-all duration-300 ease-in-out`}
        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
      />
    </div>
  );
};

export const MonitoringPage: React.FC = () => {
  const { /* user */ } = useAuth();
  const { nodes, connected, lastUpdate, refreshData } = useRealTime();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set loading to false once we have data or after a short delay
    const timer = setTimeout(() => setLoading(false), 1000);
    if (nodes.length > 0) {
      setLoading(false);
    }
    return () => clearTimeout(timer);
  }, [nodes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </main>
      </div>
    );
  }

  // Remove error handling since useRealTime handles it internally

  const onlineNodes = nodes.filter(node => node.status.toLowerCase() === 'online').length;
  const totalNodes = nodes.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题和状态 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                <Server className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  监控概览
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  实时监控 {totalNodes} 个节点的系统状态
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end space-x-4 mb-2">
                <div className="flex items-center space-x-2">
                  {connected ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {connected ? '实时连接' : '离线模式'}
                  </span>
                </div>
                <button
                  onClick={refreshData}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  刷新
                </button>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                最后更新: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '--'}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {onlineNodes}/{totalNodes} 在线
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 节点网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 p-6 transition-all duration-200 hover:shadow-lg ${getStatusColor(node.status)}`}
            >
              {/* 节点头部信息 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {getStatusIcon(node.status)}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {node.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{node.city}, {node.country}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {node.provider}
                  </div>
                </div>
              </div>

              {/* 系统资源使用率 */}
              <div className="space-y-4">
                {/* CPU使用率 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU</span>
                    </div>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {node.cpuUsage !== undefined && node.cpuUsage !== null ? `${node.cpuUsage.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar 
                    value={node.cpuUsage} 
                    color="green" 
                    size="sm" 
                  />
                </div>

                {/* 内存使用率 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">内存</span>
                    </div>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {node.memoryUsage !== undefined && node.memoryUsage !== null ? `${node.memoryUsage.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar 
                    value={node.memoryUsage} 
                    color="green" 
                    size="sm" 
                  />
                </div>

                {/* 磁盘使用率 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">磁盘</span>
                    </div>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {node.diskUsage !== undefined && node.diskUsage !== null ? `${node.diskUsage.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar 
                    value={node.diskUsage} 
                    color="green" 
                    size="sm" 
                  />
                </div>
              </div>

              {/* 运行时间 */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">运行时间</span>
                  </div>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {formatUptime(node.uptime)}
                  </span>
                </div>
                {node.lastSeen && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    最后在线: {new Date(node.lastSeen).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 空状态 */}
        {nodes.length === 0 && (
          <div className="text-center py-12">
            <Server className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              暂无节点
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              请先添加监控节点
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
