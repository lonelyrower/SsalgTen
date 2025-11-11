import { memo } from "react";
import { Globe, Server, Building, HardDrive } from "lucide-react";

interface StatsCardsProps {
  totalNodes?: number;
  onlineNodes?: number;
  totalCountries?: number;
  totalProviders?: number;
  totalTraffic?: {
    upload: number;
    download: number;
    total: number;
  };
}

// 格式化字节数为可读的单位
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const StatsCardsComponent = ({
  totalNodes = 0,
  onlineNodes = 0,
  totalCountries = 0,
  totalProviders = 0,
  totalTraffic,
}: StatsCardsProps) => {
  const offlineNodes = totalNodes - onlineNodes;

  // 计算流量数据
  const trafficTotal = totalTraffic?.total || 0;
  const trafficUpload = totalTraffic?.upload || 0;
  const trafficDownload = totalTraffic?.download || 0;

  const stats = [
    {
      title: "网络节点",
      value: totalNodes.toString(),
      subtitle: `${onlineNodes} 在线 · ${offlineNodes} 离线`,
      Icon: Server,
      badge: "实时监控",
      accent: {
        bg: "surface-base",
        border: "border-border",
        iconWrapper:
          "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border border-border",
        badge:
          "surface-base text-[hsl(var(--info))] border border-border",
        glow: "from-[hsl(var(--info))]/25 via-transparent to-[hsl(var(--info))]/20",
      },
    },
    {
      title: "全球覆盖",
      value: totalCountries.toString(),
      subtitle: "全球节点分布",
      Icon: Globe,
      badge: "国际化",
      accent: {
        bg: "surface-base",
        border: "border-border",
        iconWrapper:
          "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-border",
        badge:
          "surface-base text-[hsl(var(--success))] border border-border",
        glow: "from-[hsl(var(--success))]/25 via-transparent to-[hsl(var(--success))]/20",
      },
    },
    {
      title: "服务提供商",
      value: totalProviders.toString(),
      subtitle: "多样化基础设施",
      Icon: Building,
      badge: "多元化",
      accent: {
        bg: "surface-base",
        border: "border-border",
        iconWrapper:
          "bg-primary/15 text-primary border border-border",
        badge:
          "surface-base text-primary border border-border",
        glow: "from-primary/25 via-transparent to-primary/20",
      },
    },
    {
      title: "总流量",
      value: formatBytes(trafficTotal),
      subtitle: `↑ ${formatBytes(trafficUpload)} · ↓ ${formatBytes(trafficDownload)}`,
      Icon: HardDrive,
      badge: "累计",
      accent: {
        bg: "surface-base",
        border: "border-border",
        iconWrapper:
          "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border border-border",
        badge:
          "surface-base text-[hsl(var(--warning))] border border-border",
        glow: "from-[hsl(var(--warning))]/25 via-transparent to-[hsl(var(--warning))]/20",
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`group relative overflow-hidden border bg-gradient-to-br shadow-[var(--shadow-md)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-xl)] active:scale-[0.98] cursor-pointer ${stat.accent.border} ${stat.accent.bg}`}
          style={{
            borderRadius: 'var(--radius-lg)',
            borderWidth: 'var(--border-width-thin)',
          }}
        >
          {/* 悬停光晕效果 */}
          <div
            className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${stat.accent.glow}`}
            style={{ borderRadius: 'var(--radius-lg)' }}
          />

          {/* 装饰性光点 */}
          <div
            className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-300 ${stat.accent.iconWrapper}`}
          />

          <div className="relative flex flex-col gap-4" style={{ padding: 'var(--card-padding-lg)' }}>
            {/* 头部区域 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* 图标容器 - 添加悬停缩放效果 */}
                <div
                  className={`p-3 shadow-sm transition-transform duration-300 group-hover:scale-110 ${stat.accent.iconWrapper}`}
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  <stat.Icon className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  {stat.title}
                </p>
              </div>
              {/* 徽章 */}
              <span
                className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold tracking-wide transition-transform duration-300 group-hover:scale-105 ${stat.accent.badge}`}
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {stat.badge}
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.subtitle}
              </div>
            </div>
          </div>

          {/* 底部装饰线 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
        </div>
      ))}
    </div>
  );
};

export const StatsCards = memo(StatsCardsComponent);
