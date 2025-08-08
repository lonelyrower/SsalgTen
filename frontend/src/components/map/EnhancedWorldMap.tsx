import { useRef, memo, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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
  AlertTriangle
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
  const size = isSelected ? 32 : 24;
  const pulseClass = style.pulse ? 'animate-pulse' : '';
  const selectedClass = isSelected ? 'ring-4 ring-blue-300' : '';
  
  return new DivIcon({
    html: `
      <div class="flex items-center justify-center ${selectedClass} ${pulseClass}" 
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-3 border-white shadow-lg flex items-center justify-center" 
             style="background-color: ${style.color};">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    className: 'custom-enhanced-marker',
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

export const EnhancedWorldMap = memo(({ 
  nodes = [], 
  onNodeClick, 
  showHeatmap = false,
  selectedNode,
  className = ''
}: EnhancedWorldMapProps) => {
  const mapRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'connections'>('markers');
  const [showStats, setShowStats] = useState(true);

  const stats = useMemo(() => calculateNodeStats(nodes), [nodes]);

  // 生成标记组件
  const markers = useMemo(() => {
    return nodes.map((node) => {
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
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Globe className="h-4 w-4 mr-2 text-blue-500" />
                      <span className="text-gray-600">供应商:</span>
                    </div>
                    <p className="font-medium text-gray-900 ml-6">{node.provider}</p>
                  </div>

                  {node.ipv4 && (
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Wifi className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-gray-600">IPv4:</span>
                      </div>
                      <p className="font-mono text-sm text-gray-900 ml-6">{node.ipv4}</p>
                    </div>
                  )}

                  {node.lastSeen && (
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-orange-500" />
                        <span className="text-gray-600">最后在线:</span>
                      </div>
                      <p className="text-sm text-gray-900 ml-6">
                        {new Date(node.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Server className="h-4 w-4 mr-2 text-purple-500" />
                      <span className="text-gray-600">坐标:</span>
                    </div>
                    <p className="font-mono text-xs text-gray-900 ml-6">
                      {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
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
              </div>
            </Card>
          </Popup>
        </Marker>
      );
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
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        {/* 统计信息卡片 */}
        {showStats && (
          <Card className="p-3 bg-white/95 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">节点统计</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStats(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                在线: {stats.online}
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                离线: {stats.offline}
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-3 w-3 mr-2 text-blue-500" />
                可用率: {stats.uptime}%
              </div>
              <div className="flex items-center">
                <Server className="h-3 w-3 mr-2 text-gray-500" />
                总计: {stats.total}
              </div>
            </div>
          </Card>
        )}

        {/* 视图控制 */}
        <Card className="p-2 bg-white/95 backdrop-blur-sm shadow-lg">
          <div className="flex flex-col space-y-1">
            <Button
              variant={viewMode === 'markers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('markers')}
              className="justify-start text-xs"
            >
              <MapPin className="h-3 w-3 mr-2" />
              标记
            </Button>
            <Button
              variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('heatmap');
                setShowStats(true);
              }}
              className="justify-start text-xs"
            >
              <Zap className="h-3 w-3 mr-2" />
              热图
            </Button>
          </div>
        </Card>
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
    </div>
  );
});