import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/layout/StatsCards';
import { WorldMap } from '@/components/map/WorldMap';

interface NodeData {
  id: string;
  name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'unknown';
  provider: string;
  ipv4?: string;
  ipv6?: string;
  lastPing?: number;
}

export const HomePage = () => {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // 模拟统计数据
  const stats = {
    totalNodes: 4,
    onlineNodes: 3,
    totalCountries: 4,
    totalProviders: 4
  };

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        <StatsCards {...stats} />
        
        {/* 地图 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Global Node Network
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Offline</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span>Unknown</span>
              </div>
            </div>
          </div>
          
          <WorldMap onNodeClick={handleNodeClick} />
        </div>

        {/* 选中节点信息 */}
        {selectedNode && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">
              Selected Node: {selectedNode.name}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-200">
              {selectedNode.city}, {selectedNode.country} • {selectedNode.provider}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};