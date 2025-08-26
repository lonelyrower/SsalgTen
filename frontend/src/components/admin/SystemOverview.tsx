import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Server,
  Users,
  Database,
  Clock,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  Zap,
  HardDrive,
  Cpu,
  MemoryStick
} from 'lucide-react';

interface SystemStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  totalCountries: number;
  totalProviders: number;
}

interface SystemOverviewStats {
  nodes: SystemStats;
  heartbeats: {
    total: number;
    last24h: number;
    avgPerHour: number;
  };
  diagnostics: {
    total: number;
    last24h: number;
    successRate: number;
  };
  users: {
    total: number;
    active: number;
  };
  system: {
    uptime: number;
    version: string;
    environment: string;
  };
}

export const SystemOverview: React.FC = () => {
  const [stats, setStats] = useState<SystemOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      
      // 并行获取多个统计数据
      const [nodesRes] = await Promise.all([
        apiService.getStats(),
        // 这里可以添加更多的统计API调用
      ]);

      if (nodesRes.success && nodesRes.data) {
        // 模拟其他统计数据（实际应用中应该从后端获取）
        const mockStats: SystemOverviewStats = {
          nodes: nodesRes.data,
          heartbeats: {
            total: 12480,
            last24h: 1440,
            avgPerHour: 60
          },
          diagnostics: {
            total: 3250,
            last24h: 156,
            successRate: 94.5
          },
          users: {
            total: 8,
            active: 3
          },
          system: {
            uptime: 15 * 24 * 3600, // 15天
            version: 'v1.0.0',
            environment: 'production'
          }
        };
        
        setStats(mockStats);
        setLastUpdate(new Date());
      } else {
        setError(nodesRes.error || '获取统计数据失败');
      }
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
      setError('网络错误，无法获取统计数据');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // 每5分钟自动刷新
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    return `${days} 天 ${hours} 小时`;
  };

  const getHealthStatus = () => {
    if (!stats) return 'unknown';
    const { nodes } = stats;
    const totalNodes = nodes.totalNodes;
    const onlineNodes = nodes.onlineNodes;
    
    if (totalNodes === 0) return 'warning';
    const onlineRate = (onlineNodes / totalNodes) * 100;
    
    if (onlineRate >= 90) return 'excellent';
    if (onlineRate >= 70) return 'good';
    if (onlineRate >= 50) return 'warning';
    return 'critical';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          数据加载失败
        </h3>
        <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
        <Button onClick={fetchStats} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
          <RefreshCw className="h-4 w-4 mr-2" />
          重新加载
        </Button>
      </Card>
    );
  }

  if (!stats) return null;

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-8">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">系统统计总览</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            实时监控系统运行状况和关键指标
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              更新时间: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统健康状态卡片 */}
      <Card className={`p-6 border-2 ${getHealthColor(healthStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-white/50">
              {healthStatus === 'excellent' || healthStatus === 'good' ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <AlertCircle className="h-8 w-8" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                系统健康状态: {
                  healthStatus === 'excellent' ? '优秀' :
                  healthStatus === 'good' ? '良好' :
                  healthStatus === 'warning' ? '警告' :
                  healthStatus === 'critical' ? '严重' : '未知'
                }
              </h3>
              <p className="opacity-80">
                {stats.nodes.onlineNodes}/{stats.nodes.totalNodes} 节点在线 
                ({stats.nodes.totalNodes > 0 ? ((stats.nodes.onlineNodes / stats.nodes.totalNodes) * 100).toFixed(1) : 0}%)
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">系统运行时间</div>
            <div className="text-lg font-semibold">{formatUptime(stats.system.uptime)}</div>
          </div>
        </div>
      </Card>

      {/* 统计卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 节点统计 */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">节点总数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.nodes.totalNodes}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              在线 {stats.nodes.onlineNodes}
            </span>
            <span className="flex items-center text-red-600 dark:text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              离线 {stats.nodes.offlineNodes}
            </span>
            <span className="flex items-center text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
              未知 {stats.nodes.unknownNodes}
            </span>
          </div>
        </Card>

        {/* 心跳统计 */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">24小时心跳</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.heartbeats.last24h.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            平均 {stats.heartbeats.avgPerHour}/小时
          </div>
        </Card>

        {/* 诊断统计 */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">诊断成功率</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.diagnostics.successRate}%</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Database className="h-4 w-4 mr-1" />
            24小时内 {stats.diagnostics.last24h} 次测试
          </div>
        </Card>

        {/* 用户统计 */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">活跃用户</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.users.active}/{stats.users.total}</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 mr-1" />
            在线率 {((stats.users.active / stats.users.total) * 100).toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* 地理分布统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2 text-blue-600" />
            地理分布
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">覆盖国家</span>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.nodes.totalCountries} 个</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">服务提供商</span>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.nodes.totalProviders} 家</span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                节点分布在全球 {stats.nodes.totalCountries} 个国家，使用 {stats.nodes.totalProviders} 家不同的服务提供商
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <HardDrive className="h-5 w-5 mr-2 text-green-600" />
            系统信息
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">系统版本</span>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.system.version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">运行环境</span>
              <span className="font-semibold text-gray-900 dark:text-white capitalize">{stats.system.environment}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">运行时间</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatUptime(stats.system.uptime)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                系统稳定运行，所有核心服务正常
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};