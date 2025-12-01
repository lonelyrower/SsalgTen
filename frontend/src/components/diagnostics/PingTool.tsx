import React, { useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Wifi, Play, Copy, Check, Activity } from "lucide-react";

interface PingToolProps {
  nodeId: string;
}

interface PingResultData {
  host?: string;
  alive?: boolean;
  time?: number;
  min?: number;
  max?: number;
  avg?: number;
  packetLoss?: number;
  duration?: number;
  executedAt?: string;
  output?: string;
}

const QUICK_TARGETS = [
  { label: "Google DNS", value: "8.8.8.8" },
  { label: "Cloudflare", value: "1.1.1.1" },
  { label: "Google", value: "google.com" },
  { label: "Baidu", value: "baidu.com" },
];

export const PingTool: React.FC<PingToolProps> = ({ nodeId }) => {
  const [target, setTarget] = useState("");
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PingResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runPing = async () => {
    if (!target.trim()) {
      setError("请输入目标地址");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.runPing(nodeId, target.trim(), count);

      if (response.success && response.data) {
        const data = response.data as PingResultData;
        setResult(data);
      } else {
        setError(response.error || "Ping 测试失败");
      }
    } catch (err) {
      console.error("Ping test failed:", err);
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      const raw =
        result.output ||
        JSON.stringify(
          {
            host: result.host,
            avg: result.avg,
            min: result.min,
            max: result.max,
            packetLoss: result.packetLoss,
          },
          null,
          2,
        );
      navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatLatency = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      return "N/A";
    }
    return `${value.toFixed(2)} ms`;
  };

  const formatLoss = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      return "N/A";
    }
    return `${value.toFixed(1)}%`;
  };

  return (
    <GlassCard variant="success">
      <div className="space-y-4 text-left">
        {/* 标题 */}
        <div className="flex items-center gap-2 pb-3 border-b border-[hsl(var(--status-success-200)/0.3)] dark:border-[hsl(var(--status-success-700)/0.3)]">
          <div className="p-2 bg-[hsl(var(--status-success-100))] dark:bg-[hsl(var(--status-success-900)/0.3)] rounded-lg">
            <Wifi className="h-5 w-5 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Ping 测试
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              测试网络连通性和延迟
            </p>
          </div>
        </div>

        {/* 快捷目标 */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
            快捷目标
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_TARGETS.map((qt) => (
              <Button
                key={qt.value}
                variant="outline"
                size="sm"
                onClick={() => setTarget(qt.value)}
                disabled={loading}
                className="text-xs"
              >
                {qt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 输入区域 */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
              目标地址 <span className="text-[hsl(var(--status-error-500))]">*</span>
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="IP地址或域名 (例如: 8.8.8.8)"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
              Ping 次数
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value={1}>1 次</option>
              <option value={4}>4 次</option>
              <option value={10}>10 次</option>
              <option value={20}>20 次</option>
            </select>
          </div>
        </div>

        {/* 执行按钮 */}
        <Button
          onClick={runPing}
          disabled={loading || !target.trim()}
          className="w-full bg-[hsl(var(--status-success-600))] hover:bg-[hsl(var(--status-success-500))] text-white"
        >
          {loading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              测试中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              开始 Ping 测试
            </>
          )}
        </Button>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)] border border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-800))] rounded-lg">
            <p className="text-sm text-[hsl(var(--status-error-700))] dark:text-[hsl(var(--status-error-300))]">{error}</p>
          </div>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={result.alive ? "success" : "destructive"} className="text-xs">
                {result.alive ? "主机在线" : "主机不可达"}
              </Badge>
              <button
                onClick={copyResult}
                className="flex items-center gap-1 text-xs text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] hover:underline"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    复制原始结果
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-[hsl(var(--status-success-50))] to-emerald-50 dark:from-[hsl(var(--status-success-900)/0.2)] dark:to-emerald-900/20 rounded-lg border border-[hsl(var(--status-success-200)/0.5)] dark:border-[hsl(var(--status-success-700)/0.5)]">
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-600 dark:text-gray-400">
                  <Activity className="h-4 w-4 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" />
                  平均延迟
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatLatency(result.avg ?? result.time)}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-[hsl(var(--status-success-50))] to-emerald-50 dark:from-[hsl(var(--status-success-900)/0.2)] dark:to-emerald-900/20 rounded-lg border border-[hsl(var(--status-success-200)/0.5)] dark:border-[hsl(var(--status-success-700)/0.5)]">
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-600 dark:text-gray-400">
                  <Activity className="h-4 w-4 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" />
                  丢包率
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatLoss(result.packetLoss)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="p-3 bg-[hsl(var(--status-success-50)/0.5)] dark:bg-[hsl(var(--status-success-900)/0.1)] rounded-lg border border-[hsl(var(--status-success-200)/0.3)] dark:border-[hsl(var(--status-success-700)/0.3)]">
                <p>最小延迟</p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                  {formatLatency(result.min)}
                </p>
              </div>
              <div className="p-3 bg-[hsl(var(--status-success-50)/0.5)] dark:bg-[hsl(var(--status-success-900)/0.1)] rounded-lg border border-[hsl(var(--status-success-200)/0.3)] dark:border-[hsl(var(--status-success-700)/0.3)]">
                <p>最大延迟</p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                  {formatLatency(result.max)}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {result.host && <p>目标主机：{result.host}</p>}
              {typeof result.duration === "number" && (
                <p>诊断耗时：{(result.duration / 1000).toFixed(2)} 秒</p>
              )}
              {result.executedAt && <p>执行节点：{result.executedAt}</p>}
            </div>

            {/* 原始结果 */}
            {result.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] hover:underline">
                  查看原始输出
                </summary>
                <div className="mt-2 p-3 bg-[hsl(var(--status-success-50)/0.5)] dark:bg-[hsl(var(--status-success-900)/0.1)] rounded-lg border border-[hsl(var(--status-success-200)/0.3)] dark:border-[hsl(var(--status-success-700)/0.3)] max-h-60 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                    {result.output}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default PingTool;
