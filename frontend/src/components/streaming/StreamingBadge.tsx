import React from 'react';
import { STATUS_COLORS, STATUS_TEXT } from '@/types/streaming';
import type { StreamingServiceResult } from '@/types/streaming';

interface StreamingBadgeProps {
  service: StreamingServiceResult;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

/**
 * 流媒体服务徽章组件
 * 显示单个流媒体服务的解锁状态
 */
export const StreamingBadge: React.FC<StreamingBadgeProps> = ({
  service,
  size = 'md',
  showStatus = true
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const getStatusBg = () => {
    switch (service.status) {
      case 'yes':
        return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
      case 'no':
        return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
      case 'org':
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700';
    }
  };

  return (
    <div
      className={`inline-flex items-center space-x-1 rounded border ${getStatusBg()} ${sizeClasses[size]}`}
      title={`${service.name}: ${STATUS_TEXT[service.status]}${service.region ? ` (${service.region})` : ''}`}
    >
      <span>{service.icon}</span>
      {showStatus && (
        <span className={`font-medium ${STATUS_COLORS[service.status]}`}>
          {service.region || STATUS_TEXT[service.status]}
        </span>
      )}
    </div>
  );
};
