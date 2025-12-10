import React, { useState, useEffect, useCallback } from "react";
import type { NodeData, DiagnosticRecord } from "@/services/api";
import { apiService } from "@/services/api";
import { GlassCard } from "@/components/admin/GlassCard";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { History, RefreshCw, CheckCircle, XCircle, Clock, Target, Wrench, Server, FileText, AlertCircle, Info } from "lucide-react";
import { ConnectionCheck } from "@/components/diagnostics/ConnectionCheck";
import { PingTool } from "@/components/diagnostics/PingTool";
import { TracerouteTool } from "@/components/diagnostics/TracerouteTool";
import { MTRTool } from "@/components/diagnostics/MTRTool";
import { SpeedtestTool } from "@/components/diagnostics/SpeedtestTool";
import { LatencyTest } from "@/components/diagnostics/LatencyTest";
import { ServerDetailsPanel } from "@/components/nodes/ServerDetailsPanel";
import type { HeartbeatData } from "@/types/heartbeat";

interface NetworkToolkitProps {
  selectedNode: NodeData;
  heartbeatData?: HeartbeatData;
}

type TabType = "tools" | "history" | "system" | "logs";

interface NodeEvent {
  id: string;
  type: string;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export const NetworkToolkit: React.FC<NetworkToolkitProps> = ({ selectedNode, heartbeatData }) => {
  const [activeTab, setActiveTab] = useState<TabType>("system");
  const [diagnosticRecords, setDiagnosticRecords] = useState<DiagnosticRecord[]>([]);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagnosticFilter, setDiagnosticFilter] = useState<
    "ALL" | "PING" | "TRACEROUTE" | "MTR" | "SPEEDTEST"
  >("ALL");
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // 获取诊断历史记录
  const fetchDiagnosticRecords = useCallback(async () => {
    try {
      setLoadingDiagnostics(true);
      const response = await apiService.getNodeDiagnostics(
        selectedNode.id,
        undefined,
        50,
      );
      if (response.success && response.data) {
        setDiagnosticRecords(response.data);
      } else {
        setDiagnosticRecords([]);
      }
    } catch (error) {
      console.error("Failed to fetch diagnostic records:", error);
      setDiagnosticRecords([]);
    } finally {
      setLoadingDiagnostics(false);
    }
  }, [selectedNode.id]);

  // 获取节点事件日志
  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const response = await apiService.getNodeEvents(selectedNode.id, 100);
      if (response.success && response.data) {
        setEvents(response.data as NodeEvent[]);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error("Failed to fetch node events:", error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedNode.id]);

  // 当切换到诊断历史标签页时获取诊断记录
  useEffect(() => {
    if (activeTab === "history") {
      fetchDiagnosticRecords();
    } else if (activeTab === "logs") {
      fetchEvents();
    }
  }, [activeTab, fetchDiagnosticRecords, fetchEvents]);

