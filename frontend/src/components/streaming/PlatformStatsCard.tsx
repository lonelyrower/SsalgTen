import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { StreamingPlatformStats } from '@/types/streaming';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface PlatformStatsCardProps {
  stats: StreamingPlatformStats;
  onClick?: () => void;
}

export const PlatformStatsCard: React.FC<PlatformStatsCardProps> = ({ stats, onClick }) => {
  const unlockPercentage = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;

  return (
    <Card
      className={`transition-all hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <span className="text-2xl">{stats.icon}</span>
            <span>{stats.name}</span>
          </span>
          <span className={`text-lg font-bold ${
            unlockPercentage >= 80 ? 'text-green-600 dark:text-green-400' :
            unlockPercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {unlockPercentage}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 进度条 */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              unlockPercentage >= 80 ? 'bg-green-600' :
              unlockPercentage >= 50 ? 'bg-yellow-600' :
              'bg-red-600'
            }`}
            style={{ width: `${unlockPercentage}%` }}
          />
        </div>

        {/* 统计详情 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-gray-600 dark:text-gray-400">解锁:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.unlocked}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-gray-600 dark:text-gray-400">受限:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.restricted}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">失败:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.failed}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">未测:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.unknown}</span>
          </div>
        </div>

        {/* 总计 */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">总节点数</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">{stats.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
