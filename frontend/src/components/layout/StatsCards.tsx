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
        bg: "from-sky-50 via-white to-cyan-50 dark:from-slate-800 dark:via-cyan-950/60 dark:to-blue-950/60",
        border: "border-sky-200/70 dark:border-cyan-700/60",
        iconWrapper:
          "bg-cyan-500/12 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200 border border-white/60 dark:border-white/10",
        badge:
          "bg-white/80 text-cyan-700 border border-sky-200/60 dark:bg-cyan-500/15 dark:text-cyan-100 dark:border-cyan-700/40",
        glow: "from-cyan-400/25 via-transparent to-blue-500/20",
      },
    },
    {
      title: "全球覆盖",
      value: totalCountries.toString(),
      subtitle: "全球节点分布",
      Icon: Globe,
      badge: "国际化",
      accent: {
        bg: "from-emerald-50 via-white to-teal-50 dark:from-slate-800 dark:via-emerald-950/60 dark:to-teal-950/60",
        border: "border-emerald-200/70 dark:border-emerald-700/60",
        iconWrapper:
          "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200 border border-white/60 dark:border-white/10",
        badge:
          "bg-white/80 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-700/40",
        glow: "from-emerald-400/25 via-transparent to-teal-500/20",
      },
    },
    {
      title: "服务提供商",
      value: totalProviders.toString(),
      subtitle: "多样化基础设施",
      Icon: Building,
      badge: "多元化",
      accent: {
        bg: "from-fuchsia-50 via-white to-purple-50 dark:from-slate-800 dark:via-fuchsia-950/60 dark:to-purple-950/60",
        border: "border-fuchsia-200/70 dark:border-fuchsia-700/60",
        iconWrapper:
          "bg-fuchsia-500/12 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 border border-white/60 dark:border-white/10",
        badge:
          "bg-white/80 text-fuchsia-700 border border-fuchsia-200/60 dark:bg-fuchsia-500/15 dark:text-fuchsia-100 dark:border-fuchsia-700/40",
        glow: "from-fuchsia-400/25 via-transparent to-purple-500/20",
      },
    },
    {
      title: "总流量",
      value: formatBytes(trafficTotal),
      subtitle: `↑ ${formatBytes(trafficUpload)} · ↓ ${formatBytes(trafficDownload)}`,
      Icon: HardDrive,
      badge: "累计",
      accent: {
        bg: "from-amber-50 via-white to-orange-50 dark:from-slate-800 dark:via-amber-950/60 dark:to-orange-950/60",
        border: "border-amber-200/70 dark:border-amber-700/60",
        iconWrapper:
          "bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200 border border-white/60 dark:border-white/10",
        badge:
          "bg-white/80 text-amber-700 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-700/40",
        glow: "from-amber-400/25 via-transparent to-orange-500/20",
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${stat.accent.border} ${stat.accent.bg}`}
        >
          <div
            className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${stat.accent.glow}`}
          />
          <div className="relative flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-3 shadow-sm ${stat.accent.iconWrapper}`}
                >
                  <stat.Icon className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  {stat.title}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${stat.accent.badge}`}
              >
                {stat.badge}
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {stat.value}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {stat.subtitle}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const StatsCards = memo(StatsCardsComponent);
