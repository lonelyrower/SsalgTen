import React from 'react';
import type { StreamingOverview } from '@/types/streaming';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Server, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface StreamingOverviewStatsProps {
  overview: StreamingOverview;
}

export const StreamingOverviewStats: React.FC<StreamingOverviewStatsProps> = ({ overview }) => {
  const formatTime = (isoString: string) => {
    try {
      return formatDistanceToNow(new Date(isoString), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return '未知';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 总节点数 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Server className="h-4 w-4" />
            总节点数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {overview.totalNodes}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            已配置的节点
          </p>
        </CardContent>
      </Card>

      {/* 全局解锁率 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            全局解锁率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${
            overview.globalUnlockRate >= 80 ? 'text-green-600 dark:text-green-400' :
            overview.globalUnlockRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {Math.round(overview.globalUnlockRate)}%
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            平均解锁成功率
          </p>
        </CardContent>
      </Card>

      {/* 最新检测时间 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            最新检测时间
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatTime(overview.lastScanTime)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(overview.lastScanTime).toLocaleString('zh-CN')}
          </p>
        </CardContent>
      </Card>

      {/* 过期节点 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            数据过期节点
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${
            overview.expiredNodes === 0 ? 'text-green-600 dark:text-green-400' :
            overview.expiredNodes <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {overview.expiredNodes}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            超过 24 小时未检测
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
