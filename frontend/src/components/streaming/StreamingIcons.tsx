import React from 'react';
import type { StreamingService } from '@/types/streaming';

type IconSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<IconSize, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
};

// 使用 emoji 图标，简单直观且无需额外依赖
const emojiIcons: Record<StreamingService, string> = {
  tiktok: '🎵',
  disney_plus: '🏰',
  netflix: '🎬',
  youtube: '📺',
  amazon_prime: '📦',
  spotify: '🎶',
  chatgpt: '🤖',
};

export type StreamingIconProps = {
  service: StreamingService;
  size?: IconSize;
};

export const StreamingIcon: React.FC<StreamingIconProps> = ({ service, size = 'md' }) => {
  const emoji = emojiIcons[service] || '❓';
  const sizeClass = sizeMap[size];

  return (
    <span
      className={`inline-block ${sizeClass}`}
      role="img"
      aria-label={service}
    >
      {emoji}
    </span>
  );
};

export default StreamingIcon;
