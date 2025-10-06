import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Clock, MapPin } from 'lucide-react';

// SSH 暴力破解事件类型
interface SshBruteforceEvent {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeCountry: string;
  ip: string;
  count: number;
  windowMinutes: number;
  timestamp: Date;
}

// 活动日志类型
interface ActivityEvent {
  id: string;
  type: string;
  message?: string;
  details?: unknown;
  node?: {
    id: string;
    name: string;
    country: string;
  };
  timestamp: string;
}

export const ThreatVisualization: React.FC = () => {
  const [events, setEvents] = useState<SshBruteforceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityEvents();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchSecurityEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityEvents = async () => {
    try {
      const response = await apiService.getGlobalActivities(100);
      if (response.success && response.data) {
        // 过滤出 SSH 暴力破解事件
        const sshEvents = response.data
          .filter((event: ActivityEvent) => event.type === 'SSH_BRUTEFORCE')
          .map((event: ActivityEvent): SshBruteforceEvent => {
            const details = event.details as { ip?: string; count?: number; windowMinutes?: number } | undefined;
            return {
              id: event.id,
              nodeId: event.node?.id || '',
              nodeName: event.node?.name || 'Unknown',
              nodeCountry: event.node?.country || 'Unknown',
              ip: details?.ip || 'Unknown',
              count: details?.count || 0,
              windowMinutes: details?.windowMinutes || 10,
              timestamp: new Date(event.timestamp),
            };
          });

        setEvents(sshEvents);
      }
    } catch (error) {
      console.error('Failed to fetch security events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  // 统计数据
  const stats = {
    total: events.length,
    last24h: events.filter(e => new Date().getTime() - e.timestamp.getTime() < 86400000).length,
    uniqueIps: new Set(events.map(e => e.ip)).size,
    affectedNodes: new Set(events.map(e => e.nodeId)).size,
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          威胁监控
        </h1>
        <p className="mt-2 text-gray-400">
          实时监控 SSH 暴力破解攻击
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">总攻击次数</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">24小时内</p>
              <p className="text-2xl font-bold text-white">{stats.last24h}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
              <MapPin className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">攻击 IP 数</p>
              <p className="text-2xl font-bold text-white">{stats.uniqueIps}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">受影响节点</p>
              <p className="text-2xl font-bold text-white">{stats.affectedNodes}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 事件列表 */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-bold text-white mb-4">SSH 暴力破解事件</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">加载中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">暂无安全威胁</p>
            <p className="text-sm text-gray-500 mt-2">系统运行正常</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        SSH 暴力破解
                      </Badge>
                      <span className="text-sm text-gray-400">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">攻击 IP</p>
                        <p className="text-sm text-white font-mono">{event.ip}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">失败次数</p>
                        <p className="text-sm text-white">
                          {event.count} 次 / {event.windowMinutes} 分钟
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">目标节点</p>
                        <p className="text-sm text-white">
                          {event.nodeName}
                          <span className="ml-2 text-xs text-gray-400">({event.nodeCountry})</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* 说明 */}
      <GlassCard className="p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-300 mb-1">关于 SSH 暴力破解检测</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              系统自动监控 SSH 登录失败尝试。当检测到短时间内多次失败登录（默认：10分钟内5次），
              会记录攻击来源 IP 并生成告警。建议：
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-400 list-disc list-inside">
              <li>禁用 root 密码登录，改用 SSH 密钥认证</li>
              <li>修改 SSH 默认端口（22）</li>
              <li>使用 fail2ban 等工具自动封禁攻击 IP</li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
