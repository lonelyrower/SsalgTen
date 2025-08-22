import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  Globe,
  Activity
} from 'lucide-react';

interface Node3D {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  status: 'online' | 'offline' | 'warning';
  connections: string[];
  data?: {
    country: string;
    provider: string;
    load: number;
  };
}

interface Connection3D {
  from: string;
  to: string;
  strength: number;
  data: number; // 数据传输量
  color: string;
}

// 生成3D网络节点
const generateNetwork3D = (): { nodes: Node3D[], connections: Connection3D[] } => {
  const nodes: Node3D[] = [];
  const connections: Connection3D[] = [];
  
  // 中心节点 - 核心服务器
  nodes.push({
    id: 'core',
    name: '核心节点',
    x: 0,
    y: 0,
    z: 0,
    size: 20,
    color: '#3b82f6',
    status: 'online',
    connections: [],
    data: {
      country: 'US',
      provider: 'Core Network',
      load: 45
    }
  });

  // 区域节点 - 围绕核心的主要节点
  const regions = [
    { name: '北美区域', x: 100, y: 0, z: 50, color: '#10b981' },
    { name: '欧洲区域', x: -80, y: 60, z: -30, color: '#f59e0b' },
    { name: '亚洲区域', x: -50, y: -80, z: 70, color: '#ef4444' },
    { name: '大洋洲区域', x: 80, y: -50, z: -60, color: '#8b5cf6' }
  ];

  regions.forEach((region, index) => {
    const regionId = `region-${index}`;
    nodes.push({
      id: regionId,
      name: region.name,
      x: region.x,
      y: region.y,
      z: region.z,
      size: 15,
      color: region.color,
      status: Math.random() > 0.8 ? 'warning' : 'online',
      connections: ['core'],
      data: {
        country: ['US', 'DE', 'JP', 'AU'][index],
        provider: `${region.name} Hub`,
        load: Math.floor(Math.random() * 80) + 10
      }
    });

    // 连接到核心节点
    connections.push({
      from: 'core',
      to: regionId,
      strength: 0.8 + Math.random() * 0.2,
      data: Math.floor(Math.random() * 1000) + 500,
      color: region.color
    });
  });

  // 边缘节点 - 围绕区域节点的小节点
  nodes.slice(1).forEach((regionNode) => {
    const edgeCount = Math.floor(Math.random() * 8) + 4;
    
    for (let i = 0; i < edgeCount; i++) {
      const angle = (i / edgeCount) * Math.PI * 2;
      const radius = 40 + Math.random() * 20;
      const height = (Math.random() - 0.5) * 30;
      
      const edgeId = `${regionNode.id}-edge-${i}`;
      nodes.push({
        id: edgeId,
        name: `边缘节点-${edgeCount * (nodes.findIndex(n => n.id === regionNode.id) - 1) + i + 1}`,
        x: regionNode.x + Math.cos(angle) * radius,
        y: regionNode.y + Math.sin(angle) * radius,
        z: regionNode.z + height,
        size: 8 + Math.random() * 4,
        color: Math.random() > 0.9 ? '#ef4444' : Math.random() > 0.7 ? '#f59e0b' : '#10b981',
        status: Math.random() > 0.85 ? (Math.random() > 0.5 ? 'warning' : 'offline') : 'online',
        connections: [regionNode.id],
        data: {
          country: ['CN', 'US', 'DE', 'JP', 'UK', 'FR', 'CA', 'AU'][Math.floor(Math.random() * 8)],
          provider: `Provider-${Math.floor(Math.random() * 20) + 1}`,
          load: Math.floor(Math.random() * 95) + 5
        }
      });

      // 连接到区域节点
      connections.push({
        from: regionNode.id,
        to: edgeId,
        strength: 0.3 + Math.random() * 0.4,
        data: Math.floor(Math.random() * 500) + 50,
        color: regionNode.color
      });

      // 偶尔连接到其他边缘节点
      if (Math.random() > 0.8 && nodes.length > 10) {
        const otherNode = nodes[Math.floor(Math.random() * (nodes.length - 5)) + 5];
        if (otherNode && otherNode.id !== edgeId) {
          connections.push({
            from: edgeId,
            to: otherNode.id,
            strength: 0.1 + Math.random() * 0.2,
            data: Math.floor(Math.random() * 200) + 10,
            color: '#64748b'
          });
        }
      }
    }
  });

  return { nodes, connections };
};

