import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { ServicesOverviewStats } from '@/components/services/ServicesOverviewStats';
import { ServicesList } from '@/components/services/ServicesList';
import { ServicesFilters } from '@/components/services/ServicesFilters';
import { NodeServicesView } from '@/components/services/NodeServicesView';
import type {
  ServicesOverviewStats as StatsType,
  NodeService,
  NodeServicesOverview,
  ServiceFilters as FilterType,
  ServiceViewMode,
} from '@/types/services';
import { apiService } from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { Download, RefreshCw, List, LayoutGrid, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export const ServicesPage: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsType | null>(null);
  const [services, setServices] = useState<NodeService[]>([]);
  const [nodeOverviews, setNodeOverviews] = useState<NodeServicesOverview[]>([]);
  const [filters, setFilters] = useState<FilterType>({ showExpired: true });
  const [viewMode, setViewMode] = useState<ServiceViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取可用的节点列表
  const availableNodes = useMemo(() => {
    const nodes = new Map<string, string>();
    services.forEach(service => {
      if (service.nodeName) {
        nodes.set(service.nodeId, service.nodeName);
      }
    });
    return Array.from(nodes.entries()).map(([id, name]) => ({ id, name }));
  }, [services]);

  // 获取可用的标签列表
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    services.forEach(service => {
      service.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [services]);

  // 筛选后的服务
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (filters.nodeId && service.nodeId !== filters.nodeId) return false;
      if (filters.serviceType && service.type !== filters.serviceType) return false;
      if (filters.status && service.status !== filters.status) return false;
      if (filters.deploymentType && service.deploymentType !== filters.deploymentType) return false;
      if (filters.priority !== undefined && service.priority !== filters.priority) return false;

      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const matchName = service.name.toLowerCase().includes(keyword);
        const matchDomain = service.access?.domain?.toLowerCase().includes(keyword);
        const matchPort = service.access?.port?.toString().includes(keyword);
        if (!matchName && !matchDomain && !matchPort) return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasTags = filters.tags.some(tag => service.tags?.includes(tag));
        if (!hasTags) return false;
      }

      if (filters.showExpired === false && service.status === 'expired') return false;

      return true;
    });
  }, [services, filters]);

  // 筛选后的节点视图
  const filteredNodeOverviews = useMemo(() => {
    if (viewMode !== 'node') return [];
    return nodeOverviews.filter(overview => {
      if (filters.nodeId && overview.nodeId !== filters.nodeId) return false;
      if (filters.showExpired === false && overview.isExpired) return false;
      return true;
    });
  }, [nodeOverviews, filters, viewMode]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [statsRes, servicesRes, nodeRes] = await Promise.all([
        apiService.getServicesOverview(),
        apiService.getAllServices(filters),
        apiService.getNodeServicesGrouped(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      } else {
        throw new Error(statsRes.error || '获取服务统计失败');
      }

      if (servicesRes.success && servicesRes.data) {
        setServices(servicesRes.data);
      } else {
        throw new Error(servicesRes.error || '获取服务列表失败');
      }

      if (nodeRes.success && nodeRes.data) {
        setNodeOverviews(nodeRes.data);
      } else {
        throw new Error(nodeRes.error || '获取节点服务数据失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExport = async (format: 'json' | 'csv' | 'markdown') => {
    try {
      const result = await apiService.exportServices(format, filters);
      if (result.success && result.data) {
        const url = URL.createObjectURL(result.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName || `services-export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('导出成功');
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败';
      showError(message);
    }
  };

  const handleServiceClick = (service: NodeService) => {
    navigate(`/nodes?id=${service.nodeId}&tab=services`);
  };

  const handleNodeClick = (nodeId: string) => {
    navigate(`/nodes?id=${nodeId}&tab=services`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <LoadingSpinner size="lg" text="加载服务数据..." />
        </main>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <ErrorState message={error || '无法加载数据'} onRetry={handleRefresh} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="服务总览"
          description={`监控节点部署的服务 - ${viewMode === 'list' ? filteredServices.length + ' 个服务' : filteredNodeOverviews.length + ' 个节点'}`}
          icon={Layers}
          actions={
            <>
              {/* 视图切换 */}
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="列表视图"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('node')}
                  className={`p-2 rounded ${
                    viewMode === 'node'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="节点视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* 导出 */}
              <div className="relative group">
                <button
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">导出</span>
                </button>
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg"
                  >
                    Markdown
                  </button>
                </div>
              </div>

              {/* 刷新 */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? '刷新中...' : '刷新'}</span>
              </button>
            </>
          }
        />

        {/* 总览统计 */}
        <ServicesOverviewStats stats={stats} />

        {/* 筛选器 */}
        <ServicesFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableNodes={availableNodes}
          availableTags={availableTags}
        />

        {/* 服务列表 / 节点视图 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {viewMode === 'list' ? '服务列表' : '节点视图'}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                (共 {viewMode === 'list' ? filteredServices.length : filteredNodeOverviews.length}
                {viewMode === 'list' ? ' 个服务' : ' 个节点'})
              </span>
            </h2>
          </div>

          {viewMode === 'list' ? (
            filteredServices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    没有找到符合条件的服务
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ServicesList
                services={filteredServices}
                onServiceClick={handleServiceClick}
              />
            )
          ) : (
            filteredNodeOverviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    没有找到符合条件的节点
                  </p>
                </CardContent>
              </Card>
            ) : (
              <NodeServicesView
                nodeOverviews={filteredNodeOverviews}
                onNodeClick={handleNodeClick}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
};
