import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { useRealTime } from '@/hooks/useRealTime';
import { useConnectivityDiagnostics } from '@/hooks/useConnectivityDiagnostics';
import { ConnectivityDiagnostics } from '@/components/nodes/ConnectivityDiagnostics';
import { Button } from '@/components/ui/button';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import { ServerDetailsPanel } from '@/components/nodes/ServerDetailsPanel';
import type { HeartbeatData } from '@/types/heartbeat';
import { useClientLatency } from '@/hooks/useClientLatency';
import { Search, Filter, RefreshCw, Activity, ChevronDown } from 'lucide-react';
import { ViewModeToggle } from '@/components/map/ViewModeToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { NodeData } from '@/services/api';
import { apiService } from '@/services/api';
import { socketService } from '@/services/socketService';

type StatusFilter = 'all' | 'online' | 'offline';

interface NodeEventDetails {
  previous?: {
    ipv4?: string;
    ipv6?: string;
  };
  current?: {
    ipv4?: string;
    ipv6?: string;
  };
  from?: string;
  to?: string;
  [key: string]: unknown;
}

interface NodeEventRecord {
  id: string;
  type: string;
  message?: string;
  details?: NodeEventDetails;
  timestamp: string;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeNodeEvent = (event: unknown): NodeEventRecord | null => {
  if (!isObjectRecord(event)) {
    return null;
  }

  const id = typeof event.id === 'string' ? event.id : String(event.id ?? `event-${Date.now()}`);
  const type = typeof event.type === 'string' ? event.type : 'UNKNOWN';
  const message = typeof event.message === 'string' ? event.message : undefined;
  const timestamp = typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString();
  const details = isObjectRecord(event.details) ? (event.details as NodeEventDetails) : undefined;

  return {
    id,
    type,
    message,
    timestamp,
    details,
  };
};

// Lazy load components
const EnhancedWorldMap = lazy(() => import('@/components/map/EnhancedWorldMap').then(module => ({ default: module.EnhancedWorldMap })));
const Globe3D = lazy(() => import('@/components/map/Globe3D').then(module => ({ default: module.Globe3D })));
const NetworkToolkit = lazy(() => import('@/components/diagnostics/NetworkToolkit').then(module => ({ default: module.NetworkToolkit })));

export const NodesPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showServerDetails, setShowServerDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatData | null>(null);
  const [events, setEvents] = useState<NodeEventRecord[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | NodeEventRecord['type']>('all');
  const [loadingHeartbeat, setLoadingHeartbeat] = useState(false);
  
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const { nodes, connected, refreshData } = useRealTime();
  const diagnostics = useConnectivityDiagnostics(connected);
  const [visibleCount, setVisibleCount] = useState(60);

  const handleStatusFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value as StatusFilter;
    setStatusFilter(nextValue);
  };

