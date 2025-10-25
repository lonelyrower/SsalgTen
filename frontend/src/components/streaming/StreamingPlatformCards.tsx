import React, { memo } from "react";
import type { StreamingPlatformStats } from "@/types/streaming";
import { Card } from "../ui/card";
import { StreamingIcon } from "./StreamingIcons";
import { TrendingUp } from "lucide-react";

interface StreamingPlatformCardsProps {
  stats: StreamingPlatformStats[];
  onSelect?: (service: StreamingPlatformStats["service"]) => void;
  selectedService?: string;
}

export const StreamingPlatformCards: React.FC<StreamingPlatformCardsProps> = memo(({
  stats,
  onSelect,
  selectedService,
}) => {
  return (
    <div className="relative">
      {/* 横向滚动容器 */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
        {stats.map((platform) => {
          const isSelected = selectedService === platform.service;
          const unlockRateColor = platform.unlockRate >= 80
            ? "emerald"
            : platform.unlockRate >= 50
            ? "amber"
            : "rose";

          const colorClasses = {
            emerald: {
              bg: "bg-emerald-50 dark:bg-emerald-900/20",
              icon: "text-emerald-600 dark:text-emerald-400",
              accent: "border-emerald-200 dark:border-emerald-800",
              ring: "ring-2 ring-emerald-500",
            },
            amber: {
              bg: "bg-amber-50 dark:bg-amber-900/20",
              icon: "text-amber-600 dark:text-amber-400",
              accent: "border-amber-200 dark:border-amber-800",
              ring: "ring-2 ring-amber-500",
            },
            rose: {
              bg: "bg-rose-50 dark:bg-rose-900/20",
              icon: "text-rose-600 dark:text-rose-400",
              accent: "border-rose-200 dark:border-rose-800",
              ring: "ring-2 ring-rose-500",
            },
          };

          const colors = colorClasses[unlockRateColor];

          return (
            <Card
              key={platform.service}
              className={`
                flex-shrink-0 w-[220px] relative overflow-hidden
                bg-white dark:bg-gray-800 border ${colors.accent}
                shadow-md hover:shadow-lg transition-all duration-300
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
                      className={`h-full transition-all duration-500 ${
                        unlockRateColor === "emerald"
                          ? "bg-emerald-500"
                          : unlockRateColor === "amber"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.round(platform.unlockRate)}%` }}
                    />
                  </div>
                </div>

                {/* 统计数据 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                    <span className="text-gray-600 dark:text-gray-400">解锁</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {platform.unlocked}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                    <span className="text-gray-600 dark:text-gray-400">屏蔽</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {platform.restricted}
                    </span>
                  </div>
                  {platform.originalOnly > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                      <span className="text-gray-600 dark:text-gray-400">仅自制</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {platform.originalOnly}
                      </span>
                    </div>
                  )}
                  {platform.pending > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                      <span className="text-gray-600 dark:text-gray-400">待支持</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {platform.pending}
                      </span>
                    </div>
                  )}
                  {platform.noPremium > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                      <span className="text-gray-600 dark:text-gray-400">禁会员</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {platform.noPremium}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                    <span className="text-gray-600 dark:text-gray-400">失败</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-400">
                      {platform.failed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-900/50">
                    <span className="text-gray-600 dark:text-gray-400">未测</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-400">
                      {platform.unknown}
                    </span>
                  </div>
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
