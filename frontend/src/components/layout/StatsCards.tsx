import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Server, Building, MapPin } from 'lucide-react';

interface StatsCardsProps {
  totalNodes?: number;
  onlineNodes?: number;
  totalCountries?: number;
  totalProviders?: number;
  totalTests?: number;
}

export const StatsCards = ({ 
  totalNodes = 0, 
  onlineNodes = 0, 
  totalCountries = 0, 
  totalProviders = 0,
  totalTests = 0
}: StatsCardsProps) => {
  const uptime = totalNodes > 0 ? ((onlineNodes / totalNodes) * 100).toFixed(1) : '0';

  const stats = [
    {
      title: 'Total Nodes',
      value: totalNodes.toString(),
      subtitle: `${onlineNodes} online`,
      icon: <Server className="h-5 w-5 text-blue-500" />,
      badge: `${uptime}% uptime`,
      badgeVariant: parseFloat(uptime) > 90 ? 'default' : 'destructive'
    },
    {
      title: 'Countries',
      value: totalCountries.toString(),
      subtitle: 'Global coverage',
      icon: <Globe className="h-5 w-5 text-green-500" />,
      badge: 'Worldwide',
      badgeVariant: 'secondary' as const
    },
    {
      title: 'Providers',
      value: totalProviders.toString(),
      subtitle: 'Different hosts',
      icon: <Building className="h-5 w-5 text-purple-500" />,
      badge: 'Diverse',
      badgeVariant: 'outline' as const
    },
    {
      title: 'Network Tests',
      value: totalTests > 0 ? totalTests.toLocaleString() : '0',
      subtitle: totalTests > 0 ? 'Total performed' : 'No tests yet',
      icon: <MapPin className="h-5 w-5 text-orange-500" />,
      badge: totalTests > 0 ? 'Active' : 'Pending',
      badgeVariant: totalTests > 0 ? 'default' : 'outline' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 border-0 shadow-lg">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-24 h-24 opacity-10 transform translate-x-6 -translate-y-6">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20">
                  {stat.icon}
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {stat.title}
                </span>
              </div>
              <Badge variant={stat.badgeVariant as any} className="text-xs font-medium shadow-sm">
                {stat.badge}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                {stat.subtitle}
              </div>
            </div>
          </div>
          
          {/* 底部装饰线 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-60"></div>
        </Card>
      ))}
    </div>
  );
};