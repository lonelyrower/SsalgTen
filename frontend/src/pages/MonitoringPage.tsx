import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { useRealTime } from '@/hooks/useRealTime';
import { Server, Cpu, HardDrive, Activity, Clock, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff, List, LayoutGrid, Globe, BarChart3, PieChart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  size?: 'sm' | 'md';
}> = ({ value, color, size = 'md' }) => {
  const percentage = value ?? 0;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const heightClass = size === 'sm' ? 'h-2' : 'h-3';
  const fillClass = (() => {
    if (color === 'blue') return 'fill-blue-500';
    if (color === 'yellow') return 'fill-yellow-500';
    if (color === 'red') return 'fill-red-500';
    // green
    if (clamped > 80) return 'fill-red-500';
    if (clamped > 60) return 'fill-yellow-500';
    return 'fill-green-500';
  })();

  return (
    <svg
      className={`w-full ${heightClass}`}
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={`当前进度 ${Math.round(clamped)}%`}
    >
      <rect x={0} y={0} width={100} height={10} rx={5} className="fill-gray-200 dark:fill-gray-700" />
      <rect x={0} y={0} width={clamped} height={10} rx={5} className={fillClass} />
    </svg>
  );
};

export const MonitoringPage: React.FC = () => {
  const { nodes, connected, refreshData } = useRealTime();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // 布局模式
  const [visibleCount, setVisibleCount] = useState(60); // 初始显示60个节点
  const loadMoreRef = useRef<HTMLDivElement>(null); // 加载更多的观察目标

  // 懒加载：当滚动到底部时加载更多节点
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 40, nodes.length)); // 每次加载40个
  }, [nodes.length]);

  // 使用 Intersection Observer 监听滚动
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < nodes.length) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore, visibleCount, nodes.length]);

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
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  // Remove error handling since useRealTime handles it internally

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter(node => node.status === 'online').length;
  const offlineNodes = nodes.filter(node => node.status === 'offline').length;
  const unknownNodes = totalNodes - onlineNodes - offlineNodes;


  // 计算国家/地区分布
  const countryStats = nodes.reduce((acc, node) => {
    acc[node.country] = (acc[node.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCountries = Object.entries(countryStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  const maxCountryCount = topCountries.length > 0 ? topCountries[0][1] : 0;

  // 计算服务商分布
  const providerStats = nodes.reduce((acc, node) => {
    acc[node.provider] = (acc[node.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProviders = Object.entries(providerStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6);

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
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题和状态 */}
        <div className="mb-6 md:mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 md:p-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-blue-500/5 dark:from-blue-400/5 dark:via-cyan-400/5 dark:to-blue-400/5"></div>
            <div className="relative z-10">
              {/* 标题区域 - 移动端全宽 */}
              <div className="flex items-center space-x-3 md:space-x-4 mb-4 md:mb-0">
                <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg flex-shrink-0">
                  <Server className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 dark:from-white dark:to-cyan-300 bg-clip-text text-transparent">
                    监控概览
                  </h1>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-0.5 md:mt-1 hidden sm:block">
                    实时监控 {totalNodes} 个节点的系统状态
                  </p>
                </div>
              </div>

              {/* 控制按钮区域 - 移动端换行 */}
              <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-4 md:mt-0 md:absolute md:top-6 md:right-6">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {connected ? (
                    <Wifi className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                  )}
                  <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {connected ? '实时连接' : '离线模式'}
                  </span>
                </div>

                {/* 布局切换按钮 */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    title="网格布局"
                    aria-label="网格布局"
                  >
                    <LayoutGrid className="h-3 w-3 md:h-4 md:w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    title="列表布局"
                    aria-label="列表布局"
                  >
                    <List className="h-3 w-3 md:h-4 md:w-4" />
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshData}
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                  <span className="hidden md:inline">刷新</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 统计信息卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8 max-w-none">
          {/* 节点状态分布 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/15 rounded-lg">
                  <PieChart className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  节点状态分布
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded bg-green-50 dark:bg-green-900/20">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">在线</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{onlineNodes}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{totalNodes > 0 ? ((onlineNodes / totalNodes) * 100).toFixed(1) : 0}%</div>
              </div>
              <div className="p-2 rounded bg-red-50 dark:bg-red-900/20">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">离线</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">{offlineNodes}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{totalNodes > 0 ? ((offlineNodes / totalNodes) * 100).toFixed(1) : 0}%</div>
              </div>
              <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">未知</div>
                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{unknownNodes}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{totalNodes > 0 ? ((unknownNodes / totalNodes) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
          </div>

          {/* 地理分布 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-80">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                国家/地区分布
              </h3>
            </div>
            <div className="space-y-3">
              {topCountries.slice(0, 4).map(([country, count]) => (
                <div key={country} className="space-y-1">
                  <div className="flex items-center justify-between">
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
                  <ProgressBar
                    value={maxCountryCount ? (count / maxCountryCount) * 100 : 0}
                    color="blue"
                    size="sm"
                  />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-80">
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
                    <Cpu className="h-4 w-4 text-primary" />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-80">
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
                      index === 0 ? 'bg-primary' : 
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
              {Object.keys(providerStats).length > 6 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                  还有 {Object.keys(providerStats).length - 6} 个服务商
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 节点显示区域 */}
        {viewMode === 'grid' ? (
          /* 网格布局 */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {nodes.slice(0, visibleCount).map((node) => (
              <div
                key={node.id}
                className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 p-6 transition-all duration-200 hover:shadow-lg ${getStatusColor(node.status)}`}
              >
              {/* 节点头部信息 */}
              <div className="mb-4">
                <div className="flex items-center justify-center mb-2">
                  {getStatusIcon(node.status)}
                </div>
                <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white truncate">
                  {node.name}
                </h3>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <CountryFlagSvg country={node.country} size={16} />
                  <span className="truncate">{node.city}, {node.country}</span>
                </div>
                <div className="text-xs text-center text-gray-500 dark:text-gray-500 mt-1">
                  {node.provider}
                </div>
              </div>

              {/* 系统资源使用率 */}
              <div className="space-y-4">
                {/* CPU使用率 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-primary" />
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
                    {formatUptime(node.lastHeartbeat?.uptime)}
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
          
          {/* 加载更多触发器 - 网格布局 */}
          {visibleCount < nodes.length && (
            <div ref={loadMoreRef} className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                加载中... ({visibleCount}/{nodes.length})
              </p>
            </div>
          )}
          </>
        ) : (
          /* 列表布局 */
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <div className="col-span-1 flex items-center justify-center">状态</div>
                  <div className="col-span-2 flex items-center justify-center">节点信息</div>
                  <div className="col-span-2 flex items-center justify-center">位置</div>
                  <div className="col-span-2 flex items-center justify-center">在线状态</div>
                  <div className="col-span-2 flex items-center justify-center">CPU</div>
                  <div className="col-span-2 flex items-center justify-center">内存</div>
                  <div className="col-span-1 flex items-center justify-center">磁盘</div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {nodes.slice(0, visibleCount).map((node) => (
                  <div
                    key={node.id}
                    className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      node.status.toLowerCase() === 'online' ? 'bg-green-50/30 dark:bg-green-900/10' :
                      node.status.toLowerCase() === 'offline' ? 'bg-red-50/30 dark:bg-red-900/10' :
                      'bg-yellow-50/30 dark:bg-yellow-900/10'
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* 状态图标 */}
                      <div className="col-span-1 flex items-center justify-center">
                        {getStatusIcon(node.status)}
                      </div>
                      
                      {/* 节点信息 */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="min-w-0 text-center">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {node.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {node.provider}
                          </p>
                        </div>
                      </div>
                      
                      {/* 位置 */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="flex items-center space-x-2">
                          <CountryFlagSvg country={node.country} size={16} />
                          <div className="text-sm text-gray-900 dark:text-white truncate">
                            {node.city}, {node.country}
                          </div>
                        </div>
                      </div>
                      
                      {/* 在线状态 */}
                      <div className="col-span-2 flex items-center justify-center">
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
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="w-full max-w-20">
                          <div className="text-center mb-1">
                            <span className="text-xs font-mono text-gray-900 dark:text-white">
                              {node.cpuUsage !== undefined && node.cpuUsage !== null ? `${node.cpuUsage.toFixed(1)}%` : '--'}
                            </span>
                          </div>
                          <ProgressBar value={node.cpuUsage} color="green" size="sm" />
                        </div>
                      </div>
                      
                      {/* 内存 */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="w-full max-w-20">
                          <div className="text-center mb-1">
                            <span className="text-xs font-mono text-gray-900 dark:text-white">
                              {node.memoryUsage !== undefined && node.memoryUsage !== null ? `${node.memoryUsage.toFixed(1)}%` : '--'}
                            </span>
                          </div>
                          <ProgressBar value={node.memoryUsage} color="green" size="sm" />
                        </div>
                      </div>
                      
                      {/* 磁盘 */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="w-full max-w-16">
                          <div className="text-center mb-1">
                            <span className="text-xs font-mono text-gray-900 dark:text-white">
                              {node.diskUsage !== undefined && node.diskUsage !== null ? `${node.diskUsage.toFixed(1)}%` : '--'}
                            </span>
                          </div>
                          <ProgressBar value={node.diskUsage} color="green" size="sm" />
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
                          {formatUptime(node.lastHeartbeat?.uptime)}
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
            
            {/* 加载更多触发器 - 列表布局 */}
            {visibleCount < nodes.length && (
              <div ref={loadMoreRef} className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  加载中... ({visibleCount}/{nodes.length})
                </p>
              </div>
            )}
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
