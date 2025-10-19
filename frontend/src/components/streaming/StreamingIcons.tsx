import React from 'react';
import type { StreamingService } from '@/types/streaming';
// Official brand icons via simple-icons (per-service ESM imports)
// We keep local fallbacks to avoid empty UI if a brand icon isn't available.
import tiktok from 'simple-icons/icons/tiktok';
import netflix from 'simple-icons/icons/netflix';
import youtube from 'simple-icons/icons/youtube';
import amazonprime from 'simple-icons/icons/amazonprime';
import spotify from 'simple-icons/icons/spotify';
// Use OpenAI logo for ChatGPT
import openai from 'simple-icons/icons/openai';

type IconSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

type BrandIcon = { path: string; hex: string };

const brandIcons: Partial<Record<StreamingService, BrandIcon>> = {
  tiktok: tiktok,
  netflix: netflix,
  youtube: youtube,
  amazon_prime: amazonprime,
  spotify: spotify,
  chatgpt: openai,
};

// Brand color fallbacks for services without an icon in simple-icons
const fallbackHex: Partial<Record<StreamingService, string>> = {
  disney_plus: '113ccf',
};

// Minimal local fallback: uppercase initials box
const FallbackIcon = ({ label, size, hex }: { label: string; size: number; hex?: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: 6,
      background: hex ? `#${hex}` : '#e5e7eb',
      color: '#111827',
      fontSize: Math.max(10, Math.floor(size * 0.55)),
      lineHeight: 1,
      fontWeight: 700,
    }}
    aria-hidden
  >
    {label}
  </span>
);

export type StreamingIconProps = {
  service: StreamingService;
  size?: IconSize;
};

export const StreamingIcon: React.FC<StreamingIconProps> = ({ service, size = 'md' }) => {
  const px = sizeMap[size];
  const icon = brandIcons[service];

  if (icon?.path) {
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        role="img"
        aria-label={service}
        focusable="false"
      >
        <path d={icon.path} fill={`#${icon.hex || '111827'}`} />
      </svg>
    );
  }

  // Fallback to initials (with brand color if known)
  const hex = fallbackHex[service];
  return <FallbackIcon label={service.slice(0, 2).toUpperCase()} size={px} hex={hex} />;
};

export default StreamingIcon;
