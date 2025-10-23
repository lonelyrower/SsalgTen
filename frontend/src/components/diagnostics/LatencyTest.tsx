import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiService } from "@/services/api";
import { Play, Clock, Target, BarChart3, Globe, Zap } from "lucide-react";

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
  const [testType, setTestType] = useState<"standard" | "comprehensive">(
    "standard",
  );
  const [error, setError] = useState<string | null>(null);

  const getStatusColor = (status: LatencyResult["status"]): string => {
    switch (status) {
      case "excellent":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "good":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "poor":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "failed":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
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
        return "失败 - 无法连接";
      default:
        return "未知";
    }
  };

  const runLatencyTest = async () => {
    // 优先使用新的API（通过后端代理）
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

    // 降级到直接调用Agent端点
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
      {/* 测试控制面板 */}
      <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Globe className="w-5 h-5 text-primary" />
            网络延迟测试 - 节点到全球站点
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex gap-2">
              <Button
                variant={testType === "standard" ? "default" : "outline"}
                size="sm"
                onClick={() => setTestType("standard")}
                disabled={isLoading}
                className="text-xs"
              >
                <Target className="w-4 h-4 mr-1" />
                标准测试 (8站点)
              </Button>
              <Button
                variant={testType === "comprehensive" ? "default" : "outline"}
                size="sm"
                onClick={() => setTestType("comprehensive")}
                disabled={isLoading}
                className="text-xs"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                完整测试 (20站点)
              </Button>
            </div>

            <Button
              onClick={runLatencyTest}
              disabled={isLoading || (!nodeId && !agentEndpoint)}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  测试中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  开始测试
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResult && (
        <div className="space-y-4">
          {/* 结果概览 */}
          <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-green-400" />
                测试结果概览
                <Badge variant="outline" className="ml-2">
                  {testResult.testType === "standard" ? "标准测试" : "完整测试"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div className="text-2xl font-bold text-white">
                    {testResult.summary.successful}/{testResult.summary.total}
                  </div>
                  <div className="text-sm text-gray-400">成功率</div>
                </div>

                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div className="text-2xl font-bold text-primary">
                    {testResult.summary.averageLatency.toFixed(1)}ms
                  </div>
                  <div className="text-sm text-gray-400">平均延迟</div>
                </div>

                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div className="text-2xl font-bold text-green-400">
                    {testResult.summary.excellentCount}
                  </div>
                  <div className="text-sm text-gray-400">优秀连接</div>
                </div>

                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div className="text-2xl font-bold text-yellow-400">
                    {(testResult.duration / 1000).toFixed(1)}s
                  </div>
                  <div className="text-sm text-gray-400">测试耗时</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 详细结果 */}
          <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="w-5 h-5 text-purple-400" />
                详细延迟结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {testResult.results.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-800/30 rounded border border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {getStatusIcon(result.status)}
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {result.target}
                        </div>
                        <div className="text-xs text-gray-400">
                          {getStatusDescription(result.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(result.status)}>
                        {formatLatency(result.latency)}
                      </Badge>
                      {result.error && (
                        <div className="text-xs text-red-400 max-w-40 truncate">
                          {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 延迟等级说明 */}
          <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-sm">延迟等级说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>🟢</span>
                  <span className="text-green-400">优秀 (&lt; 50ms)</span>
                  <span className="text-gray-400">- 适合游戏和视频通话</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🟡</span>
                  <span className="text-yellow-400">良好 (50-150ms)</span>
                  <span className="text-gray-400">- 适合网页浏览和视频</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔴</span>
                  <span className="text-orange-400">较差 (&gt; 150ms)</span>
                  <span className="text-gray-400">- 仅适合基本使用</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚫</span>
                  <span className="text-red-400">失败</span>
                  <span className="text-gray-400">- 无法连接</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LatencyTest;
