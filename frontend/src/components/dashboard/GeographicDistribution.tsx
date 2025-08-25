import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Globe, MapPin, Building2 } from 'lucide-react';
import { CountryFlag } from '@/components/ui/CountryFlag';
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
  const countryStats = useMemo(() => {
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

    return Array.from(countryMap.entries())
      .map(([country, stats]) => ({
        country,
        online: stats.online,
        offline: stats.offline,
        total: stats.total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // 取前10个国家
  }, [nodes]);

  // 计算服务商分布数据
  const providerStats = useMemo(() => {
    const providerMap = new Map<string, number>();
    
    nodes.forEach(node => {
      const provider = node.provider || 'Unknown';
      providerMap.set(provider, (providerMap.get(provider) || 0) + 1);
    });

    return Array.from(providerMap.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // 取前8个服务商
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
    <div className={`space-y-6 ${className}`}>
      {/* 国家分布 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Globe className="h-5 w-5 mr-2 text-blue-600" />
            国家/地区分布
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            覆盖 {countryStats.length} 个国家/地区
          </div>
        </div>

        {countryStats.length > 0 ? (
          <>
            {/* 柱状图 */}
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="country" 
                    fontSize={12}
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis fontSize={12} tick={{ fill: 'currentColor' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="online" stackId="a" fill="#22c55e" name="在线" />
                  <Bar dataKey="offline" stackId="a" fill="#ef4444" name="离线" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 国家列表 */}
            <div className="grid grid-cols-2 gap-3">
              {countryStats.slice(0, 6).map((item, index) => (
                <div key={item.country} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">#{index + 1}</span>
                    <CountryFlag country={item.country} size="sm" showName={false} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.country}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-green-600">{item.online}</span>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs text-red-600">{item.offline}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无地理分布数据</p>
            </div>
          </div>
        )}
      </div>

      {/* 服务商分布 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-purple-600" />
            服务商分布
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {providerStats.length} 个服务商
          </div>
        </div>

        {providerStats.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {providerStats.map((item, index) => (
              <div key={item.provider} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {item.provider}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-lg font-bold text-blue-600">{item.count}</div>
                  <div className="text-xs text-gray-500">节点</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无服务商数据</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};