import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { apiService } from '@/services/api';
import { Card } from '@/components/ui/card';

interface SshBruteforceEvent {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeCountry: string;
  ip: string;
  count: number;
  timestamp: Date;
}

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

export const ThreatMonitoringSummary: React.FC = () => {
  const [events, setEvents] = useState<SshBruteforceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityEvents();
    const interval = setInterval(fetchSecurityEvents, 60000); // 每分钟刷新
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityEvents = async () => {
    try {
      const response = await apiService.getGlobalActivities(50);
      if (response.success && response.data) {
        const sshEvents = response.data
          .filter((event: ActivityEvent) => event.type === 'SSH_BRUTEFORCE')
          .slice(0, 5) // 只取最近5条
          .map((event: ActivityEvent): SshBruteforceEvent => {
            const details = event.details as { ip?: string; count?: number } | undefined;
            return {
              id: event.id,
              nodeId: event.node?.id || '',
              nodeName: event.node?.name || 'Unknown',
              nodeCountry: event.node?.country || 'Unknown',
              ip: details?.ip || 'Unknown',
              count: details?.count || 0,
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

  const stats = {
    total: events.length,
    last24h: events.filter(e => new Date().getTime() - e.timestamp.getTime() < 86400000).length,
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            威胁监控
          </h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>暂无安全威胁事件</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              威胁监控摘要
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              最近的 SSH 暴力破解攻击
            </p>
          </div>
        </div>

        {/* 统计 */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.last24h}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              过去24小时
            </div>
          </div>
        </div>
      </div>

      {/* 事件列表 */}
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  来自 <span className="font-mono text-red-600 dark:text-red-400">{event.ip}</span> 的攻击
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  目标: {event.nodeName} ({event.nodeCountry}) · {event.count} 次失败尝试
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 ml-4">
              <Clock className="h-3 w-3" />
              <span>{formatTime(event.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 底部链接 */}
      {events.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href="/security"
            className="text-sm text-primary hover:underline inline-flex items-center"
          >
            查看完整威胁日志 →
          </a>
        </div>
      )}
    </Card>
  );
};
