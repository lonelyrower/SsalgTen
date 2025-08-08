import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Server, 
  User, 
  Settings, 
  AlertTriangle, 
  Clock,
  RefreshCw,
  MoreVertical
} from 'lucide-react';

interface ActivityLogItem {
  id: string;
  type: 'node_online' | 'node_offline' | 'user_login' | 'config_change' | 'diagnostic_run' | 'system_alert';
  title: string;
  description: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}

interface ActivityLogProps {
  className?: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ className = '' }) => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'nodes' | 'users' | 'system'>('all');

  // 模拟活动数据
  useEffect(() => {
    const mockActivities: ActivityLogItem[] = [
      {
        id: '1',
        type: 'node_online',
        title: 'New York Node 上线',
        description: 'Agent 30c0914f 成功连接并开始心跳监控',
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2分钟前
        severity: 'success',
        metadata: { nodeId: '30c0914f', location: 'New York, US' }
      },
      {
        id: '2',
        type: 'diagnostic_run',
        title: '网络诊断完成',
        description: 'ping 测试成功完成，目标: google.com',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5分钟前
        severity: 'info',
        metadata: { target: 'google.com', latency: '15ms' }
      },
      {
        id: '3',
        type: 'user_login',
        title: '管理员登录',
        description: '用户 admin 从 192.168.1.100 成功登录',
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10分钟前
        severity: 'info',
        metadata: { username: 'admin', ip: '192.168.1.100' }
      },
      {
        id: '4',
        type: 'config_change',
        title: '系统配置更新',
        description: 'heartbeat_interval 配置从 30000 更改为 25000',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15分钟前
        severity: 'warning',
        metadata: { config: 'heartbeat_interval', oldValue: '30000', newValue: '25000' }
      },
      {
        id: '5',
        type: 'node_offline',
        title: 'London Node 离线',
        description: 'Agent 6749d98b 心跳超时，已标记为离线',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
        severity: 'error',
        metadata: { nodeId: '6749d98b', location: 'London, UK' }
      },
      {
        id: '6',
        type: 'system_alert',
        title: '系统性能警告',
        description: 'CPU 使用率超过 80%，建议检查系统负载',
        timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45分钟前
        severity: 'warning',
        metadata: { cpuUsage: '85%', threshold: '80%' }
      }
    ];

    setActivities(mockActivities);
  }, []);

  const getActivityIcon = (type: ActivityLogItem['type']) => {
    switch (type) {
      case 'node_online':
      case 'node_offline':
        return <Server className="h-4 w-4" />;
      case 'user_login':
        return <User className="h-4 w-4" />;
      case 'config_change':
        return <Settings className="h-4 w-4" />;
      case 'diagnostic_run':
        return <Activity className="h-4 w-4" />;
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getSeverityClasses = (severity: ActivityLogItem['severity']) => {
    switch (severity) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: 'text-green-600 dark:text-green-400',
          text: 'text-green-800 dark:text-green-200'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          text: 'text-yellow-800 dark:text-yellow-200'
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          text: 'text-red-800 dark:text-red-200'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'nodes') return ['node_online', 'node_offline', 'diagnostic_run'].includes(activity.type);
    if (filter === 'users') return activity.type === 'user_login';
    if (filter === 'system') return ['config_change', 'system_alert'].includes(activity.type);
    return true;
  });

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const handleRefresh = () => {
    setLoading(true);
    // 模拟刷新
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <Card className={`bg-white dark:bg-gray-800 shadow-lg ${className}`}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              实时活动
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              系统最新活动和事件日志
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部</option>
              <option value="nodes">节点</option>
              <option value="users">用户</option>
              <option value="system">系统</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">刷新</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无活动记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredActivities.map((activity, index) => {
              const severityClasses = getSeverityClasses(activity.severity);
              const icon = getActivityIcon(activity.type);
              
              return (
                <div 
                  key={activity.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${severityClasses.bg} ${severityClasses.border} border`}>
                      <div className={severityClasses.icon}>
                        {icon}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          <time className="text-xs text-gray-500 dark:text-gray-400">
                            {formatRelativeTime(activity.timestamp)}
                          </time>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {activity.description}
                      </p>
                      
                      {activity.metadata && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(activity.metadata).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            >
                              <span className="font-medium">{key}:</span>
                              <span className="ml-1">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {filteredActivities.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>显示 {filteredActivities.length} 条活动</span>
            <Button variant="ghost" size="sm" className="text-xs">
              查看全部 →
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};