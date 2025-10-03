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

    // 设置 Cesium Ion Access Token (使用默认的公开 token)
    // 用户可以在 https://ion.cesium.com/ 注册获取自己的 token
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

    try {
      // 创建 Cesium Viewer
      const viewer = new Cesium.Viewer(containerRef.current, {
        // 地形配置
        terrainProvider: Cesium.createWorldTerrain({
          requestWaterMask: true, // 水面效果
          requestVertexNormals: true, // 地形光照
        }),
        
        // 影像配置（使用 Bing Maps）
        imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
        
        // UI 配置
        baseLayerPicker: false, // 禁用底图选择器
        geocoder: false, // 禁用地理编码搜索
        homeButton: false, // 禁用主页按钮
        sceneModePicker: false, // 禁用场景模式选择器
        navigationHelpButton: false, // 禁用导航帮助
        animation: false, // 禁用动画控制
        timeline: false, // 禁用时间轴
        fullscreenButton: false, // 禁用全屏按钮
        vrButton: false, // 禁用 VR 按钮
        
        // 性能优化
        requestRenderMode: true, // 请求渲染模式
        maximumRenderTimeChange: Infinity, // 最大渲染时间变化
      });

      viewerRef.current = viewer;

      // 启用地球光照
      viewer.scene.globe.enableLighting = true;
      
      // 设置大气效果
      viewer.scene.skyAtmosphere.show = true;
      
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

        // 添加点击事件
        entity.onclick = () => {
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
            onNodeClick(node);
          }
        };
      });

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
      viewer.clock.onTick.addEventListener(() => {
        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        
        // 每秒旋转 0.02 弧度（约 1.15 度）
        viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.02 * deltaTime);
      });

      setIsLoading(false);

      // 清理
      return () => {
        viewer.destroy();
      };
    } catch (error) {
      console.error('Cesium initialization error:', error);
      setIsLoading(false);
    }
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Globe className="w-12 h-12 animate-spin text-blue-500" />
            <p className="text-white text-lg">加载 3D 地球...</p>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomIn}
          title="放大"
          className="bg-white/90 hover:bg-white"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomOut}
          title="缩小"
          className="bg-white/90 hover:bg-white"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetView}
          title="重置视图"
          className="bg-white/90 hover:bg-white"
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <span className="font-semibold text-gray-900">节点统计</span>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">总数:</span>
            <span className="font-medium text-gray-900">{nodes.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-green-600">在线:</span>
            <span className="font-medium text-green-600">
              {nodes.filter(n => n.status === 'online').length}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-red-600">离线:</span>
            <span className="font-medium text-red-600">
              {nodes.filter(n => n.status === 'offline').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
