import React from 'react';
import type { NodeServicesOverview } from '@/types/services';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CountryFlag } from '../ui/CountryFlag';
import { Badge } from '../ui/badge';
import { Server, Play, Square, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface NodeServicesViewProps {
  nodeOverviews: NodeServicesOverview[];
  onNodeClick?: (nodeId: string) => void;
}

export const NodeServicesView: React.FC<NodeServicesViewProps> = ({ nodeOverviews, onNodeClick }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {nodeOverviews.map((overview) => (
        <NodeServiceCard
          key={overview.nodeId}
          overview={overview}
          onClick={() => onNodeClick?.(overview.nodeId)}
        />
      ))}
    </div>
  );
};

interface NodeServiceCardProps {
  overview: NodeServicesOverview;
  onClick?: () => void;
}

const NodeServiceCard: React.FC<NodeServiceCardProps> = ({ overview, onClick }) => {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(overview.lastReported), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return '未知';
    }
  })();

  const runningPercentage = overview.totalServices > 0
    ? Math.round((overview.runningServices / overview.totalServices) * 100)
    : 0;

  return (
    <Card
      className={`hover:shadow-lg transition-all ${onClick ? 'cursor-pointer' : ''} ${
        overview.isExpired ? 'border-l-4 border-l-yellow-500' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overview.nodeCountry && (
              <CountryFlag country={overview.nodeCountry} size="md" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {overview.nodeName}
                </h3>
                {onClick && <ExternalLink className="h-4 w-4 text-gray-400" />}
              </div>
              {overview.nodeCity && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {overview.nodeCity}, {overview.nodeCountry}
                </p>
              )}
            </div>
          </div>

          {overview.isExpired && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>过期</span>
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 服务统计 */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Server className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {overview.totalServices}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">总服务</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {overview.runningServices}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">运行中</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Square className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {overview.stoppedServices}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">已停止</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {overview.failedServices}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">失败</div>
          </div>
        </div>

        {/* 运行率进度条 */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">服务运行率</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {runningPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                runningPercentage >= 90 ? 'bg-green-600' :
                runningPercentage >= 70 ? 'bg-yellow-600' :
                'bg-red-600'
              }`}
              style={{ width: `${runningPercentage}%` }}
            />
          </div>
        </div>

        {/* 重要服务列表 */}
        {overview.services.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              服务列表 (前5个):
            </div>
            <div className="space-y-1">
              {overview.services.slice(0, 5).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="truncate flex-1 text-gray-900 dark:text-gray-100">
                    {service.name}
                  </span>
                  <Badge
                    variant={service.status === 'running' ? 'default' : 'outline'}
                    className="text-xs ml-2"
                  >
                    {service.status}
                  </Badge>
                </div>
              ))}
              {overview.services.length > 5 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                  还有 {overview.services.length - 5} 个服务...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 最后上报时间 */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          <span>最后上报: {timeAgo}</span>
        </div>
      </CardContent>
    </Card>
  );
};
