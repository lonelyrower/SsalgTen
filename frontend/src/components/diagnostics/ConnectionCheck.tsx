import React, { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import type { NodeData } from "@/services/api";
import {
  CheckCircle,
  XCircle,
  Globe,
  Zap,
  RefreshCw,
} from "lucide-react";

interface ConnectionCheckProps {
  node: NodeData;
}

interface CheckResult {
  nodeOnline: boolean;
  visitorIP: string | null;
  latency: number | null;
  packetLoss: number | null;
  lastChecked: Date;
}

interface DiagnosticPingData {
  avg?: number;
  time?: number;
  packetLoss?: number;
  output?: string;
}

export const ConnectionCheck: React.FC<ConnectionCheckProps> = ({ node }) => {
  const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performCheck = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      // 获取访客IP
      const visitorResponse = await apiService.getVisitorInfo();
      let visitorIP: string | null = null;
      let checkError: string | null = null;

      if (visitorResponse.success && visitorResponse.data) {
        visitorIP = visitorResponse.data.ip;
      } else if (visitorResponse.error) {
        checkError = visitorResponse.error;
      }

      // 快速Ping测试（1次）- 测试节点到访问者的连通性
      let latency: number | null = null;
      let packetLoss: number | null = null;

      if (visitorIP && node.status === "online") {
        try {
          const pingResponse = await apiService.runPing(node.id, visitorIP, 1);

          if (pingResponse.success && pingResponse.data) {
            const data = pingResponse.data as DiagnosticPingData;
            const resolvedLatency =
              typeof data.avg === "number"
                ? data.avg
                : typeof data.time === "number"
                  ? data.time
                  : null;
            latency =
              resolvedLatency !== null && !Number.isNaN(resolvedLatency)
                ? Number(resolvedLatency.toFixed(2))
                : null;
            packetLoss =
              typeof data.packetLoss === "number" && data.packetLoss >= 0
                ? data.packetLoss
                : null;
          } else if (pingResponse.error) {
            checkError = pingResponse.error;
          }
        } catch (pingErr) {
          checkError =
            pingErr instanceof Error
              ? pingErr.message
              : "Ping 测试失败，无法获取延迟";
        }
      }

      setResult({
        nodeOnline: node.status === "online",
        visitorIP,
        latency,
        packetLoss,
        lastChecked: new Date(),
      });

      if (checkError) {
        setError(checkError);
      }
    } catch (err) {
      console.error("Connection check failed:", err);
      setError("连接性检查失败");
      setResult(null);
    } finally {
      setChecking(false);
    }
  }, [node.id, node.status]);

  useEffect(() => {
    performCheck();
  }, [performCheck]);

  if (checking && !result) {
    return (
      <GlassCard variant="info">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner text="正在检查连接性..." />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="info">
      <div className="space-y-4 text-left">
        {/* 标题 - 统一样式 */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-200/30 dark:border-cyan-700/30">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                连接性自检
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                测试节点到您的连通性和延迟
              </p>
            </div>
          </div>
          <button
            onClick={performCheck}
            disabled={checking}
            className="p-2 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition-colors"
            title="重新检查"
            aria-label="重新检查连接性"
          >
            <RefreshCw
              className={`h-4 w-4 text-cyan-600 dark:text-cyan-400 ${checking ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-3">
          {/* 节点状态 */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-lg border border-cyan-200/30 dark:border-cyan-700/30">
            <div className="flex items-center gap-3">
              {result.nodeOnline ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">节点状态</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {result.nodeOnline ? "在线" : "离线"}
                </p>
              </div>
            </div>
            <Badge
              variant={result.nodeOnline ? "success" : "destructive"}
              className="text-xs"
            >
              {result.nodeOnline ? "可用" : "不可用"}
            </Badge>
          </div>

          {/* 访客IP */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-lg border border-cyan-200/30 dark:border-cyan-700/30">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">您的IP地址</p>
                <p className="font-mono font-semibold text-gray-900 dark:text-white">
                  {result.visitorIP || "无法获取"}
                </p>
              </div>
            </div>
          </div>

          {/* 基本延迟 */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-lg border border-cyan-200/30 dark:border-cyan-700/30">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  节点 → 您的延迟
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {result.latency !== null ? (
                    <>
                      <span className="text-2xl">
                        {result.latency.toFixed(2)}
                      </span>
                      <span className="text-sm ml-1">ms</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {result.nodeOnline ? "测试中..." : "节点离线"}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {result.latency !== null && (
              <Badge
                variant={
                  result.latency < 50
                    ? "success"
                    : result.latency < 150
                      ? "default"
                      : "destructive"
                }
                className="text-xs"
              >
                {result.latency < 50
                  ? "优秀"
                  : result.latency < 150
                    ? "良好"
                    : "较差"}
              </Badge>
            )}
          </div>

          {/* 丢包 */}
          {result.packetLoss !== null && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-lg border border-cyan-200/30 dark:border-cyan-700/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                丢包率
              </div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {result.packetLoss.toFixed(1)}%
              </div>
            </div>
          )}

          {/* 最后检查时间 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            最后检查: {result.lastChecked.toLocaleTimeString("zh-CN")}
          </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default ConnectionCheck;
