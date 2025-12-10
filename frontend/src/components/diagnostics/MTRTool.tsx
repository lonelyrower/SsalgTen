import React, { useMemo, useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Activity, Play, Copy, Check } from "lucide-react";

interface MTRToolProps {
  nodeId: string;
}

interface PingSummary {
  avg?: number;
  min?: number;
  max?: number;
  packetLoss?: number;
}

interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt1?: number;
  rtt2?: number;
  rtt3?: number;
}

interface CombinedTraceroute {
  hops?: TracerouteHop[];
  totalHops?: number;
}

interface NativeMTRHub {
  host?: string;
  "Loss%"?: number;
  Snt?: number;
  Last?: number;
  Avg?: number;
  Best?: number;
  Wrst?: number;
  StDev?: number;
}

type MTRResultData = {
  target?: string;
  type?: string;
  cycles?: number;
  duration?: number;
  executedAt?: string;
  summary?: {
    avgLatency?: number;
    packetLoss?: number;
    totalHops?: number;
  };
  ping?: PingSummary;
  traceroute?: CombinedTraceroute;
  result?: {
    report?: {
      hubs?: NativeMTRHub[];
    };
  };
  output?: string;
};

const QUICK_TARGETS = [
  { label: "Google", value: "google.com" },
  { label: "Baidu", value: "baidu.com" },
  { label: "Cloudflare", value: "1.1.1.1" },
  { label: "GitHub", value: "github.com" },
];

