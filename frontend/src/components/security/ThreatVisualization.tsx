import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  AlertTriangle, 
  Zap, 
  Eye, 
  Target, 
  Activity,
  TrendingUp,
  Clock,
  MapPin,
  Wifi
} from 'lucide-react';

// 模拟威胁数据类型
interface ThreatData {
  id: string;
  type: 'ddos' | 'bruteforce' | 'malware' | 'intrusion' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceIp: string;
  targetNode: string;
  country: string;
  timestamp: Date;
  status: 'active' | 'blocked' | 'investigating';
  attackVector: string;
  volume?: number;
}

// 模拟实时威胁数据生成
const generateThreatData = (): ThreatData[] => {
  const threatTypes: ThreatData['type'][] = ['ddos', 'bruteforce', 'malware', 'intrusion', 'anomaly'];
  const severities: ThreatData['severity'][] = ['low', 'medium', 'high', 'critical'];
  const countries = ['CN', 'US', 'RU', 'KR', 'JP', 'DE', 'UK', 'FR'];
  const attackVectors = ['HTTP Flood', 'SSH Brute Force', 'Malicious Payload', 'Port Scan', 'Traffic Anomaly'];
  
  const threats: ThreatData[] = [];
  const threatCount = Math.floor(Math.random() * 15) + 5; // 5-20 威胁
  
  for (let i = 0; i < threatCount; i++) {
    threats.push({
      id: `threat-${Date.now()}-${i}`,
      type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      sourceIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      targetNode: `Node-${Math.floor(Math.random() * 100) + 1}`,
      country: countries[Math.floor(Math.random() * countries.length)],
      timestamp: new Date(Date.now() - Math.random() * 3600000), // 过去1小时内
      status: Math.random() > 0.7 ? 'blocked' : Math.random() > 0.5 ? 'investigating' : 'active',
      attackVector: attackVectors[Math.floor(Math.random() * attackVectors.length)],
      volume: Math.floor(Math.random() * 10000) + 100
    });
  }
  
  return threats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

// 威胁类型配置
const getThreatConfig = (type: ThreatData['type']) => {
  const configs = {
    ddos: {
      name: 'DDoS攻击',
      icon: Zap,
      color: 'from-red-500 to-orange-500',
      bgColor: 'from-red-500/10 to-orange-500/10',
      description: '分布式拒绝服务攻击'
    },
    bruteforce: {
      name: '暴力破解',
      icon: Target,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-500/10 to-pink-500/10',
      description: '密码暴力破解尝试'
    },
    malware: {
      name: '恶意软件',
      icon: Shield,
      color: 'from-orange-500 to-red-500',
      bgColor: 'from-orange-500/10 to-red-500/10',
      description: '恶意代码检测'
    },
    intrusion: {
      name: '入侵检测',
      icon: Eye,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-500/10 to-cyan-500/10',
      description: '系统入侵尝试'
    },
    anomaly: {
      name: '异常行为',
      icon: Activity,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'from-yellow-500/10 to-orange-500/10',
      description: '网络流量异常'
    }
  };
  return configs[type];
};

// 严重性配置
const getSeverityConfig = (severity: ThreatData['severity']) => {
  const configs = {
    low: { label: '低', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    medium: { label: '中', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    high: { label: '高', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    critical: { label: '严重', color: 'bg-red-500/20 text-red-300 border-red-500/30' }
  };
  return configs[severity];
};

// 状态配置
const getStatusConfig = (status: ThreatData['status']) => {
  const configs = {
    active: { label: '活跃', color: 'bg-red-500/20 text-red-300 border-red-500/30', pulse: true },
    blocked: { label: '已阻止', color: 'bg-green-500/20 text-green-300 border-green-500/30', pulse: false },
    investigating: { label: '调查中', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', pulse: false }
  };
  return configs[status];
};

interface ThreatVisualizationProps {
  className?: string;
}

export const ThreatVisualization: React.FC<ThreatVisualizationProps> = ({ className = '' }) => {
  const [threats, setThreats] = useState<ThreatData[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatData | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [filter, setFilter] = useState<'all' | ThreatData['type']>('all');

  // 实时数据更新
  useEffect(() => {
    const updateThreats = () => {
      try {
        setThreats(generateThreatData());
      } catch (error) {
        console.error('Failed to generate threat data:', error);
      }
    };
    
    // 初始加载
    updateThreats();
    
    // 实时更新 (每5秒)
    const interval = isLiveMode ? setInterval(updateThreats, 5000) : null;
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLiveMode]);

  // 统计信息
  const stats = useMemo(() => {
    const active = threats.filter(t => t.status === 'active').length;
    const critical = threats.filter(t => t.severity === 'critical').length;
    const blocked = threats.filter(t => t.status === 'blocked').length;
    const investigating = threats.filter(t => t.status === 'investigating').length;
    
    return { active, critical, blocked, investigating, total: threats.length };
  }, [threats]);

  // 过滤威胁
  const filteredThreats = useMemo(() => {
    if (filter === 'all') return threats;
    return threats.filter(t => t.type === filter);
  }, [threats, filter]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 威胁概览 */}
      <GlassCard variant="tech" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl">
              <Shield className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text">网络威胁监控</h2>
              <p className="text-gray-700 dark:text-white/70 text-sm">实时检测和分析网络安全威胁</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant={isLiveMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsLiveMode(!isLiveMode)}
              className="gradient-btn"
            >
              {isLiveMode ? (
                <>
                  <div className="status-indicator bg-green-400 mr-2" />
                  实时监控
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  暂停
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-400">{stats.active}</div>
                <div className="text-xs text-gray-600 dark:text-white/60">活跃威胁</div>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
          </div>
          
          <div className="glass rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-400">{stats.critical}</div>
                <div className="text-xs text-gray-600 dark:text-white/60">严重威胁</div>
              </div>
              <Zap className="h-6 w-6 text-orange-400" />
            </div>
          </div>
          
          <div className="glass rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.blocked}</div>
                <div className="text-xs text-gray-600 dark:text-white/60">已阻止</div>
              </div>
              <Shield className="h-6 w-6 text-green-400" />
            </div>
          </div>
          
          <div className="glass rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
                <div className="text-xs text-gray-600 dark:text-white/60">总检测数</div>
              </div>
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* 威胁类型过滤 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            全部 ({threats.length})
          </Button>
          {(['ddos', 'bruteforce', 'malware', 'intrusion', 'anomaly'] as const).map((type) => {
            const count = threats.filter(t => t.type === type).length;
            const config = getThreatConfig(type);
            return (
              <Button
                key={type}
                variant={filter === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(type)}
                className="text-xs"
              >
                {config.name} ({count})
              </Button>
            );
          })}
        </div>
      </GlassCard>

      {/* 威胁列表 */}
      <GlassCard variant="gradient" className="p-6">
        <h3 className="text-lg font-bold gradient-text mb-4">实时威胁动态</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredThreats.map((threat) => {
            const threatConfig = getThreatConfig(threat.type);
            const severityConfig = getSeverityConfig(threat.severity);
            const statusConfig = getStatusConfig(threat.status);
            const ThreatIcon = threatConfig.icon;
            
            return (
              <div
                key={threat.id}
                onClick={() => setSelectedThreat(threat)}
                className={`glass rounded-lg p-4 border border-white/20 cursor-pointer transition-all duration-300 hover:bg-white/10 group ${
                  selectedThreat?.id === threat.id ? 'ring-2 ring-blue-400/50' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${threatConfig.bgColor}`}>
                    <ThreatIcon className="h-5 w-5 text-gray-800 dark:text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">{threatConfig.name}</span>
                        <Badge className={`text-xs ${severityConfig.color} border`}>
                          {severityConfig.label}
                        </Badge>
                        <Badge className={`text-xs ${statusConfig.color} border ${statusConfig.pulse ? 'animate-pulse' : ''}`}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-600 dark:text-white/60">
                        {threat.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center space-x-1">
                        <Wifi className="h-3 w-3 text-cyan-400" />
                        <span className="text-gray-700 dark:text-white/70 font-mono text-xs">{threat.sourceIp}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="h-3 w-3 text-purple-400" />
                        <span className="text-gray-700 dark:text-white/70 text-xs">{threat.targetNode}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-green-400" />
                        <span className="text-gray-700 dark:text-white/70 text-xs">{threat.country}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="h-3 w-3 text-orange-400" />
                        <span className="text-gray-700 dark:text-white/70 text-xs">{threat.attackVector}</span>
                      </div>
                    </div>
                  </div>
                  
                  {threat.status === 'active' && (
                    <div className="status-indicator bg-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredThreats.length === 0 && (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-green-400 mx-auto mb-2" />
            <div className="text-gray-700 dark:text-white/70">暂无威胁检测</div>
            <div className="text-gray-500 dark:text-white/50 text-sm">系统运行安全</div>
          </div>
        )}
      </GlassCard>

      {/* 威胁详情面板 */}
      {selectedThreat && (
        <GlassCard variant="tech" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold gradient-text">威胁详情分析</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedThreat(null)}
              className="text-gray-600 dark:text-white/60 hover:text-gray-800 dark:hover:text-white"
            >
              ×
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">威胁类型</div>
                <div className="font-medium text-gray-900 dark:text-white">{getThreatConfig(selectedThreat.type).name}</div>
              </div>
              
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">攻击来源</div>
                <div className="font-mono text-gray-900 dark:text-white">{selectedThreat.sourceIp}</div>
              </div>
              
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">攻击目标</div>
                <div className="font-medium text-gray-900 dark:text-white">{selectedThreat.targetNode}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">严重等级</div>
                <div className="font-medium text-gray-900 dark:text-white">{getSeverityConfig(selectedThreat.severity).label}风险</div>
              </div>
              
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">检测时间</div>
                <div className="font-medium text-gray-900 dark:text-white">{selectedThreat.timestamp.toLocaleString()}</div>
              </div>
              
              <div className="glass rounded-lg p-4 border border-white/20">
                <div className="text-xs text-gray-600 dark:text-white/60 mb-1">处理状态</div>
                <div className="font-medium text-gray-900 dark:text-white">{getStatusConfig(selectedThreat.status).label}</div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};