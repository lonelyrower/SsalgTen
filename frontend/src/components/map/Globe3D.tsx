/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from "react";
import { logger } from "@/utils/logger";
import * as Cesium from "cesium";
import type { NodeData } from "@/services/api";
import { useVisitorLocation } from "@/hooks/useVisitorLocation";
import { useVisitorLocationVisibility } from "@/hooks/useVisitorLocationVisibility";
import { Globe } from "lucide-react";

// 导入提取的工具和组件
import {
  type CesiumLayerType,
  initCesiumIon,
  configureGlobeVisuals,
  getImageryProvider,
  createClusterIconCanvas,
  setInitialCameraView,
  getCesiumIonToken,
} from "./cesium/CesiumConfig";
import { Globe3DControls } from "./cesium/Globe3DControls";
import { Globe3DLayerMenu } from "./cesium/Globe3DLayerMenu";

interface Globe3DProps {
  nodes: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  onReady?: () => void;
  showVisitorLocation?: boolean;
}

export function Globe3D({
  nodes,
  onNodeClick,
  onReady,
  showVisitorLocation = false,
}: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializingRef = useRef(false);

  // 获取访客位置信息
  const {
    location: visitorLocation,
    matchedNode,
    loading: visitorLoading,
  } = useVisitorLocation(showVisitorLocation ? nodes : []);

  const { isVisible: isVisitorLocationVisible } =
    useVisitorLocationVisibility();

  // 图层状态
  const [currentLayer, setCurrentLayer] =
    useState<CesiumLayerType>("satellite");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // 自转控制状态
  const [isRotating, setIsRotating] = useState(true);
  const rotationEnabledRef = useRef(true);

  // 使用 useMemo 缓存节点ID列表
  const nodeIds = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);

  // 初始化 Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current && !viewerRef.current.isDestroyed()) return;
    if (initializingRef.current) return;

    initializingRef.current = true;

    const initCesium = async () => {
      const cesiumIonToken = getCesiumIonToken();
      const hasIonToken = initCesiumIon();

      try {
        const imageryProviderPromise =
          Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          );

        const viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            imageryProviderPromise,
          ),
          terrain: hasIonToken ? Cesium.Terrain.fromWorldTerrain() : undefined,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          vrButton: false,
          selectionIndicator: false,
          infoBox: false,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        viewerRef.current = viewer;
        logger.log("✓ Cesium Viewer 初始化成功");

        // 配置视觉效果
        configureGlobeVisuals(viewer.scene);

        // 设置相机初始位置
        setInitialCameraView(viewer.camera);

        // 添加点击事件监听器
        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.position);
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const nodeData = (entity as any)._nodeData;

            if (nodeData && onNodeClick) {
              onNodeClick(nodeData);
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 添加鼠标移动事件监听器
        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.endPosition);
          const canvas = viewer.canvas as HTMLCanvasElement;

          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const nodeData = (entity as any)._nodeData;

            if (nodeData || entity.billboard) {
              canvas.style.cursor = "pointer";
            } else {
              canvas.style.cursor = "grab";
            }
          } else {
            canvas.style.cursor = "grab";
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 自动旋转地球
        let lastTime = Date.now();
        const tickListener = () => {
          const now = Date.now();
          const deltaTime = (now - lastTime) / 1000;
          lastTime = now;

          if (viewer && !viewer.isDestroyed() && rotationEnabledRef.current) {
            viewer.scene.camera.rotate(
              Cesium.Cartesian3.UNIT_Z,
              0.02 * deltaTime,
            );
          }
        };

        viewer.clock.onTick.addEventListener(tickListener);

        // 启用节点聚合功能
        const entityCollection = viewer.entities as any;
        if (entityCollection.clustering) {
          entityCollection.clustering.enabled = true;
          entityCollection.clustering.pixelRange = 80;
          entityCollection.clustering.minimumClusterSize = 2;

          entityCollection.clustering.clusterEvent.addEventListener(
            (entities: any[], cluster: any) => {
              cluster.billboard.show = true;
              cluster.billboard.id = cluster.label.id;
              cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;

              const count = entities.length;
              const size = Math.min(80, 40 + count * 2);

              let onlineCount = 0;
              let offlineCount = 0;
              entities.forEach((entity: any) => {
                const nodeData = entity._nodeData;
                if (nodeData) {
                  if (nodeData.status === "online") onlineCount++;
                  else if (nodeData.status === "offline") offlineCount++;
                }
              });

              let clusterColor;
              if (onlineCount > offlineCount) {
                clusterColor =
                  Cesium.Color.fromCssColorString("#10b981").withAlpha(0.8);
              } else if (offlineCount > onlineCount) {
                clusterColor =
                  Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.8);
              } else {
                clusterColor =
                  Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.8);
              }

              cluster.billboard.image = createClusterIconCanvas(
                size,
                count,
                clusterColor,
              );
              cluster.billboard.width = size;
              cluster.billboard.height = size;
              cluster.label.show = false;
            },
          );
        }

        setIsLoading(false);
        initializingRef.current = false;
      } catch (error) {
        logger.error("Cesium initialization error:", error);
        setIsLoading(false);
        initializingRef.current = false;
      }
    };

    initCesium();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      initializingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      onReady?.();
    }
  }, [isLoading, onReady]);

  // 更新节点标记
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.removeAll();

    // 添加访客位置标记
    if (
      showVisitorLocation &&
      visitorLocation &&
      !visitorLoading &&
      isVisitorLocationVisible
    ) {
      const isMatching = !!matchedNode;
      const visitorColor = isMatching
        ? Cesium.Color.fromCssColorString("#8b5cf6")
        : Cesium.Color.fromCssColorString("#ec4899");

      const visitorEntity = viewer.entities.add({
        id: "visitor-location",
        name: "您的位置",
        position: Cesium.Cartesian3.fromDegrees(
          visitorLocation.longitude,
          visitorLocation.latitude,
          100000,
        ),
        point: {
          color: visitorColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.NONE,
          pixelSize: new Cesium.CallbackProperty(() => {
            return 20 + Math.sin(Date.now() / 200) * 5;
          }, false) as any,
        },
        label: {
          text: "您的位置",
          font: "14px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -25),
          heightReference: Cesium.HeightReference.NONE,
        },
      });

      (visitorEntity as any)._visitorData = {
        ...visitorLocation,
        isMatching,
        matchedNode,
      };

      if (isMatching && matchedNode) {
        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              visitorLocation.longitude,
              visitorLocation.latitude,
              100000,
              matchedNode.longitude,
              matchedNode.latitude,
              100000,
            ]),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.8),
            }),
            arcType: Cesium.ArcType.GEODESIC,
          },
        });
      }
    }

    // 添加节点标记
    nodes.forEach((node) => {
      let color: Cesium.Color;

      switch (node.status) {
        case "online":
          color = Cesium.Color.fromCssColorString("#10b981");
          break;
        case "offline":
          color = Cesium.Color.fromCssColorString("#ef4444");
          break;
        case "maintenance":
          color = Cesium.Color.fromCssColorString("#f59e0b");
          break;
        default:
          color = Cesium.Color.fromCssColorString("#6b7280");
      }

      const entity = viewer.entities.add({
        id: node.id,
        name: node.name,
        position: Cesium.Cartesian3.fromDegrees(
          node.longitude,
          node.latitude,
          100000,
        ),
        point: {
          pixelSize: 12,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
          ...(node.status === "online" && {
            pixelSize: new Cesium.CallbackProperty(() => {
              return 12 + Math.sin(Date.now() / 300) * 3;
            }, false) as any,
          }),
        },
      });

      (entity as any)._nodeData = node;
    });

    // 添加节点之间的连线
    if (nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        const node1 = nodes[i];
        const node2 = nodes[i + 1];

        if (node1.status === "online" && node2.status === "online") {
          viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                node1.longitude,
                node1.latitude,
                100000,
                node2.longitude,
                node2.latitude,
                100000,
              ]),
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color:
                  Cesium.Color.fromCssColorString("#06b6d4").withAlpha(0.6),
              }),
              arcType: Cesium.ArcType.GEODESIC,
            },
          });
        }
      }
    }
  }, [
    nodeIds,
    nodes,
    showVisitorLocation,
    visitorLocation,
    visitorLoading,
    matchedNode,
    isVisitorLocationVisible,
  ]);

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

  // 图层切换功能
  const switchLayer = async (layerType: CesiumLayerType) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    setCurrentLayer(layerType);
    setShowLayerMenu(false);

    viewer.imageryLayers.removeAll();

    try {
      const imageryProvider = await getImageryProvider(layerType);
      if (viewer && !viewer.isDestroyed()) {
        viewer.imageryLayers.addImageryProvider(imageryProvider);
      }
    } catch (error) {
      logger.error("图层加载失败:", error);
      const fallbackProvider = new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
      });
      if (viewer && !viewer.isDestroyed()) {
        viewer.imageryLayers.addImageryProvider(fallbackProvider);
      }
    }
  };

  // 控制函数
  const zoomIn = () => {
    if (viewerRef.current) {
      viewerRef.current.camera.zoomIn(5000000);
    }
  };

  const zoomOut = () => {
    if (viewerRef.current) {
      viewerRef.current.camera.zoomOut(5000000);
    }
  };

  const resetView = () => {
    if (viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
        duration: 2,
      });
    }
  };

  const toggleRotation = () => {
    rotationEnabledRef.current = !rotationEnabledRef.current;
    setIsRotating(rotationEnabledRef.current);
  };

  return (
    <div className="relative w-full h-full">
      {/* 3D 地球容器 */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 加载指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center gap-4">
            <Globe className="w-12 h-12 animate-spin text-primary" />
            <p className="text-white text-lg">加载 3D 地球...</p>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <Globe3DControls
        isRotating={isRotating}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={resetView}
        onToggleRotation={toggleRotation}
      />

      {/* 图层切换菜单 */}
      <Globe3DLayerMenu
        currentLayer={currentLayer}
        showMenu={showLayerMenu}
        onToggleMenu={() => setShowLayerMenu(!showLayerMenu)}
        onLayerChange={switchLayer}
      />
    </div>
  );
}
