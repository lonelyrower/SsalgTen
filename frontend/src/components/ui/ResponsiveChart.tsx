import React, { useState, useRef, useEffect } from "react";
import { useMobile } from "@/hooks/useMobile";
import { Expand, Minimize } from "lucide-react";
import { Button } from "./button";

interface ResponsiveChartProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  minHeight?: string;
  mobileHeight?: string;
  allowFullscreen?: boolean;
  scrollable?: boolean;
}

export const ResponsiveChart: React.FC<ResponsiveChartProps> = ({
  children,
  title,
  className = "",
  minHeight = "300px",
  mobileHeight = "250px",
  allowFullscreen = false,
  scrollable = false,
}) => {
  const { isMobile, screenHeight } = useMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  // ESC 键退出全屏
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleEscKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const chartHeight = isMobile ? mobileHeight : minHeight;

  // 全屏模式
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
        {/* 全屏模式头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title || "图表"}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreenToggle}
            className="mobile-touch-target"
          >
            <Minimize className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">退出全屏</span>
          </Button>
        </div>

        {/* 全屏内容 */}
        <div className="flex-1 p-4 overflow-auto mobile-scroll">
          <div
            className="w-full h-full"
            style={{
              minHeight: `${screenHeight - 120}px`, // 减去头部和边距
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  // 普通模式
  return (
    <div
      ref={containerRef}
      className={`relative bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-subtle))] mobile-safe ${className}`}
    >
      {/* 图表头部 */}
      {(title || allowFullscreen) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mobile-text-readable">
              {title}
            </h3>
          )}
          {allowFullscreen && isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreenToggle}
              className="mobile-touch-target"
            >
              <Expand className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* 图表内容 */}
      <div
        className={`p-4 ${scrollable ? "overflow-auto mobile-scroll" : "overflow-hidden"}`}
        style={{
          height: chartHeight,
          minHeight: chartHeight,
        }}
      >
        {/* 移动端优化容器 */}
        <div
          className="w-full h-full"
          style={{ minWidth: isMobile ? "100%" : "auto" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// 移动端优化的图表网格容器
interface ChartGridProps {
  children: React.ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
  className?: string;
}

export const ChartGrid: React.FC<ChartGridProps> = ({
  children,
  gap = "1rem",
  className = "",
}) => {
  const { isMobile } = useMobile();

  const gridColumns = isMobile ? 1 : `repeat(auto-fit, minmax(350px, 1fr))`;

  return (
    <div
      className={`grid gap-4 sm:gap-6 ${className}`}
      style={{
        gridTemplateColumns: gridColumns,
        gap,
      }}
    >
      {children}
    </div>
  );
};

// 移动端优化的指标卡片
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className = "",
}) => {
  const { isMobile } = useMobile();

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] p-4 sm:p-6 shadow-[var(--shadow-sm)] border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-subtle))] mobile-safe ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mobile-text-readable">
            {title}
          </p>
          <p
            className={`mt-2 font-bold text-gray-900 dark:text-white mobile-text-readable ${
              isMobile ? "text-2xl" : "text-3xl"
            }`}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0">
            <Icon
              className={`text-gray-400 ${isMobile ? "h-6 w-6" : "h-8 w-8"}`}
            />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span
            className={`font-medium ${
              trend.isPositive
                ? "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]"
                : "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]"
            }`}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
          <span className="ml-2 text-gray-500 dark:text-gray-400">较上期</span>
        </div>
      )}
    </div>
  );
};
