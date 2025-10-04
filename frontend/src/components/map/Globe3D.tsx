/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!containerRef.current) return;
    // 防止重复初始化
    if (viewerRef.current && !viewerRef.current.isDestroyed()) return;

    // 使用异步函数初始化 Cesium
    const initCesium = async () => {
      // 读取地图配置（与 2D 地图保持一致）
      const w: any = typeof window !== 'undefined' ? (window as any) : {};
      const provider = (w.APP_CONFIG?.MAP_PROVIDER || import.meta.env.VITE_MAP_PROVIDER || 'openstreetmap').toString().toLowerCase();
      const apiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';

      // 完全禁用 Cesium Ion 避免沙盒错误和 401 错误
      // 设置为空token并禁用所有Ion相关功能
      Cesium.Ion.defaultAccessToken = '';
      
      // 禁用Ion服务器连接（防止任何网络请求）
      try {
        (Cesium.Ion as any).defaultServer = '';
        // 禁用资源检查
        (Cesium.Ion as any).enabled = false;
      } catch {
        // 忽略错误，某些Cesium版本可能不支持
      }
      
      // 禁用默认资源服务器
      try {
        (Cesium as any).buildModuleUrl.setBaseUrl = () => {};
      } catch {
        // 忽略
      }

      try {
        // 根据配置选择地图源
        let imageryProvider;
        
        switch (provider) {
          case 'carto':
            // CartoDB - 简洁快速，免费
            imageryProvider = new Cesium.UrlTemplateImageryProvider({
              url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              credit: '© CARTO © OpenStreetMap contributors',
              subdomains: ['a', 'b', 'c', 'd']
            });
            break;
            
          case 'mapbox':
            // Mapbox - 需要 API key，卫星影像
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
            // OpenStreetMap - 免费开源，细节丰富
            imageryProvider = new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/'
            });
            break;
            
          default:
            // 默认使用离线地图（NaturalEarth II）
            imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
              Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
            );
        }

        // 创建 Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          // 使用选定的地图源
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Promise.resolve(imageryProvider)
          ),
          
          // 禁用地形（避免 Ion 资源请求）
          terrain: undefined,

          // UI 配置
          baseLayerPicker: false, // 禁用底图选择器（我们自己管理）
          geocoder: false, // 禁用地理编码搜索
          homeButton: false, // 禁用主页按钮
          sceneModePicker: false, // 禁用场景模式选择器
          navigationHelpButton: false, // 禁用导航帮助
          animation: false, // 禁用动画控制
          timeline: false, // 禁用时间轴
          fullscreenButton: false, // 禁用全屏按钮
          vrButton: false, // 禁用 VR 按钮
          selectionIndicator: false, // 禁用选择指示器（避免 shader 错误）
          infoBox: false, // 禁用信息框（使用自定义提示）
          
          // 场景配置
          requestRenderMode: true, // 启用按需渲染
          maximumRenderTimeChange: Infinity, // 防止自动渲染
        });

      viewerRef.current = viewer;

      // === 视觉增强配置 ===
      const scene = viewer.scene;
      const globe = scene.globe;

      // 1. 启用地球光照和阴影
      globe.enableLighting = true;
      globe.dynamicAtmosphereLighting = true;
      globe.dynamicAtmosphereLightingFromSun = true;

      // 2. 优化大气层效果
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.brightnessShift = 0.2; // 增加亮度
        scene.skyAtmosphere.saturationShift = 0.1; // 增加饱和度
      }

      // 3. 显示地面大气
      globe.showGroundAtmosphere = true;
      globe.atmosphereBrightnessShift = 0.1;
      globe.atmosphereSaturationShift = 0.1;

      // 4. 优化地球表面渲染
      globe.baseColor = Cesium.Color.BLACK; // 海洋基础颜色
      globe.showWaterEffect = true; // 显示水面效果（如果支持）
      
      // 5. 优化性能和视觉质量
      scene.globe.maximumScreenSpaceError = 1.5; // 降低可减少细节，提升性能
      scene.globe.tileCacheSize = 200; // 增加缓存
      
      // 6. 优化相机和场景
      scene.screenSpaceCameraController.enableCollisionDetection = false;
      scene.fog.enabled = true; // 启用雾效
      scene.fog.density = 0.0002; // 雾的密度
      scene.fog.minimumBrightness = 0.1;

      // 7. 添加环境光
      scene.light = new Cesium.DirectionalLight({
        direction: new Cesium.Cartesian3(1, 0, 0)
      });
      
      // 设置相机初始位置（查看整个地球）
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // 添加节点标记
      nodes.forEach((node) => {
        // 根据状态选择颜色
        let color: Cesium.Color;
        let statusText: string;
        
        switch (node.status) {
          case 'online':
            color = Cesium.Color.fromCssColorString('#10b981'); // green-500
            statusText = '在线';
            break;
          case 'offline':
            color = Cesium.Color.fromCssColorString('#ef4444'); // red-500
            statusText = '离线';
            break;
          case 'warning':
            color = Cesium.Color.fromCssColorString('#f59e0b'); // amber-500
            statusText = '警告';
            break;
          default:
            color = Cesium.Color.fromCssColorString('#6b7280'); // gray-500
            statusText = '未知';
        }

        // 创建节点实体
        const entity = viewer.entities.add({
          id: node.id,
          name: node.name,
          position: Cesium.Cartesian3.fromDegrees(
            node.longitude,
            node.latitude,
            500000 // 高度 500km (更容易看到)
          ),
          
          // 点标记
          point: {
            pixelSize: 12,
            color: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.NONE,
            // 添加跳动效果（在线节点）
            ...(node.status === 'online' && {
              pixelSize: new Cesium.CallbackProperty(() => {
                return 12 + Math.sin(Date.now() / 300) * 3;
              }, false) as any,
            }),
          },
          
          // 标签
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
          
          // 描述信息（点击时显示）
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

        // 存储节点数据用于点击事件
        (entity as any)._nodeData = node;
      });

      // 添加点击事件监听器
      viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entity = pickedObject.id;
          const nodeData = (entity as any)._nodeData;

          if (nodeData) {
            // 飞往节点
            viewer.flyTo(entity, {
              duration: 2,
              offset: new Cesium.HeadingPitchRange(
                0,
                Cesium.Math.toRadians(-45),
                5000000 // 距离 5000km
              ),
            });

            // 回调
            if (onNodeClick) {
              onNodeClick(nodeData);
            }
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // 添加节点之间的连线（可选）
      if (nodes.length > 1) {
        for (let i = 0; i < nodes.length - 1; i++) {
          const node1 = nodes[i];
          const node2 = nodes[i + 1];
          
          // 只连接在线节点
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
                  color: Cesium.Color.fromCssColorString('#06b6d4').withAlpha(0.6), // cyan-500
                }),
                arcType: Cesium.ArcType.GEODESIC, // 大圆弧
              },
            });
          }
        }
      }

      // 慢速自动旋转地球
      let lastTime = Date.now();
      const tickListener = () => {
        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        
        // 每秒旋转 0.02 弧度（约 1.15 度）
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.02 * deltaTime);
        }
      };
      
      viewer.clock.onTick.addEventListener(tickListener);

      setIsLoading(false);
    } catch (error) {
      console.error('Cesium initialization error:', error);
      setIsLoading(false);
    }
  };

    // 调用初始化函数
    initCesium();
    
    // 清理函数 - 非常重要！防止内存泄漏
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [nodes, onNodeClick]);

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

      {/* 控制按钮 - 移到右下角避免与Cesium原生控件重叠 */}
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
