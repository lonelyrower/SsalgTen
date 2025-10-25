/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useRef,
  memo,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { DivIcon } from "leaflet";
import Supercluster from "supercluster";
const ICON_CACHE = new Map<string, DivIcon>();
import { Button } from "@/components/ui/button";
import {
  Layers,
  Map as MapIcon,
  MapPin,
  AlertTriangle,
  Clock,
  Server,
  Activity,
} from "lucide-react";
import type { NodeData } from "@/services/api";
import { useVisitorLocation } from "@/hooks/useVisitorLocation";
import { useVisitorLocationVisibility } from "@/hooks/useVisitorLocationVisibility";
import { MapPin as VisitorMapPin } from "lucide-react";

// 扩展节点数据类型，支持微调坐标
interface ExtendedNodeData extends NodeData {
  _originalLat?: number;
  _originalLng?: number;
}

// 地图提供商类型
type MapProvider = "carto" | "openstreetmap" | "mapbox";

// 图层配置接口
interface LayerConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  requiresApiKey?: boolean;
}

const SUPPORTED_PROVIDERS: MapProvider[] = ["carto", "openstreetmap", "mapbox"];
const LOCAL_STORAGE_PROVIDER_KEY = "map_provider";
const LOCAL_STORAGE_LAYER_KEY = "map_layer_id";
const LOCAL_STORAGE_SELECTION_KEY = "map_provider_selected";

const normalizeProvider = (value?: unknown): MapProvider | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return (SUPPORTED_PROVIDERS as string[]).includes(normalized)
    ? (normalized as MapProvider)
    : undefined;
};

const resolveStoredSelectionMode = (): "manual" | "auto" | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
    return stored === "manual" || stored === "auto" ? stored : null;
  } catch (error) {
    console.warn(
      "Failed to read map provider selection mode from localStorage",
      error,
    );
    return null;
  }
};

const resolveStoredProvider = (): MapProvider | undefined => {
  if (typeof window === "undefined") return undefined;
  if (resolveStoredSelectionMode() !== "manual") return undefined;
  try {
    const stored = normalizeProvider(
      localStorage.getItem(LOCAL_STORAGE_PROVIDER_KEY),
    );
    if (stored === "mapbox" && !hasAnyApiKeyAvailable()) {
      return undefined;
    }
    return stored;
  } catch (error) {
    console.warn("Failed to read map provider from localStorage", error);
    return undefined;
  }
};

const resolveStoredLayerId = (provider?: MapProvider): string | undefined => {
  if (!provider) return undefined;
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_LAYER_KEY);
    return typeof stored === "string" && stored.trim().length > 0
      ? stored
      : undefined;
  } catch (error) {
    console.warn("Failed to read map layer ID from localStorage", error);
    return undefined;
  }
};

const hasAnyApiKeyAvailable = (): boolean => {
  const envKey = import.meta.env.VITE_MAP_API_KEY as string | undefined;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return true;
  }
  if (typeof window !== "undefined") {
    const w: any = window;
    const runtimeKey = w.APP_CONFIG?.MAP_API_KEY;
    return typeof runtimeKey === "string" && runtimeKey.trim().length > 0;
  }
  return false;
};

const resolvePreferredProvider = (): MapProvider => {
  const storedProvider = resolveStoredProvider();
  if (storedProvider) {
    return storedProvider;
  }

  const w: any = typeof window !== "undefined" ? (window as any) : {};
  const runtimeProvider = normalizeProvider(w.APP_CONFIG?.MAP_PROVIDER);
  if (runtimeProvider) {
    if (runtimeProvider === "mapbox" && !hasAnyApiKeyAvailable()) {
      console.warn(
        "[EnhancedWorldMap] MAP_PROVIDER=mapbox but no API key detected, falling back to carto",
      );
    } else {
      return runtimeProvider;
    }
  }

  const envProvider = normalizeProvider(
    import.meta.env.VITE_MAP_PROVIDER as string | undefined,
  );
  if (envProvider) {
    if (envProvider === "mapbox" && !hasAnyApiKeyAvailable()) {
      console.warn(
        "[EnhancedWorldMap] VITE_MAP_PROVIDER=mapbox without API key, falling back to carto",
      );
    } else {
      return envProvider;
    }
  }

  return hasAnyApiKeyAvailable() ? "mapbox" : "carto";
};

