import { memo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Globe, Server, Building, Activity, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
  totalNodes?: number;
  onlineNodes?: number;
  totalCountries?: number;
  totalProviders?: number;
  totalTests?: number;
}

const StatsCardsComponent = ({ 
  totalNodes = 0, 
  onlineNodes = 0, 
  totalCountries = 0, 
  totalProviders = 0,
  totalTests = 0
}: StatsCardsProps) => {
  const offlineNodes = totalNodes - onlineNodes;

  const stats = [
    {
      title: '网络节点',
      value: totalNodes.toString(),
      subtitle: `${onlineNodes} 在线 · ${offlineNodes} 离线`,
      icon: <Server className="h-6 w-6 text-blue-400" />,
      badge: '实时监控',
      badgeVariant: 'default',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/10 to-cyan-500/10'
    },
    {
      title: '全球覆盖',
      value: totalCountries.toString(),
      subtitle: '个国家和地区',
      icon: <Globe className="h-6 w-6 text-emerald-400" />,
      badge: '国际化',
      badgeVariant: 'secondary' as const,
      gradient: 'from-emerald-500 to-green-500',
      bgGradient: 'from-emerald-500/10 to-green-500/10'
    },
    {
      title: '服务提供商',
      value: totalProviders.toString(),
      subtitle: '多样化基础设施',
      icon: <Building className="h-6 w-6 text-purple-400" />,
      badge: '多元化',
      badgeVariant: 'outline' as const,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-500/10 to-pink-500/10'
    },
    {
      title: '网络检测',
      value: totalTests > 0 ? totalTests.toLocaleString() : '0',
      subtitle: totalTests > 0 ? '次检测完成' : '待启动检测',
      icon: <Activity className="h-6 w-6 text-orange-400" />,
      badge: totalTests > 0 ? '活跃' : '待机',
      badgeVariant: totalTests > 0 ? 'default' : 'outline' as const,
      gradient: 'from-orange-500 to-red-500',
      bgGradient: 'from-orange-500/10 to-red-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <GlassCard 
          key={index} 
          variant="tech" 
          animated={true} 
          glow={false}
          className="p-6 group cursor-pointer"
        >
          {/* 科技感背景效果 */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} rounded-xl`} />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>

          {/* 动态粒子效果 */}
          <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-white/60 rounded-full absolute -top-2 -right-1 animate-ping" />
          </div>
          
          <div className="relative z-20">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm border border-white/20">
                  {stat.icon}
                  {/* 图标发光效果 */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-1">
                    {stat.title}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <div className="status-indicator bg-green-400" />
                    <span className="text-xs text-gray-700 dark:text-white/60">ACTIVE</span>
                  </div>
                </div>
              </div>
              
              <Badge 
                variant={stat.badgeVariant as any} 
                className="text-xs font-medium backdrop-blur-sm bg-white/10 border-white/20 text-gray-900 dark:text-white/90"
              >
                {stat.badge}
              </Badge>
            </div>
            
            {/* 数值显示 */}
            <div className="space-y-3">
              <div className={`text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent drop-shadow-sm`}>
                {stat.value}
              </div>
              <div className="text-sm text-gray-700 dark:text-white/70 font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-green-400" />
                {stat.subtitle}
              </div>
            </div>

          </div>
          
          {/* 底部数据流效果 */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent data-flow" />
        </GlassCard>
      ))}
    </div>
  );
};

export const StatsCards = memo(StatsCardsComponent);