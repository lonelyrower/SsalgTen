import React, { memo, useEffect, useState } from "react";

interface SmoothTransitionProps<T = unknown> {
  children: React.ReactNode;
  data: T;
  duration?: number;
  className?: string;
}

// 平滑过渡组件，避免数据更新时的闪跳
export const SmoothTransition = memo(
  <T = unknown,>({
    children,
    data,
    duration = 300,
    className = "",
  }: SmoothTransitionProps<T>) => {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [prevData, setPrevData] = useState<T>(data);

    useEffect(() => {
      if (JSON.stringify(data) !== JSON.stringify(prevData)) {
        setIsTransitioning(true);

        const timer = setTimeout(() => {
          setPrevData(data);
          setIsTransitioning(false);
        }, duration);

        return () => clearTimeout(timer);
      }
    }, [data, prevData, duration]);

    return (
      <div
        className={`transition-all duration-${duration} ease-in-out ${
          isTransitioning
            ? "opacity-90 transform scale-[0.99]"
            : "opacity-100 transform scale-100"
        } ${className}`}
      >
        {children}
      </div>
    );
  },
);
