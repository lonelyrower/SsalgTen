/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useRef,
  memo,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { logger } from "@/utils/logger";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import Supercluster from "supercluster";
import type { NodeData } from "@/services/api";
import { useVisitorLocation } from "@/hooks/useVisitorLocation";
import { useVisitorLocationVisibility } from "@/hooks/useVisitorLocationVisibility";
import { MapPin as VisitorMapPin } from "lucide-react";

// Extracted utilities
import { jitterCoordinates, type ExtendedNodeData } from "./coordinateUtils";
import {
  createEnhancedIcon,
  createVisitorIcon,
  createClusterIcon,
} from "./MapIcons";
import { ClusterModal } from "./ClusterModal";
import { MapLayerMenu } from "./MapLayerMenu";
import { useMapProvider } from "./useMapProvider";

interface EnhancedWorldMapProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  showHeatmap?: boolean;
  selectedNode?: NodeData | null;
  className?: string;
  layout?: "card" | "fullscreen";
  showVisitorLocation?: boolean;
}

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
      logger.warn("Failed to emit initial bounds", error);
    }
  }, [map, onBoundsChange]);
  return null;
};

// 将 Leaflet Map 实例写入外部 ref
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

export const EnhancedWorldMap = memo(
  ({
    nodes = [],
    onNodeClick,
    selectedNode,
    className = "",
    layout = "card",
    showVisitorLocation = false,
  }: EnhancedWorldMapProps) => {
    // 获取访客位置信息（仅在需要时）
    const {
      location: visitorLocation,
      matchedNode,
      loading: visitorLoading,
    } = useVisitorLocation(showVisitorLocation ? nodes : []);

    // 访客位置可见性管理
    const { isVisible: isVisitorLocationVisible } =
      useVisitorLocationVisibility();

    // 使用自定义hook管理地图提供商
    const {
      currentProvider,
      currentLayerId,
      currentLayerConfig,
      apiKey,
      switchMapLayer,
      handleTileError,
    } = useMapProvider();

    const mapRef = useRef<any>(null);
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
    const [showLayerMenu, setShowLayerMenu] = useState(false);

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

    // 防抖缩放级别
    useEffect(() => {
      const t = setTimeout(() => setDebouncedZoom(currentZoom), 200);
      return () => clearTimeout(t);
    }, [currentZoom]);

    // 防抖边界变更
    useEffect(() => {
      const t = setTimeout(() => setDebouncedBounds(bounds), 200);
      return () => clearTimeout(t);
    }, [bounds]);

    // supercluster 索引
    const clusterIndex = useMemo(() => {
      const idx: any = new (Supercluster as any)({
        radius: 40,
        maxZoom: 22,
        minPoints: 2,
        map: (props: ClusterExtra) => ({
          online: props.status?.toLowerCase() === "online" ? 1 : 0,
          offline: props.status?.toLowerCase() === "offline" ? 1 : 0,
          maintenance: props.status?.toLowerCase() === "maintenance" ? 1 : 0,
        }),
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

      // 添加访客位置标记
      if (
        showVisitorLocation &&
        visitorLocation &&
        !visitorLoading &&
        isVisitorLocationVisible
      ) {
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
                    坐标: {visitorLocation.latitude.toFixed(4)},{" "}
                    {visitorLocation.longitude.toFixed(4)}
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
          </Marker>,
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

                    if (
                      currentMapZoom >= 18 &&
                      targetZoom <= currentMapZoom + 1
                    ) {
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
                      mapRef.current?.setView([lat, lng], targetZoom, {
                        animate: true,
                      });
                    }
                  } catch (error) {
                    logger.error("Failed to handle cluster click", error);
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
    }, [
      clusteredItems,
      clusterIndex,
      onNodeClick,
      selectedNode,
      showVisitorLocation,
      visitorLocation,
      visitorLoading,
      matchedNode,
      isVisitorLocationVisible,
    ]);

    const isFullscreen = layout === "fullscreen";
    const mapWrapperClasses = isFullscreen
      ? "fullscreen-map flex-1 min-h-full w-full"
      : "flex-1 min-h-[300px] md:min-h-[480px] w-full  overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800";
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
          <MapLayerMenu
            currentProvider={currentProvider}
            currentLayerId={currentLayerId}
            apiKey={apiKey}
            showMenu={showLayerMenu}
            onToggleMenu={() => setShowLayerMenu(!showLayerMenu)}
            onLayerChange={(provider, layerId) => {
              switchMapLayer(provider, layerId);
              setShowLayerMenu(false);
            }}
          />
        </div>

        {/* 地图容器 */}
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
            <MapRefSetter
              setRef={(m) => {
                (mapRef as any).current = m;
              }}
              onReady={() => invalidateMapSize()}
            />
            <BoundsHandler onBoundsChange={setBounds} />

            {/* 动态图层 */}
            <TileLayer
              key={`${currentLayerId}-${apiKey ? "with-key" : "no-key"}`}
              attribution={currentLayerConfig.attribution}
              url={currentLayerConfig.url}
              subdomains={currentLayerConfig.subdomains}
              eventHandlers={tileLayerEventHandlers}
              className="grayscale-[20%] contrast-[110%]"
              updateWhenIdle={true}
              updateWhenZooming={false}
              keepBuffer={2}
            />

            <ZoomHandler onZoomChange={setCurrentZoom} />
            {markers}
          </MapContainer>
        </div>

        {/* 底部信息栏 */}
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
        <ClusterModal
          isOpen={showClusterModal}
          nodes={clusterNodes}
          onClose={() => setShowClusterModal(false)}
          onNodeClick={onNodeClick}
        />
      </div>
    );
  },
);
