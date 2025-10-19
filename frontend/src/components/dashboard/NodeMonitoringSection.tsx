import React, { useState, useMemo, useCallback } from 'react';
import { Server, Search, Filter, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { useRealTime } from '@/hooks/useRealTime';
import { Button } from '@/components/ui/button';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import { StreamingBadge } from '@/components/streaming/StreamingBadge';
import { apiService } from '@/services/api';
import { STREAMING_SERVICES, STREAMING_SERVICE_ORDER } from '@/types/streaming';
import type { NodeData } from '@/services/api';
import type { StreamingServiceResult } from '@/types/streaming';

type StatusFilter = 'all' | 'online' | 'offline';
type ViewMode = 'grid' | 'list';

export const NodeMonitoringSection: React.FC = () => {
  const { nodes, connected, refreshData } = useRealTime();
  const ALL_STREAMING_SERVICES = STREAMING_SERVICE_ORDER;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 过滤节点
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.provider.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'online' && node.status === 'online') ||
                           (statusFilter === 'offline' && node.status === 'offline');

      // TODO: 流媒体筛选 - 等后端实现后添加

      return matchesSearch && matchesStatus;
    });
  }, [nodes, searchTerm, statusFilter]);

  // 流媒体数据存储
  const [streamingDataMap, setStreamingDataMap] = useState<Record<string, StreamingServiceResult[]>>({});

  // 获取流媒体数据
  const fetchStreamingData = useCallback(async (nodeId: string) => {
    try {
      const response = await apiService.getNodeStreaming(nodeId);
      if (response.success && response.data) {
        const serviceMap = new Map(response.data.services.map(service => [service.service, service]));
        const normalizedServices = ALL_STREAMING_SERVICES.map((service) => {
          const existing = serviceMap.get(service);
          if (existing) {
            return existing;
          }

          return {
            service,
            name: STREAMING_SERVICES[service].name,
            icon: STREAMING_SERVICES[service].icon,
            status: 'unknown' as const,
          };
        });

        setStreamingDataMap(prev => ({
          ...prev,
          [nodeId]: normalizedServices
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch streaming data for node ${nodeId}:`, error);
    }
  }, [ALL_STREAMING_SERVICES]);

  // 当节点列表加载时，获取每个节点的流媒体数据
  React.useEffect(() => {
    if (filteredNodes.length > 0) {
      // 为前10个节点获取流媒体数据（避免一次性请求太多）
      filteredNodes.slice(0, 10).forEach(node => {
        if (!streamingDataMap[node.id]) {
          fetchStreamingData(node.id);
        }
      });
    }
  }, [filteredNodes, streamingDataMap, fetchStreamingData]);

  // 获取节点的流媒体数据（带默认值）
  const getStreamingData = (nodeId: string): StreamingServiceResult[] => {
    if (streamingDataMap[nodeId]) {
      return streamingDataMap[nodeId];
    }

    // 返回默认的未测试状态
    return ALL_STREAMING_SERVICES.map(service => ({
      service,
      name: STREAMING_SERVICES[service].name,
      icon: STREAMING_SERVICES[service].icon,
      status: 'unknown' as const,
    }));
  };

  return (
    <div className="space-y-4">
      {/* 头部和工具栏 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 标题 */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                节点监控
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                共 {filteredNodes.length} 个节点
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            {/* 视图切换 */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                title="网格视图"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                title="列表视图"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* 刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              className="hidden sm:flex"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="mt-4 flex flex-col md:flex-row gap-3">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索节点名称、国家、服务商..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">所有状态</option>
              <option value="online">仅在线</option>
              <option value="offline">仅离线</option>
            </select>
          </div>
        </div>

        {/* 流媒体筛选 (占位,等后端实现) */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">流媒体筛选:</span>
          <span className="text-xs text-gray-500 dark:text-gray-500">(待实现)</span>
        </div>
      </div>

      {/* 节点网格/列表 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredNodes.map((node) => (
            <NodeCardGrid key={node.id} node={node} streamingData={getStreamingData(node.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNodes.map((node) => (
            <NodeCardList key={node.id} node={node} streamingData={getStreamingData(node.id)} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {filteredNodes.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Server className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            未找到节点
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            请调整筛选条件或添加新节点
          </p>
        </div>
      )}

      {/* 连接状态提示 */}
      {!connected && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center">
            <div className="text-yellow-500 mr-2">⚠️</div>
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">实时连接已断开</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                当前显示的是缓存数据，正在尝试重新连接...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 网格视图节点卡片
const NodeCardGrid: React.FC<{ node: NodeData; streamingData: StreamingServiceResult[] }> = ({ node, streamingData }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
      {/* 状态指示器 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            node.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {node.name}
          </h4>
        </div>
      </div>

      {/* 位置 */}
      <div className="flex items-center space-x-2 mb-3">
        <CountryFlagSvg country={node.country} size={16} />
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {node.city}, {node.country}
        </span>
      </div>

      {/* 资源使用 */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400">CPU</span>
          <span className="font-mono text-gray-900 dark:text-white">
            {node.cpuUsage !== undefined && node.cpuUsage !== null ? `${node.cpuUsage.toFixed(1)}%` : '--'}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400">内存</span>
          <span className="font-mono text-gray-900 dark:text-white">
            {node.memoryUsage !== undefined && node.memoryUsage !== null ? `${node.memoryUsage.toFixed(1)}%` : '--'}
          </span>
        </div>
      </div>

      {/* 流媒体标签 */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">流媒体解锁</div>
        <div className="flex flex-wrap gap-1">
          {streamingData.slice(0, 7).map((service) => (
            <StreamingBadge key={service.service} service={service} size="sm" showStatus={false} />
          ))}
        </div>
      </div>
    </div>
  );
};

// 列表视图节点卡片
const NodeCardList: React.FC<{ node: NodeData; streamingData: StreamingServiceResult[] }> = ({ node, streamingData }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {/* 状态 */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            node.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>

          {/* 节点信息 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-3">
              <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                {node.name}
              </h4>
              <div className="flex items-center space-x-1">
                <CountryFlagSvg country={node.country} size={14} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {node.city}
                </span>
              </div>
            </div>
          </div>

          {/* 流媒体标签 */}
          <div className="hidden lg:flex items-center space-x-1">
            {streamingData.slice(0, 7).map((service) => (
              <StreamingBadge key={service.service} service={service} size="sm" showStatus={false} />
            ))}
          </div>

          {/* 资源使用 */}
          <div className="hidden md:flex items-center space-x-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">CPU: </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {node.cpuUsage !== undefined && node.cpuUsage !== null ? `${node.cpuUsage.toFixed(1)}%` : '--'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">内存: </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {node.memoryUsage !== undefined && node.memoryUsage !== null ? `${node.memoryUsage.toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
