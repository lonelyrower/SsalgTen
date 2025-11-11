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
    <div className="overflow-x-auto rounded-xl border border-border surface-elevated shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              平台
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              解锁
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              受限
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              检测失败
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              未测试
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              解锁率
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {stats.map((platform) => (
            <tr
              key={platform.service}
              className={`transition-colors hover:bg-muted/30 ${
                onSelect ? "cursor-pointer" : ""
              }`}
              onClick={() => onSelect?.(platform.service)}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <StreamingIcon service={platform.service} size="md" />
                  <span className="font-medium text-foreground">
                    {STREAMING_SERVICES[platform.service]?.name || platform.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[hsl(var(--success))] font-semibold">
                {platform.unlocked}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({STATUS_TEXT.yes})
                </span>
              </td>
              <td className="px-4 py-3 text-[hsl(var(--error))] font-semibold">
                {platform.restricted}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({STATUS_TEXT.no})
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground font-semibold">
                {platform.failed}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({STATUS_TEXT.failed})
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground font-semibold">
                {platform.unknown}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({STATUS_TEXT.unknown})
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        platform.unlockRate >= 80
                          ? "bg-[hsl(var(--success))]"
                          : platform.unlockRate >= 50
                            ? "bg-[hsl(var(--warning))]"
                            : "bg-[hsl(var(--error))]"
                      }`}
                      style={{ width: `${Math.round(platform.unlockRate)}%` }}
                    />
                  </div>
                  <span
                    className={`w-14 text-right font-semibold ${
                      platform.unlockRate >= 80
                        ? "text-[hsl(var(--success))]"
                        : platform.unlockRate >= 50
                          ? "text-[hsl(var(--warning))]"
                          : "text-[hsl(var(--error))]"
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

