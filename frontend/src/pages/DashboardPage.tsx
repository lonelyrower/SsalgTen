import React, { useState, Suspense, lazy, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { useRealTime } from '@/hooks/useRealTime';
import { Button } from '@/components/ui/button';
import { Activity, Loader2 } from 'lucide-react';
import type { NodeData } from '@/services/api';
import { apiService } from '@/services/api';
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary';

// Lazy load heavy components
const EnhancedWorldMap = lazy(() => import('@/components/map/EnhancedWorldMap').then(module => ({ default: module.EnhancedWorldMap })));
const NetworkToolkit = lazy(() => import('@/components/diagnostics/NetworkToolkit').then(module => ({ default: module.NetworkToolkit })));

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { nodes, stats, lastUpdate, connected } = useRealTime();
  
  // 从当前nodes中找到选中的节点，保持数据同步
  const selectedNode = useMemo(() => {
    return selectedNodeId ? nodes.find(node => node.id === selectedNodeId) || null : null;
  }, [selectedNodeId, nodes]);

  const handleNodeClick = (node: NodeData) => {
    setSelectedNodeId(node.id);
    setShowDiagnostics(false);
    console.log('Node clicked:', node);
  };

  const handleDiagnosticsClose = () => {
    setShowDiagnostics(false);
  };

  // 处理节点改名
  const handleNodeRename = async (nodeId: string, newName: string) => {
    try {
      const response = await apiService.updateNode(nodeId, { name: newName });
      if (response.success) {
        // 实时数据会自动更新，这里不需要手动刷新
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
        if (selectedNodeId === nodeId) {
          setSelectedNodeId(null);
          setShowDiagnostics(false);
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

  // 如果没有连接且没有数据，显示加载状态
  if (!connected && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Connecting to real-time server...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 如果显示诊断界面且有选中节点
  if (showDiagnostics && selectedNode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
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
        {/* 欢迎信息和实时状态 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                欢迎回来, {user?.name || user?.username}!
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                SsalgTen 网络监控管理系统 - {user?.role === 'ADMIN' ? '管理员' : user?.role === 'OPERATOR' ? '操作员' : '查看者'}
              </p>
            </div>
            
            {/* 实时连接状态指示器 */}
            <div className="flex items-center space-x-3">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                connected 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`}></div>
                <span className="text-sm font-medium">
                  {connected ? '实时连接' : '连接断开'}
                </span>
              </div>
              {lastUpdate && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  更新于: {new Date(lastUpdate).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* 监控概览内容 */}
        <>
          {/* 增强统计卡片 */}
          <EnhancedStats 
            totalNodes={stats?.totalNodes || 0}
            onlineNodes={stats?.onlineNodes || 0}
            totalCountries={stats?.totalCountries || 0}
            totalProviders={stats?.totalProviders || 0}
            className="mb-8"
          />
          
          {/* 全球节点网络地图 */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  全球节点网络
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>在线 ({stats?.onlineNodes || 0})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>离线 ({(stats?.totalNodes || 0) - (stats?.onlineNodes || 0)})</span>
                  </div>
                </div>
              </div>
              
              <ComponentErrorBoundary componentName="世界地图">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
                  </div>
                }>
                  <EnhancedWorldMap 
                    nodes={nodes} 
                    onNodeClick={handleNodeClick} 
                    selectedNode={selectedNode}
                    showHeatmap={false}
                    className="mb-4"
                    onNodeRename={user?.role === 'ADMIN' ? handleNodeRename : undefined}
                    onNodeDelete={user?.role === 'ADMIN' ? handleNodeDelete : undefined}
                  />
                </Suspense>
              </ComponentErrorBoundary>
            </div>
          </div>

          {/* 选中节点信息 */}
          {selectedNode && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {selectedNode.name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      selectedNode.status.toLowerCase() === 'online' 
                        ? 'bg-green-500' 
                        : selectedNode.status.toLowerCase() === 'unknown'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {selectedNode.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => setShowDiagnostics(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  网络诊断
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">位置: </span>
                    <span className="text-gray-900 dark:text-white">{selectedNode.city}, {selectedNode.country}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">服务商: </span>
                    <span className="text-gray-900 dark:text-white">{selectedNode.provider}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedNode.ipv4 && (
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">IPv4: </span>
                      <span className="font-mono text-gray-900 dark:text-white">{selectedNode.ipv4}</span>
                    </div>
                  )}
                  {selectedNode.ipv6 && selectedNode.ipv6 !== selectedNode.ipv4 && (
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">IPv6: </span>
                      <span className="font-mono text-gray-900 dark:text-white">{selectedNode.ipv6}</span>
                    </div>
                  )}
                  {selectedNode.lastSeen && (
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">最后在线: </span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(selectedNode.lastSeen).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>

        {/* 连接状态提示 */}
        {!connected && nodes.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
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