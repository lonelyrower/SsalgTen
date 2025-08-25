import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Server } from 'lucide-react';

interface NodeStatusChartProps {
  onlineNodes: number;
  offlineNodes: number;
  className?: string;
}

export const NodeStatusChart: React.FC<NodeStatusChartProps> = ({
  onlineNodes,
  offlineNodes,
  className = ''
}) => {
  const data = [
    { name: '在线节点', value: onlineNodes, color: '#22c55e' },
    { name: '离线节点', value: offlineNodes, color: '#ef4444' }
  ];

  const total = onlineNodes + offlineNodes;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            数量: {data.value} ({total > 0 ? Math.round((data.value / total) * 100) : 0}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          节点状态分布
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          总计: {total} 个节点
        </div>
      </div>

      {total > 0 ? (
        <div className="flex items-center space-x-6">
          {/* 饼图 */}
          <div className="flex-shrink-0" style={{ width: '200px', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 图例和统计 */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">在线节点</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">{onlineNodes}</div>
                  <div className="text-xs text-green-600">
                    {total > 0 ? Math.round((onlineNodes / total) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">离线节点</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-600">{offlineNodes}</div>
                  <div className="text-xs text-red-600">
                    {total > 0 ? Math.round((offlineNodes / total) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* 可用率指示器 */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">系统可用率</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {total > 0 ? Math.round((onlineNodes / total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (onlineNodes / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无节点数据</p>
          </div>
        </div>
      )}
    </div>
  );
};