interface NetworkUniverseProps {
  className?: string;
}

export const NetworkUniverse: React.FC<NetworkUniverseProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(true);
  const [viewMode, setViewMode] = useState<'3d' | 'network' | 'data'>('3d');
  const [network] = useState<{ nodes: Node3D[], connections: Connection3D[] }>(() => generateNetwork3D());
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [zoom, setZoom] = useState(300);

  // 鼠标交互状态
  const [mouseDown, setMouseDown] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // 3D投影函数
  const project3D = useCallback((x: number, y: number, z: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1, visible: false };

    // 应用旋转
    const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
    const cosZ = Math.cos(rotation.z), sinZ = Math.sin(rotation.z);

    // 3D旋转变换
    let x1 = x;
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;

    let x2 = x1 * cosY + z1 * sinY;
    let y2 = y1;
    let z2 = -x1 * sinY + z1 * cosY;

    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;

    // 3D到2D投影
    const distance = 500;
    const scale = distance / (distance + z3);
    
    return {
      x: canvas.width / 2 + x3 * scale * (zoom / 300),
      y: canvas.height / 2 - y3 * scale * (zoom / 300),
      scale,
      visible: z3 > -distance
    };
  }, [rotation, zoom]);

  // 绘制函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 清空画布
    ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制连接线
    network.connections.forEach(conn => {
      const fromNode = network.nodes.find(n => n.id === conn.from);
      const toNode = network.nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        const from2D = project3D(fromNode.x, fromNode.y, fromNode.z);
        const to2D = project3D(toNode.x, toNode.y, toNode.z);
        
        if (from2D.visible && to2D.visible) {
          // 数据流动效果
          const gradient = ctx.createLinearGradient(from2D.x, from2D.y, to2D.x, to2D.y);
          gradient.addColorStop(0, conn.color + '00');
          gradient.addColorStop(0.5, conn.color + '88');
          gradient.addColorStop(1, conn.color + '00');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = Math.max(1, conn.strength * 3 * Math.min(from2D.scale, to2D.scale));
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = Date.now() / 50;
          
          ctx.beginPath();
          ctx.moveTo(from2D.x, from2D.y);
          ctx.lineTo(to2D.x, to2D.y);
          ctx.stroke();
          
          // 数据包动画
          if (Math.random() > 0.95) {
            const t = (Date.now() / 1000) % 2 / 2;
            const packetX = from2D.x + (to2D.x - from2D.x) * t;
            const packetY = from2D.y + (to2D.y - from2D.y) * t;
            
            ctx.fillStyle = conn.color;
            ctx.beginPath();
            ctx.arc(packetX, packetY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });

    ctx.setLineDash([]);

    // 绘制节点
    network.nodes.forEach(node => {
      const pos2D = project3D(node.x, node.y, node.z);
      
      if (pos2D.visible) {
        const size = node.size * pos2D.scale;
        
        // 节点光晕
        const glowGradient = ctx.createRadialGradient(pos2D.x, pos2D.y, 0, pos2D.x, pos2D.y, size * 2);
        glowGradient.addColorStop(0, node.color + '40');
        glowGradient.addColorStop(1, node.color + '00');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(pos2D.x, pos2D.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 节点主体
        const nodeGradient = ctx.createRadialGradient(pos2D.x - size/3, pos2D.y - size/3, 0, pos2D.x, pos2D.y, size);
        nodeGradient.addColorStop(0, node.color + 'ff');
        nodeGradient.addColorStop(0.7, node.color + 'cc');
        nodeGradient.addColorStop(1, node.color + '88');
        
        ctx.fillStyle = nodeGradient;
        ctx.beginPath();
        ctx.arc(pos2D.x, pos2D.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 状态指示
        if (node.status === 'warning') {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(pos2D.x, pos2D.y, size + 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (node.status === 'offline') {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos2D.x, pos2D.y, size + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // 节点标签 (仅限大节点)
        if (size > 10) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = `${Math.min(12, size)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.name, pos2D.x, pos2D.y + size + 15);
        }
      }
    });
  }, [network, project3D]);

  // 动画循环
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        try {
          setRotation(prev => ({
            x: prev.x + 0.005,
            y: prev.y + 0.008,
            z: prev.z + 0.003
          }));
          
          draw();
          animationRef.current = requestAnimationFrame(animate);
        } catch (error) {
          console.error('Animation error:', error);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      try {
        draw();
      } catch (error) {
        console.error('Draw error:', error);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isPlaying, draw]);

  // 画布大小调整
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(400, rect.height);
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw]);

  // 鼠标交互
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDown(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown) return;
    
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.01,
      y: prev.y + deltaX * 0.01,
      z: prev.z
    }));
    
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setMouseDown(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(100, Math.min(800, prev - e.deltaY * 0.5)));
  };

  const handleReset = () => {
    setRotation({ x: 0, y: 0, z: 0 });
    setZoom(300);
  };

  // 统计信息
  const stats = {
    total: network.nodes.length,
    online: network.nodes.filter(n => n.status === 'online').length,
    warning: network.nodes.filter(n => n.status === 'warning').length,
    offline: network.nodes.filter(n => n.status === 'offline').length,
    connections: network.connections.length
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 控制面板 */}
      <GlassCard variant="tech" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
              <Globe className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text">3D网络宇宙</h2>
              <p className="text-gray-700 dark:text-white/70 text-sm">沉浸式网络拓扑可视化</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={isPlaying ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="glass rounded-lg p-3 border border-white/20">
            <div className="text-lg font-bold text-blue-400">{stats.total}</div>
            <div className="text-xs text-gray-600 dark:text-white/60">总节点</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/20">
            <div className="text-lg font-bold text-green-400">{stats.online}</div>
            <div className="text-xs text-gray-600 dark:text-white/60">在线</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/20">
            <div className="text-lg font-bold text-yellow-400">{stats.warning}</div>
            <div className="text-xs text-gray-600 dark:text-white/60">警告</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/20">
            <div className="text-lg font-bold text-red-400">{stats.offline}</div>
            <div className="text-xs text-gray-600 dark:text-white/60">离线</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/20">
            <div className="text-lg font-bold text-purple-400">{stats.connections}</div>
            <div className="text-xs text-gray-600 dark:text-white/60">连接</div>
          </div>
        </div>

        {/* 视图模式 */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700 dark:text-white/70">视图:</span>
          {[
            { key: '3d', label: '3D宇宙', icon: Globe },
            { key: 'network', label: '网络图', icon: Activity },
            { key: 'data', label: '数据流', icon: Zap }
          ].map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={viewMode === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(key as any)}
              className="text-xs"
            >
              <Icon className="h-3 w-3 mr-1" />
              {label}
            </Button>
          ))}
        </div>
      </GlassCard>

      {/* 3D画布 */}
      <GlassCard variant="gradient" className="p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-96 lg:h-[500px] rounded-lg cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
          
          {/* 操作提示 */}
          <div className="absolute top-4 right-4 glass rounded-lg p-3 border border-white/20">
            <div className="text-xs text-gray-700 dark:text-white/70 space-y-1">
              <div>🖱️ 拖拽旋转</div>
              <div>🔄 滚轮缩放</div>
              <div>⏯️ 空格暂停</div>
            </div>
          </div>
          
          {/* 性能统计 */}
          <div className="absolute bottom-4 left-4 glass rounded-lg p-3 border border-white/20">
            <div className="text-xs text-gray-700 dark:text-white/70">
              <div>缩放: {Math.round(zoom)}%</div>
              <div>节点: {network.nodes.length}</div>
              <div>连接: {network.connections.length}</div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};