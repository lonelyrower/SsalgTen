import React, { useMemo } from "react";
import type {
  NodeStreamingSummary,
  StreamingService,
  StreamingServiceResult,
} from "@/types/streaming";
import {
  STATUS_TEXT,
  STATUS_COLORS,
  UNLOCK_TYPE_LABELS,
  UNLOCK_TYPE_COLORS,
  STREAMING_SERVICES,
} from "@/types/streaming";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface StreamingNodeTableProps {
  nodes: NodeStreamingSummary[];
  services: StreamingService[];
  onRetest: (nodeId: string) => Promise<void> | void;
  testingMap: Record<string, boolean>;
  onNodeClick?: (nodeId: string) => void;
}

const formatRelativeTime = (iso?: string) => {
  if (!iso) return "从未检测";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN });
  } catch {
    return "未知";
  }
};

const getServiceResult = (
  services: StreamingServiceResult[],
  service: StreamingService,
) => services.find((item) => item.service === service);

const unlockTypeLabel = (unlockType?: StreamingServiceResult["unlockType"]) => {
  if (!unlockType) return UNLOCK_TYPE_LABELS.unknown;
  return UNLOCK_TYPE_LABELS[unlockType];
};

export const StreamingNodeTable: React.FC<StreamingNodeTableProps> = ({
  nodes,
  services,
  onRetest,
  testingMap,
  onNodeClick,
}) => {
  const handleRetest = async (nodeId: string) => {
    if (!onRetest) return;
    await onRetest(nodeId);
  };

  const columns = useMemo(
    () =>
      services.map((service) => ({
        key: service,
        label: STREAMING_SERVICES[service]?.name ?? service.toUpperCase(),
      })),
    [services],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
              节点
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28"
                title={col.label}
              >
                <div className="flex items-center justify-center">
                  <StreamingIcon service={col.key} size="sm" />
                </div>
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
              最近检测
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {nodes.map((node) => {
            const isTesting = !!testingMap[node.nodeId];
            const isExpired = node.isExpired;
            const relativeTime = formatRelativeTime(node.lastScanned);
            return (
              <tr
                key={node.nodeId}
                className="bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center h-full">
                    <button
                      type="button"
                      onClick={() => onNodeClick?.(node.nodeId)}
                      className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100"
                    >
                      {node.country && (
                        <CountryFlagSvg country={node.country} className="w-6 h-6" />
                      )}
                      <div>
                        <div className="font-semibold truncate max-w-[200px]">
                          {node.nodeName}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {node.city ? `${node.city}, ${node.country}` : node.country}
                        </p>
                      </div>
                    </button>
                  </div>
                </td>
                {columns.map((col) => {
                  const serviceResult = getServiceResult(node.services, col.key);
                  if (!serviceResult) {
                    return (
                      <td key={col.key} className="px-4 py-4 text-center text-xs text-slate-400">
                        —
                      </td>
                    );
                  }
                  const statusClass = STATUS_COLORS[serviceResult.status];
                  const unlockType = serviceResult.unlockType ?? "unknown";
                  const unlockClass = UNLOCK_TYPE_COLORS[unlockType];
                  // 解锁、仅自制、待支持状态显示地区和解锁类型
                  const showDetails = serviceResult.status === "yes" || serviceResult.status === "org" || serviceResult.status === "pending";

                  return (
                    <td key={col.key} className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-center">
                        {/* 第一行：状态 */}
                        <div className={`text-sm font-medium ${statusClass}`}>
                          {STATUS_TEXT[serviceResult.status]}
                        </div>

                        {/* 第二行：地区（仅解锁状态显示） */}
                        {showDetails && serviceResult.region && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {serviceResult.region.toUpperCase()}
                          </div>
                        )}

                        {/* 第三行：解锁类型（仅解锁状态显示） */}
                        {showDetails && serviceResult.unlockType && (
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${unlockClass}`}
                            >
                              {unlockTypeLabel(serviceResult.unlockType)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col gap-1 items-center">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{relativeTime}</span>
                      </div>
                      {isExpired && (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>数据过期</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center h-full">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRetest(node.nodeId);
                      }}
                      disabled={isTesting || !onRetest}
                    >
                      {isTesting ? "检测中..." : "检测"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
