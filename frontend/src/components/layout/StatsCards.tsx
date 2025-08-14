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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {stat.icon}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </span>
            </div>
            <Badge variant={stat.badgeVariant as any} className="text-xs">
              {stat.badge}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stat.subtitle}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};