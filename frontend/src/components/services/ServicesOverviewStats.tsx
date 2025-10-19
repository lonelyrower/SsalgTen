import React from 'react';
import type { ServicesOverviewStats as StatsType } from '@/types/services';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Server, Play, Square, AlertCircle } from 'lucide-react';

interface ServicesOverviewStatsProps {
  stats: StatsType;
}

export const ServicesOverviewStats: React.FC<ServicesOverviewStatsProps> = ({ stats }) => {

  const runningPercentage = stats.totalServices > 0
    ? Math.round((stats.runningServices / stats.totalServices) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            {stats.totalNodes}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.expiredNodes > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {stats.expiredNodes} 个数据过期
              </span>
            )}
            {stats.expiredNodes === 0 && '全部节点正常'}
          </p>
        </CardContent>
      </Card>

      {/* 总服务数 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Server className="h-4 w-4" />
            总服务数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalServices}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            已记录的服务
          </p>
        </CardContent>
      </Card>

      {/* 运行中 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Play className="h-4 w-4" />
            运行中
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {stats.runningServices}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {runningPercentage}% 在线
          </p>
        </CardContent>
      </Card>

      {/* 已停止 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Square className="h-4 w-4" />
            已停止
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
            {stats.stoppedServices}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            未运行的服务
          </p>
        </CardContent>
      </Card>

      {/* 失败 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            失败/异常
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${
            stats.failedServices === 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {stats.failedServices}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            需要关注
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
