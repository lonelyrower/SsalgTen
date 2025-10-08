import { memo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Globe, Server, Building, Shield } from 'lucide-react';

interface StatsCardsProps {
  totalNodes?: number;
  onlineNodes?: number;
  totalCountries?: number;
  totalProviders?: number;
  securityEvents?: number;
}

const StatsCardsComponent = ({ 
  totalNodes = 0, 
  onlineNodes = 0, 
  totalCountries = 0, 
  totalProviders = 0,
  securityEvents = 0
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
      subtitle: '全球节点分布',
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
      title: '安全事件',
      value: securityEvents > 0 ? securityEvents.toLocaleString() : '0',
      subtitle: securityEvents > 0 ? '检测到威胁' : '系统安全',
      icon: <Shield className="h-6 w-6 text-orange-400" />,
      badge: securityEvents > 0 ? '警惕' : '正常',
      badgeVariant: securityEvents > 0 ? 'default' : 'outline' as const,
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
          animated={false} 
          glow={false}
          className="p-6 hover:border-white/30 transition-colors"
        >
          <div className="relative">
            {/* 简洁头部 - 只保留图标和标题 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-white/10">
                  {stat.icon}
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </h3>
              </div>
              
              {/* 只为安全事件保留动态徽章 */}
              {stat.title === '安全事件' && securityEvents > 0 && (
                <Badge 
                  variant="default" 
                  className="text-xs font-medium bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                >
                  {stat.badge}
                </Badge>
              )}
            </div>
            
            {/* 数值显示 - 简洁版 */}
            <div className="space-y-2">
              <div className="text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.subtitle}
              </div>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
};

export const StatsCards = memo(StatsCardsComponent);