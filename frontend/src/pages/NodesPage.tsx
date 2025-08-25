import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { useRealTime } from '@/hooks/useRealTime';
import { useConnectivityDiagnostics } from '@/hooks/useConnectivityDiagnostics';
import { ConnectivityDiagnostics } from '@/components/nodes/ConnectivityDiagnostics';
import { Button } from '@/components/ui/button';
import { ServerDetailsPanel } from '@/components/nodes/ServerDetailsPanel';
import { AgentDeployModal } from '@/components/admin/AgentDeployModal';
import { Plus, Search, Filter, RefreshCw, Activity, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { NodeData, VisitorInfo } from '@/services/api';
import { apiService } from '@/services/api';

// Lazy load components
const EnhancedWorldMap = lazy(() => import('@/components/map/EnhancedWorldMap').then(module => ({ default: module.EnhancedWorldMap })));
const NetworkToolkit = lazy(() => import('@/components/diagnostics/NetworkToolkit').then(module => ({ default: module.NetworkToolkit })));

export const NodesPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showServerDetails, setShowServerDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [heartbeatData, setHeartbeatData] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | string>('all');
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(null);
  const [loadingHeartbeat, setLoadingHeartbeat] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const { nodes, stats, connected, refreshData } = useRealTime();
  const diagnostics = useConnectivityDiagnostics(connected);

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

  const handleAddNode = () => {
    setShowDeployModal(true);
  };

  const handleDeployComplete = async () => {
    await refreshData(); // 刷新节点列表
  };

  // 处理节点改名
  const handleNodeRename = async (nodeId: string, newName: string) => {
    try {
      const response = await apiService.updateNode(nodeId, { name: newName });
      if (response.success) {
        console.log('Node renamed successfully');
      } else {
        console.error('Failed to rename node:', response.error);
        alert('改名失败: ' + (response.error || '未知错误'));
      }
    } catch (error) {
      console.error('Error renaming node:', error);
      alert('改名失败，请重试');
    }
  };

  // 处理节点删除
  const handleNodeDelete = async (nodeId: string) => {
    try {
      const response = await apiService.deleteNode(nodeId);
      if (response.success) {
        // 如果删除的是当前选中的节点，清空选择
        if (selectedNode?.id === nodeId) {
          setSelectedNode(null);
          setShowDiagnostics(false);
          setShowServerDetails(false);
        }
        console.log('Node deleted successfully');
      } else {
        console.error('Failed to delete node:', response.error);
        alert('删除失败: ' + (response.error || '未知错误'));
      }
    } catch (error) {
      console.error('Error deleting node:', error);
      alert('删除失败，请重试');
    }
  };

  // 获取节点详细心跳数据
  const fetchHeartbeatData = async (nodeId: string) => {
    try {
      setLoadingHeartbeat(true);
      const response = await apiService.getNodeHeartbeatData(nodeId);
      if (response.success && response.data) {
        setHeartbeatData(response.data);
      } else {
        setHeartbeatData(null);
      }
    } catch (error) {
      console.error('Failed to fetch heartbeat data:', error);
      setHeartbeatData(null);
    } finally {
      setLoadingHeartbeat(false);
    }
  };

  // 获取访问者信息（仅获取一次）
  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getVisitorInfo();
        if (res.success && res.data) {
          setVisitorInfo(res.data as VisitorInfo);
        }
      } catch {}
    })();
  }, []);

  // 获取节点事件
  const fetchNodeEvents = async (nodeId: string) => {
    try {
      const res = await apiService.getNodeEvents(nodeId, 50);
      if (res.success && Array.isArray(res.data)) {
        setEvents(res.data);
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
    };
    return map[type] || type;
  };

  // 事件友好渲染
  const renderEventMessage = (ev: any) => {
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
        const from = ev.details?.from || 'UNKNOWN';
        const to = ev.details?.to || 'UNKNOWN';
        return `状态：${from} → ${to}`;
      }
      return ev.message || JSON.stringify(ev.details || {});
    } catch {
      return ev.message || '';
    }
  };

  const filteredEvents = events.filter(ev => eventFilter === 'all' ? true : ev.type === eventFilter);
  const eventTypes = Array.from(new Set(events.map(ev => ev.type)));

  // 当选中节点时获取心跳数据
  useEffect(() => {
    if (selectedNode) {
      fetchHeartbeatData(selectedNode.id);
      fetchNodeEvents(selectedNode.id);
    } else {
      setHeartbeatData(null);
      setEvents([]);
    }
  }, [selectedNode]);

  // 面板展开时，定时刷新心跳数据以驱动速率曲线
  useEffect(() => {
    if (selectedNode && showServerDetails) {
      const id = selectedNode.id;
      const timer = setInterval(() => {
        fetchHeartbeatData(id);
        fetchNodeEvents(id);
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [selectedNode, showServerDetails]);

  // 过滤节点
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.provider.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'online' && node.status === 'online') ||
                         (statusFilter === 'offline' && node.status === 'offline');
    
    return matchesSearch && matchesStatus;
  });

  // 如果显示诊断界面且有选中节点
  if (showDiagnostics && selectedNode) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题和操作 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                节点管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                管理和监控网络中的所有代理节点
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* 连接状态简述（保留） */}
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${connected ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`}></div>
                <span className="text-sm font-medium">{connected ? '实时连接' : '连接断开'}</span>
              </div>
              
              {hasRole('ADMIN') && (
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleAddNode}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  部署节点
                </Button>
              )}
              
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总节点数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalNodes || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">在线节点</p>
                <p className="text-2xl font-bold text-green-600">{stats?.onlineNodes || 0}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-green-500"></div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">离线节点</p>
                <p className="text-2xl font-bold text-red-600">{(stats?.totalNodes || 0) - (stats?.onlineNodes || 0)}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-red-500"></div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">覆盖国家</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalCountries || 0}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索节点名称、国家或服务商..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  节点分布地图
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>在线</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>离线</span>
                  </div>
                </div>
              </div>
              
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
                </div>
              }>
                <EnhancedWorldMap 
                  nodes={filteredNodes} 
                  onNodeClick={handleNodeClick} 
                  selectedNode={selectedNode}
                  showHeatmap={false}
                  className="mb-4"
                  onNodeRename={hasRole('ADMIN') ? handleNodeRename : undefined}
                  onNodeDelete={hasRole('ADMIN') ? handleNodeDelete : undefined}
                />
              </Suspense>
            </div>
          </div>
          
          {/* 节点列表 */}
          <div className="xl:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                节点列表
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredNodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedNode?.id === node.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${
                            node.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {node.name}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {node.city}, {node.country}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {node.provider}
                        </p>
                      </div>
                      {selectedNode?.id === node.id && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDiagnostics(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Activity className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 选中节点详情 */}
        {selectedNode && (
          <div className="mt-6 space-y-6">
            {/* 快速操作面板 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedNode.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedNode.city}, {selectedNode.country} • {selectedNode.provider}
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowServerDetails(!showServerDetails)}
                    className="flex items-center space-x-2"
                  >
                    {showServerDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span>详细信息</span>
                  </Button>
                  
                  <Button
                    onClick={() => setShowDiagnostics(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    运行诊断
                  </Button>
                </div>
              </div>
              
              {/* 基本状态信息 */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">状态:</span>
                  <span className={`ml-2 font-medium ${selectedNode.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedNode.status.toUpperCase()}
                  </span>
                </div>
                {selectedNode.ipv4 && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">IPv4:</span>
                    <span className="ml-2 font-mono text-xs">{selectedNode.ipv4}</span>
                  </div>
                )}
                {selectedNode.lastSeen && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">最后在线:</span>
                    <span className="ml-2">{new Date(selectedNode.lastSeen).toLocaleString()}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600 dark:text-gray-400">系统:</span>
                  <span className="ml-2">{selectedNode.osType || 'Unknown'}</span>
                </div>
              </div>
            </div>
            
            {/* 详细服务器信息面板 */}
            {showServerDetails && (
              <div className="transition-all duration-300 ease-in-out">
                {loadingHeartbeat ? (
                  <div className="flex items-center justify-center h-32 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">加载详细信息中...</span>
                  </div>
                ) : (
                  <ServerDetailsPanel 
                    node={selectedNode}
                    heartbeatData={heartbeatData}
                    visitorInfo={visitorInfo || undefined}
                  />
                )}
                {/* 事件列表 */}
                <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white">事件</h4>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">筛选</span>
                      <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="all">全部</option>
                        {eventTypes.map(t => (
                          <option key={t} value={t}>{eventTypeLabel(t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {filteredEvents.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无事件</p>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEvents.map((ev) => (
                        <li key={ev.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              <span className={`px-2 py-0.5 rounded text-xs mr-2 ${ev.type === 'STATUS_CHANGED' ? 'bg-blue-100 text-blue-800' : ev.type === 'IP_CHANGED' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                {eventTypeLabel(ev.type)}
                              </span>
                              {renderEventMessage(ev)}
                            </span>
                            <span className="text-gray-500">{new Date(ev.timestamp).toLocaleString()}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
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

      {/* 节点部署模态框 */}
      <AgentDeployModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        onDeployed={handleDeployComplete}
      />
    </div>
  );
};
