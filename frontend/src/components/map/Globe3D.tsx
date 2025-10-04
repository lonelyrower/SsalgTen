/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from 'react';
import * as Cesium from 'cesium';
import type { NodeData } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Globe, ZoomIn, ZoomOut, Home } from 'lucide-react';

interface Globe3DProps {
  nodes: NodeData[];
  onNodeClick?: (node: NodeData) => void;
}

export function Globe3D({ nodes, onNodeClick }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializingRef = useRef(false); // 防止重复初始化

  // 使用 useMemo 缓存节点ID列表，只有当节点ID变化时才重新渲染
  const nodeIds = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);

  // useEffect 1: 初始化 Cesium Viewer（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current && !viewerRef.current.isDestroyed()) return;
    if (initializingRef.current) return; // 正在初始化，避免重复

    initializingRef.current = true;

    // 使用异步函数初始化 Cesium
    const initCesium = async () => {
      // 读取地图配置
      const w: any = typeof window !== 'undefined' ? (window as any) : {};
      const provider = (w.APP_CONFIG?.MAP_PROVIDER || import.meta.env.VITE_MAP_PROVIDER || 'openstreetmap').toString().toLowerCase();
      const apiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';
      
      // 读取Cesium Ion配置
      const cesiumIonToken = w.APP_CONFIG?.CESIUM_ION_TOKEN || import.meta.env.VITE_CESIUM_ION_TOKEN || '';
      
      // 配置 Cesium Ion（如果有token则启用，否则使用免费tiles）
      if (cesiumIonToken) {
        Cesium.Ion.defaultAccessToken = cesiumIonToken;
        console.log('✓ Cesium Ion已启用（高质量3D渲染）');
      } else {
        // 禁用 Cesium Ion，使用免费地图源
        Cesium.Ion.defaultAccessToken = '';
        try {
          (Cesium.Ion as any).defaultServer = '';
          (Cesium.Ion as any).enabled = false;
        } catch {
          // 忽略错误
        }
        console.log('ℹ Cesium Ion未配置，使用免费地图源（可在设置中添加API key以获得更好的3D效果）');
      }

      try {
        // 根据配置选择地图源
        let imageryProvider;
        
        switch (provider) {
          case 'carto':
            imageryProvider = new Cesium.UrlTemplateImageryProvider({
              url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              credit: '© CARTO © OpenStreetMap contributors',
              subdomains: ['a', 'b', 'c', 'd']
            });
            break;
            
          case 'mapbox':
            if (apiKey) {
              imageryProvider = new Cesium.UrlTemplateImageryProvider({
                url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`,
                credit: '© Mapbox © OpenStreetMap contributors'
              });
            } else {
              console.warn('Mapbox 需要 API key，回退到 OpenStreetMap');
              imageryProvider = new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/'
              });
            }
            break;
            
          case 'openstreetmap':
            imageryProvider = new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/'
            });
            break;
            
          default:
            imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
              Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
            );
        }

        // 创建 Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Promise.resolve(imageryProvider)
          ),
          
          // 如果有Cesium Ion token，使用高质量地形数据
          terrain: cesiumIonToken ? 
            Cesium.Terrain.fromWorldTerrain() : 
            undefined,

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

        // === 视觉增强配置 ===
        const scene = viewer.scene;
        const globe = scene.globe;

        globe.enableLighting = true;
        globe.dynamicAtmosphereLighting = true;
        globe.dynamicAtmosphereLightingFromSun = true;

        if (scene.skyAtmosphere) {
          scene.skyAtmosphere.show = true;
          scene.skyAtmosphere.brightnessShift = 0.2;
          scene.skyAtmosphere.saturationShift = 0.1;
        }

        globe.showGroundAtmosphere = true;
        globe.atmosphereBrightnessShift = 0.1;
        globe.atmosphereSaturationShift = 0.1;
        globe.baseColor = Cesium.Color.BLACK;
        globe.showWaterEffect = true;
        
        scene.globe.maximumScreenSpaceError = 1.5;
        scene.globe.tileCacheSize = 200;
        
        scene.screenSpaceCameraController.enableCollisionDetection = false;
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        scene.fog.minimumBrightness = 0.1;

        scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(1, 0, 0)
        });
      
        // 设置相机初始位置
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // 添加点击事件监听器
        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const pickedObject = viewer.scene.pick(movement.position);
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const nodeData = (entity as any)._nodeData;

            if (nodeData) {
              viewer.flyTo(entity, {
                duration: 2,
                offset: new Cesium.HeadingPitchRange(
                  0,
                  Cesium.Math.toRadians(-45),
                  5000000
                ),
              });

              if (onNodeClick) {
                onNodeClick(nodeData);
              }
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 慢速自动旋转地球
        let lastTime = Date.now();
        const tickListener = () => {
          const now = Date.now();
          const deltaTime = (now - lastTime) / 1000;
          lastTime = now;
          
          if (viewer && !viewer.isDestroyed()) {
            viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.02 * deltaTime);
          }
        };
        
        viewer.clock.onTick.addEventListener(tickListener);

        setIsLoading(false);
        initializingRef.current = false;
      } catch (error) {
        console.error('Cesium initialization error:', error);
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
  }, []); // ← 仅初始化一次，不依赖nodes

  // useEffect 2: 更新节点标记（当nodes变化时）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // 清除所有现有节点实体
    viewer.entities.removeAll();

    // 添加节点标记
    nodes.forEach((node) => {
      let color: Cesium.Color;
      let statusText: string;
      
      switch (node.status) {
        case 'online':
          color = Cesium.Color.fromCssColorString('#10b981');
          statusText = '在线';
          break;
        case 'offline':
          color = Cesium.Color.fromCssColorString('#ef4444');
          statusText = '离线';
          break;
        case 'warning':
          color = Cesium.Color.fromCssColorString('#f59e0b');
          statusText = '警告';
          break;
        default:
          color = Cesium.Color.fromCssColorString('#6b7280');
          statusText = '未知';
      }

      const entity = viewer.entities.add({
        id: node.id,
        name: node.name,
        position: Cesium.Cartesian3.fromDegrees(
          node.longitude,
          node.latitude,
          500000
        ),
        
        point: {
          pixelSize: 12,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
          ...(node.status === 'online' && {
            pixelSize: new Cesium.CallbackProperty(() => {
              return 12 + Math.sin(Date.now() / 300) * 3;
            }, false) as any,
          }),
        },
        
        label: {
          text: node.name,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          heightReference: Cesium.HeightReference.NONE,
        },
        
        description: `
          <div style="padding: 10px; font-family: sans-serif;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">${node.name}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px; color: #6b7280;">状态:</td><td style="padding: 4px; font-weight: bold; color: ${color.toCssColorString()};">${statusText}</td></tr>
              <tr><td style="padding: 4px; color: #6b7280;">位置:</td><td style="padding: 4px;">${node.city}, ${node.country}</td></tr>
              <tr><td style="padding: 4px; color: #6b7280;">坐标:</td><td style="padding: 4px;">${node.latitude.toFixed(4)}°N, ${node.longitude.toFixed(4)}°E</td></tr>
              ${node.ipv4 ? `<tr><td style="padding: 4px; color: #6b7280;">IPv4:</td><td style="padding: 4px;">${node.ipv4}</td></tr>` : ''}
              ${node.provider ? `<tr><td style="padding: 4px; color: #6b7280;">提供商:</td><td style="padding: 4px;">${node.provider}</td></tr>` : ''}
              ${node.asnName ? `<tr><td style="padding: 4px; color: #6b7280;">ASN:</td><td style="padding: 4px;">${node.asnName}</td></tr>` : ''}
            </table>
          </div>
        `,
      });

      (entity as any)._nodeData = node;
    });

    // 添加节点之间的连线
    if (nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        const node1 = nodes[i];
        const node2 = nodes[i + 1];
        
        if (node1.status === 'online' && node2.status === 'online') {
          viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                node1.longitude, node1.latitude, 500000,
                node2.longitude, node2.latitude, 500000,
              ]),
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Cesium.Color.fromCssColorString('#06b6d4').withAlpha(0.6),
              }),
              arcType: Cesium.ArcType.GEODESIC,
            },
          });
        }
      }
    }
  }, [nodeIds, nodes]); // 依赖nodeIds，避免不必要的更新

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

  return (
    <div className="relative w-full h-full">
      {/* 3D 地球容器 */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 加载指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center gap-4">
            <Globe className="w-12 h-12 animate-spin text-blue-500" />
            <p className="text-white text-lg">加载 3D 地球...</p>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomIn}
          title="放大"
          className="bg-white/90 hover:bg-white shadow-lg"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomOut}
          title="缩小"
          className="bg-white/90 hover:bg-white shadow-lg"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetView}
          title="重置视图"
          className="bg-white/90 hover:bg-white shadow-lg"
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
