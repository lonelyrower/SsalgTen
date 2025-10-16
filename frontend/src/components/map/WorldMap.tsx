/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, memo, useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Badge } from '@/components/ui/badge';
import type { NodeData } from '@/services/api';

type MapProvider = 'carto' | 'openstreetmap' | 'mapbox';

const SUPPORTED_PROVIDERS: MapProvider[] = ['carto', 'openstreetmap', 'mapbox'];

const normalizeProvider = (value?: unknown): MapProvider | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return (SUPPORTED_PROVIDERS as string[]).includes(normalized)
    ? (normalized as MapProvider)
    : undefined;
};

const hasMapboxKey = (apiKey: string): boolean => {
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return true;
  }
  const envKey = import.meta.env.VITE_MAP_API_KEY as string | undefined;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const w: any = window;
    const runtimeKey = w.APP_CONFIG?.MAP_API_KEY;
    return typeof runtimeKey === 'string' && runtimeKey.trim().length > 0;
  }
  return false;
};

// 运行时地图配置（与 EnhancedWorldMap 保持一致）
// 注意：这个函数现在接收 apiKey 作为参数，确保响应式更新
const getMapConfig = (apiKey: string) => {
  const w: any = typeof window !== 'undefined' ? (window as any) : {};
  const providerCandidate =
    normalizeProvider(w.APP_CONFIG?.MAP_PROVIDER) ??
    normalizeProvider(import.meta.env.VITE_MAP_PROVIDER as string | undefined);

  const provider: MapProvider = (() => {
    if (providerCandidate) {
      if (providerCandidate === 'mapbox' && !hasMapboxKey(apiKey)) {
        return 'carto';
      }
      return providerCandidate;
    }
    return hasMapboxKey(apiKey) ? 'mapbox' : 'carto';
  })();

  switch (provider) {
    case 'carto':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        provider: 'carto' as const,
      };
    case 'mapbox':
      return {
        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`,
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        provider: 'mapbox' as const,
      };
    case 'openstreetmap':
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        provider: 'openstreetmap' as const,
      };
  }
};

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
  hideIPs?: boolean; // 隐藏弹窗中的IP（用于未登录首页）
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

export const WorldMap = memo(({ nodes = [], onNodeClick, hideIPs = false }: WorldMapProps) => {
  const mapRef = useRef<any>(null);

  // 获取API key（用于Mapbox）- 使用 useState 确保响应式更新
  const [apiKey, setApiKey] = useState<string>(() => {
    const w: any = typeof window !== 'undefined' ? (window as any) : {};
    return w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';
  });

  // 监听 APP_CONFIG 的变化，动态更新 apiKey
  useEffect(() => {
    const checkApiKey = () => {
      const w: any = typeof window !== 'undefined' ? (window as any) : {};
      const newApiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';
      if (newApiKey && newApiKey !== apiKey) {
        setApiKey(newApiKey);
      }
    };

    // 立即检查一次
    checkApiKey();

    // 设置轮询检查（仅在 apiKey 为空时）
    let intervalId: NodeJS.Timeout | undefined;
    if (!apiKey) {
      intervalId = setInterval(checkApiKey, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [apiKey]);

  // 获取地图配置（基于当前 apiKey）
  const mapConfig = useMemo(() => getMapConfig(apiKey), [apiKey]);

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
              {!hideIPs && node.ipv4 && (
                <p><span className="font-medium">IP:</span> {node.ipv4}</p>
              )}
              {node.lastSeen && (
                <p><span className="font-medium">最后在线:</span> {new Date(node.lastSeen).toLocaleString()}</p>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    ));
  }, [nodes, onNodeClick, hideIPs]);

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        className="z-0"
        worldCopyJump={true}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={0.5}
      >
        <TileLayer
          key={`${mapConfig.provider}-${apiKey ? 'with-key' : 'no-key'}`}
          attribution={mapConfig.attribution}
          url={mapConfig.url}
        />

        {markers}
      </MapContainer>
    </div>
  );
});
