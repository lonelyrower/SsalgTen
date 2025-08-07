import { useRef } from 'react';
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

export const WorldMap = ({ nodes = [], onNodeClick }: WorldMapProps) => {
  const mapRef = useRef<any>(null);

  // 使用传入的节点数据，如果没有则显示空地图
  const displayNodes = nodes || [];

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
        
        {displayNodes.map((node) => (
          <Marker
            key={node.id}
            position={[node.latitude, node.longitude]}
            icon={createCustomIcon(node.status)}
            eventHandlers={{
              click: () => onNodeClick?.(node)
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{node.name}</h3>
                  <Badge 
                    variant={
                      node.status.toLowerCase() === 'online' ? 'default' : 
                      node.status.toLowerCase() === 'maintenance' ? 'secondary' : 
                      'destructive'
                    }
                    className="text-xs"
                  >
                    {node.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span>{node.city}, {node.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    <span>{node.provider}</span>
                  </div>
                  {node.ipv4 && (
                    <div className="flex justify-between">
                      <span>IPv4:</span>
                      <span className="font-mono text-xs">{node.ipv4}</span>
                    </div>
                  )}
                  {node.ipv6 && (
                    <div className="flex justify-between">
                      <span>IPv6:</span>
                      <span className="font-mono text-xs">{node.ipv6.substring(0, 16)}...</span>
                    </div>
                  )}
                  {node.lastSeen && (
                    <div className="flex justify-between">
                      <span>Last Seen:</span>
                      <span className="text-xs">{new Date(node.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {node._count && (
                    <div className="flex justify-between text-xs pt-1 border-t">
                      <span>Records:</span>
                      <span>{node._count.diagnosticRecords} diagnostics</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};