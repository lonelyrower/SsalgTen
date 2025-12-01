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
    bg: "bg-red-50 dark:bg-red-950/40",
    icon: "text-red-600 dark:text-red-400",
    accent: "border-red-500 dark:border-red-600",
    ring: "ring-2 ring-inset ring-red-500",
    progressBg: "bg-red-600",
  },
  // YouTube 官方红色 #FF0000
  youtubeRed: {
    bg: "bg-red-50 dark:bg-red-950/40",
    icon: "text-red-500 dark:text-red-400",
    accent: "border-red-400 dark:border-red-500",
    ring: "ring-2 ring-inset ring-red-500",
    progressBg: "bg-red-500",
  },
  // Disney+ 官方蓝色 #113CCF
  disneyBlue: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon: "text-blue-700 dark:text-blue-400",
    accent: "border-blue-600 dark:border-blue-500",
    ring: "ring-2 ring-inset ring-blue-600",
    progressBg: "bg-blue-600",
  },
  // Amazon Prime 官方青色 #00A8E1
  amazonCyan: {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    icon: "text-cyan-600 dark:text-cyan-400",
    accent: "border-cyan-500 dark:border-cyan-500",
    ring: "ring-2 ring-inset ring-cyan-500",
    progressBg: "bg-cyan-500",
  },
  // TikTok 官方颜色 #FE2C55 + #00F2EA (使用粉红色)
  tiktokPink: {
    bg: "bg-pink-50 dark:bg-pink-950/40",
    icon: "text-pink-600 dark:text-pink-400",
    accent: "border-pink-500 dark:border-pink-500",
    ring: "ring-2 ring-inset ring-pink-500",
    progressBg: "bg-pink-500",
  },
  // Spotify 官方绿色 #1DB954
  spotifyGreen: {
    bg: "bg-green-50 dark:bg-green-950/40",
    icon: "text-green-600 dark:text-green-400",
    accent: "border-green-500 dark:border-green-500",
    ring: "ring-2 ring-inset ring-green-500",
    progressBg: "bg-green-500",
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
    spotify: "spotifyGreen",
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
                bg-white dark:bg-gray-800 border ${colors.accent}
                shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)]
                ${onSelect ? "cursor-pointer" : ""}
                ${isSelected ? colors.ring : ""}
              `}
              onClick={() => onSelect?.(platform.service)}
            >
              <div className="p-4">
                {/* 图标和名称 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <StreamingIcon service={platform.service} size="lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                      {platform.name}
                    </h4>
                  </div>
                </div>

                {/* 解锁率 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      解锁率
                    </span>
                    <span className={`text-lg font-bold ${colors.icon}`}>
                      {Math.round(platform.unlockRate)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
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
                        className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50"
                      >
                        <span className="text-gray-600 dark:text-gray-400">
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
