import React, { useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Play, Clock, Target, BarChart3, Zap } from "lucide-react";

interface LatencyResult {
  target: string;
  latency: number | null;
  status: "excellent" | "good" | "poor" | "failed";
  error?: string;
}

interface LatencyTestResult {
  testType: "standard" | "comprehensive";
  results: LatencyResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    excellentCount: number;
    goodCount: number;
    poorCount: number;
  };
  timestamp: string;
  duration: number;
}

interface LatencyTestProps {
  nodeId?: string;
  agentEndpoint?: string;
  onTestComplete?: (result: LatencyTestResult) => void;
}

export const LatencyTest: React.FC<LatencyTestProps> = ({
  nodeId,
  agentEndpoint,
  onTestComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<LatencyTestResult | null>(null);
  const [testType, setTestType] = useState<"standard" | "comprehensive">("standard");
  const [error, setError] = useState<string | null>(null);

  const getStatusColor = (status: LatencyResult["status"]): string => {
    switch (status) {
      case "excellent":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "good":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      case "poor":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
      case "failed":
        return "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
      default:
        return "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: LatencyResult["status"]): string => {
    switch (status) {
      case "excellent":
        return "🟢";
      case "good":
        return "🟡";
      case "poor":
        return "🔴";
      case "failed":
        return "⚫";
      default:
        return "⚫";
    }
  };

  const getStatusDescription = (status: LatencyResult["status"]): string => {
    switch (status) {
      case "excellent":
        return "优秀 - 适合游戏和视频通话";
      case "good":
        return "良好 - 适合网页浏览和视频";
      case "poor":
        return "较差 - 仅适合基本使用";
      case "failed":
        return "失败 - 目标不响应或 ICMP 被阻止";
      default:
        return "未知";
    }
  };

  const runLatencyTest = async () => {
    if (isLoading) return;

    // 优先使用代理 API
    if (nodeId) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiService.runLatencyTest(nodeId, testType);

        if (response.success && response.data) {
          setTestResult(response.data as LatencyTestResult);
          onTestComplete?.(response.data as LatencyTestResult);
        } else {
          throw new Error(response.error || "延迟测试失败");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "未知错误";
        setError(`延迟测试失败: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 降级到 agentEndpoint
    if (!agentEndpoint) {
      setError("缺少节点配置");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${agentEndpoint}/api/latency-test?testType=${testType}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "延迟测试失败");
      }

      setTestResult(data.data);
      onTestComplete?.(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError(`延迟测试失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatLatency = (latency: number | null): string => {
    if (latency === null) return "N/A";
    return `${latency.toFixed(1)}ms`;
  };

  return (
    <div className="space-y-6">
      <GlassCard variant="info" className="space-y-5">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Zap className="h-5 w-5 text-cyan-500" />
            延迟测试 - 节点到全球站点
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            选择测试范围后即可开始，系统会依次 Ping 全球热门站点并统计响应情况。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={testType === "standard" ? "info" : "outline"}
            size="sm"
            onClick={() => setTestType("standard")}
            disabled={isLoading}
            className="gap-1"
          >
            <Target className="h-4 w-4" />
            标准测试 (8站点)
          </Button>
          <Button
            variant={testType === "comprehensive" ? "info" : "outline"}
            size="sm"
            onClick={() => setTestType("comprehensive")}
            disabled={isLoading}
            className="gap-1"
          >
            <BarChart3 className="h-4 w-4" />
            完整测试 (20站点)
          </Button>
          <Button
            onClick={runLatencyTest}
            disabled={isLoading || (!nodeId && !agentEndpoint)}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                测试中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                开始测试
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </GlassCard>

      {testResult && (
        <div className="space-y-4">
          <GlassCard variant="default" className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-slate-900 dark:text-white">
              <Clock className="h-5 w-5 text-emerald-500" />
              测试结果概览
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                {testResult.testType === "standard" ? "标准测试" : "完整测试"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200/60 bg-white/80 p-4 text-center dark:border-slate-700/60 dark:bg-slate-900/30">
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {testResult.summary.successful}/{testResult.summary.total}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">成功站点</div>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-white/80 p-4 text-center dark:border-slate-700/60 dark:bg-slate-900/30">
                <div className="text-2xl font-semibold text-cyan-600 dark:text-cyan-300">
                  {testResult.summary.averageLatency.toFixed(1)}ms
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">平均延迟</div>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-white/80 p-4 text-center dark:border-slate-700/60 dark:bg-slate-900/30">
                <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
                  {testResult.summary.excellentCount}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">优秀连接</div>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-white/80 p-4 text-center dark:border-slate-700/60 dark:bg-slate-900/30">
                <div className="text-2xl font-semibold text-amber-600 dark:text-amber-300">
                  {(testResult.duration / 1000).toFixed(1)}s
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">测试耗时</div>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="default" className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Zap className="h-5 w-5 text-purple-500" />
              详细延迟结果
            </div>
            <div className="grid gap-3">
              {testResult.results.map((result, index) => (
                <div
                  key={`${result.target}-${index}`}
                  className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40 md:flex-row md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getStatusIcon(result.status)}</span>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{result.target}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {getStatusDescription(result.status)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={getStatusColor(result.status)}>
                      {formatLatency(result.latency)}
                    </Badge>
                    {result.error && (
                      <span className="max-w-64 text-xs text-red-500 dark:text-red-300">
                        {result.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard variant="default">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-medium text-slate-900 dark:text-white">延迟等级说明</div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <span>🟢</span>
                  <span>优秀 (&lt; 50ms) - 适合游戏和实时通讯</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🟡</span>
                  <span>良好 (50-150ms) - 适合网页浏览和视频播放</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔴</span>
                  <span>较差 (&gt; 150ms) - 仅适合基本访问</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚫</span>
                  <span>失败 - 目标不响应或被防火墙阻断</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default LatencyTest;
