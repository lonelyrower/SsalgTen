import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeData } from '@/services/api';

interface Globe3DProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  selectedNode?: NodeData | null;
  className?: string;
}

// 简易 Canvas 3D 地球，可视化节点（不依赖三方 3D 库）
export const Globe3D: React.FC<Globe3DProps> = ({ nodes = [], onNodeClick, selectedNode, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotation, setRotation] = useState({ x: 0, y: 0 }); // 俯仰 x，偏航 y
  const [zoom, setZoom] = useState(1);
  const [mouseDown, setMouseDown] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; node: NodeData } | null>(null);
  const [powerSave, setPowerSave] = useState<boolean>(() => /Mobile|Android|iP(hone|od|ad)/i.test(navigator.userAgent));

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const R = Math.min(canvasSize.width, canvasSize.height) * 0.35; // 动态球半径，占容器的35%
  
  // 根据设备像素比调整绘制质量
  const getDrawingScale = useCallback(() => {
    if (powerSave) return 1; // 省电模式使用1x
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, 2); // 最高2x，避免过度渲染
  }, [powerSave]);

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  // 将经纬度转换为球面三维坐标
  const latLonToXYZ = (lat: number, lon: number) => {
    const phi = toRadians(90 - lat); // 从北极开始的角度
    const theta = toRadians(lon + 180); // 经度偏移，确保 0 经在中央
    const x = -R * Math.sin(phi) * Math.cos(theta);
    const z = R * Math.sin(phi) * Math.sin(theta);
    const y = R * Math.cos(phi);
    return { x, y, z };
  };

  // 3D -> 2D 投影（应用旋转与缩放）
  const project3D = useCallback((x: number, y: number, z: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1, visible: false };

    // 绕 X（俯仰）、Y（偏航）旋转
    const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);

    // Y 轴旋转
    let x1 = x * cosY + z * sinY;
    let y1 = y;
    let z1 = -x * sinY + z * cosY;
    // X 轴旋转
    let x2 = x1;
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;

    const distance = 800;
    const scale = (distance / (distance + z2)) * zoom;

    return {
      x: canvasSize.width / 2 + x2 * scale,
      y: canvasSize.height / 2 - y2 * scale,
      scale,
      visible: z2 > -distance
    };
  }, [rotation, zoom, canvasSize.width, canvasSize.height]);

  // 绘制
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 星空背景
    const w = canvasSize.width;
    const h = canvasSize.height;
    ctx.clearRect(0, 0, w, h);
    const starGrad = ctx.createRadialGradient(
      w / 2, h / 2, 0,
      w / 2, h / 2, Math.max(w, h) / 2
    );
    starGrad.addColorStop(0, '#0f1419');
    starGrad.addColorStop(1, '#020817');
    ctx.fillStyle = starGrad;
    ctx.fillRect(0, 0, w, h);

    // 添加星星效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 地球球体（海洋色彩）
    const centerX = w / 2;
    const centerY = h / 2;
    const effectiveRadius = R * zoom;
    
    // 海洋渐变（蓝色基调）
    const oceanGrad = ctx.createRadialGradient(
      centerX - effectiveRadius * 0.3, 
      centerY - effectiveRadius * 0.3, 
      effectiveRadius * 0.1, 
      centerX, 
      centerY, 
      effectiveRadius
    );
    oceanGrad.addColorStop(0, 'rgba(65, 105, 200, 1)');
    oceanGrad.addColorStop(0.4, 'rgba(45, 85, 170, 0.95)');
    oceanGrad.addColorStop(0.7, 'rgba(25, 65, 140, 0.8)');
    oceanGrad.addColorStop(1, 'rgba(15, 45, 100, 0.6)');
    
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, effectiveRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 大陆轮廓（绿棕色）
    ctx.strokeStyle = 'rgba(120, 160, 80, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    // 简化的大陆轮廓
    const continents = [
      // 亚洲主要轮廓
      [[35, 100], [50, 120], [40, 140], [20, 130], [10, 110], [25, 95]],
      // 欧洲
      [[60, 10], [70, 30], [55, 25], [50, 5], [55, -5]],
      // 非洲
      [[35, 20], [30, 30], [10, 25], [-10, 30], [-30, 20], [-20, 10], [10, 15]],
      // 北美洲
      [[70, -100], [60, -80], [30, -90], [40, -120], [65, -130]],
      // 南美洲
      [[10, -70], [5, -60], [-10, -65], [-30, -70], [-40, -60], [-20, -55]],
      // 澳大利亚
      [[-20, 130], [-30, 140], [-35, 130], [-25, 120]]
    ];
    
    continents.forEach(continent => {
      const points = continent.map(([lat, lon]) => {
        const { x, y, z } = latLonToXYZ(lat, lon);
        return project3D(x, y, z);
      }).filter(p => p.visible);
      
      if (points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(90, 140, 60, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 160, 80, 0.6)';
        ctx.stroke();
      }
    });
    
    // 经纬网格（更细致）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 2]);
    
    // 纬线
    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        const { x, y, z } = latLonToXYZ(lat, lon);
        const p = project3D(x, y, z);
        if (p.visible && Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2) <= effectiveRadius) {
          points.push(p);
        }
      }
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    }
    
    // 经线
    for (let lon = -150; lon <= 150; lon += 30) {
      const points = [];
      for (let lat = -80; lat <= 80; lat += 3) {
        const { x, y, z } = latLonToXYZ(lat, lon);
        const p = project3D(x, y, z);
        if (p.visible && Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2) <= effectiveRadius) {
          points.push(p);
        }
      }
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    }
    
    // 球面高光效果（类似地球仪的反光）
    const highlight = ctx.createRadialGradient(
      centerX - effectiveRadius * 0.4,
      centerY - effectiveRadius * 0.4,
      0,
      centerX - effectiveRadius * 0.4,
      centerY - effectiveRadius * 0.4,
      effectiveRadius * 0.8
    );
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    highlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    highlight.addColorStop(0.6, 'rgba(255, 255, 255, 0.05)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(centerX, centerY, effectiveRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.setLineDash([]);

    // 节点点云
    const sizeBase = 3;
    nodes.forEach(node => {
      const { x, y, z } = latLonToXYZ(node.latitude, node.longitude);
      const p = project3D(x, y, z);
      if (!p.visible) return;

      const status = (node.status || 'unknown').toLowerCase();
      const color = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : status === 'maintenance' ? '#f59e0b' : '#9ca3af';
      const isSelected = selectedNode && selectedNode.id === node.id;
      const r = Math.max(1.5, sizeBase * Math.max(0.6, p.scale));
      
      // 选中节点的高亮效果
      if (isSelected) {
        // 脉冲外环
        const pulseTime = Date.now() * 0.003;
        const pulseRadius = r * (2 + Math.sin(pulseTime) * 0.5);
        const pulseGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulseRadius);
        pulseGlow.addColorStop(0, color + '80');
        pulseGlow.addColorStop(0.7, color + '40');
        pulseGlow.addColorStop(1, color + '00');
        ctx.fillStyle = pulseGlow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 选中指示环
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 光晕
      const glowSize = isSelected ? r * 4 : r * 2.5;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
      glow.addColorStop(0, color + 'AA');
      glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // 核心点
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? r * 1.2 : r, 0, Math.PI * 2);
      ctx.fill();
      
      // 选中节点的内核
      if (isSelected) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // 悬浮拾取：粗略匹配屏幕距离
      if (hover) {
        const d2 = (p.x - hover.x) ** 2 + (p.y - hover.y) ** 2;
        if (d2 < (r * 4) ** 2) {
          // 记录最近匹配
          hover.node = node;
        }
      }
    });
  }, [nodes, project3D, zoom, selectedNode]);

  // 动画
  useEffect(() => {
    if (isPlaying && !powerSave) {
      const animate = () => {
        setRotation(prev => ({ x: prev.x, y: prev.y + 0.003 }));
        try { draw(); } catch {}
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      try { draw(); } catch {}
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    };
  }, [isPlaying, draw]);

  // 页面不可见时自动暂停
  useEffect(() => {
    const onVis = () => setIsPlaying(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 尺寸和高DPI支持
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const scale = getDrawingScale();
      
      // 更新画布尺寸状态
      setCanvasSize({ width: rect.width, height: rect.height });
      
      // 设置画布的实际大小
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      
      // 设置画布的显示大小
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // 缩放绘制上下文以匹配设备像素比
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
      }
      
      draw();
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw, getDrawingScale]);

  // 点击拾取最近点
  const pickNode = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let bestNode: NodeData | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    nodes.forEach(node => {
      const { x: vx, y: vy, z: vz } = latLonToXYZ(node.latitude, node.longitude);
      const p = project3D(vx, vy, vz);
      if (!p.visible) return;
      const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d2 < bestDist) { bestDist = d2; bestNode = node; }
    });
    if (bestNode && bestDist < 20 * 20) {
      return bestNode;
    }
    return null;
  };

  // 交互
  const onMouseDown = (e: React.MouseEvent) => {
    setMouseDown(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotation(prev => ({ x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x + dy * 0.005)), y: prev.y + dx * 0.005 }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const onMouseMoveHover = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: (hover?.node as any) });
    // 重新绘制以触发标签渲染
    draw();
  };
  const onMouseUp = () => setMouseDown(false);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.6, Math.min(1.8, prev - e.deltaY * 0.0015)));
  };
  const onClick = (e: React.MouseEvent) => {
    const n = pickNode(e.clientX, e.clientY);
    if (n && onNodeClick) onNodeClick(n);
  };

  // 控件栏
  const Controls = useMemo(() => (
    <div className="absolute top-4 right-4 z-10 space-y-2">
      <button
        onClick={() => setIsPlaying(p => !p)}
        className="px-3 py-1 text-xs rounded bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700"
      >
        {isPlaying ? '暂停' : '播放'}
      </button>
      <button
        onClick={() => { setRotation({ x: 0, y: 0 }); setZoom(1); }}
        className="px-3 py-1 text-xs rounded bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700"
      >
        重置
      </button>
    </div>
  ), [isPlaying]);

  return (
    <div className={`relative w-full h-[500px] ${className}`}>
      {Controls}
      {/* 省电模式开关 */}
      <div className="absolute top-4 left-4 z-10">
        <label className="text-xs bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 cursor-pointer select-none">
          <input type="checkbox" className="mr-1" checked={powerSave} onChange={e => setPowerSave(e.target.checked)} />
          省电模式
        </label>
      </div>
      <div className="w-full h-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 bg-slate-900 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="cursor-grab active:cursor-grabbing bg-slate-900"
          onMouseDown={onMouseDown}
          onMouseMove={(e) => { onMouseMove(e); onMouseMoveHover(e); }}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onClick={onClick}
        />
        {/* 悬浮提示 */}
        {hover?.node && (
          <div
            className="absolute text-xs bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 pointer-events-none"
            style={{ left: Math.max(8, Math.min((hover.x + 12), (canvasRef.current?.clientWidth || 0) - 120)), top: Math.max(8, (hover.y + 12)) }}
          >
            <div className="font-semibold text-gray-800 dark:text-gray-200">{hover.node.name}</div>
            <div className="text-gray-600 dark:text-gray-400">{hover.node.city}, {hover.node.country}</div>
            <div className="text-gray-500 dark:text-gray-400">状态: {hover.node.status}</div>
          </div>
        )}
      </div>
    </div>
  );
};
