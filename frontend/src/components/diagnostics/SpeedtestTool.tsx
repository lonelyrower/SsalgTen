import React, { useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Gauge, Play, TrendingUp, TrendingDown, Radio } from "lucide-react";

interface SpeedtestToolProps {
  nodeId: string;
}

interface RawSpeedtestData {
  download?: unknown;
  upload?: unknown;
  ping?: unknown;
  location?: string;
  server?: unknown;
  timestamp?: string;
  duration?: number;
  executedAt?: string;
}

interface NormalizedSpeedtestResult {
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  serverName?: string;
  serverLocation?: string;
  serverCountry?: string;
  serverHost?: string;
  executedAt?: string;
  duration?: number;
  timestamp?: string;
}

const normalizeBandwidth = (value: unknown): number | null => {
  if (typeof value === "number") {
    return value >= 0 ? Number(value.toFixed(2)) : null;
  }
  if (value && typeof value === "object") {
    const obj = value as { bandwidth?: number; bytes?: number };
    if (typeof obj.bandwidth === "number") {
      return Number((obj.bandwidth / 1_000_000).toFixed(2));
    }
    if (typeof obj.bytes === "number") {
      return Number(((obj.bytes * 8) / 1_000_000).toFixed(2));
    }
  }
  return null;
};

const normalizeLatency = (value: unknown): { latency: number | null; jitter: number | null } => {
  if (typeof value === "number") {
    return { latency: value >= 0 ? Number(value.toFixed(2)) : null, jitter: null };
  }
  if (value && typeof value === "object") {
    const obj = value as { latency?: number; jitter?: number };
    return {
      latency:
        typeof obj.latency === "number" && obj.latency >= 0
          ? Number(obj.latency.toFixed(2))
          : null,
      jitter:
        typeof obj.jitter === "number" && obj.jitter >= 0
          ? Number(obj.jitter.toFixed(2))
          : null,
    };
  }
  return { latency: null, jitter: null };
};

const normalizeServer = (
  rawServer: unknown,
  fallbackLocation?: string,
): Pick<
  NormalizedSpeedtestResult,
  "serverName" | "serverLocation" | "serverCountry" | "serverHost"
> => {
  if (!rawServer) {
    return {
      serverName: undefined,
      serverLocation: fallbackLocation,
      serverCountry: undefined,
      serverHost: undefined,
    };
  }
  if (typeof rawServer === "string") {
    return {
      serverName: rawServer,
      serverLocation: fallbackLocation,
      serverCountry: undefined,
      serverHost: undefined,
    };
  }
  if (typeof rawServer === "object") {
    const server = rawServer as {
      name?: string;
      location?: string;
      country?: string;
      host?: string;
    };
    return {
      serverName: server.name,
      serverLocation: server.location ?? fallbackLocation,
      serverCountry: server.country,
      serverHost: server.host,
    };
  }
  return {
    serverName: undefined,
    serverLocation: fallbackLocation,
    serverCountry: undefined,
    serverHost: undefined,
  };
};

