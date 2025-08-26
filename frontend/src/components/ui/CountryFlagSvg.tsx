import React from 'react';
import { getCountryCode } from '@/utils/countryFlags';

interface Props {
  country: string;
  size?: number; // px
  className?: string;
}

export const CountryFlagSvg: React.FC<Props> = ({ country, size = 16, className = '' }) => {
  const code = getCountryCode(country);
  const src = `https://cdn.jsdelivr.net/npm/flag-icons/flags/1x1/${code}.svg`;
  const label = country || code.toUpperCase();
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`${label} flag`}
      title={label}
      className={`inline-block rounded-sm ${className}`}
      loading="lazy"
      onError={(e) => {
        // 回退为地球图标
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};

export default CountryFlagSvg;

