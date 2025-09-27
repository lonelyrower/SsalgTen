import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Globe, MapPin } from 'lucide-react';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import type { NodeData } from '@/services/api';

interface GeographicDistributionProps {
  nodes: NodeData[];
  className?: string;
}

export const GeographicDistribution: React.FC<GeographicDistributionProps> = ({
  nodes,
  className = ''
}) => {
  // 计算国家分布数据
  const { countryStats, totalCountries } = useMemo(() => {
    const countryMap = new Map<string, { online: number; offline: number; total: number }>();
    
    nodes.forEach(node => {
      const country = node.country;
      const current = countryMap.get(country) || { online: 0, offline: 0, total: 0 };
      
      if (node.status.toLowerCase() === 'online') {
        current.online++;
      } else {
        current.offline++;
      }
      current.total++;
      
      countryMap.set(country, current);
    });

    const allCountryStats = Array.from(countryMap.entries())
      .map(([country, stats]) => ({
        country,
        online: stats.online,
        offline: stats.offline,
        total: stats.total
      }))
      .sort((a, b) => b.total - a.total);
    
    return {
      countryStats: allCountryStats.slice(0, 10), // 图表显示前10个国家
      totalCountries: allCountryStats.length // 实际覆盖的国家总数
    };
  }, [nodes]);


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Globe className="h-5 w-5 mr-2 text-blue-600" />
          国家/地区分布
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          覆盖 {totalCountries} 个国家/地区
        </div>
      </div>

      {countryStats.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 柱状图 */}
          <div className="flex-1 mb-4 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryStats} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="country"
                  fontSize={10}
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis fontSize={10} tick={{ fill: 'currentColor' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="online" stackId="a" fill="#22c55e" name="在线" />
                <Bar dataKey="offline" stackId="a" fill="#ef4444" name="离线" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 国家列表 - 使用滚动 */}
          <div className="flex-shrink-0 max-h-20 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {countryStats.slice(0, 4).map((item, index) => (
                <div key={item.country} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                  <div className="flex items-center space-x-1 min-w-0">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">#{index + 1}</span>
                    <CountryFlagSvg country={item.country} size={12} />
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {item.country}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <span className="text-xs text-green-600">{item.online}</span>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs text-red-600">{item.offline}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无地理分布数据</p>
          </div>
        </div>
      )}
    </div>
  );
};
