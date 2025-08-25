import { useRef, memo, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Activity, 
  Globe, 
  Wifi, 
  Server, 
  MapPin, 
  Clock, 
  Zap,
  Eye,
  TrendingUp,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react';
import type { NodeData } from '@/services/api';
import 'leaflet/dist/leaflet.css';

// 修复 Leaflet 默认图标问题
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  showHeatmap?: boolean;
  selectedNode?: NodeData | null;
  className?: string;
}

// 聚合节点类型
interface NodeCluster {
  id: string;
  latitude: number;
  longitude: number;
  nodes: NodeData[];
  count: number;
  onlineCount: number;
  offlineCount: number;
  maintenanceCount: number;
}

// 聚合距离计算（基于缩放级别）
const getClusterDistance = (zoom: number): number => {
  // 缩放级别越低，聚合距离越大
  if (zoom <= 3) return 500; // 国家级别
  if (zoom <= 6) return 200; // 州/省级别  
  if (zoom <= 9) return 100; // 城市级别
  if (zoom <= 12) return 50;  // 区域级别
  return 20; // 街道级别
};

// 计算两点之间的距离（公里）
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // 地球半径
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// 节点聚合算法
const clusterNodes = (nodes: NodeData[], zoom: number): (NodeData | NodeCluster)[] => {
  if (!nodes.length) return [];
  
  const clusterDistance = getClusterDistance(zoom);
  const clusters: (NodeData | NodeCluster)[] = [];
  const processed = new Set<string>();
  
  nodes.forEach((node, index) => {
    if (processed.has(node.id)) return;
    
    const nearbyNodes: NodeData[] = [node];
    processed.add(node.id);
    
    // 寻找附近的节点
    nodes.slice(index + 1).forEach(otherNode => {
      if (processed.has(otherNode.id)) return;
      
      const distance = calculateDistance(
        node.latitude, node.longitude,
        otherNode.latitude, otherNode.longitude
      );
      
      if (distance <= clusterDistance) {
        nearbyNodes.push(otherNode);
        processed.add(otherNode.id);
      }
    });
    
    if (nearbyNodes.length === 1) {
      // 单个节点
      clusters.push(nearbyNodes[0]);
    } else {
      // 创建聚合节点
      const avgLat = nearbyNodes.reduce((sum, n) => sum + n.latitude, 0) / nearbyNodes.length;
      const avgLon = nearbyNodes.reduce((sum, n) => sum + n.longitude, 0) / nearbyNodes.length;
      
      const cluster: NodeCluster = {
        id: `cluster-${nearbyNodes.map(n => n.id).join('-')}`,
        latitude: avgLat,
        longitude: avgLon,
        nodes: nearbyNodes,
        count: nearbyNodes.length,
        onlineCount: nearbyNodes.filter(n => n.status.toLowerCase() === 'online').length,
        offlineCount: nearbyNodes.filter(n => n.status.toLowerCase() === 'offline').length,
        maintenanceCount: nearbyNodes.filter(n => n.status.toLowerCase() === 'maintenance').length,
      };
      
      clusters.push(cluster);
    }
  });
  
  return clusters;
};

// 状态对应的颜色和图标
const getNodeStyle = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case 'online': 
      return { 
        color: '#22c55e', 
        bgColor: 'bg-green-50', 
        textColor: 'text-green-700',
        icon: Activity,
        pulse: true
      };
    case 'offline': 
      return { 
        color: '#ef4444', 
        bgColor: 'bg-red-50', 
        textColor: 'text-red-700',
        icon: AlertTriangle,
        pulse: false
      };
    case 'maintenance': 
      return { 
        color: '#f59e0b', 
        bgColor: 'bg-yellow-50', 
        textColor: 'text-yellow-700',
        icon: Clock,
        pulse: false
      };
    default: 
      return { 
        color: '#6b7280', 
        bgColor: 'bg-gray-50', 
        textColor: 'text-gray-700',
        icon: Server,
        pulse: false
      };
  }
};