const getDefaultLayerForProvider = (provider: MapProvider): string => {
  switch (provider) {
    case "mapbox":
      return "mapbox-streets";
    case "openstreetmap":
      return "osm-standard";
    case "carto":
    default:
      return "carto-light";
  }
};

// 获取所有图层配置
const getAllLayers = (
  apiKey: string = "",
): Record<MapProvider, LayerConfig[]> => {
  return {
    carto: [
      {
        id: "carto-light",
        name: "Light 亮色",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
      {
        id: "carto-dark",
        name: "Dark 暗色",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
      {
        id: "carto-voyager",
        name: "Voyager 航海",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
    ],
    openstreetmap: [
      {
        id: "osm-standard",
        name: "Standard 标准",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ["a", "b", "c"],
      },
      {
        id: "osm-hot",
        name: "HOT 人道主义",
        url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, HOT',
        subdomains: ["a", "b"],
      },
      {
        id: "osm-cycle",
        name: "CycleMap 自行车",
        url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, CyclOSM',
        subdomains: ["a", "b", "c"],
      },
    ],
    mapbox: [
      {
        id: "mapbox-streets",
        name: "Streets 街道",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-satellite",
        name: "Satellite 卫星",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-dark",
        name: "Dark 暗色",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-light",
        name: "Light 亮色",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
    ],
  };
};

// 说明：标记均使用 DivIcon，自定义样式，不再依赖 Leaflet 默认图标

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  showHeatmap?: boolean;
  selectedNode?: NodeData | null;
  className?: string;
  layout?: "card" | "fullscreen";
  showVisitorLocation?: boolean; // 是否显示访客位置
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
type AggregatedClusterProps = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  online?: number;
  offline?: number;
  maintenance?: number;
};
const isSuperCluster = (props: any): props is AggregatedClusterProps => {
  return (
    !!props && props.cluster === true && typeof props.cluster_id === "number"
  );
};

// 状态对应的颜色和图标
const getNodeStyle = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "online":
      return {
        color: "#22c55e",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        icon: Activity,
        pulse: true,
      };
    case "offline":
      return {
        color: "#ef4444",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        icon: AlertTriangle,
        pulse: false,
      };
    case "maintenance":
      return {
        color: "#f59e0b",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        icon: Clock,
        pulse: false,
      };
    default:
      return {
        color: "#6b7280",
        bgColor: "bg-gray-50",
        textColor: "text-gray-700",
        icon: Server,
        pulse: false,
      };
  }
};

// 创建增强的自定义图标
const createEnhancedIcon = (status: string, isSelected: boolean = false) => {
  const normalizedStatus = (status || "unknown").toLowerCase();
  const cacheKey = `${normalizedStatus}-${isSelected ? "selected" : "default"}`;
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const style = getNodeStyle(normalizedStatus);
  const size = isSelected ? 24 : 18;
  const pulseClass = style.pulse ? "animate-pulse" : "";
  const selectedClass = isSelected ? "transform scale-125" : "";

  const icon = new DivIcon({
    html: `
      <div class="flex items-center justify-center ${selectedClass} ${pulseClass}"
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center"
             style="background-color: ${style.color};">
          <div class="rounded-full" style="width: 6px; height: 6px; background-color: #ffffff;"></div>
        </div>
      </div>
    `,
    className: "custom-enhanced-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

// 创建访客位置图标
const createVisitorIcon = (isMatchingNode: boolean = false) => {
  const cacheKey = `visitor-${isMatchingNode ? "matching" : "default"}`;
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const size = 28;
  const color = isMatchingNode ? "#8b5cf6" : "#ec4899"; // 紫色（匹配）或粉色（默认）

  const icon = new DivIcon({
    html: `
      <div class="flex items-center justify-center animate-pulse"
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-3 border-white shadow-2xl flex items-center justify-center"
             style="background: linear-gradient(135deg, ${color}, ${color}DD);">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-visitor-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

// 创建聚合节点图标（基于 supercluster 返回的统计）
const createClusterIcon = (
  count: number,
  offline: number = 0,
  online: number = 0,
) => {
  // 调整聚合点大小，使其更接近常规点大小
  // 基础大小22px，根据节点数量略微增大，最大不超过32px
  const size = Math.min(22 + Math.log2(count + 1) * 2, 32);

  // 根据在线/离线状态确定颜色 - 简化的3色方案
  let primaryColor: string;
  if (offline === 0) {
    // 全部在线：绿色
    primaryColor = "#22c55e";
  } else if (online === 0) {
    // 全部离线：红色
    primaryColor = "#ef4444";
  } else {
    // 混合状态（有在线有离线）：蓝色
    primaryColor = "#2563eb";
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
    className: "custom-cluster-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// 缩放监听组件
const ZoomHandler = ({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) => {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });
  return null;
};

// 监听地图边界变化
const BoundsHandler = ({
  onBoundsChange,
}: {
  onBoundsChange: (b: any) => void;
}) => {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    try {
      onBoundsChange(map.getBounds());
    } catch (error) {
      console.warn("Failed to emit initial bounds", error);
    }
  }, [map, onBoundsChange]);
  return null;
};

// 将 Leaflet Map 实例写入外部 ref，便于在点击聚合时主动缩放
const MapRefSetter = ({
  setRef,
  onReady,
}: {
  setRef: (map: any) => void;
  onReady?: (map: any) => void;
}) => {
  const map = useMap();
  useEffect(() => {
    setRef(map);
    if (onReady) {
      requestAnimationFrame(() => onReady(map));
    }
  }, [map, setRef, onReady]);
  return null;
};

// 处理相同坐标的节点重叠问题：坐标微调(jittering)
const jitterCoordinates = (nodes: NodeData[]): ExtendedNodeData[] => {
  const coordinateGroups = new Map<string, NodeData[]>();

  // 按坐标分组
  nodes.forEach((node) => {
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
        const distance =
          jitterRadius * (0.5 + 0.5 * (index / groupNodes.length)); // 渐变距离

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
  layout?: "card" | "fullscreen";
  showVisitorLocation?: boolean; // 是否显示访客位置
}

export const EnhancedWorldMap = memo(
  ({
    nodes = [],
    onNodeClick,
    selectedNode,
    className = "",
    layout = "card",
    showVisitorLocation = false, // 默认不显示访客位置
  }: EnhancedWorldMapProps) => {
    // 获取访客位置信息（仅在需要时）
    const { location: visitorLocation, matchedNode, loading: visitorLoading } = useVisitorLocation(
      showVisitorLocation ? nodes : []
    );

    // 访客位置可见性管理（仅在需要时）
    const { isVisible: isVisitorLocationVisible } = useVisitorLocationVisibility();

    const storedProvider = useMemo(() => resolveStoredProvider(), []);
    const initialProvider = useMemo(
      () => storedProvider ?? resolvePreferredProvider(),
      [storedProvider],
    );
    const manualPreferenceRef = useRef<boolean>(Boolean(storedProvider));

    const mapRef = useRef<any>(null);
    const tileErrorCountRef = useRef(0);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const invalidateMapSize = useCallback(() => {
      if (
        mapRef.current &&
        typeof mapRef.current.invalidateSize === "function"
      ) {
        mapRef.current.invalidateSize();
      }
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const timeoutId = window.setTimeout(() => invalidateMapSize(), 180);
      return () => window.clearTimeout(timeoutId);
    }, [invalidateMapSize]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const handleResize = () => {
        requestAnimationFrame(invalidateMapSize);
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }, [invalidateMapSize]);

    useEffect(() => {
      if (!mapContainerRef.current || typeof ResizeObserver === "undefined")
        return;
      const observer = new ResizeObserver(() => {
        requestAnimationFrame(invalidateMapSize);
      });

      observer.observe(mapContainerRef.current);
      return () => observer.disconnect();
    }, [invalidateMapSize]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const timeoutId = window.setTimeout(() => invalidateMapSize(), 120);
      return () => window.clearTimeout(timeoutId);
    }, [nodes.length, invalidateMapSize]);

    const [currentZoom, setCurrentZoom] = useState(3);
    const [debouncedZoom, setDebouncedZoom] = useState(3);
    const [bounds, setBounds] = useState<any | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<any | null>(null);
    const [showClusterModal, setShowClusterModal] = useState(false);
    const [clusterNodes, setClusterNodes] = useState<NodeData[]>([]);

    // 图层切换状态 - 从 localStorage 读取用户偏好
    const [currentProvider, setCurrentProvider] =
      useState<MapProvider>(initialProvider);

    const [currentLayerId, setCurrentLayerId] = useState<string>(() => {
      const storedLayerId = resolveStoredLayerId(storedProvider);
      if (storedLayerId) {
        return storedLayerId;
      }
      return getDefaultLayerForProvider(initialProvider);
    });
    const [showLayerMenu, setShowLayerMenu] = useState(false);

    // 获取API key（用于Mapbox）- 使用 useState 确保响应式更新
    const [apiKey, setApiKey] = useState<string>(() => {
      const w: any = typeof window !== "undefined" ? (window as any) : {};
      return (
        w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || ""
      );
    });

    // 监听 APP_CONFIG 的变化，动态更新 apiKey
    useEffect(() => {
      const checkApiKey = () => {
        const w: any = typeof window !== "undefined" ? (window as any) : {};
        const newApiKey =
          w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || "";
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

    // 获取所有图层
    const allLayers = useMemo(() => getAllLayers(apiKey), [apiKey]);

    // 获取当前提供商的所有图层（带安全检查）
    const currentProviderLayers = useMemo(() => {
      return allLayers[currentProvider] || allLayers.carto || [];
    }, [allLayers, currentProvider]);

    // 获取当前选中的图层配置（带安全检查）
    const currentLayerConfig = useMemo(() => {
      if (!currentProviderLayers || currentProviderLayers.length === 0) {
        // 如果没有可用图层，返回一个默认配置
        return {
          id: "carto-light",
          name: "Light 亮色",
          url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          attribution:
            '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
          subdomains: ["a", "b", "c", "d"],
        };
      }
      const layer = currentProviderLayers.find((l) => l.id === currentLayerId);
      return layer || currentProviderLayers[0]; // 否则降级到第一个
    }, [currentProviderLayers, currentLayerId]);

    const fallbackToDefaultLayer = useCallback(
      (reason?: string) => {
        const fallbackProvider: MapProvider = "carto";
        const fallbackLayerId = getDefaultLayerForProvider(fallbackProvider);

        if (
          currentProvider === fallbackProvider &&
          currentLayerId === fallbackLayerId
        ) {
          return false;
        }

        if (reason) {
          console.warn(
            `[EnhancedWorldMap] Fallback to default layer due to: ${reason}`,
          );
        }

        setCurrentProvider(fallbackProvider);
        setCurrentLayerId(fallbackLayerId);
        manualPreferenceRef.current = false;

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, fallbackProvider);
            localStorage.setItem(LOCAL_STORAGE_LAYER_KEY, fallbackLayerId);
            localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, "auto");
          } catch (error) {
            console.warn("Failed to persist fallback map provider", error);
          }
        }
        return true;
      },
      [currentLayerId, currentProvider],
    );

    useEffect(() => {
      const hasValidUrl =
        currentLayerConfig &&
        typeof currentLayerConfig.url === "string" &&
        currentLayerConfig.url.trim().length > 0;

      if (hasValidUrl) {
        return;
      }

      fallbackToDefaultLayer("missing or invalid tile URL");
    }, [currentLayerConfig, fallbackToDefaultLayer]);

    // 切换地图提供商和图层，并保存到 localStorage
    const switchMapLayer = (
      provider: MapProvider,
      layerId: string,
      options: { persist?: boolean; manual?: boolean } = {},
    ) => {
      const { persist = true, manual = true } = options;
      setCurrentProvider(provider);
      setCurrentLayerId(layerId);
      manualPreferenceRef.current = manual;
      if (persist && typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, provider);
          localStorage.setItem(LOCAL_STORAGE_LAYER_KEY, layerId);
          localStorage.setItem(
            LOCAL_STORAGE_SELECTION_KEY,
            manual ? "manual" : "auto",
          );
        } catch (error) {
          console.warn("Failed to save map preferences to localStorage", error);
        }
      }
    };

    useEffect(() => {
      if (
        !manualPreferenceRef.current &&
        apiKey &&
        currentProvider !== "mapbox"
      ) {
        switchMapLayer("mapbox", getDefaultLayerForProvider("mapbox"), {
          manual: false,
        });
      }
    }, [apiKey, currentProvider]);

    useEffect(() => {
      tileErrorCountRef.current = 0;
    }, [currentProvider, currentLayerId]);

    const handleTileError = useCallback(() => {
      if (!currentLayerConfig?.requiresApiKey && currentProvider === "carto") {
        return;
      }

      tileErrorCountRef.current += 1;

      if (tileErrorCountRef.current >= 2) {
        fallbackToDefaultLayer(
          `tile load failure (${currentProvider}/${currentLayerId})`,
        );
      }
    }, [
      currentLayerConfig?.requiresApiKey,
      currentLayerId,
      currentProvider,
      fallbackToDefaultLayer,
    ]);

    const tileLayerEventHandlers = useMemo(
      () => ({
        tileerror: handleTileError,
      }),
      [handleTileError],
    );

    // 点击外部关闭图层菜单
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (showLayerMenu && !target.closest(".layer-menu-container")) {
          setShowLayerMenu(false);
        }
      };

      if (showLayerMenu) {
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
          document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [showLayerMenu]);

    // 处理坐标重叠的节点
    const processedNodes = useMemo(() => jitterCoordinates(nodes), [nodes]);

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
          online: props.status?.toLowerCase() === "online" ? 1 : 0,
          offline: props.status?.toLowerCase() === "offline" ? 1 : 0,
          maintenance: props.status?.toLowerCase() === "maintenance" ? 1 : 0,
        }),
        // 聚合统计
        reduce: (acc: ClusterExtra, props: ClusterExtra) => {
          acc.online = (acc.online || 0) + (props.online || 0);
          acc.offline = (acc.offline || 0) + (props.offline || 0);
          acc.maintenance = (acc.maintenance || 0) + (props.maintenance || 0);
        },
      });
      const features = processedNodes.map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.longitude, n.latitude] },
        properties: { id: n.id, status: n.status, node: n } as ClusterExtra,
      }));
      idx.load(features);
      return idx;
    }, [processedNodes]);

    // 计算当前视口聚合结果
    const clusteredItems = useMemo(() => {
      if (!debouncedBounds) return [] as any[];
      const north = debouncedBounds.getNorth
        ? debouncedBounds.getNorth()
        : debouncedBounds._northEast?.lat;
      const south = debouncedBounds.getSouth
        ? debouncedBounds.getSouth()
        : debouncedBounds._southWest?.lat;
      const east = debouncedBounds.getEast
        ? debouncedBounds.getEast()
        : debouncedBounds._northEast?.lng;
      const west = debouncedBounds.getWest
        ? debouncedBounds.getWest()
        : debouncedBounds._southWest?.lng;
      if ([north, south, east, west].some((v) => typeof v !== "number"))
        return [] as any[];
      const bbox: [number, number, number, number] = [west, south, east, north];
      const z = Math.max(0, Math.floor(debouncedZoom));
      return (clusterIndex as any).getClusters(bbox, z) as any[];
    }, [clusterIndex, debouncedBounds, debouncedZoom]);

    // 生成标记组件（包括节点和访客位置）
    const markers = useMemo(() => {
      const els: React.ReactElement[] = [];

      // 添加访客位置标记（仅在启用且可见时）
      if (showVisitorLocation && visitorLocation && !visitorLoading && isVisitorLocationVisible) {
        const isMatching = !!matchedNode;
        els.push(
          <Marker
            key="visitor-location"
            position={[visitorLocation.latitude, visitorLocation.longitude]}
            icon={createVisitorIcon(isMatching)}
          >
            <Popup className="custom-popup" maxWidth={300}>
              <div className="p-3">
                <h3 className="font-bold text-base text-pink-700 dark:text-pink-300 mb-2 flex items-center">
                  <VisitorMapPin className="h-4 w-4 mr-2" />
                  您的位置
                </h3>
                <div className="text-sm text-gray-700 dark:text-gray-200 mb-2 space-y-1">
                  <div>
                    位置: {visitorLocation.city}, {visitorLocation.country}
                  </div>
                  {visitorLocation.ipv4 && (
                    <div className="font-mono text-xs text-blue-600 dark:text-blue-300">
                      IPv4: {visitorLocation.ipv4}
                    </div>
                  )}
                  {visitorLocation.ipv6 && (
                    <div className="font-mono text-xs text-indigo-600 dark:text-indigo-300 break-all">
                      IPv6: {visitorLocation.ipv6}
                    </div>
                  )}
                  {visitorLocation.isp && (
                    <div className="text-xs text-gray-700 dark:text-gray-200">
                      ISP: {visitorLocation.isp}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    坐标: {visitorLocation.latitude.toFixed(4)}, {visitorLocation.longitude.toFixed(4)}
                  </div>
                </div>
                {isMatching && matchedNode && (
                  <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/40 rounded border border-purple-200 dark:border-purple-600">
                    <div className="text-sm font-semibold text-purple-700 dark:text-purple-200 mb-1">
                      🎯 正在使用此节点
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-300">
                      节点名称: {matchedNode.name}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-300">
                      {matchedNode.city}, {matchedNode.country}
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      }

      // 添加节点标记
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
                    const targetZoom = Math.min(
                      (clusterIndex as any).getClusterExpansionZoom(
                        props.cluster_id,
                      ),
                      22,
                    );
                    const currentMapZoom = mapRef.current?.getZoom() || 0;

                    // 如果已经在高缩放级别且无法进一步缩放，显示节点列表
                    if (
                      currentMapZoom >= 18 &&
                      targetZoom <= currentMapZoom + 1
                    ) {
                      // 获取聚合中的节点
                      const leaves = (clusterIndex as any).getLeaves(
                        props.cluster_id,
                        Infinity,
                      );
                      const nodes = leaves
                        .map((leaf: any) => leaf.properties?.node)
                        .filter(Boolean);
                      setClusterNodes(nodes);
                      setShowClusterModal(true);
                    } else {
                      // 正常缩放
                      mapRef.current?.setView([lat, lng], targetZoom, {
                        animate: true,
                      });
                    }
                  } catch (error) {
                    console.error("Failed to handle cluster click", error);
                  }
                },
              }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-3">
                  <h3 className="font-bold text-base text-gray-900 mb-2">
                    集群节点 ({count})
                  </h3>
                  <div className="text-sm text-gray-600 mb-2">
                    在线: {props.online || 0} | 离线: {props.offline || 0}
                    {(() => {
                      const total = (props.online || 0) + (props.offline || 0);
                      const rate =
                        total > 0
                          ? Math.round(((props.online || 0) / total) * 100)
                          : 0;
                      return (
                        <div className="text-xs mt-1">
                          状态:{" "}
                          <span
                            className={`font-semibold ${
                              (props.offline || 0) === 0
                                ? "text-green-600"
                                : (props.online || 0) === 0
                                  ? "text-red-600"
                                  : "text-primary"
                            }`}
                          >
                            {(props.offline || 0) === 0
                              ? "全部在线"
                              : (props.online || 0) === 0
                                ? "全部离线"
                                : "混合状态"}
                          </span>{" "}
                          ({rate}%)
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const currentMapZoom = mapRef.current?.getZoom() || 0;
                      const targetZoom = Math.min(
                        (clusterIndex as any).getClusterExpansionZoom(
                          props.cluster_id,
                        ),
                        22,
                      );
                      return currentMapZoom >= 18 &&
                        targetZoom <= currentMapZoom + 1
                        ? "点击查看节点列表"
                        : "点击放大以查看详情";
                    })()}
                  </p>
                </div>
              </Popup>
            </Marker>,
          );
        } else {
          const node: ExtendedNodeData | undefined = props.node as
            | ExtendedNodeData
            | undefined;
          if (!node) return;
          const isSelected = selectedNode?.id === node.id;
          const hasOriginalCoords =
            node._originalLat !== undefined && node._originalLng !== undefined;

          els.push(
            <Marker
              key={`node-${node.id}-${node.status}-${isSelected}`}
              position={[node.latitude, node.longitude]}
              icon={createEnhancedIcon(node.status, isSelected)}
              eventHandlers={{ click: () => onNodeClick?.(node) }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-3">
                  <h3 className="font-bold text-base text-gray-900 mb-2">
                    {node.name}
                  </h3>
                  <div className="text-sm text-gray-600 mb-2 space-y-1">
                    <div>
                      状态:{" "}
                      <span
                        className={`font-semibold ${
                          node.status === "online"
                            ? "text-green-600"
                            : node.status === "offline"
                              ? "text-red-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {node.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      位置: {node.city}, {node.country}
                    </div>
                    <div>提供商: {node.provider}</div>
                    {hasOriginalCoords && (
                      <div className="text-xs text-orange-600 mt-2 p-2 bg-orange-50 rounded">
                        <div className="font-medium">⚠️ 坐标已微调</div>
                        <div>
                          原始坐标: {node._originalLat?.toFixed(6)},{" "}
                          {node._originalLng?.toFixed(6)}
                        </div>
                        <div className="text-gray-500">
                          多节点位于相同位置，已自动分散显示
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>,
          );
        }
      });
      return els;
    }, [clusteredItems, clusterIndex, onNodeClick, selectedNode, showVisitorLocation, visitorLocation, visitorLoading, matchedNode, isVisitorLocationVisible]);

    const isFullscreen = layout === "fullscreen";
    const mapWrapperClasses = isFullscreen
      ? "fullscreen-map flex-1 min-h-full w-full"
      : "flex-1 min-h-[300px] md:min-h-[480px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800";
    const mapContainerClassName = isFullscreen
      ? "z-0 rounded-none border-none shadow-none"
      : "z-0";

    return (
      <div
        ref={mapContainerRef}
        className={`relative flex flex-col ${className}`}
      >
        {/* Layer switcher - top right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-40">
          <div className="layer-menu-container relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-white/95 text-gray-800 hover:bg-white shadow-lg border border-gray-200/60 lg:bg-white/90 lg:backdrop-blur-[10px] dark:bg-gray-800/95 dark:hover:bg-gray-700/95 dark:text-white dark:border-gray-600"
              aria-expanded={showLayerMenu}
              aria-haspopup="menu"
            >
              <Layers className="h-3 w-3 md:h-4 md:w-4 text-gray-700 dark:text-white" />
              <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-white">
                图层
              </span>
            </Button>

            {/* 图层选择菜单 */}
            {showLayerMenu && (
              <div className="absolute top-14 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[280px] z-50 animate-in fade-in slide-in-from-top-2 duration-200 layer-menu-container">
                <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-2">
                    选择地图图层
                  </p>
                </div>
                <div className="p-2 space-y-3 max-h-[500px] overflow-y-auto">
                  {/* Carto 提供商组 */}
                  <div className="rounded-lg border border-purple-200 dark:border-purple-700/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800/50">
                      <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        CARTO
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {allLayers.carto.map((layer) => (
                        <button
                          key={layer.id}
                          role="menuitemradio"
                          aria-checked={
                            currentProvider === "carto" &&
                            currentLayerId === layer.id
                          }
                          onClick={() => {
                            switchMapLayer("carto", layer.id);
                            setShowLayerMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                            currentProvider === "carto" &&
                            currentLayerId === layer.id
                              ? "bg-purple-600/10 dark:bg-purple-900/30 border-l-2 border-purple-600 text-purple-800 dark:text-purple-200"
                              : "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                          }`}
                        >
                          <span className="flex-1 text-left">{layer.name}</span>
                          {currentProvider === "carto" &&
                            currentLayerId === layer.id && (
                              <div className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-300 rounded-full"></div>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* OpenStreetMap 提供商组 */}
                  <div className="rounded-lg border border-green-200 dark:border-green-700/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800/50">
                      <MapIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-bold text-green-700 dark:text-green-300">
                        OPENSTREETMAP
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {allLayers.openstreetmap.map((layer) => (
                        <button
                          key={layer.id}
                          role="menuitemradio"
                          aria-checked={
                            currentProvider === "openstreetmap" &&
                            currentLayerId === layer.id
                          }
                          onClick={() => {
                            switchMapLayer("openstreetmap", layer.id);
                            setShowLayerMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                            currentProvider === "openstreetmap" &&
                            currentLayerId === layer.id
                              ? "bg-green-600/10 dark:bg-green-900/30 border-l-2 border-green-600 text-green-800 dark:text-green-200"
                              : "bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                          }`}
                        >
                          <span className="flex-1 text-left">{layer.name}</span>
                          {currentProvider === "openstreetmap" &&
                            currentLayerId === layer.id && (
                              <div className="w-1.5 h-1.5 bg-green-600 dark:bg-green-300 rounded-full"></div>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mapbox 提供商组 */}
                  <div className="rounded-lg border border-blue-200 dark:border-blue-700/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/50">
                      <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                        MAPBOX
                      </span>
                      {!apiKey && (
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          (需要API密钥)
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {allLayers.mapbox.map((layer) => (
                        <button
                          key={layer.id}
                          role="menuitemradio"
                          aria-checked={
                            currentProvider === "mapbox" &&
                            currentLayerId === layer.id
                          }
                          onClick={() => {
                            if (!apiKey) {
                              alert(
                                "Mapbox需要API密钥。如需使用Mapbox，请联系管理员配置环境变量 VITE_MAP_API_KEY",
                              );
                              return;
                            }
                            switchMapLayer("mapbox", layer.id);
                            setShowLayerMenu(false);
                          }}
                          disabled={!apiKey}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                            !apiKey
                              ? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-600"
                              : currentProvider === "mapbox" &&
                                  currentLayerId === layer.id
                                ? "bg-blue-600/10 dark:bg-blue-900/30 border-l-2 border-blue-600 text-blue-800 dark:text-blue-200"
                                : "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                          }`}
                        >
                          <span className="flex-1 text-left">{layer.name}</span>
                          {apiKey &&
                            currentProvider === "mapbox" &&
                            currentLayerId === layer.id && (
                              <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-300 rounded-full"></div>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 地图容器：占满可用空间，移动端使用较小的最小高度 */}
        <div className={mapWrapperClasses}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
            className={mapContainerClassName}
            preferCanvas={true}
            worldCopyJump={true}
            maxBounds={[
              [-90, -180],
              [90, 180],
            ]}
            maxBoundsViscosity={0.5}
          >
            {/* 设置 mapRef，供点击聚合时 setView 使用 */}
            <MapRefSetter
              setRef={(m) => {
                (mapRef as any).current = m;
              }}
              onReady={() => invalidateMapSize()}
            />
            <BoundsHandler onBoundsChange={setBounds} />

            {/* 动态图层 */}
            <TileLayer
              key={`${currentLayerId}-${apiKey ? "with-key" : "no-key"}`} // 关键：当图层ID或apiKey状态改变时重新渲染
              attribution={currentLayerConfig.attribution}
              url={currentLayerConfig.url}
              subdomains={currentLayerConfig.subdomains}
              eventHandlers={tileLayerEventHandlers}
              className="grayscale-[20%] contrast-[110%]"
              updateWhenIdle={true}
              updateWhenZooming={false}
              keepBuffer={2}
            />

            {/* 缩放监听组件 */}
            <ZoomHandler onZoomChange={setCurrentZoom} />

            {/* 渲染节点标记 */}
            {markers}
          </MapContainer>
        </div>

        {/* 底部信息栏（固定高度不参与伸缩） */}
        {!isFullscreen && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500 shrink-0">
            <div className="flex items-center space-x-4">
              <span>共 {nodes.length} 个节点</span>
              {selectedNode && (
                <span className="text-primary">已选择: {selectedNode.name}</span>
              )}
            </div>
          </div>
        )}

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
                    aria-label="关闭聚合节点详情"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
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
                        <div
                          className={`w-3 h-3 rounded-full ${
                            node.status === "online"
                              ? "bg-green-500"
                              : node.status === "offline"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        ></div>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div>
                          状态:{" "}
                          <span
                            className={`font-medium ${
                              node.status === "online"
                                ? "text-green-600"
                                : node.status === "offline"
                                  ? "text-red-600"
                                  : "text-yellow-600"
                            }`}
                          >
                            {node.status.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          位置: {node.city}, {node.country}
                        </div>
                        <div>提供商: {node.provider}</div>
                        {node.ipv4 && (
                          <div className="font-mono text-primary">
                            {node.ipv4}
                          </div>
                        )}
                        {node.ipv6 && node.ipv6.includes(":") && (
                          <div className="font-mono text-indigo-500 dark:text-indigo-300 break-all">
                            {node.ipv6}
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
                      在线:{" "}
                      {clusterNodes.filter((n) => n.status === "online").length}
                    </span>
                    <span className="text-red-600">
                      离线:{" "}
                      {
                        clusterNodes.filter((n) => n.status === "offline")
                          .length
                      }
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
  },
);
