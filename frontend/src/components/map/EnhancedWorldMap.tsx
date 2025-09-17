import React, { useRef, memo, useMemo, useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import Supercluster from 'supercluster';
const ICON_CACHE = new Map<string, DivIcon>();
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Server, 
  Clock, 
  Eye,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import type { NodeData } from '@/services/api';

// 扩展节点数据类型，支持微调坐标
interface ExtendedNodeData extends NodeData {
  _originalLat?: number;
  _originalLng?: number;
}

// 读取运行时地图配置
const getMapConfig = () => {
  const w: any = typeof window !== 'undefined' ? (window as any) : {};
  const provider = (w.APP_CONFIG?.MAP_PROVIDER || import.meta.env.VITE_MAP_PROVIDER || 'openstreetmap').toString().toLowerCase();
  const apiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';

  // 支持多种底图源，默认 OSM。如需更快的瓦片，可在生产设置 MAP_PROVIDER。
  // 选项：
  // - openstreetmap（默认）
  // - carto（Carto light_all，无需密钥，速度通常更快）
  // - maptiler（需要 MAP_API_KEY）
  switch (provider) {
    case 'carto':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ['a', 'b', 'c', 'd'] as string[],
      };
    case 'maptiler':
      return {
        url: `https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=${apiKey}`,
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OSM contributors',
        subdomains: undefined as unknown as string[],
      };
    case 'openstreetmap':
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ['a', 'b', 'c'] as string[],
      };
  }
};

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
// 旧的手写聚合类型已移除，改用 supercluster

// supercluster 属性定义
type ClusterExtra = {
  online?: number;
  offline?: number;
  maintenance?: number;
  status?: string;
  id?: string;
  node?: NodeData;
};