// 创建增强的自定义图标
const createEnhancedIcon = (status: string, isSelected: boolean = false) => {
  const style = getNodeStyle(status);
  const size = isSelected ? 24 : 18;
  const pulseClass = style.pulse ? 'animate-pulse' : '';
  const selectedClass = isSelected ? 'transform scale-125' : '';
  
  return new DivIcon({
    html: `
      <div class="flex items-center justify-center ${selectedClass} ${pulseClass}" 
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center" 
             style="background-color: ${style.color};">
          <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    className: 'custom-enhanced-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// 创建聚合节点图标
const createClusterIcon = (cluster: NodeCluster) => {
  const size = Math.min(40 + Math.log2(cluster.count) * 8, 60); // 动态大小
  const primaryColor = cluster.onlineCount > cluster.offlineCount ? '#22c55e' : 
                       cluster.offlineCount > 0 ? '#ef4444' : '#6b7280';
  
  return new DivIcon({
    html: `
      <div class="flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white font-bold" 
             style="background-color: ${primaryColor}; font-size: ${Math.max(12, size / 4)}px;">
          ${cluster.count}
        </div>
        ${cluster.onlineCount > 0 && cluster.offlineCount > 0 ? `
          <div class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white" 
               style="background-color: #ef4444;"></div>
        ` : ''}
      </div>
    `,
    className: 'custom-cluster-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// 计算节点统计信息
const calculateNodeStats = (nodes: NodeData[]) => {
  const total = nodes.length;
  const online = nodes.filter(n => n.status.toLowerCase() === 'online').length;
  const offline = nodes.filter(n => n.status.toLowerCase() === 'offline').length;
  const maintenance = nodes.filter(n => n.status.toLowerCase() === 'maintenance').length;
  const uptime = total > 0 ? Math.round((online / total) * 100) : 0;
  
  return { total, online, offline, maintenance, uptime };
};

// 缩放监听组件
const ZoomHandler = ({ onZoomChange }: { onZoomChange: (zoom: number) => void }) => {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });
  return null;
};

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  selectedNode?: NodeData | null;
  showHeatmap?: boolean;
  className?: string;
  onNodeRename?: (nodeId: string, newName: string) => void;
  onNodeDelete?: (nodeId: string) => void;
}

export const EnhancedWorldMap = memo(({ 
  nodes = [], 
  onNodeClick, 
  showHeatmap = false,
  selectedNode,
  className = '',
  onNodeRename,
  onNodeDelete
}: EnhancedWorldMapProps) => {
  const mapRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'connections'>('markers');
  const [showStats, setShowStats] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(3);
  
  // 节点管理状态
  const [renamingNode, setRenamingNode] = useState<NodeData | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [deletingNode, setDeletingNode] = useState<NodeData | null>(null);

  const stats = useMemo(() => calculateNodeStats(nodes), [nodes]);

  // 处理节点改名
  const handleRename = (node: NodeData) => {
    setRenamingNode(node);
    setNewNodeName(node.name);
  };

  const confirmRename = () => {
    if (renamingNode && newNodeName.trim() && onNodeRename) {
      onNodeRename(renamingNode.id, newNodeName.trim());
      setRenamingNode(null);
      setNewNodeName('');
    }
  };

  const cancelRename = () => {
    setRenamingNode(null);
    setNewNodeName('');
  };

  // 处理节点删除
  const handleDelete = (node: NodeData) => {
    setDeletingNode(node);
  };

  const confirmDelete = () => {
    if (deletingNode && onNodeDelete) {
      onNodeDelete(deletingNode.id);
      setDeletingNode(null);
    }
  };

  const cancelDelete = () => {
    setDeletingNode(null);
  };

  // 聚合节点
  const clusteredItems = useMemo(() => {
    return clusterNodes(nodes, currentZoom);
  }, [nodes, currentZoom]);

  // 生成标记组件
  const markers = useMemo(() => {
    return clusteredItems.map((item) => {
      // 检查是否为聚合节点
      if ('count' in item) {
        // 聚合节点
        const cluster = item as NodeCluster;
        return (
          <Marker
            key={cluster.id}
            position={[cluster.latitude, cluster.longitude]}
            icon={createClusterIcon(cluster)}
            eventHandlers={{
              click: () => {
                // 点击聚合节点时可以放大地图或显示节点列表
                if (mapRef.current) {
                  mapRef.current.setView([cluster.latitude, cluster.longitude], Math.min(currentZoom + 2, 18));
                }
              },
            }}
          >
            <Popup className="custom-popup" maxWidth={400}>
              <Card className="border-0 shadow-lg">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900">
                      集群节点 ({cluster.count})
                    </h3>
                    <Badge variant="secondary">
                      在线: {cluster.onlineCount}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {cluster.nodes.map((node) => {
                      const style = getNodeStyle(node.status);
                      const IconComponent = style.icon;
                      return (
                        <div key={node.id} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center space-x-2">
                            <div className={`p-1 rounded ${style.bgColor}`}>
                              <IconComponent className={`h-3 w-3 ${style.textColor}`} />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{node.name}</div>
                              <div className="text-xs text-gray-500">{node.city}</div>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onNodeClick?.(node)}
                            className="text-xs"
                          >
                            查看
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </Popup>
          </Marker>
        );
      } else {
        // 单个节点
        const node = item as NodeData;
        const isSelected = selectedNode?.id === node.id;
        const style = getNodeStyle(node.status);
        const IconComponent = style.icon;

        return (
          <Marker
            key={`${node.id}-${node.status}-${isSelected}`}
            position={[node.latitude, node.longitude]}
            icon={createEnhancedIcon(node.status, isSelected)}
            eventHandlers={{
              click: () => onNodeClick?.(node),
            }}
          >
          <Popup className="custom-popup" maxWidth={350}>
            <Card className="border-0 shadow-lg">
              <div className="p-4">
                {/* 头部信息 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${style.bgColor}`}>
                      <IconComponent className={`h-5 w-5 ${style.textColor}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{node.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {node.city}, {node.country}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    className={`${
                      node.status.toLowerCase() === 'online' ? 'bg-green-100 text-green-800 border-green-200' :
                      node.status.toLowerCase() === 'offline' ? 'bg-red-100 text-red-800 border-red-200' :
                      node.status.toLowerCase() === 'maintenance' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-gray-100 text-gray-800 border-gray-200'
                    } px-2 py-1 font-medium`}
                  >
                    {node.status.toUpperCase()}
                  </Badge>
                </div>

                {/* 详细信息网格 */}
                <div className="space-y-3 mb-4">
                  {/* 基础信息行 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Globe className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="text-gray-600">供应商:</span>
                      </div>
                      <p className="font-medium text-gray-900 ml-6 text-sm">{node.provider}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Server className="h-4 w-4 mr-2 text-purple-500" />
                        <span className="text-gray-600">坐标:</span>
                      </div>
                      <p className="font-mono text-xs text-gray-900 ml-6">
                        {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* IP地址信息 */}
                  <div className="grid grid-cols-1 gap-3">
                    {node.ipv4 && (
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Wifi className="h-4 w-4 mr-2 text-green-500" />
                          <span className="text-gray-600">IPv4:</span>
                        </div>
                        <p className="font-mono text-sm text-blue-600 ml-6">{node.ipv4}</p>
                      </div>
                    )}

                    {node.ipv6 && (
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Wifi className="h-4 w-4 mr-2 text-green-500" />
                          <span className="text-gray-600">IPv6:</span>
                        </div>
                        <p className="font-mono text-xs text-blue-600 ml-6 break-all">{node.ipv6}</p>
                      </div>
                    )}
                  </div>

                  {/* ASN信息 */}
                  {node.asnNumber && (
                    <div className="border-t pt-3">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <TrendingUp className="h-4 w-4 mr-2 text-purple-500" />
                            <span className="text-gray-600">ASN:</span>
                          </div>
                          <p className="font-mono text-sm text-purple-600 ml-6">{node.asnNumber}</p>
                        </div>
                        
                        {(node.asnName || node.asnOrg) && (
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Globe className="h-4 w-4 mr-2 text-indigo-500" />
                              <span className="text-gray-600">ASN组织:</span>
                            </div>
                            <p className="text-xs text-gray-900 ml-6 break-words">
                              {node.asnName || node.asnOrg}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 状态信息 */}
                  {node.lastSeen && (
                    <div className="border-t pt-3">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Clock className="h-4 w-4 mr-2 text-orange-500" />
                          <span className="text-gray-600">最后在线:</span>
                        </div>
                        <p className="text-sm text-gray-900 ml-6">
                          {new Date(node.lastSeen).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                      onClick={() => onNodeClick?.(node)}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      运行诊断
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        if (mapRef.current) {
                          mapRef.current.setView([node.latitude, node.longitude], 8);
                        }
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* 管理按钮 */}
                  {(onNodeRename || onNodeDelete) && (
                    <div className="flex space-x-2">
                      {onNodeRename && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => handleRename(node)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          改名
                        </Button>
                      )}
                      {onNodeDelete && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleDelete(node)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Popup>
        </Marker>
        );
      }
    });
  }, [nodes, onNodeClick, selectedNode]);

  // 生成覆盖圈（显示节点覆盖范围）
  const coverageCircles = useMemo(() => {
    if (!showHeatmap) return [];

    return nodes.map((node) => {
      const style = getNodeStyle(node.status);
      return (
        <Circle
          key={`coverage-${node.id}`}
          center={[node.latitude, node.longitude]}
          radius={50000} // 50km 覆盖半径
          fillColor={style.color}
          fillOpacity={0.1}
          color={style.color}
          weight={1}
          opacity={0.3}
        />
      );
    });
  }, [nodes, showHeatmap]);

  return (
    <div className={`relative ${className}`}>
      {/* 地图控制面板 */}
      <div className="absolute top-4 right-4 z-[1000] space-y-3">
        {/* 统计信息卡片 */}
        {showStats && (
          <div className="glass rounded-lg p-4 border border-white/20 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white/90 flex items-center">
                <Activity className="h-4 w-4 mr-2 text-blue-400" />
                节点统计
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStats(false)}
                className="h-6 w-6 p-0 text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white"
              >
                ×
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center glass rounded p-2 border border-white/10">
                <div className="status-indicator bg-green-400 mr-2"></div>
                <span className="text-gray-900 dark:text-white/90">在线: {stats.online}</span>
              </div>
              <div className="flex items-center glass rounded p-2 border border-white/10">
                <div className="status-indicator bg-red-400 mr-2"></div>
                <span className="text-gray-900 dark:text-white/90">离线: {stats.offline}</span>
              </div>
              <div className="flex items-center glass rounded p-2 border border-white/10">
                <TrendingUp className="h-3 w-3 mr-2 text-blue-400" />
                <span className="text-gray-900 dark:text-white/90">可用率: {stats.uptime}%</span>
              </div>
              <div className="flex items-center glass rounded p-2 border border-white/10">
                <Server className="h-3 w-3 mr-2 text-purple-400" />
                <span className="text-gray-900 dark:text-white/90">总计: {stats.total}</span>
              </div>
            </div>
            
            {/* 实时状态指示 */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-gray-700 dark:text-white/70">
                <span>实时监控</span>
                <div className="flex items-center space-x-1">
                  <div className="status-indicator bg-green-400"></div>
                  <span>ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 视图控制 */}
        <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-xl shadow-lg">
          <div className="flex flex-col space-y-2">
            <div className="text-xs text-gray-700 dark:text-gray-300 mb-1 font-medium">显示模式</div>
            <Button
              variant={viewMode === 'markers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('markers')}
              className="justify-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <MapPin className="h-3 w-3 mr-2" />
              节点标记
            </Button>
            <Button
              variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('heatmap');
              }}
              className="justify-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <Zap className="h-3 w-3 mr-2" />
              覆盖热图
            </Button>
          </div>
          
          {/* 快速操作 */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="w-full justify-start text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Eye className="h-3 w-3 mr-2" />
              {showStats ? '隐藏' : '显示'}统计
            </Button>
          </div>
        </div>
      </div>

      {/* 地图容器 */}
      <div className="h-[600px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          className="z-0"
          preferCanvas={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="grayscale-[20%] contrast-[110%]"
          />
          
          {/* 缩放监听组件 */}
          <ZoomHandler onZoomChange={setCurrentZoom} />
          
          {/* 根据视图模式渲染不同内容 */}
          {viewMode === 'markers' && markers}
          {viewMode === 'heatmap' && [...markers, ...coverageCircles]}
        </MapContainer>
      </div>

      {/* 底部信息栏 */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span>共 {nodes.length} 个节点</span>
          {selectedNode && (
            <span className="text-blue-600">
              已选择: {selectedNode.name}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span>视图模式:</span>
          <Badge variant="secondary" className="text-xs">
            {viewMode === 'markers' ? '标记模式' : '热图模式'}
          </Badge>
        </div>
      </div>

      {/* 改名对话框 */}
      {renamingNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">重命名节点</h3>
            <p className="text-sm text-gray-600 mb-4">
              当前节点: <span className="font-medium">{renamingNode.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">新名称</label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入新的节点名称"
                  autoFocus
                />
              </div>
              <div className="flex space-x-3">
                <Button 
                  onClick={confirmRename}
                  className="flex-1"
                  disabled={!newNodeName.trim()}
                >
                  确认
                </Button>
                <Button 
                  onClick={cancelRename}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deletingNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-4">确认删除节点</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要删除节点 <span className="font-medium text-red-600">{deletingNode.name}</span> 吗？
            </p>
            <p className="text-xs text-red-500 mb-4">
              ⚠️ 此操作不可撤销，将永久删除该节点的所有数据。
            </p>
            <div className="flex space-x-3">
              <Button 
                onClick={confirmDelete}
                variant="outline"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
              >
                确认删除
              </Button>
              <Button 
                onClick={cancelDelete}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
});