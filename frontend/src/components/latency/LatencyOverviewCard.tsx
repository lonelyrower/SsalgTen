import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useClientLatency } from '@/hooks/useClientLatency';
import { 
  Activity, 
  Wifi, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Globe,
  Loader2
} from 'lucide-react';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';

interface LatencyOverviewCardProps {
  className?: string;
}

export const LatencyOverviewCard: React.FC<LatencyOverviewCardProps> = ({ 
  className = '' 
}) => {
  const { 
    isLoading,
    isTestingInProgress,
    stats,
    error,
    lastUpdated,
    startLatencyTest,
    refreshResults,
    getTestProgress
  } = useClientLatency();

  const progress = getTestProgress();

  // 格式化时间显示
  const formatLastUpdate = (timestamp: string | null) => {
    if (!timestamp) return '未测试';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 获取延迟等级的颜色和图标
  const getLatencyLevel = (average: number) => {
    if (average < 50) return { 
      color: 'text-green-600', 
      bg: 'bg-green-100 dark:bg-green-900/20',
      level: '优秀', 
      icon: <TrendingDown className="h-4 w-4" />
    };
    if (average < 100) return { 
      color: 'text-yellow-600', 
      bg: 'bg-yellow-100 dark:bg-yellow-900/20',
      level: '良好', 
      icon: <Activity className="h-4 w-4" />
    };
    if (average < 200) return { 
      color: 'text-orange-600', 
      bg: 'bg-orange-100 dark:bg-orange-900/20',
      level: '一般', 
      icon: <TrendingUp className="h-4 w-4" />
    };
    return { 
      color: 'text-red-600', 
      bg: 'bg-red-100 dark:bg-red-900/20',
      level: '需要关注', 
      icon: <TrendingUp className="h-4 w-4" />
    };
  };

  return (
    <Card className={`p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Wifi className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              连通性概览
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              到您的延迟统计
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {!isTestingInProgress && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stats ? refreshResults : startLatencyTest}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          
          <Button
            size="sm"
            onClick={startLatencyTest}
            disabled={isLoading || isTestingInProgress}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isTestingInProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                测试中
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                {stats ? '重新测试' : '开始测试'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 错误状态 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
            <Activity className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* 测试进度 */}
      {isTestingInProgress && progress.total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              测试进度: {progress.completed} / {progress.total}
            </span>
            <span className="text-sm font-medium text-blue-600">
              {progress.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 统计数据 */}
      {stats && stats.tested > 0 ? (
        <div className="space-y-4">
          {/* 主要指标 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.average}ms
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">平均延迟</div>
              {stats.average > 0 && (
                <div className={`inline-flex items-center mt-1 px-2 py-1 rounded-full text-xs ${getLatencyLevel(stats.average).bg} ${getLatencyLevel(stats.average).color}`}>
                  {getLatencyLevel(stats.average).icon}
                  <span className="ml-1">{getLatencyLevel(stats.average).level}</span>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 mb-1">
                {stats.min}ms
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">最佳延迟</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 mb-1">
                {stats.max}ms
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">最高延迟</div>
            </div>
          </div>

          {/* 延迟分布 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                延迟分布
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {stats.tested} / {stats.total} 个节点
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {stats.distribution.map((dist, index) => (
                <div key={index} className="text-center">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {dist.count}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {dist.range}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 最佳节点 */}
          {stats.bestNodes && stats.bestNodes.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  最佳节点
                </span>
              </div>
              
              <div className="space-y-1">
                {stats.bestNodes.slice(0, 3).map((node, index) => (
                  <div key={node.nodeId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {node.nodeName}
                      </span>
                      <span className="text-gray-500 dark:text-gray-500 text-xs flex items-center space-x-1">
                        <CountryFlagSvg country={node.country} size={14} />
                        <span>{node.location || `${node.city}, ${node.country}`}</span>
                      </span>
                    </div>
                    <span className="font-medium text-green-600">
                      {node.latency}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最后更新时间 */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3" />
              <span>最后更新: {formatLastUpdate(lastUpdated)}</span>
            </div>
          </div>
        </div>
      ) : (
        // 空状态
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wifi className="h-8 w-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            尚未进行延迟测试
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            开始测试以查看您到各个节点的连通性情况
          </p>
        </div>
      )}
    </Card>
  );
};
