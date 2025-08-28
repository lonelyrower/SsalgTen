import { useState, useCallback, useRef } from 'react';
import { apiService } from '@/services/api';
import type { ClientLatencyData, LatencyStats } from '@/services/api';

interface ClientLatencyState {
  isLoading: boolean;
  isTestingInProgress: boolean;
  results: ClientLatencyData[];
  stats: LatencyStats | null;
  error: string | null;
  lastUpdated: string | null;
  clientIP: string | null;
}

const initialState: ClientLatencyState = {
  isLoading: false,
  isTestingInProgress: false,
  results: [],
  stats: null,
  error: null,
  lastUpdated: null,
  clientIP: null,
};

export function useClientLatency() {
  const [state, setState] = useState<ClientLatencyState>(initialState);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
  }, []);

  // 开始延迟测试
  const startLatencyTest = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        isTestingInProgress: true,
        error: null,
        results: [],
        stats: null
      }));

      // 清理之前的定时器
      clearTimers();

      // 启动测试
      const testResponse = await apiService.startLatencyTest();
      
      if (!testResponse.success || !testResponse.data) {
        throw new Error(testResponse.error || 'Failed to start latency test');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        clientIP: testResponse.data?.clientIP || null
      }));

      // 开始轮询结果
      const pollResults = async () => {
        try {
          const resultsResponse = await apiService.getLatencyResults();
          
          if (resultsResponse.success && resultsResponse.data) {
            const data = resultsResponse.data;
            
            setState(prev => ({
              ...prev,
              results: data.results,
              stats: data.stats,
              lastUpdated: data.timestamp,
              error: null
            }));

            // 检查是否所有测试都完成了
            const allCompleted = data.results.every(result => 
              result.status === 'success' || 
              result.status === 'failed' || 
              result.status === 'timeout'
            );

            if (allCompleted) {
              setState(prev => ({
                ...prev,
                isTestingInProgress: false
              }));
              clearTimers();
            }
          }
        } catch (error) {
          console.error('Failed to poll latency results:', error);
          // 继续轮询，不中断
        }
      };

      // 立即获取一次结果
      await pollResults();

      // 设置轮询定时器（每3秒检查一次）
      pollIntervalRef.current = setInterval(pollResults, 3000);

      // 设置总体超时（35秒后停止测试）
      testTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isTestingInProgress: false,
          error: 'Test timeout - some nodes may not have responded'
        }));
        clearTimers();
      }, 35000);

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isTestingInProgress: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
      clearTimers();
    }
  }, [clearTimers]);

  // 获取最新的延迟结果（不开始新测试）
  const refreshResults = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await apiService.getLatencyResults();
      if (!response.success || !response.data) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Failed to fetch results'
        }));
        return;
      }

      const data = response.data; // LatencyTestResults
      setState(prev => ({
        ...prev,
        isLoading: false,
        results: data.results,
        stats: data.stats,
        lastUpdated: data.timestamp,
        clientIP: data.clientIP
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, []);

  // 清除数据
  const clearData = useCallback(() => {
    clearTimers();
    setState(initialState);
  }, [clearTimers]);

  // 计算延迟颜色等级
  const getLatencyColor = useCallback((latency: number | null) => {
    if (latency === null) return 'gray';
    if (latency < 50) return 'green';
    if (latency < 150) return 'yellow';
    return 'red';
  }, []);

  // 格式化延迟显示
  const formatLatency = useCallback((latency: number | null) => {
    if (latency === null) return '--';
    return `${latency}ms`;
  }, []);

  // 获取测试进度
  const getTestProgress = useCallback(() => {
    if (state.results.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = state.results.filter(result => 
      result.status === 'success' || 
      result.status === 'failed' || 
      result.status === 'timeout'
    ).length;
    
    const total = state.results.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }, [state.results]);

  return {
    // State
    ...state,
    
    // Actions
    startLatencyTest,
    refreshResults,
    clearData,
    
    // Utilities
    getLatencyColor,
    formatLatency,
    getTestProgress,
    
    // Cleanup (for useEffect cleanup)
    cleanup: clearTimers
  };
}
