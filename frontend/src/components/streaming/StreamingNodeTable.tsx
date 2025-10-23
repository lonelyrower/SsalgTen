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
import { CountryFlag } from "@/components/ui/CountryFlag";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, ExternalLink } from "lucide-react";
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
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              节点
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <StreamingIcon service={col.key} size="sm" />
                  <span>{col.label}</span>
                </div>
              </th>
            ))}
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              汇总
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              最近检测
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td className="px-4 py-4 align-top">
                  <button
                    type="button"
                    onClick={() => onNodeClick?.(node.nodeId)}
                    className="flex items-start gap-3 text-left text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <CountryFlag country={node.country} size="sm" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate max-w-[200px]">
                          {node.nodeName}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {node.city ? `${node.city}, ${node.country}` : node.country}
                      </p>
                    </div>
                  </button>
                </td>
                {columns.map((col) => {
                  const serviceResult = getServiceResult(node.services, col.key);
                  if (!serviceResult) {
                    return (
                      <td key={col.key} className="px-3 py-4 align-top text-xs text-slate-400">
                        —
                      </td>
                    );
                  }
                  const statusClass = STATUS_COLORS[serviceResult.status];
                  const unlockType = serviceResult.unlockType ?? "unknown";
                  const unlockClass = UNLOCK_TYPE_COLORS[unlockType];

                  return (
                    <td key={col.key} className="px-3 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className={`flex items-center gap-2 text-sm font-medium ${statusClass}`}>
                          <StreamingIcon service={serviceResult.service} size="sm" />
                          <span>{STATUS_TEXT[serviceResult.status]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {serviceResult.region ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                              {serviceResult.region.toUpperCase()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-400">
                              未知区域
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${unlockClass}`}
                          >
                            {unlockTypeLabel(serviceResult.unlockType)}
                          </span>
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-4 align-top">
                  <div className="flex items-center gap-3 text-sm">
                    <div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {node.unlockedCount}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                        解锁
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {node.restrictedCount}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                        受限
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 align-top text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>{relativeTime}</span>
                    </div>
                    {isExpired && (
                      <Badge variant="warning" className="w-fit gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>数据过期</span>
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-right">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
