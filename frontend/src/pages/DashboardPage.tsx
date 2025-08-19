import React, { useState, Suspense, lazy } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { ActivityLog } from '@/components/dashboard/ActivityLog';
import { useRealTime } from '@/hooks/useRealTime';
import { Button } from '@/components/ui/button';
import { Activity, Users, Settings, BarChart3, Loader2, Download } from 'lucide-react';
import type { NodeData } from '@/services/api';

// Lazy load heavy components
const EnhancedWorldMap = lazy(() => import('@/components/map/EnhancedWorldMap').then(module => ({ default: module.EnhancedWorldMap })));
const NetworkToolkit = lazy(() => import('@/components/diagnostics/NetworkToolkit').then(module => ({ default: module.NetworkToolkit })));
const AnalyticsPanel = lazy(() => import('@/components/analytics/AnalyticsPanel').then(module => ({ default: module.AnalyticsPanel })));
const UserManagement = lazy(() => import('@/components/admin/UserManagement').then(module => ({ default: module.UserManagement })));
const SystemSettings = lazy(() => import('@/components/admin/SystemSettings').then(module => ({ default: module.SystemSettings })));
const AgentInstaller = lazy(() => import('@/components/agent/AgentInstaller').then(module => ({ default: module.AgentInstaller })));

interface DashboardPageProps {
  view?: 'overview' | 'users' | 'settings' | 'analytics' | 'agents';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ view = 'overview' }) => {
  const { user, hasRole } = useAuth();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [activeView, setActiveView] = useState(view);
  const { nodes, stats, lastUpdate, connected } = useRealTime();

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setShowDiagnostics(false);
    console.log('Node clicked:', node);
  };

  const handleDiagnosticsClose = () => {
    setShowDiagnostics(false);
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

        {/* 管理功能导航 */}
        {hasRole('OPERATOR') && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant={activeView === 'overview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('overview')}
                className="flex items-center space-x-2"
              >
                <Activity className="h-4 w-4" />
                <span>监控概览</span>
              </Button>
              
              {hasRole('ADMIN') && (
                <>
                  <Button
                    variant={activeView === 'users' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveView('users')}
                    className="flex items-center space-x-2"
                  >
                    <Users className="h-4 w-4" />
                    <span>用户管理</span>
                  </Button>
                  
                  <Button
                    variant={activeView === 'settings' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveView('settings')}
                    className="flex items-center space-x-2"
                  >
                    <Settings className="h-4 w-4" />
                    <span>系统设置</span>
                  </Button>
                </>
              )}
              
              <Button
                variant={activeView === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('analytics')}
                className="flex items-center space-x-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>数据分析</span>
              </Button>
              
              <Button
                variant={activeView === 'agents' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('agents')}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>节点部署</span>
              </Button>
            </div>
          </div>
        )}

        {/* 根据选择的视图显示不同内容 */}
        {activeView === 'overview' && (
          <>
            {/* 增强统计卡片 */}
            <EnhancedStats 
              totalNodes={stats?.totalNodes || 0}
              onlineNodes={stats?.onlineNodes || 0}
              totalCountries={stats?.totalCountries || 0}
              totalProviders={stats?.totalProviders || 0}
              className="mb-8"
            />
            
            {/* 地图和活动日志布局 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              {/* 地图 */}
              <div className="xl:col-span-2">
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
                    />
                  </Suspense>
                </div>
              </div>
              
              {/* 活动日志 */}
              <div className="xl:col-span-1">
                <ActivityLog />
              </div>
            </div>

            {/* 选中节点信息 */}
            {selectedNode && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Selected Node: {selectedNode.name}
                  </h3>
                  <Button
                    onClick={() => setShowDiagnostics(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Run Diagnostics
                  </Button>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-200 mb-2">
                  {selectedNode.city}, {selectedNode.country} • {selectedNode.provider}
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
                  <div>Status: <span className="font-medium">{selectedNode.status.toUpperCase()}</span></div>
                  {selectedNode.ipv4 && <div>IPv4: <span className="font-mono">{selectedNode.ipv4}</span></div>}
                  {selectedNode.lastSeen && (
                    <div>Last Seen: <span className="font-medium">
                      {new Date(selectedNode.lastSeen).toLocaleString()}
                    </span></div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'users' && hasRole('ADMIN') && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          }>
            <UserManagement />
          </Suspense>
        )}


        {activeView === 'settings' && hasRole('ADMIN') && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          }>
            <SystemSettings />
          </Suspense>
        )}

        {activeView === 'analytics' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          }>
            <AnalyticsPanel />
          </Suspense>
        )}

        {activeView === 'agents' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          }>
            <AgentInstaller />
          </Suspense>
        )}

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