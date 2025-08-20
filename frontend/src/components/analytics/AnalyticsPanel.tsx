import { memo, useState } from 'react';
import { NetworkMetricsChart } from '@/components/charts/NetworkMetricsChart';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Activity, 
  Globe, 
  Zap,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';

interface AnalyticsPanelProps {
  className?: string;
}

export const AnalyticsPanel = memo(({ className = '' }: AnalyticsPanelProps) => {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [refreshing, setRefreshing] = useState(false);

  // 模拟刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  // 关键指标数据
  const keyMetrics = [
    {
      label: '平均延迟',
      value: '14.2ms',
      change: -8.5,
      icon: Activity,
      color: 'blue',
      description: '相比上小时'
    },
    {
      label: '网络吞吐量',
      value: '1.2Gbps',
      change: 12.3,
      icon: Zap,
      color: 'green',
      description: '峰值流量'
    },
    {
      label: '系统可用性',
      value: '99.97%',
      change: 0.02,
      icon: CheckCircle,
      color: 'emerald',
      description: '本月平均'
    },
    {
      label: '故障次数',
      value: '2',
      change: -33.3,
      icon: AlertTriangle,
      color: 'red',
      description: '相比上周'
    }
  ];

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? 
      <TrendingUp className="h-3 w-3" /> : 
      <TrendingUp className="h-3 w-3 rotate-180" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 控制面板 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">数据分析面板</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            实时网络监控数据分析和趋势预测
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 时间范围选择 */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {keyMetrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <GlassCard key={index} className="p-6" animated>
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl bg-${metric.color}-50 dark:bg-${metric.color}-900/20`}>
                  <IconComponent className={`h-6 w-6 text-${metric.color}-600`} />
                </div>
                <div className={`flex items-center space-x-1 text-sm ${getChangeColor(metric.change)}`}>
                  {getChangeIcon(metric.change)}
                  <span className="font-medium">
                    {Math.abs(metric.change)}%
                  </span>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metric.value}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {metric.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  {metric.description}
                </p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* 主要图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 延迟趋势图 */}
        <div className="lg:col-span-2">
          <NetworkMetricsChart
            type="area"
            title="网络延迟趋势"
            metric="latency"
            timeRange={timeRange}
            height={320}
          />
        </div>

        {/* 节点状态分布 */}
        <div>
          <NetworkMetricsChart
            type="pie"
            title="节点状态分布"
            metric="status"
            height={320}
          />
        </div>
      </div>

      {/* 次要图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 吞吐量图表 */}
        <NetworkMetricsChart
          type="line"
          title="网络吞吐量"
          metric="throughput"
          timeRange={timeRange}
          height={280}
        />

        {/* 地理分布图表 */}
        <NetworkMetricsChart
          type="bar"
          title="地理分布"
          metric="nodes"
          height={280}
        />
      </div>

      {/* 详细性能指标 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <NetworkMetricsChart
          type="line"
          title="CPU 使用率"
          metric="cpu_usage"
          timeRange={timeRange}
          height={240}
        />

        <NetworkMetricsChart
          type="line"
          title="内存使用率"
          metric="memory_usage"
          timeRange={timeRange}
          height={240}
        />

        <NetworkMetricsChart
          type="area"
          title="系统可用性"
          metric="uptime"
          timeRange={timeRange}
          height={240}
        />
      </div>

      {/* 实时状态栏 */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                实时监控已启用
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              最后更新: {new Date().toLocaleTimeString()}
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Server className="h-3 w-3" />
              <span>52 节点在线</span>
            </Badge>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Globe className="h-3 w-3" />
              <span>15 个国家</span>
            </Badge>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>99.97% 可用性</span>
            </Badge>
          </div>
        </div>
      </GlassCard>
    </div>
  );
});

AnalyticsPanel.displayName = 'AnalyticsPanel';