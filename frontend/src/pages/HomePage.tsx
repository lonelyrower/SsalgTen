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
        
        {/* 地图 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Global Node Network
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Online ({stats?.onlineNodes || 0})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Offline ({stats?.offlineNodes || 0})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span>Unknown ({stats?.unknownNodes || 0})</span>
              </div>
            </div>
          </div>
          
          <WorldMap nodes={nodes} onNodeClick={handleNodeClick} />
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