  const filteredDiagnostics = diagnosticRecords.filter(
    (record) =>
      diagnosticFilter === "ALL" || record.type === diagnosticFilter,
  );

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-[hsl(var(--status-success-600))]" />
    ) : (
      <XCircle className="h-4 w-4 text-[hsl(var(--status-error-600))]" />
    );
  };

  const getDiagnosticTypeColor = (type: string) => {
    switch (type) {
      case "PING":
        return "bg-primary/10 text-primary";
      case "TRACEROUTE":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "MTR":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "SPEEDTEST":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] dark:bg-[hsl(var(--muted))]/30 dark:text-[hsl(var(--muted-foreground))]";
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const tabs = [
    { id: "system" as TabType, label: "系统详情", icon: Server },
    { id: "tools" as TabType, label: "诊断工具", icon: Wrench },
    { id: "history" as TabType, label: "诊断历史", icon: History },
    { id: "logs" as TabType, label: "运行日志", icon: FileText },
  ];

  const getTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("error") || lowerType.includes("fail")) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (lowerType.includes("warning") || lowerType.includes("warn")) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (lowerType.includes("success") || lowerType.includes("complete")) {
      return <CheckCircle className="h-4 w-4" />;
    }
    return <Info className="h-4 w-4" />;
  };

  const getTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("error") || lowerType.includes("fail")) {
      return "text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]";
    }
    if (lowerType.includes("warning") || lowerType.includes("warn")) {
      return "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))]";
    }
    if (lowerType.includes("success") || lowerType.includes("complete")) {
      return "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]";
    }
    return "text-blue-600 dark:text-blue-400";
  };

  const getEventVariant = (type: string): "default" | "success" | "danger" | "warning" => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("error") || lowerType.includes("fail")) {
      return "danger";
    }
    if (lowerType.includes("warning") || lowerType.includes("warn")) {
      return "warning";
    }
    if (lowerType.includes("success") || lowerType.includes("complete")) {
      return "success";
    }
    return "default";
  };

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="加载中..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="flex justify-center">
        <AdminTabs
          tabs={tabs}
          value={activeTab}
          onChange={(value) => setActiveTab(value as TabType)}
        />
      </div>

      {/* 标签页内容 */}
      {activeTab === "system" ? (
        <div className="space-y-6">
          {/* 系统详情 */}
          <ServerDetailsPanel
            node={selectedNode}
            heartbeatData={heartbeatData}
          />
        </div>
      ) : activeTab === "tools" ? (
        <div className="space-y-6">
          {/* 连接性自检 */}
          <ConnectionCheck node={selectedNode} />

          {/* 四大诊断工具 - 2x2网格 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PingTool nodeId={selectedNode.id} />
            <TracerouteTool nodeId={selectedNode.id} />
            <MTRTool nodeId={selectedNode.id} />
            <SpeedtestTool nodeId={selectedNode.id} />
          </div>

          {/* 延迟测试 */}
          <LatencyTest nodeId={selectedNode.id} onTestComplete={() => {}} />
        </div>
      ) : activeTab === "history" ? (
        <div className="space-y-6">
          {/* 诊断记录控制面板 */}
          <GlassCard variant="default" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--foreground))]">
                <History className="h-4 w-4" />
                <span>诊断历史记录</span>
              </h3>
              <div className="flex items-center space-x-3">
                <select
                  value={diagnosticFilter}
                  onChange={(e) =>
                    setDiagnosticFilter(
                      e.target.value as typeof diagnosticFilter,
                    )
                  }
                  className="px-3 py-1.5 border border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">全部类型</option>
                  <option value="PING">PING</option>
                  <option value="TRACEROUTE">TRACEROUTE</option>
                  <option value="MTR">MTR</option>
                  <option value="SPEEDTEST">SPEEDTEST</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDiagnosticRecords}
                  disabled={loadingDiagnostics}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingDiagnostics ? "animate-spin" : ""}`}
                  />
                  刷新
                </Button>
              </div>
            </div>

            {loadingDiagnostics ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner text="加载诊断记录..." />
              </div>
            ) : filteredDiagnostics.length === 0 ? (
              <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>
                  {diagnosticFilter === "ALL"
                    ? "暂无诊断记录"
                    : `暂无 ${diagnosticFilter} 类型的诊断记录`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDiagnostics.map((record) => (
                  <GlassCard
                    key={record.id}
                    variant={record.success ? "success" : "danger"}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">{getStatusIcon(record.success)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getDiagnosticTypeColor(record.type)}>
                              {record.type}
                            </Badge>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {record.success ? "成功" : "失败"}
                            </span>
                          </div>

                          {record.target && (
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                              <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                                {record.target}
                              </span>
                            </div>
                          )}

                          {record.error && (
                            <p className="text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))] mb-2">
                              {record.error}
                            </p>
                          )}

                          {record.result && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary hover:underline">
                                查看详细结果
                              </summary>
                              <div className="mt-2 p-3 bg-black/5 dark:bg-black/20 rounded-lg">
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                  {record.result}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(record.duration)}</span>
                        </div>
                        <span className="text-right">
                          {new Date(record.timestamp).toLocaleString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      ) : activeTab === "logs" ? (
        <div className="space-y-6">
          {/* 运行日志 */}
          <GlassCard variant="default" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--foreground))]">
                <FileText className="h-4 w-4" />
                <span>节点运行日志</span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEvents}
                disabled={loadingEvents}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingEvents ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </div>

            {loadingEvents ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner text="加载日志..." />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无运行日志</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <GlassCard key={event.id} variant={getEventVariant(event.type)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-0.5 ${getTypeColor(event.type)}`}>
                          {getTypeIcon(event.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              className={
                                event.type.toLowerCase().includes("error") || event.type.toLowerCase().includes("fail")
                                  ? "bg-[hsl(var(--status-error-100))] text-[hsl(var(--status-error-800))] dark:bg-[hsl(var(--status-error-900)/0.3)] dark:text-[hsl(var(--status-error-400))]"
                                  : event.type.toLowerCase().includes("warning")
                                  ? "bg-[hsl(var(--status-warning-100))] text-[hsl(var(--status-warning-800))] dark:bg-[hsl(var(--status-warning-900)/0.3)] dark:text-[hsl(var(--status-warning-400))]"
                                  : event.type.toLowerCase().includes("success")
                                  ? "bg-[hsl(var(--status-success-100))] text-[hsl(var(--status-success-800))] dark:bg-[hsl(var(--status-success-900)/0.3)] dark:text-[hsl(var(--status-success-400))]"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              }
                            >
                              {event.type}
                            </Badge>
                          </div>

                          {event.message && (
                            <p className="text-sm text-[hsl(var(--foreground))] mb-2">
                              {event.message}
                            </p>
                          )}

                          {event.details && Object.keys(event.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary hover:underline">
                                查看详细信息
                              </summary>
                              <div className="mt-2 p-3 bg-black/5 dark:bg-black/20 rounded-lg">
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(event.details, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <Clock className="h-3 w-3" />
                        <span className="text-right">
                          {new Date(event.timestamp).toLocaleString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
};

export default NetworkToolkit;
