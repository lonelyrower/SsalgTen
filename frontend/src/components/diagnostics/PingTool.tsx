import React, { useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Wifi, Play, Copy, Check } from "lucide-react";

interface PingToolProps {
  nodeId: string;
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
  const [result, setResult] = useState<string | null>(null);
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
        // 格式化结果
        const data = response.data as any;
        setResult(data.output || JSON.stringify(data, null, 2));
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
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <GlassCard variant="success">
      <div className="space-y-4">
        {/* 标题 */}
        <div className="flex items-center gap-2 pb-3 border-b border-green-200/30 dark:border-green-700/30">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
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
              目标地址 <span className="text-red-500">*</span>
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
          className="w-full bg-green-600 hover:bg-green-500 text-white"
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
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="success" className="text-xs">
                测试完成
              </Badge>
              <button
                onClick={copyResult}
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    复制结果
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-200/30 dark:border-green-700/30 max-h-96 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default PingTool;
