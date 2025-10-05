/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from 'react';
import * as Cesium from 'cesium';
import type { NodeData } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Globe, ZoomIn, ZoomOut, Home, Layers, MapPin, Satellite, Map } from 'lucide-react';

interface Globe3DProps {
  nodes: NodeData[];
  onNodeClick?: (node: NodeData) => void;
}

export function Globe3D({ nodes, onNodeClick }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializingRef = useRef(false); // 防止重复初始化
  
  // 图层状态 - 3D 地球专用图层
  const [currentLayer, setCurrentLayer] = useState<'satellite' | 'terrain' | 'bluemarble' | 'natgeo'>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

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
      let provider = (w.APP_CONFIG?.MAP_PROVIDER || import.meta.env.VITE_MAP_PROVIDER || 'openstreetmap').toString().toLowerCase();
      const apiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';
      
      // 验证提供商是否有效（3D 地球支持的提供商）
      const validProviders = ['carto', 'mapbox', 'openstreetmap'];
      if (!validProviders.includes(provider)) {
        console.warn(`⚠️ 无效的地图提供商: ${provider}，使用默认值 openstreetmap`);
        provider = 'openstreetmap';
      }
      
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
        // 根据配置选择地图源（使用异步创建，更可靠）
        let imageryProviderPromise: Promise<Cesium.ImageryProvider>;
        
        switch (provider) {
          case 'carto':
            imageryProviderPromise = Promise.resolve(new Cesium.UrlTemplateImageryProvider({
              url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              credit: '© CARTO © OpenStreetMap contributors',
              subdomains: ['a', 'b', 'c', 'd']
            }));
            break;
            
          case 'mapbox':
            if (apiKey) {
              imageryProviderPromise = Promise.resolve(new Cesium.UrlTemplateImageryProvider({
                url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`,
                credit: '© Mapbox © OpenStreetMap contributors'
              }));
            } else {
              console.warn('Mapbox 需要 API key，回退到 OpenStreetMap');
              imageryProviderPromise = Promise.resolve(
                new Cesium.OpenStreetMapImageryProvider({
                  url: 'https://tile.openstreetmap.org/'
                })
              );
            }
            break;
            
          case 'openstreetmap':
            imageryProviderPromise = Promise.resolve(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/'
              })
            );
            break;
            
          default:
            // 使用更可靠的默认地图源（ArcGIS World Imagery）
            imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
            );
        }

        // 创建 Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            imageryProviderPromise
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
        
        console.log('✓ Cesium Viewer 初始化成功');

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
          scene.skyAtmosphere.brightnessShift = 0.0;  // 从0.2改为0.0
          scene.skyAtmosphere.saturationShift = 0.0;  // 从0.1改为0.0
        }

        globe.showGroundAtmosphere = true;
        // 地面大气层也使用更温和的值
        globe.atmosphereBrightnessShift = 0.0;  // 从0.1改为0.0
        globe.atmosphereSaturationShift = 0.0;  // 从0.1改为0.0
        
        // 移除自定义基础颜色，使用默认
        // globe.baseColor = Cesium.Color.BLACK; // 删除这行，让Cesium使用默认颜色
        
        globe.showWaterEffect = true;
        
        // 优化夜间过渡效果
        globe.nightFadeInDistance = 8000000.0;   // 增大从5000000，让过渡更柔和
        globe.nightFadeOutDistance = 15000000.0; // 增大从10000000
        
        scene.globe.maximumScreenSpaceError = 1.5;
        scene.globe.tileCacheSize = 200;
        
        scene.screenSpaceCameraController.enableCollisionDetection = false;
        
        // 雾效 - 使用更自然的设置
        scene.fog.enabled = true;
        scene.fog.density = 0.0001;              // 从0.0002减小，让雾更淡
        scene.fog.minimumBrightness = 0.05;      // 从0.03增加到0.05，避免过暗

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← 仅初始化一次，不依赖nodes或onNodeClick

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

  // 点击外部关闭图层菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showLayerMenu && !target.closest('.layer-menu-container')) {
        setShowLayerMenu(false);
      }
    };

    if (showLayerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLayerMenu]);

  // 图层切换功能 - 3D 地球专用（修复异步问题）
  const switchLayer = async (layerType: 'satellite' | 'terrain' | 'bluemarble' | 'natgeo') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    setCurrentLayer(layerType);
    setShowLayerMenu(false);

    // 移除当前图层
    viewer.imageryLayers.removeAll();

    let imageryProviderPromise: Promise<Cesium.ImageryProvider> | null = null;

    switch (layerType) {
      case 'satellite':
        // 高清卫星影像（Esri 世界影像）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        );
        break;

      case 'terrain':
        // 地形底图（Esri 世界地形）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer'
        );
        break;

      case 'bluemarble':
        // 蓝色大理石（夜景+白天）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
        );
        break;

      case 'natgeo':
      default:
        // National Geographic 风格（清晰的地理标注）
        imageryProviderPromise = Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer'
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
        console.error('图层加载失败:', error);
        // 失败时回退到 OpenStreetMap
        const fallbackProvider = new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/'
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

      {/* 图层切换按钮 */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative layer-menu-container">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white/90 hover:bg-white shadow-lg flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">图层</span>
          </Button>

          {/* 图层选择菜单 */}
          {showLayerMenu && (
            <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                  🌍 选择 3D 底图
                </p>
              </div>
              <div className="p-2">
                {/* 卫星影像 */}
                <button
                  onClick={() => switchLayer('satellite')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    currentLayer === 'satellite'
                      ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <Satellite className={`h-5 w-5 flex-shrink-0 ${
                    currentLayer === 'satellite' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                  }`} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">卫星影像</p>
                    <p className={`text-xs ${
                      currentLayer === 'satellite' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'
                    }`}>高清卫星图</p>
                  </div>
                  {currentLayer === 'satellite' && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>

                {/* 地形图 */}
                <button
                  onClick={() => switchLayer('terrain')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    currentLayer === 'terrain'
                      ? 'bg-green-600 text-white shadow-md scale-[1.02]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <Map className={`h-5 w-5 flex-shrink-0 ${
                    currentLayer === 'terrain' ? 'text-white' : 'text-green-600 dark:text-green-400'
                  }`} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">地形图</p>
                    <p className={`text-xs ${
                      currentLayer === 'terrain' ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'
                    }`}>立体地形</p>
                  </div>
                  {currentLayer === 'terrain' && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>

                {/* 街道底图 */}
                <button
                  onClick={() => switchLayer('bluemarble')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    currentLayer === 'bluemarble'
                      ? 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <MapPin className={`h-5 w-5 flex-shrink-0 ${
                    currentLayer === 'bluemarble' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'
                  }`} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">街道底图</p>
                    <p className={`text-xs ${
                      currentLayer === 'bluemarble' ? 'text-indigo-100' : 'text-gray-600 dark:text-gray-400'
                    }`}>清晰标注</p>
                  </div>
                  {currentLayer === 'bluemarble' && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>

                {/* 国家地理 */}
                <button
                  onClick={() => switchLayer('natgeo')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    currentLayer === 'natgeo'
                      ? 'bg-amber-600 text-white shadow-md scale-[1.02]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <Globe className={`h-5 w-5 flex-shrink-0 ${
                    currentLayer === 'natgeo' ? 'text-white' : 'text-amber-600 dark:text-amber-400'
                  }`} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">国家地理</p>
                    <p className={`text-xs ${
                      currentLayer === 'natgeo' ? 'text-amber-100' : 'text-gray-600 dark:text-gray-400'
                    }`}>经典风格</p>
                  </div>
                  {currentLayer === 'natgeo' && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
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
