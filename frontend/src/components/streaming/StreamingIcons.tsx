import React from 'react';
import type { StreamingService } from '@/types/streaming';

type IconSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

const TikTokIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="TikTok">
    <rect width="24" height="24" rx="6" fill="#000000" />
    <path
      d="M13.5 6.5h2c0 1.9 1.6 3.5 3.5 3.5v2.2c-1.4-.06-2.7-.52-3.9-1.29v4.46c0 2.8-2.2 5.03-5 5.03a5 5 0 0 1-2-.41v-2.45a2.8 2.8 0 0 0 1.3.32 2.82 2.82 0 0 0 2.8-2.8v-7.66Z"
      fill="#EE1D52"
    />
    <path
      d="M12.1 8.1v7.54c0 1.9-1.53 3.44-3.43 3.45A3.44 3.44 0 0 1 7 18.75V16.3c.27.14.58.23.91.23 1.06 0 1.92-.86 1.92-1.92v-4.8c1.1-.17 2.08-.68 2.27-1.7Z"
      fill="#69C9D0"
    />
  </svg>
);

const DisneyPlusIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Disney Plus">
    <rect width="24" height="24" rx="6" fill="#093491" />
    <path
      d="M6 14.5c2.1-2.4 5.2-4 8.7-4 1.8 0 3.5.4 5.1 1.1"
      stroke="#1E68FF"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M7.5 15.5c1-.2 1.9.5 2.1 1.4.2.9-.3 1.7-1.2 1.9-.5.1-1 .1-1.4 0v-3.2Zm6.4-.6c.9 0 1.5.4 1.5 1.2 0 .9-.7 1.4-2 1.5v1.2h-.9v-3.9h1.4Zm4.1.2c.9 0 1.6.7 1.6 1.6 0 1-.7 1.6-1.6 1.6-.9 0-1.6-.6-1.6-1.6 0-.9.7-1.6 1.6-1.6Z"
      fill="#FFFFFF"
    />
  </svg>
);

const NetflixIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Netflix">
    <rect width="24" height="24" rx="6" fill="#E50914" />
    <path d="M7 5h3l3.2 10.8V5h4v14h-3l-3.2-10.8V19H7V5Z" fill="#FFFFFF" opacity="0.9" />
    <path d="M13.2 5h2.8v14h-2.8l-3.2-10.8V19H7V5h2.8l3.4 11.5V5Z" fill="#B20710" />
  </svg>
);

const YouTubeIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="YouTube">
    <rect width="24" height="24" rx="6" fill="#FF0000" />
    <path
      d="M10.5 8.5 15.8 12 10.5 15.5V8.5ZM6.3 9.2c.1-1.1.9-1.9 2-2 1.5-.1 3-.2 4.5-.2 1.5 0 3 .1 4.4.2 1.1.1 1.9.9 2 2 .1.9.1 1.8.1 2.8s0 1.9-.1 2.8c-.1 1.1-.9 1.9-2 2-1.4.1-2.9.2-4.4.2-1.5 0-3-.1-4.5-.2-1.1-.1-1.9-.9-2-2-.1-.9-.1-1.8-.1-2.8s0-1.9.1-2.8Z"
      fill="#FFFFFF"
    />
  </svg>
);

const AmazonPVIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Amazon Prime Video">
    <rect width="24" height="24" rx="6" fill="#1A2530" />
    <path
      d="M7.5 15.8c1.8.9 3.9 1.4 5.9 1.4 1.9 0 3.9-.4 5.7-1.3"
      stroke="#FF9900"
      strokeWidth="1.4"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M9.4 8.5h1.5l1.1 3.1 1.1-3.1h1.5l-1.9 5.1h-1.3L9.4 8.5Zm7 .1c1.3 0 2.3 1 2.3 2.3 0 1.4-.9 2.4-2.4 2.4h-1.6V8.6h1.7Zm-.2 1.1h-.5v2.5h.5a1.2 1.2 0 1 0 0-2.5Z"
      fill="#FFFFFF"
    />
  </svg>
);

const SpotifyIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Spotify">
    <rect width="24" height="24" rx="6" fill="#1DB954" />
    <path
      d="M7.5 10.6c2.6-1 5.4-1 7.9-.3m-7.3 3c2-.7 4.2-.7 6.1-.2m-5.4 2.5c1.2-.4 2.7-.4 3.9-.1"
      stroke="#FFFFFF"
      strokeWidth="1.4"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const ChatGPTIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="ChatGPT">
    <rect width="24" height="24" rx="6" fill="#74AA9C" />
    <path
      d="M12 5.2c1.5 0 2.8.8 3.6 2l1.6-.9.8 1.4-1.5.9c.1.4.2.7.2 1.1 0 .4-.1.7-.2 1l1.5.9-.8 1.4-1.6-.9c-.8 1.2-2.1 2-3.6 2-1.5 0-2.8-.8-3.6-2l-1.6.9-.8-1.4 1.5-.9a3 3 0 0 1-.2-1c0-.4.1-.7.2-1l-1.5-.9.8-1.4 1.6.9c.8-1.2 2.1-2 3.6-2Z"
      fill="#FFFFFF"
      opacity="0.85"
    />
    <path
      d="M12 7.5c.9 0 1.7.4 2.2 1.1l.4.5c.2.3.3.7.3 1 0 1.3-1.2 2.4-2.9 2.4s-2.9-1.1-2.9-2.4c0-.4.1-.7.3-1l.4-.5c.5-.7 1.3-1.1 2.2-1.1Z"
      fill="#437D71"
    />
  </svg>
);

const iconMap: Record<StreamingService, ({ size }: { size: number }) => JSX.Element> = {
  tiktok: TikTokIcon,
  disney_plus: DisneyPlusIcon,
  netflix: NetflixIcon,
  youtube: YouTubeIcon,
  amazon_prime: AmazonPVIcon,
  spotify: SpotifyIcon,
  chatgpt: ChatGPTIcon,
};

export const getStreamingIcon = (service: StreamingService, size: IconSize = 'md'): JSX.Element => {
  const Component = iconMap[service];
  if (!Component) {
    return <span className="text-sm font-semibold uppercase">{service.slice(0, 2)}</span>;
  }

  return <Component size={sizeMap[size]} />;
};
