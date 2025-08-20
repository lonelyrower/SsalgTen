import { useRef, memo, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Badge } from '@/components/ui/badge';
import type { NodeData } from '@/services/api';
import 'leaflet/dist/leaflet.css';

// 修复 Leaflet 默认图标问题
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface WorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
}

// 状态对应的图标颜色
const getMarkerColor = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case 'online': return '#22c55e'; // green-500
    case 'offline': return '#ef4444'; // red-500
    case 'maintenance': return '#f59e0b'; // amber-500
    default: return '#6b7280'; // gray-500
  }
};

// 创建自定义标记图标
const createCustomIcon = (status: string) => {
  const color = getMarkerColor(status);
  return new DivIcon({
    html: `
      <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow-lg" 
           style="background-color: ${color}">
        <div class="w-2 h-2 bg-white rounded-full"></div>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export const WorldMap = memo(({ nodes = [], onNodeClick }: WorldMapProps) => {
  const mapRef = useRef<any>(null);

  // 使用 useMemo 缓存标记组件，避免不必要的重新渲染
  const markers = useMemo(() => {
    return nodes.map((node) => (
      <Marker
        key={`${node.id}-${node.status}`} // 包含状态的 key 确保状态变化时更新
        position={[node.latitude, node.longitude]}
        icon={createCustomIcon(node.status)}
        eventHandlers={{
          click: () => onNodeClick?.(node),
        }}
      >
        <Popup>
          <div className="p-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{node.name}</h3>
              <Badge 
                className={`ml-2 ${
                  node.status.toLowerCase() === 'online' ? 'bg-green-100 text-green-800' :
                  node.status.toLowerCase() === 'offline' ? 'bg-red-100 text-red-800' :
                  node.status.toLowerCase() === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}
              >
                {node.status.toUpperCase()}
              </Badge>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">位置:</span> {node.city}, {node.country}</p>
              <p><span className="font-medium">供应商:</span> {node.provider}</p>
              {node.ipv4 && <p><span className="font-medium">IP:</span> {node.ipv4}</p>}
              {node.lastSeen && (
                <p><span className="font-medium">最后在线:</span> {new Date(node.lastSeen).toLocaleString()}</p>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    ));
  }, [nodes, onNodeClick]);

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {markers}
      </MapContainer>
    </div>
  );
});