export const SpeedtestTool: React.FC<SpeedtestToolProps> = ({ nodeId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NormalizedSpeedtestResult | null>(null);
  const [rawResult, setRawResult] = useState<RawSpeedtestData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSpeedtest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawResult(null);

    try {
      const response = await apiService.runSpeedtest(nodeId);

      if (response.success && response.data) {
        const data = response.data as RawSpeedtestData;
        const downloadMbps = normalizeBandwidth(data.download);
        const uploadMbps = normalizeBandwidth(data.upload);
        const { latency, jitter } = normalizeLatency(data.ping);
        const serverMeta = normalizeServer(data.server, data.location);

        setResult({
          downloadMbps,
          uploadMbps,
          pingMs: latency,
          jitterMs: jitter,
          executedAt: data.executedAt,
          duration: data.duration,
          timestamp: data.timestamp,
          ...serverMeta,
        });
        setRawResult(data);
      } else {
        setError(response.error || "Speedtest 测试失败");
      }
    } catch (err) {
      console.error("Speedtest failed:", err);
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  const renderMbps = (value: number | null) =>
    value !== null ? value.toFixed(2) : "N/A";

  const renderLatency = (value: number | null) =>
    value !== null ? `${value.toFixed(2)} ms` : "N/A";

  return (
    <GlassCard variant="warning">
      <div className="space-y-4 text-left">
        {/* 标题 */}
        <div className="flex items-center gap-2 pb-3 border-b border-yellow-200/30 dark:border-yellow-700/30">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <Gauge className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Speedtest
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              测试节点的上传和下载速度
            </p>
          </div>
        </div>

        {/* 结果显示区域 - 始终显示框架 */}
        <div className="space-y-3">
          {/* 测试完成标记 */}
          {result && (
            <div className="flex items-center justify-between">
              <Badge variant="success" className="text-xs">
                测试完成
              </Badge>
              {result.timestamp && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(result.timestamp).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* 速度指标 */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-4 bg-gradient-to-br from-[hsl(var(--status-success-50))] to-emerald-50 dark:from-[hsl(var(--status-success-900)/0.2)] dark:to-emerald-900/20 rounded-lg border border-[hsl(var(--status-success-200)/0.5)] dark:border-[hsl(var(--status-success-700)/0.5)] transition-opacity ${!result ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  下载速度
                </span>
              </div>
              <p className={`text-2xl font-bold ${result ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {result ? renderMbps(result.downloadMbps) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mbps</p>
            </div>

            <div className={`p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50 transition-opacity ${!result ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  上传速度
                </span>
              </div>
              <p className={`text-2xl font-bold ${result ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {result ? renderMbps(result.uploadMbps) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mbps</p>
            </div>
          </div>

          {/* 延迟和抖动 */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30 transition-opacity ${!result ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Radio className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Ping 延迟
                </span>
              </div>
              <p className={`text-lg font-semibold ${result ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {result ? renderLatency(result.pingMs) : '--'}
              </p>
            </div>
            <div className={`p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30 transition-opacity ${!result ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  抖动
                </span>
              </div>
              <p className={`text-lg font-semibold ${result ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {result ? renderLatency(result.jitterMs) : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* 执行按钮 */}
        <Button
          onClick={runSpeedtest}
          disabled={loading}
          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white"
        >
          {loading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              测试中，请耐心等待...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              开始速度测试
            </>
          )}
        </Button>

        {/* 说明 */}
        <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>提示：</strong>速度测试会连接 Speedtest.net 或备用服务器，过程可能需要 30-90 秒
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)] border border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-800))] rounded-lg">
            <p className="text-sm text-[hsl(var(--status-error-700))] dark:text-[hsl(var(--status-error-300))]">{error}</p>
          </div>
        )}

        {/* 服务器信息和其他详情 */}
        {result && (
          <div className="space-y-3">
            {/* 服务器信息 */}
            {(result.serverName ||
              result.serverLocation ||
              result.serverCountry ||
              result.serverHost) && (
              <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    测试服务器
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {result.serverName && (
                    <p>
                      <strong>名称:</strong> {result.serverName}
                    </p>
                  )}
                  {result.serverLocation && (
                    <p>
                      <strong>位置:</strong> {result.serverLocation}
                    </p>
                  )}
                  {result.serverCountry && (
                    <p>
                      <strong>国家:</strong> {result.serverCountry}
                    </p>
                  )}
                  {result.serverHost && (
                    <p>
                      <strong>主机:</strong> {result.serverHost}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {result.executedAt && <p>执行节点：{result.executedAt}</p>}
              {typeof result.duration === "number" && (
                <p>测试耗时：{(result.duration / 1000).toFixed(2)} 秒</p>
              )}
            </div>

            {/* 原始结果 */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-yellow-600 dark:text-yellow-400 hover:underline">
                查看完整结果
              </summary>
              <div className="mt-2 p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {JSON.stringify(rawResult ?? result, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default SpeedtestTool;
