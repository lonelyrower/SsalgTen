import React from "react";
import { getCountryCode } from "@/utils/countryFlags";

interface Props {
  country: string;
  size?: number; // px
  className?: string;
}

export const CountryFlagSvg: React.FC<Props> = ({
  country,
  size = 16,
  className = "",
}) => {
  const code = getCountryCode(country);

  // 如果是 Unknown，显示问号 emoji
  if (country?.toLowerCase() === "unknown" || !code) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        title={country || "Unknown"}
      >
        ❓
      </span>
    );
  }

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
        // 回退为问号图标
        const span = document.createElement("span");
        span.textContent = "❓";
        span.className = "inline-flex items-center justify-center";
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.title = label;
        e.currentTarget.parentNode?.replaceChild(span, e.currentTarget);
      }}
    />
  );
};

export default CountryFlagSvg;
