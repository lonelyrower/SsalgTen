import React, { useState, useMemo } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Route, Play, Copy, Check, Activity } from "lucide-react";

interface TracerouteToolProps {
  nodeId: string;
}

interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  rtt1?: number;
  rtt2?: number;
  rtt3?: number;
}

interface TracerouteResultData {
  target?: string;
  hops?: TracerouteHop[];
  totalHops?: number;
  duration?: number;
  executedAt?: string;
  output?: string;
}

const QUICK_TARGETS = [
  { label: "Google", value: "google.com" },
  { label: "Baidu", value: "baidu.com" },
  { label: "GitHub", value: "github.com" },
  { label: "Cloudflare", value: "1.1.1.1" },
];

export const TracerouteTool: React.FC<TracerouteToolProps> = ({ nodeId }) => {
  const [target, setTarget] = useState("");
  const [maxHops, setMaxHops] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TracerouteResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runTraceroute = async () => {
    if (!target.trim()) {
      setError("请输入目标地址");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.runTraceroute(
        nodeId,
        target.trim(),
        maxHops,
      );

      if (response.success && response.data) {
        const data = response.data as TracerouteResultData;
        setResult(data);
      } else {
        setError(response.error || "Traceroute 测试失败");
      }
    } catch (err) {
      console.error("Traceroute test failed:", err);
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
            target: result.target,
            hops: result.hops,
          },
          null,
          2,
        );
      navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hopRows = useMemo(() => {
    if (!result?.hops || !Array.isArray(result.hops)) return [];
    return result.hops.map((hop) => ({
      hop: hop.hop,
      address: hop.hostname
        ? `${hop.hostname}${hop.ip ? ` (${hop.ip})` : ""}`
        : hop.ip || "N/A",
      rtt1: hop.rtt1 ?? null,
      rtt2: hop.rtt2 ?? null,
      rtt3: hop.rtt3 ?? null,
    }));
  }, [result]);

  const formatLatency = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      return "N/A";
    }
    return `${value.toFixed(2)} ms`;
  };

  return (
    <GlassCard variant="purple">
      <div className="space-y-4 text-left">
        {/* 标题 */}
        <div className="flex items-center gap-2 pb-3 border-b border-primary/30">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Traceroute
            </h3>
            <p className="text-xs text-muted-foreground">
              追踪数据包的路由路径
            </p>
          </div>
        </div>

        {/* 快捷目标 */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">
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
            <label className="text-xs text-muted-foreground mb-2 block">
              目标地址 <span className="text-[hsl(var(--error))]">*</span>
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="IP地址或域名 (例如: google.com)"
              disabled={loading}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm surface-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              最大跳数
            </label>
            <select
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              disabled={loading}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm surface-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={15}>15 跳</option>
              <option value={30}>30 跳 (默认)</option>
              <option value={50}>50 跳</option>
              <option value={64}>64 跳</option>
            </select>
          </div>
        </div>

        {/* 执行按钮 */}
        <Button
          onClick={runTraceroute}
          disabled={loading || !target.trim()}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {loading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              追踪中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              开始路由追踪
            </>
          )}
        </Button>

        {/* 提示信息 */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground">
            <strong>提示：</strong>Traceroute 可能需要 30-60 秒完成，请耐心等待
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-[hsl(var(--error))]/10 border border-[hsl(var(--error))]/30 rounded-lg">
            <p className="text-sm text-[hsl(var(--error))]">{error}</p>
          </div>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="success" className="text-xs">
                追踪完成
              </Badge>
              <button
                onClick={copyResult}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
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
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  跳数
                </div>
                <p className="text-xl font-semibold text-foreground">
                  {result.totalHops ?? hopRows.length}
                </p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  耗时
                </div>
                <p className="text-xl font-semibold text-foreground">
                  {typeof result.duration === "number"
                    ? `${(result.duration / 1000).toFixed(2)} 秒`
                    : "N/A"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-primary/20">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">跳数</th>
                    <th className="px-3 py-2 text-left font-medium">节点</th>
                    <th className="px-3 py-2 text-left font-medium">RTT #1</th>
                    <th className="px-3 py-2 text-left font-medium">RTT #2</th>
                    <th className="px-3 py-2 text-left font-medium">RTT #3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hopRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                        未获取到有效的路由跳数
                      </td>
                    </tr>
                  ) : (
                    hopRows.map((row) => (
                      <tr key={row.hop} className="text-foreground">
                        <td className="px-3 py-2 font-mono">{row.hop}</td>
                        <td className="px-3 py-2 break-all">{row.address}</td>
                        <td className="px-3 py-2">{formatLatency(row.rtt1)}</td>
                        <td className="px-3 py-2">{formatLatency(row.rtt2)}</td>
                        <td className="px-3 py-2">{formatLatency(row.rtt3)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              {result.target && <p>目标：{result.target}</p>}
              {result.executedAt && <p>执行节点：{result.executedAt}</p>}
            </div>

            {result.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-primary hover:underline">
                  查看原始输出
                </summary>
                <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20 max-h-60 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
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

export default TracerouteTool;
