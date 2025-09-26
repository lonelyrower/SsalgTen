import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useMobile } from '@/hooks/useMobile';

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  threshold?: number; // 触发刷新的阈值（像素）
  disabled?: boolean;
}

export const MobilePullToRefresh: React.FC<MobilePullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  threshold = 80,
  disabled = false,
}) => {
  const { isMobile } = useMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const scrollTop = useRef(0);

  // 只在移动端启用
  if (!isMobile || disabled) {
    return <div className={className}>{children}</div>;
  }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    startY.current = e.touches[0].clientY;
    scrollTop.current = container.scrollTop;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;

    // 只有在容器顶部且向下拉时才响应
    if (scrollTop.current <= 0 && deltaY > 0) {
      e.preventDefault();
      setIsPulling(true);
      const distance = Math.min(deltaY * 0.5, threshold * 1.5); // 阻尼效果
      setPullDistance(distance);
    }
  }, [isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh, isRefreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const getRefreshIndicatorOpacity = () => {
    if (isRefreshing) return 1;
    return Math.min(pullDistance / threshold, 1);
  };

  const getRefreshIndicatorScale = () => {
    const scale = Math.min(pullDistance / threshold, 1);
    return 0.5 + scale * 0.5; // 从 0.5 缩放到 1
  };

  return (
    <div
      ref={containerRef}
      className={`relative mobile-scroll ${className}`}
      style={{
        transform: `translateY(${isPulling ? Math.min(pullDistance, threshold) : 0}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      {/* 下拉刷新指示器 */}
      <div
        className="absolute top-0 left-1/2 transform -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          transform: `translate(-50%, ${-40 + Math.min(pullDistance * 0.5, 40)}px) scale(${getRefreshIndicatorScale()})`,
          opacity: getRefreshIndicatorOpacity(),
          transition: isPulling ? 'none' : 'all 0.3s ease-out',
        }}
      >
        <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 p-3">
          <RefreshCw
            className={`h-5 w-5 text-blue-500 ${
              isRefreshing ? 'animate-spin' : ''
            } ${pullDistance >= threshold && !isRefreshing ? 'text-green-500' : ''}`}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
            {isRefreshing
              ? '刷新中...'
              : pullDistance >= threshold
              ? '松开刷新'
              : '下拉刷新'}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      {children}
    </div>
  );
};

// 简化版本，仅用于检测下拉动作
export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  options: { threshold?: number; disabled?: boolean } = {}
) => {
  const { disabled = false } = options;
  const { isMobile } = useMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled || !isMobile) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, disabled, isMobile]);

  return {
    isRefreshing,
    handleRefresh,
  };
};