import React from 'react';
import type { StreamingService } from '@/types/streaming';
// Official brand icons via simple-icons (per-service ESM imports)
// We keep local fallbacks to avoid empty UI if a brand icon isn't available.
import {
  siTiktok,
  siNetflix,
  siYoutube,
  siAmazonprime,
  siSpotify,
  siOpenai,
} from 'simple-icons';

type IconSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

type BrandIcon = { path: string; hex: string };

const brandIcons: Partial<Record<StreamingService, BrandIcon>> = {
  tiktok: siTiktok,
  netflix: siNetflix,
  youtube: siYoutube,
  amazon_prime: siAmazonprime,
  spotify: siSpotify,
  chatgpt: siOpenai,
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

  // Custom Disney+ icon rendering (simple arc + plus), since simple-icons has no disneyplus slug
  if (service === 'disney_plus') {
    const stroke = `#${fallbackHex.disney_plus}`;
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        role="img"
        aria-label="disney_plus"
        focusable="false"
      >
        <path
          d="M4 13.5c2.4-2.6 5.9-4.2 9.8-4.2 2 0 3.9.4 5.6 1.2"
          stroke={stroke}
          strokeWidth={Math.max(1.4, Math.round(px / 14))}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M17 12v4M15 14h4"
          stroke={stroke}
          strokeWidth={Math.max(1.6, Math.round(px / 12))}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

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
