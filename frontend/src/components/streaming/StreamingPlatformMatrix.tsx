import React from "react";
import type { StreamingPlatformStats } from "@/types/streaming";
import { STREAMING_SERVICES, STATUS_TEXT } from "@/types/streaming";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";

interface StreamingPlatformMatrixProps {
  stats: StreamingPlatformStats[];
  onSelect?: (service: StreamingPlatformStats["service"]) => void;
}

export const StreamingPlatformMatrix: React.FC<StreamingPlatformMatrixProps> = ({
  stats,
  onSelect,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              平台
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              解锁
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              受限
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              检测失败
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              未测试
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              解锁率
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
          {stats.map((platform) => (
            <tr
              key={platform.service}
              className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                onSelect ? "cursor-pointer" : ""
              }`}
              onClick={() => onSelect?.(platform.service)}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <StreamingIcon service={platform.service} size="md" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {STREAMING_SERVICES[platform.service]?.name || platform.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] font-semibold">
                {platform.unlocked}
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  ({STATUS_TEXT.yes})
                </span>
              </td>
              <td className="px-4 py-3 text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))] font-semibold">
                {platform.restricted}
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  ({STATUS_TEXT.no})
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold">
                {platform.failed}
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  ({STATUS_TEXT.failed})
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold">
                {platform.unknown}
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  ({STATUS_TEXT.unknown})
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        platform.unlockRate >= 80
                          ? "bg-[hsl(var(--status-success-500))]"
                          : platform.unlockRate >= 50
                            ? "bg-[hsl(var(--status-warning-500))]"
                            : "bg-[hsl(var(--status-error-500))]"
                      }`}
                      style={{ width: `${Math.round(platform.unlockRate)}%` }}
                    />
                  </div>
                  <span
                    className={`w-14 text-right font-semibold ${
                      platform.unlockRate >= 80
                        ? "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]"
                        : platform.unlockRate >= 50
                          ? "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]"
                          : "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]"
                    }`}
                  >
                    {Math.round(platform.unlockRate)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

