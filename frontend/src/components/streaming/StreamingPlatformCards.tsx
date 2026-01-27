import React, { memo } from "react";
import type { StreamingPlatformStats } from "@/types/streaming";
import { PLATFORM_SUPPORTED_STATUSES, getStatusCount } from "@/types/streaming";
import { Card } from "../ui/card";
import { StreamingIcon } from "./StreamingIcons";
import { TrendingUp } from "lucide-react";

interface StreamingPlatformCardsProps {
  stats: StreamingPlatformStats[];
  onSelect?: (service: StreamingPlatformStats["service"]) => void;
  selectedService?: string;
}

// 定义颜色类型和配置（在组件外部）- 使用各平台官方品牌色
const colorClasses = {
  // Netflix 官方红色 #E50914
  netflixRed: {
    bg: "bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.4)]",
    icon: "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]",
    accent: "border-[hsl(var(--status-error-500))] dark:border-[hsl(var(--status-error-600))]",
    ring: "ring-2 ring-inset ring-[hsl(var(--status-error-500))]",
    progressBg: "bg-[hsl(var(--status-error-600))]",
  },
  // YouTube 官方红色 #FF0000
  youtubeRed: {
    bg: "bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.4)]",
    icon: "text-[hsl(var(--status-error-500))] dark:text-[hsl(var(--status-error-400))]",
    accent: "border-[hsl(var(--status-error-400))] dark:border-[hsl(var(--status-error-500))]",
    ring: "ring-2 ring-inset ring-[hsl(var(--status-error-500))]",
    progressBg: "bg-[hsl(var(--status-error-500))]",
  },
  // Disney+ 官方蓝色 #113CCF
  disneyBlue: {
    bg: "bg-[hsl(var(--status-info-50))] dark:bg-[hsl(var(--status-info-900)/0.4)]",
    icon: "text-[hsl(var(--status-info-700))] dark:text-[hsl(var(--status-info-400))]",
    accent: "border-[hsl(var(--status-info-600))] dark:border-[hsl(var(--status-info-500))]",
    ring: "ring-2 ring-inset ring-[hsl(var(--status-info-600))]",
    progressBg: "bg-[hsl(var(--status-info-600))]",
  },
  // Amazon Prime 官方青色 #00A8E1
  amazonCyan: {
    bg: "bg-[hsl(var(--secondary))]/10 dark:bg-[hsl(var(--secondary))]/20",
    icon: "text-[hsl(var(--secondary))] dark:text-[hsl(var(--secondary))]",
    accent: "border-[hsl(var(--secondary))] dark:border-[hsl(var(--secondary))]",
    ring: "ring-2 ring-inset ring-[hsl(var(--secondary))]",
    progressBg: "bg-[hsl(var(--secondary))]",
  },
  // TikTok 官方颜色 #FE2C55 + #00F2EA (使用粉红色)
  tiktokPink: {
    bg: "bg-pink-50 dark:bg-pink-950/40",
    icon: "text-pink-600 dark:text-pink-400",
    accent: "border-pink-500 dark:border-pink-500",
    ring: "ring-2 ring-inset ring-pink-500",
    progressBg: "bg-pink-500",
  },
  // Reddit 官方橙色 #FF4500
  redditOrange: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    icon: "text-orange-600 dark:text-orange-400",
    accent: "border-orange-500 dark:border-orange-500",
    ring: "ring-2 ring-inset ring-orange-500",
    progressBg: "bg-orange-500",
  },
  // ChatGPT 官方绿色 #10A37F
  chatgptTeal: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    icon: "text-teal-600 dark:text-teal-400",
    accent: "border-teal-500 dark:border-teal-500",
    ring: "ring-2 ring-inset ring-teal-500",
    progressBg: "bg-teal-600",
  },
} as const;

type ColorKey = keyof typeof colorClasses;

// 为每个平台定义品牌色（注意使用下划线匹配后端）
const getPlatformColor = (service: string): ColorKey => {
  const platformColors: Record<string, ColorKey> = {
    netflix: "netflixRed",
    youtube: "youtubeRed",
    disney_plus: "disneyBlue",
    amazon_prime: "amazonCyan",
    tiktok: "tiktokPink",
    reddit: "redditOrange",
    chatgpt: "chatgptTeal",
  };
  return platformColors[service] || "netflixRed";
};

export const StreamingPlatformCards: React.FC<StreamingPlatformCardsProps> = memo(({
  stats,
  onSelect,
  selectedService,
}) => {
  return (
    <div className="relative">
      {/* 横向滚动容器 */}
      <div className="flex gap-4 overflow-x-auto pb-2 pl-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
        {stats.map((platform) => {
          const isSelected = selectedService === platform.service;
          const platformColor = getPlatformColor(platform.service);
          const colors = colorClasses[platformColor];

          return (
            <Card
              key={platform.service}
              className={`
                flex-shrink-0 w-[220px] relative overflow-hidden
                bg-[hsl(var(--card))] border ${colors.accent}
                shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)]
                ${onSelect ? "cursor-pointer" : ""}
                ${isSelected ? colors.ring : ""}
              `}
              onClick={() => onSelect?.(platform.service)}
            >
              <div className="p-4">
                {/* 图标和名称 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-[var(--radius-lg)] ${colors.bg}`}>
                    <StreamingIcon service={platform.service} size="lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[hsl(var(--foreground))] truncate">
                      {platform.name}
                    </h4>
                  </div>
                </div>

                {/* 解锁率 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      解锁率
                    </span>
                    <span className={`text-lg font-bold ${colors.icon}`}>
                      {Math.round(platform.unlockRate)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${colors.progressBg}`}
                      style={{ width: `${Math.round(platform.unlockRate)}%` }}
                    />
                  </div>
                </div>

                {/* 统计数据 - 根据不同平台显示不同状态 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {PLATFORM_SUPPORTED_STATUSES[platform.service].map((statusDef) => {
                    const count = getStatusCount(platform, statusDef.status);
                    return (
                      <div
                        key={statusDef.status}
                        className="flex items-center justify-between px-2 py-1 rounded bg-[hsl(var(--muted))]"
                      >
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {statusDef.label}
                        </span>
                        <span className={`font-semibold ${statusDef.color}`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 装饰性渐变 */}
              <div className={`absolute top-0 right-0 w-16 h-16 ${colors.bg} rounded-bl-full opacity-30`} />
            </Card>
          );
        })}
      </div>
    </div>
  );
});