export const MTRTool: React.FC<MTRToolProps> = ({ nodeId }) => {
  const [target, setTarget] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MTRResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runMTR = async () => {
    if (!target.trim()) {
      setError("请输入目标地址");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.runMTR(nodeId, target.trim(), count);

      if (response.success && response.data) {
        const data = response.data as MTRResultData;
        setResult(data);
      } else {
        setError(response.error || "MTR 测试失败");
      }
    } catch (err) {
      console.error("MTR test failed:", err);
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      const raw =
        result.output || JSON.stringify(result, null, 2);
      navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hops = useMemo(() => {
    if (!result) return [];

    if (result.type === "native-mtr" && result.result?.report?.hubs) {
      return result.result.report.hubs.map((hub, index) => ({
        hop: index + 1,
        address: hub.host ?? "未知",
        loss: typeof hub["Loss%"] === "number" ? hub["Loss%"] : null,
        sent: hub.Snt ?? null,
        last: hub.Last ?? null,
        avg: hub.Avg ?? null,
        best: hub.Best ?? null,
        worst: hub.Wrst ?? null,
        stdev: hub.StDev ?? null,
      }));
    }

    if (result.traceroute?.hops) {
      return result.traceroute.hops.map((hop) => ({
        hop: hop.hop,
        address: hop.hostname
          ? `${hop.hostname}${hop.ip ? ` (${hop.ip})` : ""}`
          : hop.ip || "N/A",
        loss: result.summary?.packetLoss ?? result.ping?.packetLoss ?? null,
        sent: count,
        last: hop.rtt1 ?? null,
        avg: hop.rtt1 ?? null,
        best: hop.rtt2 ?? null,
        worst: hop.rtt3 ?? null,
        stdev: null,
      }));
    }

    return [];
  }, [result, count]);

  const resolveLatency = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      return "N/A";
    }
    return `${value.toFixed(2)} ms`;
  };

  const resolveLoss = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      return "N/A";
    }
    return `${value.toFixed(1)}%`;
  };

  return (
    <GlassCard variant="orange">
      <div className="space-y-4 text-left">
        {/* 标题 */}
        <div className="flex items-center gap-2 pb-3 border-b border-orange-200/30 dark:border-orange-700/30">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
              MTR 测试
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              综合网络诊断 (Ping + Traceroute)
            </p>
          </div>
        </div>

        {/* 快捷目标 */}
        <div>
          <label className="text-xs text-[hsl(var(--muted-foreground))] mb-2 block">
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
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-2 block">
              目标地址 <span className="text-[hsl(var(--status-error-500))]">*</span>
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="IP地址或域名 (例如: google.com)"
              disabled={loading}
              className="w-full px-3 py-2 border border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-2 block">
              测试循环次数
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={loading}
              className="w-full px-3 py-2 border border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value={5}>5 次</option>
              <option value={10}>10 次 (默认)</option>
              <option value={20}>20 次</option>
              <option value={50}>50 次</option>
            </select>
          </div>
        </div>

        {/* 执行按钮 */}
        <Button
          onClick={runMTR}
          disabled={loading || !target.trim()}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white"
        >
          {loading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              测试中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              开始 MTR 测试
            </>
          )}
        </Button>

        {/* 提示信息 */}
        <div className="p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-200/30 dark:border-orange-700/30">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <strong>提示：</strong>MTR 结合 Ping 与 Traceroute，可展示各跳延迟与丢包情况
          </p>
        </div>

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
              <Badge variant="success" className="text-xs">
                测试完成
              </Badge>
              <button
                onClick={copyResult}
                className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
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
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                  平均延迟
                </div>
                <p className="text-xl font-semibold text-[hsl(var(--foreground))]">
                  {resolveLatency(
                    result.summary?.avgLatency ?? result.ping?.avg ?? null,
                  )}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                  丢包率
                </div>
                <p className="text-xl font-semibold text-[hsl(var(--foreground))]">
                  {resolveLoss(
                    result.summary?.packetLoss ?? result.ping?.packetLoss ?? null,
                  )}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-orange-200/30 dark:border-orange-700/30">
              <table className="min-w-full divide-y divide-orange-200/40 dark:divide-orange-900/30 text-xs">
                <thead className="bg-orange-50/70 dark:bg-orange-900/20 text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">跳数</th>
                    <th className="px-3 py-2 text-left font-medium">节点</th>
                    <th className="px-3 py-2 text-left font-medium">丢包%</th>
                    <th className="px-3 py-2 text-left font-medium">发送</th>
                    <th className="px-3 py-2 text-left font-medium">最后</th>
                    <th className="px-3 py-2 text-left font-medium">平均</th>
                    <th className="px-3 py-2 text-left font-medium">最佳</th>
                    <th className="px-3 py-2 text-left font-medium">最差</th>
                    <th className="px-3 py-2 text-left font-medium">抖动</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 dark:divide-orange-900/30">
                  {hops.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-[hsl(var(--muted-foreground))]">
                        未获取到有效的 MTR 数据
                      </td>
                    </tr>
                  ) : (
                    hops.map((hop) => (
                      <tr key={`${hop.hop}-${hop.address}`} className="text-[hsl(var(--foreground))]">
                        <td className="px-3 py-2 font-mono">{hop.hop}</td>
                        <td className="px-3 py-2 break-all">{hop.address}</td>
                        <td className="px-3 py-2">
                          {hop.loss !== null && hop.loss !== undefined
                            ? `${hop.loss.toFixed(1)}%`
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">{hop.sent ?? "N/A"}</td>
                        <td className="px-3 py-2">
                          {hop.last !== null && hop.last !== undefined
                            ? `${hop.last.toFixed(2)} ms`
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {hop.avg !== null && hop.avg !== undefined
                            ? `${hop.avg.toFixed(2)} ms`
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {hop.best !== null && hop.best !== undefined
                            ? `${hop.best.toFixed(2)} ms`
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {hop.worst !== null && hop.worst !== undefined
                            ? `${hop.worst.toFixed(2)} ms`
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {hop.stdev !== null && hop.stdev !== undefined
                            ? `${hop.stdev.toFixed(2)}`
                            : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
              {result.target && <p>目标：{result.target}</p>}
              {result.executedAt && <p>执行节点：{result.executedAt}</p>}
              {typeof result.cycles === "number" && (
                <p>循环次数：{result.cycles}</p>
              )}
              {typeof result.duration === "number" && (
                <p>诊断耗时：{(result.duration / 1000).toFixed(2)} 秒</p>
              )}
            </div>

            {result.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-orange-600 dark:text-orange-400 hover:underline">
                  查看原始输出
                </summary>
                <div className="mt-2 p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-200/30 dark:border-orange-700/30 max-h-60 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-[hsl(var(--foreground))]">
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

export default MTRTool;
