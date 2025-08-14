import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/layout/StatsCards';
import { WorldMap } from '@/components/map/WorldMap';
import { NetworkDiagnostics } from '@/components/diagnostics/NetworkDiagnostics';
import { useNodes } from '@/hooks/useNodes';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import type { NodeData } from '@/services/api';

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { nodes, stats, loading, error } = useNodes();

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setShowDiagnostics(false); // 重置诊断视图
    console.log('Node clicked:', node);
  };

  const handleDiagnosticsClose = () => {
    setShowDiagnostics(false);
  };

  // 如果正在加载，显示加载状态
  if (loading && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading node data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 如果有错误，显示错误状态
  if (error && nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 text-xl mb-2">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Failed to Load Data
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Make sure the backend server is running on http://localhost:3001
              </p>
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
          <NetworkDiagnostics 
            node={selectedNode} 
            onClose={handleDiagnosticsClose} 
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        <StatsCards 
          totalNodes={stats?.totalNodes || 0}
          onlineNodes={stats?.onlineNodes || 0}
          totalCountries={stats?.totalCountries || 0}
          totalProviders={stats?.totalProviders || 0}
        />
        
        {/* 地图区域 */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-purple-900/10 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-blue-800/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  全球节点网络
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  实时监控全球网络节点状态和性能
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-full shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-green-500 shadow-sm"></div>
                  <span className="font-medium">在线 ({stats?.onlineNodes || 0})</span>
                </div>
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-full shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 shadow-sm"></div>
                  <span className="font-medium">离线 ({stats?.offlineNodes || 0})</span>
                </div>
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-full shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-gray-400 to-gray-500 shadow-sm"></div>
                  <span className="font-medium">未知 ({stats?.unknownNodes || 0})</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/50">
              <WorldMap nodes={nodes} onNodeClick={handleNodeClick} />
            </div>
          </div>
        </div>

        {/* 选中节点信息 */}
        {selectedNode && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-blue-800/30">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedNode.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        已选中网络节点
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">位置</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {selectedNode.city}, {selectedNode.country}
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">提供商</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {selectedNode.provider}
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">状态</div>
                      <div className="font-medium">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          selectedNode.status === 'online' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                            : selectedNode.status === 'offline' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {selectedNode.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    {selectedNode.ipv4 && (
                      <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">IPv4地址</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-white">
                          {selectedNode.ipv4}
                        </div>
                      </div>
                    )}
                    
                    {selectedNode.lastSeen && (
                      <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最后在线</div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                          {new Date(selectedNode.lastSeen).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="lg:ml-6">
                  <Button
                    onClick={() => setShowDiagnostics(true)}
                    size="lg"
                    className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Activity className="h-5 w-5 mr-2" />
                    运行网络诊断
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-500 mr-2">⚠️</div>
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-100">Connection Error</h3>
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};