  const handleEventFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value as NodeEventRecord['type'] | 'all';
    setEventFilter(nextValue);
  };
  
  // 延迟测试功能
  const { 
    results: latencyResults, 
    isTestingInProgress, 
    startLatencyTest, 
    getLatencyColor,
    formatLatency,
    // getTestProgress
  } = useClientLatency();

  // 获取节点的延迟数据
  const getNodeLatency = (nodeId: string) => {
    const result = latencyResults.find(r => r.nodeId === nodeId);
    return result ? { latency: result.latency, status: result.status } : null;
  };

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setShowDiagnostics(false);
    setShowServerDetails(false);
  };

  const handleDiagnosticsClose = () => {
    setShowDiagnostics(false);
  };

  const handleRefresh = () => {
    refreshData();
  };
  


  // 获取节点详细心跳数据
  // showSpinner: 是否展示加载骨架（仅首次加载时需要，定时刷新避免闪烁）
  const fetchHeartbeatData = async (nodeId: string, showSpinner: boolean = true) => {
    try {
      if (showSpinner) setLoadingHeartbeat(true);
      const response = await apiService.getNodeHeartbeatData(nodeId);
      if (response.success && response.data) {
        setHeartbeatData(response.data as HeartbeatData);
      } else {
        setHeartbeatData(null);
      }
    } catch (error) {
      console.error('Failed to fetch heartbeat data:', error);
      setHeartbeatData(null);
    } finally {
      if (showSpinner) setLoadingHeartbeat(false);
    }
  };


  // 获取节点事件
  const fetchNodeEvents = async (nodeId: string) => {
    try {
      const res = await apiService.getNodeEvents(nodeId, 50);
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data
          .map(normalizeNodeEvent)
          .filter((event): event is NodeEventRecord => event !== null);
        setEvents(normalized);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    }
  };

  // 事件类型映射为中文标签
  const eventTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      IP_CHANGED: 'IP 变更',
      STATUS_CHANGED: '状态变更',
      SSH_BRUTEFORCE: 'SSH暴力破解',
      MALWARE_DETECTED: '恶意软件检测',
      DDOS_ATTACK: 'DDoS攻击',
      INTRUSION_DETECTED: '入侵检测',
      ANOMALY_DETECTED: '异常检测',
      SUSPICIOUS_ACTIVITY: '可疑活动',
    };
    return map[type] || type;
  };

  // 事件友好渲染
  const renderEventMessage = (ev: NodeEventRecord) => {
    try {
      if (ev.type === 'IP_CHANGED') {
        const prev = ev.details?.previous || {};
        const curr = ev.details?.current || {};
        const parts: string[] = [];
        if (prev.ipv4 || curr.ipv4) {
          parts.push(`IPv4: ${prev.ipv4 || '-'} → ${curr.ipv4 || '-'}`);
        }
        if (prev.ipv6 || curr.ipv6) {
          parts.push(`IPv6: ${prev.ipv6 || '-'} → ${curr.ipv6 || '-'}`);
        }
        return parts.join('；');
      }
      if (ev.type === 'STATUS_CHANGED') {
        const from = (ev.details?.from as string | undefined) || 'UNKNOWN';
        const to = (ev.details?.to as string | undefined) || 'UNKNOWN';
        return `状态：${from} → ${to}`;
      }
      if (ev.message) {
        return ev.message;
      }
      return ev.details ? JSON.stringify(ev.details) : '';
    } catch {
      return ev.message || '';
    }
  };

  const filteredEvents = events.filter(ev => eventFilter === 'all' ? true : ev.type === eventFilter);
  const eventTypes = Array.from(new Set(events.map(ev => ev.type)));

  // 当选中节点时获取心跳数据
  useEffect(() => {
    if (selectedNode) {
      // 首次打开详细面板前先拉一次，展示加载态
      fetchHeartbeatData(selectedNode.id, true);
      fetchNodeEvents(selectedNode.id);
    } else {
      setHeartbeatData(null);
      setEvents([]);
    }
  }, [selectedNode]);

  // 面板展开时，优先走WS订阅，回退为定时HTTP刷新
  useEffect(() => {
    if (selectedNode && showServerDetails) {
      const id = selectedNode.id;

      if (connected) {
        const handler = (payload: { nodeId: string; data: unknown }) => {
          if (payload?.nodeId === id) {
            setHeartbeatData((payload.data as HeartbeatData | null | undefined) ?? null);
          }
        };
        socketService.subscribeToNodeHeartbeat(id, handler);
        // 主动请求一次，确保立即有数据
        socketService.requestLatestHeartbeat(id);

        // 节点事件走WS增量订阅
        const handleEvent = (event: unknown) => {
          const normalized = normalizeNodeEvent(event);
          if (!normalized) {
            return;
          }
          setEvents(prev => [normalized, ...prev].slice(0, 50));
        };
        socketService.subscribeToNodeEvents(id, handleEvent);
        // 初次拉取一页历史以填充
        fetchNodeEvents(id);
        return () => {
          socketService.unsubscribeFromNodeHeartbeat(id);
          socketService.unsubscribeFromNodeEvents(id);
        };
      }

      // 回退：HTTP 定时刷新
      const timer = setInterval(() => {
        fetchHeartbeatData(id, false);
        fetchNodeEvents(id);
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [selectedNode, showServerDetails, connected]);

  // 过滤节点 - 使用useMemo缓存结果，避免不必要的引用变化
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           node.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (node.ipv4 && node.ipv4.includes(searchTerm)) ||
                           (node.ipv6 && node.ipv6.includes(searchTerm)) ||
                           (node.asnNumber && node.asnNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (node.asnName && node.asnName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'online' && node.status === 'online') ||
                           (statusFilter === 'offline' && node.status === 'offline');
      
      return matchesSearch && matchesStatus;
    });
  }, [nodes, searchTerm, statusFilter]); // 仅在这些依赖变化时重新计算

  // 当筛选结果变化时，校正可见数量，避免越界
  useEffect(() => {
    setVisibleCount(c => Math.min(c, Math.max(60, filteredNodes.length)));
  }, [filteredNodes.length]);

  // 如果显示诊断界面且有选中节点
  if (showDiagnostics && selectedNode) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 连接性自检横幅 */}
        <ConnectivityDiagnostics
          checking={diagnostics.checking}
          apiReachable={diagnostics.apiReachable}
          socketConnected={diagnostics.socketConnected}
          authOk={diagnostics.authOk}
          nodesCount={diagnostics.nodesCount}
          lastCheckedAt={diagnostics.lastCheckedAt}
          issues={diagnostics.issues}
          onRefresh={diagnostics.refresh}
          isAdmin={hasRole('ADMIN')}
        />
          <Suspense fallback={
            <LoadingSpinner text="加载网络工具..." size="md" className="h-64" />
          }>
            <NetworkToolkit 
              selectedNode={selectedNode} 
              onClose={handleDiagnosticsClose} 
            />
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 操作栏（简化） */}
        <div className="flex items-center justify-end gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="hidden sm:flex"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={startLatencyTest}
            disabled={isTestingInProgress}
            className="hidden md:flex"
          >
            {isTestingInProgress ? (
              <LoadingSpinner size="xs" center={false} className="mr-2" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            延迟测试
          </Button>
        </div>


        {/* 搜索和过滤 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索节点名称、国家、服务商或ASN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                aria-label="筛选节点状态"
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">所有状态</option>
                <option value="online">仅在线</option>
                <option value="offline">仅离线</option>
              </select>
              
              <span className="text-sm text-gray-500 dark:text-gray-400">
                显示 {filteredNodes.length} / {nodes.length} 个节点
              </span>
            </div>
          </div>
        </div>

        {/* 地图视图 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 地图 */}
          <div className="xl:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col xl:min-h-[700px] xl:sticky xl:top-4 xl:h-[calc(100vh-160px)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  节点分布（{viewMode === '3d' ? '3D 地球' : '2D 地图'}）
                </h2>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
              
              <div className="flex-1 min-h-0">
                <Suspense fallback={
                  <LoadingSpinner text="加载地图..." size="lg" className="h-64" />
                }>
                  {viewMode === '2d' ? (
                    <EnhancedWorldMap 
                      nodes={filteredNodes} 
                      onNodeClick={handleNodeClick} 
                      selectedNode={selectedNode}
                      showHeatmap={false}
                      showControlPanels={false}
                      className="h-[420px] sm:h-[500px] md:h-[560px] xl:h-full"
                    />
                  ) : (
                    <Globe3D 
                      nodes={filteredNodes} 
                      onNodeClick={handleNodeClick}
                    />
                  )}
                </Suspense>
              </div>
            </div>
          </div>
          
          {/* 节点列表/详情 */}
          <div className="xl:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col xl:min-h-[700px] xl:sticky xl:top-4 xl:h-[calc(100vh-160px)]">
              {selectedNode ? (
                /* 节点详情视图 */
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="space-y-4">
                  {/* 返回按钮和标题 */}
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 pb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedNode(null)}
                      className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      <div className="w-4 h-4">←</div>
                      <span>返回列表</span>
                    </Button>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      节点详情
                    </h3>
                  </div>

                  {/* 节点基本信息 */}
                  <div className="space-y-4">
                    {/* 节点标题卡片 */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-4 relative">
                      {/* 状态指示器在左上角 */}
                      <div className={`absolute top-3 left-3 w-3 h-3 rounded-full ${
                        selectedNode.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></div>
                      
                      {/* 居中的内容区域 */}
                      <div className="text-center space-y-2">
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                          {selectedNode.name}
                        </h4>
                        
                        {selectedNode.asnNumber && (
                          <div className="flex justify-center">
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full font-mono">
                              {selectedNode.asnNumber}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-center space-x-2">
                          <CountryFlagSvg country={selectedNode.country} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {selectedNode.city}, {selectedNode.country}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedNode.provider}
                        </div>
                      </div>
                    </div>

                    {/* 状态信息 */}
                    <div className="grid grid-cols-1 gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">状态:</span>
                        <span className={`text-sm font-medium ${
                          selectedNode.status === 'online' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {selectedNode.status.toUpperCase()}
                        </span>
                      </div>
                      
                      {selectedNode.ipv4 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">IPv4:</span>
                          <span className="text-sm font-mono text-primary">{selectedNode.ipv4}</span>
                        </div>
                      )}
                      
                      {selectedNode.ipv6 && selectedNode.ipv6.includes(':') && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">IPv6:</span>
                          <span className="text-xs font-mono text-primary break-all">{selectedNode.ipv6}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">系统:</span>
                        <span className="text-sm">{selectedNode.osType || 'Unknown'}</span>
                      </div>
                      
                      {selectedNode.lastSeen && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">最后在线:</span>
                          <span className="text-xs">{new Date(selectedNode.lastSeen).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* 地理信息 */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">坐标:</span>
                          <span className="text-sm font-mono">
                            {selectedNode.latitude.toFixed(4)}, {selectedNode.longitude.toFixed(4)}
                          </span>
                        </div>
                        
                        {selectedNode.asnNumber && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">ASN:</span>
                            <span className="text-sm font-mono">{selectedNode.asnNumber}</span>
                          </div>
                        )}
                        
                        {selectedNode.asnName && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-gray-600 dark:text-gray-400">ASN名称:</span>
                            <span className="text-xs text-right max-w-[200px]">
                              {selectedNode.asnName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => setShowDiagnostics(true)}
                        className="w-full"
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        运行诊断
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => setShowServerDetails(!showServerDetails)}
                        className="w-full"
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        {showServerDetails ? '收起' : '展开'}详细信息
                      </Button>
                    </div>
                  </div>
                  </div>
                </div>
              ) : (
                /* 节点列表视图 */
                <div className="flex flex-col flex-1 min-h-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    节点列表
                  </h3>
                  {/* 简易虚拟化：初始仅渲染部分节点，支持加载更多 */}
                  <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                    {filteredNodes.slice(0, Math.min(filteredNodes.length, visibleCount)).map((node) => (
                      <div
                        key={node.id}
                        onClick={() => handleNodeClick(node)}
                        className="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 relative">
                            {/* 状态指示器在左上角 */}
                            <div className={`absolute top-0 left-0 w-2 h-2 rounded-full ${
                              node.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                            {/* 节点名称居中 */}
                            <div className="text-center mb-1">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {node.name}
                              </h4>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 text-center flex items-center justify-center gap-1">
                              <CountryFlagSvg country={node.country} className="w-4 h-4" />
                              <span>{node.city}, {node.country}</span>
                            </div>
                            {node.ipv4 && (
                              <p className="text-xs text-primary font-mono mb-1 text-center">
                                {node.ipv4}
                              </p>
                            )}
                            {node.ipv6 && node.ipv6.includes(':') && (
                              <p className="text-[10px] text-indigo-500 dark:text-indigo-300 font-mono mb-1 text-center break-all">
                                {node.ipv6}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                              {node.provider}
                            </p>
                            {node.asnNumber && (
                              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 text-center">
                                {node.asnNumber}
                              </p>
                            )}
                            {/* 延迟信息 */}
                            {(() => {
                              const latencyData = getNodeLatency(node.id);
                              if (latencyData && latencyData.status !== 'testing') {
                                const colorClass = latencyData.latency !== null 
                                  ? getLatencyColor(latencyData.latency) === 'green' ? 'text-green-600'
                                  : getLatencyColor(latencyData.latency) === 'yellow' ? 'text-yellow-600'
                                  : getLatencyColor(latencyData.latency) === 'red' ? 'text-red-600'
                                  : 'text-gray-400'
                                  : 'text-red-400';
                                return (
                                  <div className="mt-1 text-center">
                                    <span className={`text-xs font-mono ${colorClass}`}>
                                      {latencyData.status === 'success' ? formatLatency(latencyData.latency) : 
                                       latencyData.status === 'failed' ? '失败' : 
                                       latencyData.status === 'timeout' ? '超时' : '--'}
                                    </span>
                                  </div>
                                );
                              }
                              if (latencyData && latencyData.status === 'testing') {
                                return (
                                  <div className="mt-1 text-center">
                                    <span className="text-xs text-primary">
                                      测试中...
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredNodes.length > visibleCount && (
                      <button
                        className="w-full py-2 mt-2 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setVisibleCount((c) => Math.min(c + 60, filteredNodes.length))}
                      >
                        加载更多
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 详细服务器信息面板 - 仅在展开时在底部显示 */}
        {selectedNode && showServerDetails && (
          <div className="mt-6 transition-all duration-300 ease-in-out">
            {loadingHeartbeat ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                <LoadingSpinner text="加载详细信息中..." size="md" center={true} />
              </div>
            ) : (
              <ServerDetailsPanel 
                node={selectedNode}
                heartbeatData={heartbeatData ?? undefined}
              />
            )}
            {/* 事件列表 */}
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">事件</h4>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">筛选</span>
                  <select
                    aria-label="筛选节点事件类型"
                    value={eventFilter}
                    onChange={handleEventFilterChange}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="all">全部</option>
                    {eventTypes.map(t => (
                      <option key={t} value={t}>{eventTypeLabel(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* 显示来自API的安全事件 */}
              {selectedNode?.securityEvents && selectedNode.securityEvents.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center">
                    <span className="mr-2">🛡️</span>
                    安全威胁 ({selectedNode.securityEvents.length})
                  </h5>
                  <ul className="divide-y divide-red-100 dark:divide-red-900">
                    {selectedNode.securityEvents.map((event) => (
                      <li key={event.id} className="py-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                              event.severity === 'critical' 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {eventTypeLabel(event.type)}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {event.description}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 常规事件列表 */}
              {filteredEvents.length === 0 && (!selectedNode?.securityEvents || selectedNode.securityEvents.length === 0) ? (
                <p className="text-sm text-gray-500">暂无事件</p>
              ) : filteredEvents.length > 0 ? (
                <div>
                  <h5 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">常规事件</h5>
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredEvents.map((ev) => (
                      <li key={ev.id} className="py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            <span className={`px-2 py-0.5 rounded text-xs mr-2 ${
                              ev.type === 'STATUS_CHANGED' ? 'bg-primary/10 text-primary' : 
                              ev.type === 'IP_CHANGED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {eventTypeLabel(ev.type)}
                            </span>
                            {renderEventMessage(ev)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">{new Date(ev.timestamp).toLocaleString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 连接状态提示 */}
        {!connected && nodes.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
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
      </main>

      
    </div>
  );
};
