import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Badge } from '@/components/ui/badge';
import 'leaflet/dist/leaflet.css';

// 修复 Leaflet 默认图标问题
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

interface WorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
}

// 状态对应的图标颜色
const getMarkerColor = (status: string) => {
  switch (status) {
    case 'online': return '#22c55e'; // green-500
    case 'offline': return '#ef4444'; // red-500
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

  // 默认示例节点数据
  const defaultNodes: NodeData[] = [
    {
      id: '1',
      name: 'New York Node',
      country: 'United States',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.0060,
      status: 'online',
      provider: 'DigitalOcean',
      ipv4: '192.168.1.1',
      lastPing: 23
    },
    {
      id: '2', 
      name: 'London Node',
      country: 'United Kingdom',
      city: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      status: 'online',
      provider: 'Vultr',
      ipv4: '192.168.1.2',
      lastPing: 45
    },
    {
      id: '3',
      name: 'Tokyo Node', 
      country: 'Japan',
      city: 'Tokyo',
      latitude: 35.6762,
      longitude: 139.6503,
      status: 'offline',
      provider: 'Linode',
      ipv4: '192.168.1.3',
      lastPing: 892
    },
    {
      id: '4',
      name: 'Sydney Node',
      country: 'Australia', 
      city: 'Sydney',
      latitude: -33.8688,
      longitude: 151.2093,
      status: 'online',
      provider: 'AWS',
      ipv4: '192.168.1.4',
      lastPing: 156
    }
  ];

  const displayNodes = nodes.length > 0 ? nodes : defaultNodes;

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
                    variant={node.status === 'online' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {node.status}
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
                  {node.lastPing && (
                    <div className="flex justify-between">
                      <span>Ping:</span>
                      <span className="font-mono text-xs">{node.lastPing}ms</span>
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