import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeData } from '@/services/api';

interface Globe3DProps {
  nodes?: NodeData[];
  onNodeClick?: (node: NodeData) => void;
  className?: string;
}

// 简易 Canvas 3D 地球，可视化节点（不依赖三方 3D 库）
export const Globe3D: React.FC<Globe3DProps> = ({ nodes = [], onNodeClick, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotation, setRotation] = useState({ x: 0, y: 0 }); // 俯仰 x，偏航 y
  const [zoom, setZoom] = useState(1);
  const [mouseDown, setMouseDown] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const R = 220; // 球半径（像素）

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
      x: canvas.width / 2 + x2 * scale,
      y: canvas.height / 2 - y2 * scale,
      scale,
      visible: z2 > -distance
    };
  }, [rotation, zoom]);

  // 绘制
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 地球球体（渐变）
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const grad = ctx.createRadialGradient(centerX - R / 3, centerY - R / 3, R / 8, centerX, centerY, R);
    grad.addColorStop(0, 'rgba(40,120,255,0.9)');
    grad.addColorStop(0.7, 'rgba(40,120,255,0.4)');
    grad.addColorStop(1, 'rgba(40,120,255,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, R * zoom, 0, Math.PI * 2);
    ctx.fill();

    // 节点点云
    const sizeBase = 3;
    nodes.forEach(node => {
      const { x, y, z } = latLonToXYZ(node.latitude, node.longitude);
      const p = project3D(x, y, z);
      if (!p.visible) return;

      const status = (node.status || 'unknown').toLowerCase();
      const color = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : status === 'maintenance' ? '#f59e0b' : '#9ca3af';
      const r = Math.max(1.5, sizeBase * Math.max(0.6, p.scale));

      // 光晕
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      glow.addColorStop(0, color + 'AA');
      glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 核心点
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [nodes, project3D, zoom]);

  // 动画
  useEffect(() => {
    if (isPlaying) {
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

  // 尺寸
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(420, rect.height);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // 点击拾取最近点
  const pickNode = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let best: { node: NodeData; dist: number } | null = null;
    nodes.forEach(node => {
      const { x: vx, y: vy, z: vz } = latLonToXYZ(node.latitude, node.longitude);
      const p = project3D(vx, vy, vz);
      if (!p.visible) return;
      const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (!best || d2 < best.dist) best = { node, dist: d2 };
    });
    if (best && best.dist < 20 * 20) {
      return best.node;
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
    <div className={`relative ${className}`}>
      {Controls}
      <div className="h-[600px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing bg-slate-900"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onClick={onClick}
        />
      </div>
    </div>
  );
};

