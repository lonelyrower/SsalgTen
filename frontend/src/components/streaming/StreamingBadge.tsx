import React from "react";
import { STATUS_COLORS, STATUS_TEXT } from "@/types/streaming";
import type { StreamingServiceResult } from "@/types/streaming";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";

interface StreamingBadgeProps {
  service: StreamingServiceResult;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  showRegion?: boolean;
}

/**
 * 流媒体服务徽章组件
 * 显示单个流媒体服务的解锁状态
 */
export const StreamingBadge: React.FC<StreamingBadgeProps> = ({
  service,
  size = "md",
  showStatus = true,
  showRegion = false,
}) => {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${sizeClasses[size]}`}
      title={`${service.name}: ${STATUS_TEXT[service.status]}${service.region ? ` (${service.region})` : ""}`}
    >
      <span className="flex items-center justify-center">
        <StreamingIcon service={service.service} size={size} />
      </span>
      {showStatus && (
        <span className={`font-medium ${STATUS_COLORS[service.status]}`}>
          {showRegion && service.region
            ? service.region
            : STATUS_TEXT[service.status]}
        </span>
      )}
    </div>
  );
};
