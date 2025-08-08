import { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';

interface NetworkMetricsChartProps {
  data?: any[];
  type: 'line' | 'area' | 'bar' | 'pie';
  title: string;
  metric: string;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  className?: string;
  height?: number;
}

// 颜色主题
const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  teal: '#14b8a6',
  pink: '#ec4899'
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.purple,
  COLORS.indigo
];

// 自定义Tooltip组件
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <GlassCard variant="strong" className="p-3 min-w-[150px]">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {entry.name}: <span className="font-semibold">{entry.value}</span>
                {entry.unit && <span className="text-gray-400 ml-1">{entry.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }
  return null;
};

// 生成模拟时间序列数据
const generateTimeSeriesData = (hours: number = 24) => {
  const data = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      timestamp: time.getTime(),
      latency: Math.round(10 + Math.random() * 30 + Math.sin(i / 4) * 10),
      throughput: Math.round(80 + Math.random() * 40 + Math.cos(i / 6) * 20),
      packet_loss: Math.max(0, Math.round(Math.random() * 5)),
      online_nodes: Math.round(45 + Math.random() * 10),
      cpu_usage: Math.round(20 + Math.random() * 60),
      memory_usage: Math.round(30 + Math.random() * 50),
      uptime: Math.round(95 + Math.random() * 5)
    });
  }
  
  return data;
};

// 生成饼图数据
const generatePieData = () => [
  { name: '在线', value: 42, color: COLORS.success },
  { name: '离线', value: 5, color: COLORS.danger },
  { name: '维护', value: 3, color: COLORS.warning },
  { name: '未知', value: 2, color: COLORS.purple }
];

// 地理分布数据
const generateGeoData = () => [
  { region: '亚洲', nodes: 18, performance: 95 },
  { region: '欧洲', nodes: 15, performance: 92 },
  { region: '北美', nodes: 12, performance: 98 },
  { region: '南美', nodes: 4, performance: 88 },
  { region: '非洲', nodes: 2, performance: 85 },
  { region: '大洋洲', nodes: 1, performance: 90 }
];

export const NetworkMetricsChart = memo(({
  data,
  type,
  title,
  metric,
  timeRange = '24h',
  className = '',
  height = 300
}: NetworkMetricsChartProps) => {
  const chartData = useMemo(() => {
    if (data) return data;
    
    switch (type) {
      case 'pie':
        return generatePieData();
      case 'bar':
        return generateGeoData();
      default:
        return generateTimeSeriesData(timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : 24);
    }
  }, [data, type, timeRange]);

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={metric} 
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: COLORS.primary, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey={metric} 
                stroke={COLORS.primary}
                fill={`${COLORS.primary}20`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="region" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="nodes" 
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={height / 3}
                fill="#8884d8"
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // 计算趋势
  const calculateTrend = () => {
    if (type === 'pie' || type === 'bar' || !chartData.length) return null;
    
    const recent = chartData.slice(-6);
    const earlier = chartData.slice(-12, -6);
    
    if (recent.length === 0 || earlier.length === 0) return null;
    
    const recentAvg = recent.reduce((sum, item) => sum + (item[metric] || 0), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, item) => sum + (item[metric] || 0), 0) / earlier.length;
    
    const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
    
    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(change).toFixed(1),
      isPositive: metric === 'throughput' || metric === 'uptime' || metric === 'online_nodes' ? change > 0 : change < 0
    };
  };

  const trend = calculateTrend();

  return (
    <GlassCard className={`p-6 ${className}`} animated>
      {/* 图表标题和控制 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            {type === 'pie' ? (
              <PieChartIcon className="h-5 w-5 text-blue-600" />
            ) : type === 'bar' ? (
              <BarChart3 className="h-5 w-5 text-blue-600" />
            ) : (
              <Activity className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {metric.replace('_', ' ')} · {timeRange}
            </p>
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center space-x-2">
            <Badge 
              variant={trend.isPositive ? 'default' : 'destructive'}
              className="flex items-center space-x-1"
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.percentage}%</span>
            </Badge>
          </div>
        )}
      </div>

      {/* 图表内容 */}
      <div className="w-full">
        {renderChart()}
      </div>

      {/* 时间范围选择器 */}
      {type !== 'pie' && (
        <div className="flex items-center justify-center space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {['1h', '24h', '7d', '30d'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              className="text-xs"
            >
              {range}
            </Button>
          ))}
        </div>
      )}
    </GlassCard>
  );
});

NetworkMetricsChart.displayName = 'NetworkMetricsChart';