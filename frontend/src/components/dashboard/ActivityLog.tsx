import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api';
import { 
  Activity, 
  Server, 
  User, 
  Settings, 
  AlertTriangle, 
  Clock,
  RefreshCw
} from 'lucide-react';

interface ActivityLogItem {
  id: string;
  type: string;
  message?: string;
  details?: any;
  timestamp: string;
  node: {
    id: string;
    name: string;
    city: string;
    country: string;
    status: string;
  };
  severity?: 'info' | 'warning' | 'error' | 'success';
}

interface ActivityLogProps {
  className?: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ className = '' }) => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'nodes' | 'users' | 'system'>('all');
  const [hasRealData, setHasRealData] = useState(false);

  // 加载活动数据
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await apiService.getGlobalActivities(50);
      if (response.success && response.data && response.data.length > 0) {
        // 转换数据格式并添加推断的严重程度
        const transformedActivities: ActivityLogItem[] = response.data.map((activity) => ({
          ...activity,
          severity: inferSeverity(activity.type),
        }));
        setActivities(transformedActivities);
        setHasRealData(true);
      } else {
        // 如果API返回空数据或失败，不显示任何活动
        setActivities([]);
        setHasRealData(false);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      setActivities([]);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  };

  // 根据事件类型推断严重程度
  const inferSeverity = (type: string): 'info' | 'warning' | 'error' | 'success' => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('online') || lowerType.includes('connected') || lowerType.includes('success')) {
      return 'success';
    }
    if (lowerType.includes('offline') || lowerType.includes('failed') || lowerType.includes('error')) {
      return 'error';
    }
    if (lowerType.includes('warning') || lowerType.includes('timeout') || lowerType.includes('changed')) {
      return 'warning';
    }
    return 'info';
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const getActivityIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('node') || lowerType.includes('agent') || lowerType.includes('heartbeat')) {
      return <Server className="h-4 w-4" />;
    }
    if (lowerType.includes('user') || lowerType.includes('login') || lowerType.includes('auth')) {
      return <User className="h-4 w-4" />;
    }
    if (lowerType.includes('config') || lowerType.includes('setting') || lowerType.includes('update')) {
      return <Settings className="h-4 w-4" />;
    }
    if (lowerType.includes('diagnostic') || lowerType.includes('test') || lowerType.includes('ping')) {
      return <Activity className="h-4 w-4" />;
    }
    if (lowerType.includes('alert') || lowerType.includes('warning') || lowerType.includes('error')) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
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
    const lowerType = activity.type.toLowerCase();
    if (filter === 'nodes') return lowerType.includes('node') || lowerType.includes('agent') || lowerType.includes('heartbeat') || lowerType.includes('diagnostic');
    if (filter === 'users') return lowerType.includes('user') || lowerType.includes('login') || lowerType.includes('auth');
    if (filter === 'system') return lowerType.includes('config') || lowerType.includes('system') || lowerType.includes('alert') || lowerType.includes('warning');
    return true;
  });

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
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
    fetchActivities();
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
            {!hasRealData ? (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-2">活动日志功能尚未配置</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  系统将在有实际活动数据时自动显示
                </p>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">暂无活动记录</p>
            )}
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
                          {activity.type} - {activity.node.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <time className="text-xs text-gray-500 dark:text-gray-400">
                            {formatRelativeTime(activity.timestamp)}
                          </time>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {activity.message || `${activity.node.city}, ${activity.node.country}`}
                      </p>
                      
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          <span className="font-medium">节点:</span>
                          <span className="ml-1">{activity.node.name}</span>
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          <span className="font-medium">位置:</span>
                          <span className="ml-1">{activity.node.city}, {activity.node.country}</span>
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          activity.node.status.toLowerCase() === 'online' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          <span className="font-medium">状态:</span>
                          <span className="ml-1">{activity.node.status}</span>
                        </span>
                        {activity.details && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            <span className="font-medium">详情:</span>
                            <span className="ml-1">{JSON.stringify(activity.details).substring(0, 50)}...</span>
                          </span>
                        )}
                      </div>
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
