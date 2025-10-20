import { useState, useCallback } from "react";
import { useMobile } from "./useMobile";

interface UsePullToRefreshOptions {
  threshold?: number;
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
}

export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  options: UsePullToRefreshOptions = {},
): UsePullToRefreshResult => {
  const { disabled = false } = options;
  const { isMobile } = useMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled || !isMobile) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, disabled, isMobile]);

  return {
    isRefreshing,
    handleRefresh,
  };
};
