import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { EnhancedStats } from '@/components/dashboard/EnhancedStats';
import { NodeStatusChart } from '@/components/dashboard/NodeStatusChart';
import { GeographicDistribution } from '@/components/dashboard/GeographicDistribution';
import { useRealTime } from '@/hooks/useRealTime';
import { Activity, Loader2, Globe, MapPin, Settings, Shield, BarChart } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { nodes, stats, lastUpdate, connected } = useRealTime();
  



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
          
          {/* 节点状态和分布分析 */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
            {/* 节点状态饼图 */}
            <div className="xl:col-span-2">
              <NodeStatusChart 
                onlineNodes={stats?.onlineNodes || 0}
                offlineNodes={(stats?.totalNodes || 0) - (stats?.onlineNodes || 0)}
              />
            </div>
            
            {/* 地理和服务商分布 */}
            <div className="xl:col-span-3">
              <GeographicDistribution nodes={nodes} />
            </div>
          </div>

          {/* 系统监控概览 */}
          <div className="mb-6">
            {/* 节点健康状态 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-green-600" />
                节点健康状态
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">在线率</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${stats?.totalNodes ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {stats?.totalNodes ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats?.onlineNodes || 0}</div>
                    <div className="text-xs text-green-700 dark:text-green-300">在线节点</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {(stats?.totalNodes || 0) - (stats?.onlineNodes || 0)}
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-300">离线节点</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 快速操作 */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速操作</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a 
                href="/nodes" 
                className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <MapPin className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">节点管理</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">管理和诊断节点</div>
                </div>
              </a>
              
              <a 
                href="/admin" 
                className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <Settings className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">系统管理</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">用户和系统设置</div>
                </div>
              </a>

              <a 
                href="/security" 
                className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <Shield className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">安全中心</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">安全日志和告警</div>
                </div>
              </a>

              <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm opacity-75">
                <BarChart className="h-8 w-8 text-gray-400 mr-3" />
                <div>
                  <div className="font-medium text-gray-500 dark:text-gray-400">数据分析</div>
                  <div className="text-xs text-gray-400">即将推出</div>
                </div>
              </div>
            </div>
          </div>
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