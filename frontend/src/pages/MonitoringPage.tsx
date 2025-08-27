import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useRealTime } from '@/hooks/useRealTime';
import { Server, Cpu, HardDrive, Activity, Clock, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff, List, LayoutGrid, Globe, BarChart3, PieChart } from 'lucide-react';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';

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

const formatUptime = (uptime: number | null | undefined) => {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // 布局模式

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

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter(node => node.status.toLowerCase() === 'online').length;
  const offlineNodes = nodes.filter(node => node.status.toLowerCase() === 'offline').length;
  const unknownNodes = totalNodes - onlineNodes - offlineNodes;

  // 计算国家/地区分布
  const countryStats = nodes.reduce((acc, node) => {
    acc[node.country] = (acc[node.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCountries = Object.entries(countryStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // 计算服务商分布
  const providerStats = nodes.reduce((acc, node) => {
    acc[node.provider] = (acc[node.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProviders = Object.entries(providerStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  // 计算平均资源使用率
  const avgCpuUsage = nodes.length > 0 
    ? nodes.filter(n => n.cpuUsage != null).reduce((sum, n) => sum + (n.cpuUsage || 0), 0) / nodes.filter(n => n.cpuUsage != null).length
    : 0;

  const avgMemoryUsage = nodes.length > 0 
    ? nodes.filter(n => n.memoryUsage != null).reduce((sum, n) => sum + (n.memoryUsage || 0), 0) / nodes.filter(n => n.memoryUsage != null).length
    : 0;

  const avgDiskUsage = nodes.length > 0 
    ? nodes.filter(n => n.diskUsage != null).reduce((sum, n) => sum + (n.diskUsage || 0), 0) / nodes.filter(n => n.diskUsage != null).length
    : 0;


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
                
                {/* 布局切换按钮 */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    title="网格布局"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    title="列表布局"
                  >
                    <List className="h-4 w-4" />
                  </button>
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

        {/* 统计信息卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8 max-w-none">
          {/* 节点状态分布 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  节点状态分布
                </h3>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">在线</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{onlineNodes}</span>
                  <span className="text-xs text-gray-500">
                    {totalNodes > 0 ? ((onlineNodes / totalNodes) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">离线</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{offlineNodes}</span>
                  <span className="text-xs text-gray-500">
                    {totalNodes > 0 ? ((offlineNodes / totalNodes) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
              {unknownNodes > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">未知</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{unknownNodes}</span>
                    <span className="text-xs text-gray-500">
                      {((unknownNodes / totalNodes) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 地理分布 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  地理分布
                </h3>
              </div>
            </div>
            <div className="space-y-2">
              {topCountries.slice(0, 4).map(([country, count]) => (
                <div key={country} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CountryFlagSvg country={country} size={16} />
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {country}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
              {Object.keys(countryStats).length > 4 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                  还有 {Object.keys(countryStats).length - 4} 个国家/地区
                </div>
              )}
            </div>
          </div>

          {/* 平均资源使用 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  平均资源使用
                </h3>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">CPU</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {avgCpuUsage.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={avgCpuUsage} color="blue" size="sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">内存</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {avgMemoryUsage.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={avgMemoryUsage} color="green" size="sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">磁盘</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {avgDiskUsage.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={avgDiskUsage} color="green" size="sm" />
              </div>
            </div>
          </div>

          {/* 服务商分布 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Server className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  服务商分布
                </h3>
              </div>
            </div>
            <div className="space-y-2">
              {topProviders.map(([provider, count], index) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 'bg-purple-500'
                    }`}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {provider.length > 12 ? `${provider.substring(0, 12)}...` : provider}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
              {Object.keys(providerStats).length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                  还有 {Object.keys(providerStats).length - 3} 个服务商
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 节点显示区域 */}
        {viewMode === 'grid' ? (
          /* 网格布局 */
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
                    <CountryFlagSvg country={node.country} size={16} />
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
        ) : (
          /* 列表布局 */
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <div className="col-span-3">节点信息</div>
                  <div className="col-span-2">位置</div>
                  <div className="col-span-1">状态</div>
                  <div className="col-span-2">CPU</div>
                  <div className="col-span-2">内存</div>
                  <div className="col-span-2">磁盘</div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      node.status.toLowerCase() === 'online' ? 'bg-green-50/30 dark:bg-green-900/10' :
                      node.status.toLowerCase() === 'offline' ? 'bg-red-50/30 dark:bg-red-900/10' :
                      'bg-yellow-50/30 dark:bg-yellow-900/10'
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* 节点信息 */}
                      <div className="col-span-3">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(node.status)}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {node.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {node.provider}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* 位置 */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <CountryFlagSvg country={node.country} size={16} />
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 dark:text-white truncate">
                              {node.city}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {node.country}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 状态 */}
                      <div className="col-span-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          node.status.toLowerCase() === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          node.status.toLowerCase() === 'offline' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {node.status.toLowerCase() === 'online' ? '在线' :
                           node.status.toLowerCase() === 'offline' ? '离线' : '异常'}
                        </span>
                      </div>
                      
                      {/* CPU */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">CPU</span>
                              <span className="text-xs font-mono text-gray-900 dark:text-white">
                                {node.cpuUsage !== undefined && node.cpuUsage !== null ? `${node.cpuUsage.toFixed(1)}%` : '--'}
                              </span>
                            </div>
                            <ProgressBar value={node.cpuUsage} color="green" size="sm" />
                          </div>
                        </div>
                      </div>
                      
                      {/* 内存 */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">内存</span>
                              <span className="text-xs font-mono text-gray-900 dark:text-white">
                                {node.memoryUsage !== undefined && node.memoryUsage !== null ? `${node.memoryUsage.toFixed(1)}%` : '--'}
                              </span>
                            </div>
                            <ProgressBar value={node.memoryUsage} color="green" size="sm" />
                          </div>
                        </div>
                      </div>
                      
                      {/* 磁盘 */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">磁盘</span>
                              <span className="text-xs font-mono text-gray-900 dark:text-white">
                                {node.diskUsage !== undefined && node.diskUsage !== null ? `${node.diskUsage.toFixed(1)}%` : '--'}
                              </span>
                            </div>
                            <ProgressBar value={node.diskUsage} color="green" size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 运行时间 - 在小屏幕上显示 */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 lg:hidden">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>运行时间</span>
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
            </div>
          </div>
        )}

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
