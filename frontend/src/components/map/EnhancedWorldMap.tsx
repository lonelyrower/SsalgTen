import React, { useRef, memo, useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Server, 
  MapPin, 
  Clock, 
  Zap,
  Eye,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import type { NodeData } from '@/services/api';

// 说明：标记均使用 DivIcon，自定义样式，不再依赖 Leaflet 默认图标

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  showHeatmap?: boolean;
  selectedNode?: NodeData | null;
  className?: string;
  // 是否显示右上角的控制面板（节点统计与显示模式）
  showControlPanels?: boolean;
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

// 网格单元角度（基于缩放级别），近似 looking.house 聚合风格：低缩放大聚合，高缩放细化
const getCellSizeDeg = (zoom: number): number => {
  if (zoom <= 2) return 6;
  if (zoom <= 3) return 3;
  if (zoom <= 5) return 1.5;
  if (zoom <= 7) return 0.7;
  if (zoom <= 9) return 0.35;
  if (zoom <= 12) return 0.18;
  return 0.1;
};


// 基于网格的 O(n) 聚合（按缩放选择单元大小），相比两两距离判断更高效
const clusterNodes = (nodes: NodeData[], zoom: number): (NodeData | NodeCluster)[] => {
  if (!nodes.length) return [];
  const cell = getCellSizeDeg(zoom);
  const buckets = new Map<string, NodeData[]>();
  for (const n of nodes) {
    const key = `${Math.floor(n.latitude / cell)}_${Math.floor(n.longitude / cell)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(n); else buckets.set(key, [n]);
  }
  const result: (NodeData | NodeCluster)[] = [];
  buckets.forEach((arr, key) => {
    if (arr.length === 1) { result.push(arr[0]); return; }
    const avgLat = arr.reduce((s, n) => s + n.latitude, 0) / arr.length;
    const avgLon = arr.reduce((s, n) => s + n.longitude, 0) / arr.length;
    const cluster: NodeCluster = {
      id: `cluster-${key}-${arr.length}`,
      latitude: avgLat,
      longitude: avgLon,
      nodes: arr,
      count: arr.length,
      onlineCount: arr.filter(n => n.status.toLowerCase() === 'online').length,
      offlineCount: arr.filter(n => n.status.toLowerCase() === 'offline').length,
      maintenanceCount: arr.filter(n => n.status.toLowerCase() === 'maintenance').length,
    };
    result.push(cluster);
  });
  return result;
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
  const size = Math.min(28 + Math.log2(cluster.count + 1) * 4, 44);
  const primaryColor = cluster.offlineCount > 0 ? '#ef4444' : '#2563eb'; // 离线偏红，否则蓝调
  const fontSize = Math.max(11, size / 3.2);
  return new DivIcon({
    html: `
      <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full shadow-md flex items-center justify-center text-white font-semibold"
             style="background: radial-gradient(100% 100% at 50% 0%, ${primaryColor}, ${primaryColor}CC); border: 2px solid rgba(255,255,255,0.8); font-size: ${fontSize}px;">
          ${cluster.count}
        </div>
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

// 生成扇形展开的节点位置
const generateExpandedPositions = (centerLat: number, centerLng: number, nodeCount: number) => {
  const radius = 0.05; // 展开半径（度）
  const positions: Array<{lat: number; lng: number}> = [];
  
  for (let i = 0; i < nodeCount; i++) {
    const angle = (2 * Math.PI * i) / nodeCount;
    const lat = centerLat + radius * Math.cos(angle);
    const lng = centerLng + radius * Math.sin(angle);
    positions.push({ lat, lng });
  }
  
  return positions;
};

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  selectedNode?: NodeData | null;
  showHeatmap?: boolean;
  className?: string;
  // 是否显示右上角的控制面板（节点统计与显示模式）
  showControlPanels?: boolean;
}

export const EnhancedWorldMap = memo(({ 
  nodes = [], 
  onNodeClick, 
  showHeatmap = false,
  selectedNode,
  className = '',
  showControlPanels = true
}: EnhancedWorldMapProps) => {
  const mapRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'connections'>('markers');
  const [showStats, setShowStats] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(3);
  const [debouncedZoom, setDebouncedZoom] = useState(3);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  
  const stats = useMemo(() => calculateNodeStats(nodes), [nodes]);

  // 防抖缩放级别，避免频繁重算聚合
  useEffect(() => {
    const t = setTimeout(() => setDebouncedZoom(currentZoom), 200);
    return () => clearTimeout(t);
  }, [currentZoom]);

  // 聚合节点
  const clusteredItems = useMemo(() => {
    return clusterNodes(nodes, debouncedZoom);
  }, [nodes, debouncedZoom]);

  // 生成标记组件
  const markers = useMemo(() => {
    const markerElements: React.ReactElement[] = [];
    
    clusteredItems.forEach((item) => {
      // 检查是否为聚合节点
      if ('count' in item) {
        // 聚合节点
        const cluster = item as NodeCluster;
        const isExpanded = expandedCluster === cluster.id;
        
        if (!isExpanded) {
          // 显示聚合节点
          markerElements.push(
            <Marker
              key={cluster.id}
              position={[cluster.latitude, cluster.longitude]}
              icon={createClusterIcon(cluster)}
              eventHandlers={{
                click: () => {
                  // 低缩放优先引导放大查看，较高缩放再展开子节点
                  const z = debouncedZoom;
                  if (z < 6 && mapRef.current?.setView) {
                    try { mapRef.current.setView([cluster.latitude, cluster.longitude], Math.min(z + 2, 12), { animate: true }); } catch {}
                  } else {
                    setExpandedCluster(cluster.id);
                  }
                },
            }}
          >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-3">
                  <h3 className="font-bold text-base text-gray-900 mb-2">
                    集群节点 ({cluster.count})
                  </h3>
                  <div className="text-sm text-gray-600 mb-2">
                    在线: {cluster.onlineCount} | 离线: {cluster.offlineCount}
                  </div>
                  <p className="text-xs text-gray-500">
                    点击展开查看各个节点
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        } else {
          // 显示展开的各个节点
          const expandedPositions = generateExpandedPositions(cluster.latitude, cluster.longitude, cluster.count);
          
          cluster.nodes.forEach((node, index) => {
            const expandedPos = expandedPositions[index];
            const isSelected = selectedNode?.id === node.id;
            
            markerElements.push(
              <Marker
                key={`expanded-${node.id}`}
                position={[expandedPos.lat, expandedPos.lng]}
                icon={createEnhancedIcon(node.status, isSelected)}
                eventHandlers={{
                  click: () => onNodeClick?.(node),
                }}
              />
            );
          });
          
          // 添加中心点用于收起
          const centerIcon = new DivIcon({
            html: `
              <div class="flex items-center justify-center" style="width: 20px; height: 20px;">
                <div class="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold" 
                     style="background-color: #6b7280; font-size: 10px;">
                  ×
                </div>
              </div>
            `,
            className: 'custom-center-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          
          markerElements.push(
            <Marker
              key={`center-${cluster.id}`}
              position={[cluster.latitude, cluster.longitude]}
              icon={centerIcon}
              eventHandlers={{
                click: () => {
                  setExpandedCluster(null);
                },
              }}
            />
          );
        }
      } else {
        // 单个节点
        const node = item as NodeData;
        const isSelected = selectedNode?.id === node.id;

        markerElements.push(
          <Marker
            key={`${node.id}-${node.status}-${isSelected}`}
            position={[node.latitude, node.longitude]}
            icon={createEnhancedIcon(node.status, isSelected)}
            eventHandlers={{
              click: () => onNodeClick?.(node),
            }}
          />
        );
      }
    });
    
    return markerElements;
  }, [nodes, onNodeClick, selectedNode, expandedCluster]);

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
    <div className={`relative flex flex-col ${className}`}>
      {/* 地图控制面板 */}
      {showControlPanels && (
      <div className="absolute top-4 right-4 z-40 space-y-3">
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
      )}

      {/* 地图容器：占满可用空间，保底高度避免过小 */}
      <div className="flex-1 min-h-[480px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          className="z-0"
          preferCanvas={true}
          worldCopyJump={true}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={0.5}
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

      {/* 底部信息栏（固定高度不参与伸缩） */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500 shrink-0">
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

    </div>
  );
});
