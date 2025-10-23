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

interface SpeedtestResult {
  download?: { bandwidth?: number };
  upload?: { bandwidth?: number };
  ping?: { latency?: number; jitter?: number };
  server?: {
    name?: string;
    location?: string;
    country?: string;
    host?: string;
  };
}

export const SpeedtestTool: React.FC<SpeedtestToolProps> = ({ nodeId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeedtestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSpeedtest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.runSpeedtest(nodeId);

      if (response.success && response.data) {
        setResult(response.data);
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

  const formatSpeed = (bps?: number) => {
    if (!bps) return "N/A";
    const mbps = bps / 1000000;
    return mbps.toFixed(2);
  };

  return (
    <GlassCard variant="warning">
      <div className="space-y-4">
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

        {/* 说明 */}
        <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>提示：</strong>速度测试将使用 Speedtest.net 服务器，测试通常需要 30-90 秒
          </p>
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

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="success" className="text-xs">
                测试完成
              </Badge>
            </div>

            {/* 速度指标 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200/50 dark:border-green-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    下载速度
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatSpeed(result.download?.bandwidth)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mbps</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    上传速度
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatSpeed(result.upload?.bandwidth)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mbps</p>
              </div>
            </div>

            {/* 延迟和抖动 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  延迟 (Ping)
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {result.ping?.latency?.toFixed(2) || "N/A"} ms
                </p>
              </div>

              <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  抖动 (Jitter)
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {result.ping?.jitter?.toFixed(2) || "N/A"} ms
                </p>
              </div>
            </div>

            {/* 服务器信息 */}
            {result.server && (
              <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    测试服务器
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p>
                    <strong>名称:</strong> {result.server.name || "N/A"}
                  </p>
                  <p>
                    <strong>位置:</strong> {result.server.location || "N/A"}
                  </p>
                  <p>
                    <strong>国家:</strong> {result.server.country || "N/A"}
                  </p>
                  {result.server.host && (
                    <p>
                      <strong>主机:</strong> {result.server.host}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 原始结果 */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-yellow-600 dark:text-yellow-400 hover:underline">
                查看完整结果
              </summary>
              <div className="mt-2 p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/30 dark:border-yellow-700/30">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100 max-h-60 overflow-y-auto">
                  {JSON.stringify(result, null, 2)}
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
