import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Users,
  TrendingUp,
  MapPin,
  Server,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Activity,
  Eye
} from 'lucide-react';

interface VisitorStats {
  totalVisitors: number;
  uniqueIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  topASNs: Array<{ asn: string; count: number }>;
  recentVisitors: Array<{
    ip: string;
    country?: string;
    city?: string;
    asnName?: string;
    userAgent: string;
    timestamp: string;
    path: string;
  }>;
}

interface CacheStats {
  size: number;
  ttl: number;
}

export const VisitorStatsCard: React.FC = () => {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      
      const [visitorRes, cacheRes] = await Promise.all([
        apiService.getVisitorStats(7), // 获取7天的统计数据
        apiService.getVisitorCacheStats()
      ]);

      if (visitorRes.success && visitorRes.data) {
        setStats(visitorRes.data);
      }

      if (cacheRes.success && cacheRes.data) {
        setCacheStats(cacheRes.data);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch visitor stats:', err);
      setError('网络错误，无法获取访问统计');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('确定要清空访问者缓存吗？这将影响IP信息查询的响应速度。')) {
      return;
    }

    try {
      setClearing(true);
      setError(null);
      setSuccess(null);

      const response = await apiService.clearVisitorCache();
      
      if (response.success) {
        setSuccess('缓存清理成功');
        await fetchStats(); // 重新获取统计数据
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || '缓存清理失败');
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
      setError('缓存清理失败');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // 每10分钟自动刷新
    const interval = setInterval(fetchStats, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // 计算百分比
  const calculatePercentage = (count: number, total: number) => {
    return total > 0 ? ((count / total) * 100).toFixed(1) : '0';
  };

  // 处理国家数据
  const enrichedCountries = stats?.topCountries.map(country => ({
    ...country,
    percentage: parseFloat(calculatePercentage(country.count, stats.totalVisitors))
  })) || [];

  // 处理ASN数据
  const enrichedASNs = stats?.topASNs.map(asn => ({
    ...asn,
    org: asn.asn, // 暂时使用ASN号作为组织名
    percentage: parseFloat(calculatePercentage(asn.count, stats.totalVisitors))
  })) || [];

  return (
    <div className="space-y-6">
      {/* 状态消息 */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </Card>
      )}

      {success && (
        <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        </Card>
      )}

      {/* 主要访问统计卡片 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Eye className="h-5 w-5 mr-2 text-blue-600" />
              访问统计 (近7天)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              访问者行为分析和地理分布统计
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {lastUpdate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Button onClick={fetchStats} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新
            </Button>
          </div>
        </div>

        {/* 访问量概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {stats?.totalVisitors.toLocaleString()}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">总访问量</div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              独立IP {stats?.uniqueIPs.toLocaleString()}
            </div>
          </div>

          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {stats?.recentVisitors.length || 0}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">最近访问</div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              活跃用户
            </div>
          </div>

          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <Activity className="h-8 w-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {enrichedCountries.length}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">覆盖国家</div>
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              ASN: {enrichedASNs.length}
            </div>
          </div>
        </div>

        {/* Top 国家和 ASN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 国家 */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-green-600" />
              Top 国家
            </h4>
            <div className="space-y-2">
              {enrichedCountries.slice(0, 5).map((country, index) => (
                <div key={country.country} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {country.country}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {country.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {country.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top ASN */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Server className="h-4 w-4 mr-2 text-purple-600" />
              Top ASN
            </h4>
            <div className="space-y-2">
              {enrichedASNs.slice(0, 5).map((asn, index) => (
                <div key={asn.asn} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {asn.asn}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {asn.org}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {asn.count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {asn.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 最近访问者 */}
      {stats?.recentVisitors && stats.recentVisitors.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-purple-600" />
            最近访问者
          </h3>
          <div className="overflow-x-auto">
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-400">IP地址</th>
                    <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-400">位置</th>
                    <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-400">ASN</th>
                    <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-400">访问页面</th>
                    <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-400">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.recentVisitors.slice(0, 10).map((visitor, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="p-2 font-mono text-blue-600 dark:text-blue-400">{visitor.ip}</td>
                      <td className="p-2">
                        {visitor.country && (
                          <span>{visitor.city ? `${visitor.city}, ` : ''}{visitor.country}</span>
                        ) || '-'}
                      </td>
                      <td className="p-2 text-xs">{visitor.asnName || '-'}</td>
                      <td className="p-2 text-xs font-mono">{visitor.path}</td>
                      <td className="p-2 text-xs text-gray-500">
                        {new Date(visitor.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* 缓存管理卡片 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Globe className="h-5 w-5 mr-2 text-indigo-600" />
              缓存管理
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              IP地理位置和ASN信息缓存统计
            </p>
          </div>
          <Button 
            onClick={handleClearCache} 
            disabled={clearing}
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
          >
            {clearing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                清理中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                清空缓存
              </>
            )}
          </Button>
        </div>

        {cacheStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">缓存条目数</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {cacheStats.size.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Globe className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">缓存TTL</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {Math.floor(cacheStats.ttl / 3600)}小时
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <Activity className="h-4 w-4 inline mr-1" />
              缓存统计：共缓存 {cacheStats?.size || 0} 条IP地理位置信息，TTL设置为 {cacheStats ? Math.floor(cacheStats.ttl / 3600) : 0} 小时。
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              注意：清空缓存后，IP地理位置查询将需要重新从第三方服务获取，可能影响响应速度。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};