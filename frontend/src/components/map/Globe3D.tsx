/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from "react";
import * as Cesium from "cesium";
import type { NodeData } from "@/services/api";
import { useVisitorLocation } from "@/hooks/useVisitorLocation";
import { useVisitorLocationVisibility } from "@/hooks/useVisitorLocationVisibility";
import { Button } from "@/components/ui/button";
import {
  Globe,
  ZoomIn,
  ZoomOut,
  Home,
  Layers,
  MapPin,
  Satellite,
  Map,
  Pause,
  Play,
} from "lucide-react";

interface Globe3DProps {
  nodes: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  onReady?: () => void;
  showVisitorLocation?: boolean; // 是否显示访客位置
}

// 创建聚合节点图标
function createClusterIcon(
  size: number,
  count: number,
  color: Cesium.Color,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 绘制圆形背景
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = color.toCssColorString();
    ctx.fill();

    // 绘制白色边框
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 绘制数字
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.min(size / 2.5, 24)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count.toString(), size / 2, size / 2);
  }

  return canvas;
}

export function Globe3D({ nodes, onNodeClick, onReady, showVisitorLocation = false }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializingRef = useRef(false); // 防止重复初始化

  // 获取访客位置信息（仅在需要时）
  const { location: visitorLocation, matchedNode, loading: visitorLoading } = useVisitorLocation(
    showVisitorLocation ? nodes : []
  );

  // 访客位置可见性管理（仅在需要时）
  const { isVisible: isVisitorLocationVisible } = useVisitorLocationVisibility();

  // 图层状态 - 3D 地球专用图层
  const [currentLayer, setCurrentLayer] = useState<
    "satellite" | "terrain" | "bluemarble" | "natgeo"
  >("satellite");
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // 自转控制状态
  const [isRotating, setIsRotating] = useState(true);
  const rotationEnabledRef = useRef(true);

  // 使用 useMemo 缓存节点ID列表，只有当节点ID变化时才重新渲染
  const nodeIds = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);

  // useEffect 1: 初始化 Cesium Viewer（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current && !viewerRef.current.isDestroyed()) return;
    if (initializingRef.current) return; // 正在初始化，避免重复

    initializingRef.current = true;

    // 使用异步函数初始化 Cesium
    const initCesium = async () => {
      // 读取Cesium Ion配置
      const w: any = typeof window !== "undefined" ? (window as any) : {};

      const cesiumIonToken =
        w.APP_CONFIG?.CESIUM_ION_TOKEN ||
        import.meta.env.VITE_CESIUM_ION_TOKEN ||
        "";

      // 配置 Cesium Ion（如果有token则启用，否则使用免费tiles）
      if (cesiumIonToken) {
        Cesium.Ion.defaultAccessToken = cesiumIonToken;
        console.log("✓ Cesium Ion已启用（高质量3D渲染）");
      } else {
        // 禁用 Cesium Ion，使用免费地图源
        Cesium.Ion.defaultAccessToken = "";
        try {
          (Cesium.Ion as any).defaultServer = "";
          (Cesium.Ion as any).enabled = false;
        } catch {
          // 忽略错误
        }
        console.log(
          "ℹ Cesium Ion未配置，使用免费地图源（可在设置中添加API key以获得更好的3D效果）",
        );
      }

      try {
        // 3D 地球默认使用高清卫星图（忽略2D地图配置）
        // 这样确保初始化时就能看到正确的卫星图层
        const imageryProviderPromise =
          Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          );

        // 创建 Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            imageryProviderPromise,
          ),

          // 如果有Cesium Ion token，使用高质量地形数据
          terrain: cesiumIonToken
            ? Cesium.Terrain.fromWorldTerrain()
            : undefined,

          // UI 配置
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

          // 场景配置
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        viewerRef.current = viewer;

        console.log("✓ Cesium Viewer 初始化成功");

        // === 视觉增强配置（优化晨昏线效果）===
        const scene = viewer.scene;
        const globe = scene.globe;

        // 使用Cesium默认的光照设置，获得更自然的晨昏线效果
        globe.enableLighting = true;

        // 关键：使用默认的太阳光照，不要过度调整
        scene.globe.dynamicAtmosphereLighting = true;
        scene.globe.dynamicAtmosphereLightingFromSun = true;

        // 大气层效果 - 使用接近Cesium默认值
        if (scene.skyAtmosphere) {
          scene.skyAtmosphere.show = true;
          // 使用更接近默认的值，让大气层更自然
          scene.skyAtmosphere.brightnessShift = 0.0; // 从0.2改为0.0
          scene.skyAtmosphere.saturationShift = 0.0; // 从0.1改为0.0
        }

        globe.showGroundAtmosphere = true;
        // 地面大气层也使用更温和的值
        globe.atmosphereBrightnessShift = 0.0; // 从0.1改为0.0
        globe.atmosphereSaturationShift = 0.0; // 从0.1改为0.0

        // 移除自定义基础颜色，使用默认
        // globe.baseColor = Cesium.Color.BLACK; // 删除这行，让Cesium使用默认颜色

        globe.showWaterEffect = true;

        // 优化夜间过渡效果
        globe.nightFadeInDistance = 8000000.0; // 增大从5000000，让过渡更柔和
        globe.nightFadeOutDistance = 15000000.0; // 增大从10000000

        scene.globe.maximumScreenSpaceError = 1.5;
        scene.globe.tileCacheSize = 200;

        scene.screenSpaceCameraController.enableCollisionDetection = false;

        // 雾效 - 使用更自然的设置
        scene.fog.enabled = true;
        scene.fog.density = 0.0001; // 从0.0002减小，让雾更淡
        scene.fog.minimumBrightness = 0.05; // 从0.03增加到0.05，避免过暗

        // 使用默认的太阳光照（不需要手动设置）
        // Cesium会自动根据当前时间计算太阳位置

        // 设置相机初始位置
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // 添加点击事件监听器（只触发节点选择，不弹窗）
        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.position);
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const nodeData = (entity as any)._nodeData;

            if (nodeData && onNodeClick) {
              // 只触发节点选择回调，显示右侧详情面板
              onNodeClick(nodeData);
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 添加鼠标移动事件监听器 - 动态改变光标样式
        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.endPosition);
          const canvas = viewer.canvas as HTMLCanvasElement;

          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const nodeData = (entity as any)._nodeData;

            // 如果悬停在节点或聚合点上，显示指针
            if (nodeData || entity.billboard) {
              canvas.style.cursor = 'pointer';
            } else {
              canvas.style.cursor = 'grab';
            }
          } else {
            // 没有悬停在任何对象上，显示抓手
            canvas.style.cursor = 'grab';
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 慢速自动旋转地球（可控制）
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
          entityCollection.clustering.pixelRange = 80; // 聚合距离（像素）
          entityCollection.clustering.minimumClusterSize = 2; // 最小聚合数量

          // 自定义聚合样式
          entityCollection.clustering.clusterEvent.addEventListener(
            (entities: any[], cluster: any) => {
              cluster.billboard.show = true;
              cluster.billboard.id = cluster.label.id;
              cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;

              const count = entities.length;
              const size = Math.min(80, 40 + count * 2);

              // 统计在线/离线节点
              let onlineCount = 0;
              let offlineCount = 0;
              entities.forEach((entity: any) => {
                const nodeData = entity._nodeData;
                if (nodeData) {
                  if (nodeData.status === "online") onlineCount++;
                  else if (nodeData.status === "offline") offlineCount++;
                }
              });

              // 根据节点状态决定聚合颜色
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

              // 创建聚合图标
              cluster.billboard.image = createClusterIcon(
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
        console.error("Cesium initialization error:", error);
        setIsLoading(false);
        initializingRef.current = false;
      }
    };

    initCesium();

    // 清理函数
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      initializingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← 仅初始化一次，不依赖nodes或onNodeClick

  useEffect(() => {
    if (!isLoading) {
      onReady?.();
    }
  }, [isLoading, onReady]);

  // useEffect 2: 更新节点标记（当nodes变化时）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // 清除所有现有节点实体
    viewer.entities.removeAll();

    // 添加访客位置标记（仅在启用且可见时）
    if (showVisitorLocation && visitorLocation && !visitorLoading && isVisitorLocationVisible) {
      const isMatching = !!matchedNode;
      const visitorColor = isMatching
        ? Cesium.Color.fromCssColorString("#8b5cf6") // 紫色（匹配节点）
        : Cesium.Color.fromCssColorString("#ec4899"); // 粉色（普通）

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
          // 添加脉动效果
          pixelSize: new Cesium.CallbackProperty(() => {
            return 20 + Math.sin(Date.now() / 200) * 5;
          }, false) as any,
        },

        label: {
          text: "您的位置",
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -25),
          heightReference: Cesium.HeightReference.NONE,
        },
      });

      // 存储访客位置数据
      (visitorEntity as any)._visitorData = {
        ...visitorLocation,
        isMatching,
        matchedNode,
      };

      // 如果匹配了节点，添加连接线
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

        // 移除节点名称标签和弹窗描述
        // label: {
        //   text: node.name,
        //   font: '14px sans-serif',
        //   fillColor: Cesium.Color.WHITE,
        //   outlineColor: Cesium.Color.BLACK,
        //   outlineWidth: 2,
        //   style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        //   verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        //   pixelOffset: new Cesium.Cartesian2(0, -15),
        //   heightReference: Cesium.HeightReference.NONE,
        // },

        // description: 已禁用 infoBox，不需要弹窗内容
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
  }, [nodeIds, nodes, showVisitorLocation, visitorLocation, visitorLoading, matchedNode, isVisitorLocationVisible]); // 依赖nodeIds和访客位置，避免不必要的更新

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

  // 图层切换功能 - 3D 地球专用（修复异步问题）
  const switchLayer = async (
    layerType: "satellite" | "terrain" | "bluemarble" | "natgeo",
  ) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    setCurrentLayer(layerType);
    setShowLayerMenu(false);

    // 移除当前图层
    viewer.imageryLayers.removeAll();

    let imageryProviderPromise: Promise<Cesium.ImageryProvider> | null = null;

    switch (layerType) {
      case "satellite":
        // 高清卫星影像（Esri 世界影像）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        );
        break;

      case "terrain":
        // 地形底图（Esri 世界地形）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer",
        );
        break;

      case "bluemarble":
        // 蓝色大理石（夜景+白天）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
        );
        break;

      case "natgeo":
      default:
        // National Geographic 风格（清晰的地理标注）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer",
        );
        break;
    }

    if (imageryProviderPromise) {
      try {
        const imageryProvider = await imageryProviderPromise;
        if (viewer && !viewer.isDestroyed()) {
          viewer.imageryLayers.addImageryProvider(imageryProvider);
        }
      } catch (error) {
        console.error("图层加载失败:", error);
        // 失败时回退到 OpenStreetMap
        const fallbackProvider = new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        });
        if (viewer && !viewer.isDestroyed()) {
          viewer.imageryLayers.addImageryProvider(fallbackProvider);
        }
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
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleRotation}
          title={isRotating ? "暂停自转" : "恢复自转"}
          aria-label={isRotating ? "暂停地球自转" : "恢复地球自转"}
          className={`${
            isRotating
              ? "bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800"
              : "bg-primary hover:bg-primary/90"
          } shadow-lg border border-gray-200/50 dark:border-gray-600/50`}
        >
          {isRotating ? (
            <Pause className="h-4 w-4 text-gray-700 dark:text-gray-200" />
          ) : (
            <Play className="h-4 w-4 text-white" />
          )}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomIn}
          title="放大"
          aria-label="放大地图"
          className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        >
          <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomOut}
          title="缩小"
          aria-label="缩小地图"
          className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        >
          <ZoomOut className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetView}
          title="重置视图"
          aria-label="重置地图视图到初始位置"
          className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        >
          <Home className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </Button>

      </div>

      {/* Layer switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <div className="relative layer-menu-container">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg flex items-center gap-2 border border-gray-200/50 dark:border-gray-600/50 lg:bg-white/90 lg:dark:bg-gray-800/90 lg:backdrop-blur-[10px]"
          >
            <Layers className="h-4 w-4 text-gray-700 dark:text-gray-200" />
            <span className="hidden sm:inline text-gray-700 dark:text-gray-200">
              图层
            </span>
          </Button>

          {/* 图层选择菜单（简化列表样式，每个选项使用不同主题色） */}
          {showLayerMenu && (
            <div
              className="absolute top-14 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[280px] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              role="menu"
            >
              <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-2">
                  选择地图图层
                </p>
              </div>
              <div className="p-2 divide-y divide-gray-100 dark:divide-gray-700">
                {/* 高清卫星图 - 蓝色 */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentLayer === "satellite" ? "true" : "false"}
                  onClick={() => {
                    switchLayer("satellite");
                    setShowLayerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    currentLayer === "satellite"
                      ? "bg-blue-600/10 dark:bg-blue-900/30 border-l-2 border-blue-600 text-blue-800 dark:text-blue-200"
                      : "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Satellite className="h-4 w-4" />
                    高清卫星图
                  </span>
                  {currentLayer === "satellite" && (
                    <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-300 rounded-full"></div>
                  )}
                </button>

                {/* 立体地形 - 绿色 */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentLayer === "terrain" ? "true" : "false"}
                  onClick={() => {
                    switchLayer("terrain");
                    setShowLayerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    currentLayer === "terrain"
                      ? "bg-[hsl(var(--status-success-600)/0.1)] dark:bg-[hsl(var(--status-success-900)/0.3)] border-l-2 border-[hsl(var(--status-success-600))] text-[hsl(var(--status-success-800))] dark:text-[hsl(var(--status-success-200))]"
                      : "bg-white dark:bg-gray-800 hover:bg-[hsl(var(--status-success-50))] dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    立体地形
                  </span>
                  {currentLayer === "terrain" && (
                    <div className="w-1.5 h-1.5 bg-[hsl(var(--status-success-600))] dark:bg-[hsl(var(--status-success-300))] rounded-full"></div>
                  )}
                </button>

                {/* 街道标注 - 紫色 */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={
                    currentLayer === "bluemarble" ? "true" : "false"
                  }
                  onClick={() => {
                    switchLayer("bluemarble");
                    setShowLayerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    currentLayer === "bluemarble"
                      ? "bg-purple-600/10 dark:bg-purple-900/30 border-l-2 border-purple-600 text-purple-800 dark:text-purple-200"
                      : "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    街道标注
                  </span>
                  {currentLayer === "bluemarble" && (
                    <div className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-300 rounded-full"></div>
                  )}
                </button>

                {/* 国家地理风格 - 橙色 */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentLayer === "natgeo" ? "true" : "false"}
                  onClick={() => {
                    switchLayer("natgeo");
                    setShowLayerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    currentLayer === "natgeo"
                      ? "bg-orange-600/10 dark:bg-orange-900/30 border-l-2 border-orange-600 text-orange-800 dark:text-orange-200"
                      : "bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    国家地理风格
                  </span>
                  {currentLayer === "natgeo" && (
                    <div className="w-1.5 h-1.5 bg-orange-600 dark:bg-orange-300 rounded-full"></div>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
