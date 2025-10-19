import React from 'react';
import type { StreamingService } from '@/types/streaming';
// Official brand icons via simple-icons (per-service ESM imports)
// We keep local fallbacks to avoid empty UI if a brand icon isn't available.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - types shim provided in src/types/simple-icons.d.ts
import tiktok from 'simple-icons/icons/tiktok';
// @ts-ignore
import disneyplus from 'simple-icons/icons/disneyplus';
// @ts-ignore
import netflix from 'simple-icons/icons/netflix';
// @ts-ignore
import youtube from 'simple-icons/icons/youtube';
// @ts-ignore
import amazonprime from 'simple-icons/icons/amazonprime';
// @ts-ignore
import spotify from 'simple-icons/icons/spotify';
// Use OpenAI logo for ChatGPT
// @ts-ignore
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
  disney_plus: disneyplus,
  netflix: netflix,
  youtube: youtube,
  amazon_prime: amazonprime,
  spotify: spotify,
  chatgpt: openai,
};

// Minimal local fallback: uppercase initials box
const FallbackIcon = ({ label, size }: { label: string; size: number }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: 6,
      background: '#e5e7eb',
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

  // Fallback to initials
  return <FallbackIcon label={service.slice(0, 2).toUpperCase()} size={px} />;
};

export default StreamingIcon;