// 从 supercluster 聚合特征中提取是否为聚合
type AggregatedClusterProps = { cluster: true; cluster_id: number; point_count: number; online?: number; offline?: number; maintenance?: number };
const isSuperCluster = (props: any): props is AggregatedClusterProps => {
  return !!props && props.cluster === true && typeof props.cluster_id === 'number';
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
  const normalizedStatus = (status || 'unknown').toLowerCase();
  const cacheKey = `${normalizedStatus}-${isSelected ? 'selected' : 'default'}`;
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const style = getNodeStyle(normalizedStatus);
  const size = isSelected ? 24 : 18;
  const pulseClass = style.pulse ? 'animate-pulse' : '';
  const selectedClass = isSelected ? 'transform scale-125' : '';

  const icon = new DivIcon({
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

  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

// 创建聚合节点图标（基于 supercluster 返回的统计）
const createClusterIcon = (count: number, offline: number = 0, online: number = 0) => {
  // 调整聚合点大小，使其更接近常规点大小
  // 基础大小22px，根据节点数量略微增大，最大不超过32px
  const size = Math.min(22 + Math.log2(count + 1) * 2, 32);
  
  // 根据在线/离线状态确定颜色 - 简化的3色方案
  let primaryColor: string;
  if (offline === 0) {
    // 全部在线：绿色
    primaryColor = '#22c55e';
  } else if (online === 0) {
    // 全部离线：红色
    primaryColor = '#ef4444';
  } else {
    // 混合状态（有在线有离线）：蓝色
    primaryColor = '#2563eb';
  }
  
  const fontSize = Math.max(10, size / 2.8);
  return new DivIcon({
    html: `
      <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full shadow-md flex items-center justify-center text-white font-semibold"
             style="background: radial-gradient(100% 100% at 50% 0%, ${primaryColor}, ${primaryColor}CC); border: 2px solid rgba(255,255,255,0.8); font-size: ${fontSize}px;">
          ${count}
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

// 监听地图边界变化
const BoundsHandler = ({ onBoundsChange }: { onBoundsChange: (b: any) => void }) => {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    try { onBoundsChange(map.getBounds()); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

// 将 Leaflet Map 实例写入外部 ref，便于在点击聚合时主动缩放
const MapRefSetter = ({ setRef }: { setRef: (map: any) => void }) => {
  const map = useMap();
  useEffect(() => { setRef(map); }, [map, setRef]);
  return null;
};

// 处理相同坐标的节点重叠问题：坐标微调(jittering)
const jitterCoordinates = (nodes: NodeData[]): ExtendedNodeData[] => {
  const coordinateGroups = new Map<string, NodeData[]>();
  
  // 按坐标分组
  nodes.forEach(node => {
    const key = `${node.latitude.toFixed(6)},${node.longitude.toFixed(6)}`;
    if (!coordinateGroups.has(key)) {
      coordinateGroups.set(key, []);
    }
    coordinateGroups.get(key)!.push(node);
  });
  
  // 为重叠节点添加微调
  const jitteredNodes: ExtendedNodeData[] = [];
  coordinateGroups.forEach((groupNodes) => {
    if (groupNodes.length === 1) {
      // 单个节点直接添加
      jitteredNodes.push(groupNodes[0]);
    } else {
      // 多个节点需要微调坐标
      groupNodes.forEach((node, index) => {
        const jitterRadius = 0.001; // 扩大微调半径到约100米，减少聚合重叠
        const angle = (index * 2 * Math.PI) / groupNodes.length; // 均匀分布角度
        const distance = jitterRadius * (0.5 + 0.5 * (index / groupNodes.length)); // 渐变距离
        
        const latOffset = distance * Math.cos(angle);
        const lngOffset = distance * Math.sin(angle);
        
        jitteredNodes.push({
          ...node,
          // 保存原始坐标用于显示
          _originalLat: node.latitude,
          _originalLng: node.longitude,
          // 使用微调后的坐标用于地图显示
          latitude: node.latitude + latOffset,
          longitude: node.longitude + lngOffset,
        });
      });
    }
  });
  
  return jitteredNodes;
};

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  selectedNode?: NodeData | null;
  className?: string;
  // 是否显示右上角的控制面板（节点统计）
  showControlPanels?: boolean;
}

export const EnhancedWorldMap = memo(({ 
  nodes = [], 
  onNodeClick, 
  selectedNode,
  className = '',
  showControlPanels = true
}: EnhancedWorldMapProps) => {
  const mapRef = useRef<any>(null);
  const [showStats, setShowStats] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(3);
  const [debouncedZoom, setDebouncedZoom] = useState(3);
  const [bounds, setBounds] = useState<any | null>(null);
  const [debouncedBounds, setDebouncedBounds] = useState<any | null>(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterNodes, setClusterNodes] = useState<NodeData[]>([]);
  
  // 处理坐标重叠的节点
  const processedNodes = useMemo(() => jitterCoordinates(nodes), [nodes]);
  
  const stats = useMemo(() => calculateNodeStats(nodes), [nodes]);

  // 防抖缩放级别，避免频繁重算聚合
  useEffect(() => {
    const t = setTimeout(() => setDebouncedZoom(currentZoom), 200);
    return () => clearTimeout(t);
  }, [currentZoom]);

  // 防抖边界变更
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBounds(bounds), 200);
    return () => clearTimeout(t);
  }, [bounds]);

  // supercluster 索引（随节点变化重建）
  const clusterIndex = useMemo(() => {
    const idx: any = new (Supercluster as any)({
      radius: 40, // 降低聚合半径，减少节点聚合
      maxZoom: 22, // 提高最大缩放级别
      minPoints: 2,
      // 映射每个点的聚合贡献
      map: (props: ClusterExtra) => ({
        online: props.status?.toLowerCase() === 'online' ? 1 : 0,
        offline: props.status?.toLowerCase() === 'offline' ? 1 : 0,
        maintenance: props.status?.toLowerCase() === 'maintenance' ? 1 : 0,
      }),
      // 聚合统计
      reduce: (acc: ClusterExtra, props: ClusterExtra) => {
        acc.online = (acc.online || 0) + (props.online || 0);
        acc.offline = (acc.offline || 0) + (props.offline || 0);
        acc.maintenance = (acc.maintenance || 0) + (props.maintenance || 0);
      },
    });
    const features = processedNodes.map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] },
      properties: { id: n.id, status: n.status, node: n } as ClusterExtra,
    }));
    idx.load(features);
    return idx;
  }, [processedNodes]);

  // 计算当前视口聚合结果
  const clusteredItems = useMemo(() => {
    if (!debouncedBounds) return [] as any[];
    const north = debouncedBounds.getNorth ? debouncedBounds.getNorth() : debouncedBounds._northEast?.lat;
    const south = debouncedBounds.getSouth ? debouncedBounds.getSouth() : debouncedBounds._southWest?.lat;
    const east = debouncedBounds.getEast ? debouncedBounds.getEast() : debouncedBounds._northEast?.lng;
    const west = debouncedBounds.getWest ? debouncedBounds.getWest() : debouncedBounds._southWest?.lng;
    if ([north, south, east, west].some(v => typeof v !== 'number')) return [] as any[];
    const bbox: [number, number, number, number] = [west, south, east, north];
    const z = Math.max(0, Math.floor(debouncedZoom));
    return (clusterIndex as any).getClusters(bbox, z) as any[];
  }, [clusterIndex, debouncedBounds, debouncedZoom]);

  // 生成标记组件
  const markers = useMemo(() => {
    const els: React.ReactElement[] = [];
    clusteredItems.forEach((feature: any) => {
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = feature.properties as any;
      if (isSuperCluster(props)) {
        const count = props.point_count as number;
        const offline = (props.offline as number) || 0;
        els.push(
          <Marker
            key={`cluster-${props.cluster_id}-${count}`}
            position={[lat, lng]}
            icon={createClusterIcon(count, offline, props.online)}
            eventHandlers={{
              click: () => {
                try {
                  const targetZoom = Math.min((clusterIndex as any).getClusterExpansionZoom(props.cluster_id), 22);
                  const currentMapZoom = mapRef.current?.getZoom() || 0;
                  
                  // 如果已经在高缩放级别且无法进一步缩放，显示节点列表
                  if (currentMapZoom >= 18 && targetZoom <= currentMapZoom + 1) {
                    // 获取聚合中的节点
                    const leaves = (clusterIndex as any).getLeaves(props.cluster_id, Infinity);
                    const nodes = leaves.map((leaf: any) => leaf.properties?.node).filter(Boolean);
                    setClusterNodes(nodes);
                    setShowClusterModal(true);
                  } else {
                    // 正常缩放
                    mapRef.current?.setView([lat, lng], targetZoom, { animate: true });
                  }
                } catch {}
              },
            }}
          >
            <Popup className="custom-popup" maxWidth={300}>
              <div className="p-3">
                <h3 className="font-bold text-base text-gray-900 mb-2">集群节点 ({count})</h3>
                <div className="text-sm text-gray-600 mb-2">
                  在线: {props.online || 0} | 离线: {props.offline || 0}
                  {(() => {
                    const total = (props.online || 0) + (props.offline || 0);
                    const rate = total > 0 ? Math.round(((props.online || 0) / total) * 100) : 0;
                    return (
                      <div className="text-xs mt-1">
                        状态: <span className={`font-semibold ${
                          (props.offline || 0) === 0 ? 'text-green-600' :
                          (props.online || 0) === 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {(props.offline || 0) === 0 ? '全部在线' :
                           (props.online || 0) === 0 ? '全部离线' : '混合状态'}
                        </span> ({rate}%)
                      </div>
                    );
                  })()} 
                </div>
                <p className="text-xs text-gray-500">
                  {(() => {
                    const currentMapZoom = mapRef.current?.getZoom() || 0;
                    const targetZoom = Math.min((clusterIndex as any).getClusterExpansionZoom(props.cluster_id), 22);
                    return currentMapZoom >= 18 && targetZoom <= currentMapZoom + 1
                      ? '点击查看节点列表'
                      : '点击放大以查看详情';
                  })()}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      } else {
        const node: ExtendedNodeData | undefined = props.node as ExtendedNodeData | undefined;
        if (!node) return;
        const isSelected = selectedNode?.id === node.id;
        const hasOriginalCoords = node._originalLat !== undefined && node._originalLng !== undefined;
        
        els.push(
          <Marker
            key={`node-${node.id}-${node.status}-${isSelected}`}
            position={[node.latitude, node.longitude]}
            icon={createEnhancedIcon(node.status, isSelected)}
            eventHandlers={{ click: () => onNodeClick?.(node) }}
          >
            <Popup className="custom-popup" maxWidth={300}>
              <div className="p-3">
                <h3 className="font-bold text-base text-gray-900 mb-2">{node.name}</h3>
                <div className="text-sm text-gray-600 mb-2 space-y-1">
                  <div>状态: <span className={`font-semibold ${
                    node.status === 'online' ? 'text-green-600' : 
                    node.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                  }`}>{node.status.toUpperCase()}</span></div>
                  <div>位置: {node.city}, {node.country}</div>
                  <div>提供商: {node.provider}</div>
                  {hasOriginalCoords && (
                    <div className="text-xs text-orange-600 mt-2 p-2 bg-orange-50 rounded">
                      <div className="font-medium">⚠️ 坐标已微调</div>
                      <div>原始坐标: {node._originalLat?.toFixed(6)}, {node._originalLng?.toFixed(6)}</div>
                      <div className="text-gray-500">多节点位于相同位置，已自动分散显示</div>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      }
    });
    return els;
  }, [clusteredItems, clusterIndex, onNodeClick, selectedNode]);


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

        {/* 快速操作 */}
        <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-xl shadow-lg">
          <div className="space-y-1">
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
          {/* 设置 mapRef，供点击聚合时 setView 使用 */}
          <MapRefSetter setRef={(m) => { (mapRef as any).current = m; }} />
          <BoundsHandler onBoundsChange={setBounds} />
          {(() => {
            const cfg = getMapConfig();
            return (
              <TileLayer
                attribution={cfg.attribution}
                url={cfg.url}
                className="grayscale-[20%] contrast-[110%]"
                updateWhenIdle={true}
                updateWhenZooming={false}
                keepBuffer={2}
              />
            );
          })()}
          
          {/* 缩放监听组件 */}
          <ZoomHandler onZoomChange={setCurrentZoom} />
          
          {/* 渲染节点标记 */}
          {markers}
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
      </div>

      {/* 聚合节点详情模态框 */}
      {showClusterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  聚合节点详情 ({clusterNodes.length} 个节点)
                </h3>
                <button
                  onClick={() => setShowClusterModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                该位置的所有节点（已达到最大缩放级别）
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clusterNodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => {
                      onNodeClick?.(node);
                      setShowClusterModal(false);
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        {node.name}
                      </h4>
                      <div className={`w-3 h-3 rounded-full ${
                        node.status === 'online' ? 'bg-green-500' : 
                        node.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                    </div>
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>状态: <span className={`font-medium ${
                        node.status === 'online' ? 'text-green-600' :
                        node.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                      }`}>{node.status.toUpperCase()}</span></div>
                      <div>位置: {node.city}, {node.country}</div>
                      <div>提供商: {node.provider}</div>
                      {node.ipv4 && (
                        <div className="font-mono text-blue-600 dark:text-blue-400">
                          {node.ipv4}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <span className="text-green-600">
                    在线: {clusterNodes.filter(n => n.status === 'online').length}
                  </span>
                  <span className="text-red-600">
                    离线: {clusterNodes.filter(n => n.status === 'offline').length}
                  </span>
                </div>
                <button
                  onClick={() => setShowClusterModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
