import React, { useMemo } from "react";
import type {
  NodeStreamingSummary,
  StreamingService,
  StreamingServiceResult,
  StreamingStatus,
} from "@/types/streaming";
import {
  STATUS_TEXT,
  STATUS_COLORS,
  UNLOCK_TYPE_LABELS,
  UNLOCK_TYPE_COLORS,
  STREAMING_SERVICES,
  STREAMING_DATA_EXPIRY_THRESHOLD,
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
  selectedService?: StreamingService;
}

const formatRelativeTime = (iso?: string) => {
  if (!iso) return "暂无检测";
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

const STATUS_WITH_DETAILS: ReadonlySet<StreamingStatus> = new Set([
  "yes",
  "org",
  "pending",
  "cn",
  "app",
  "web",
  "idc",
]);

export const StreamingNodeTable: React.FC<StreamingNodeTableProps> = ({
  nodes,
  services,
  onRetest,
  testingMap,
  selectedService,
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
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-48"
            >
              节点
            </th>
            {columns.map((col) => {
              const isSelected = selectedService === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-28 transition-all ${
                    isSelected
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      : "text-slate-500"
                  }`}
                  title={col.label}
                >
                  <div className="flex items-center justify-center">
                    <StreamingIcon service={col.key} size="sm" />
                  </div>
                </th>
              );
            })}
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-36"
            >
              最近检测
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {nodes.map((node, index) => {
            const isTesting = !!testingMap[node.nodeId];
            const isExpired =
              typeof node.isExpired === "boolean"
                ? node.isExpired
                : (() => {
                    if (!node.lastScanned) return true;
                    try {
                      return (
                        new Date(node.lastScanned).getTime() <
                        Date.now() - STREAMING_DATA_EXPIRY_THRESHOLD
                      );
                    } catch {
                      return true;
                    }
                  })();
            const relativeTime = formatRelativeTime(node.lastScanned);

            // 与卡片模式一致的 4 组背景渐变
            const colorSchemes = [
              "bg-gradient-to-br from-blue-50/80 via-cyan-50/50 to-blue-100/60 dark:from-blue-950/30 dark:via-cyan-950/20 dark:to-blue-900/30",
              "bg-gradient-to-br from-purple-50/80 via-violet-50/50 to-purple-100/60 dark:from-purple-950/30 dark:via-violet-950/20 dark:to-purple-900/30",
              "bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-emerald-100/60 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-900/30",
              "bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-100/60 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-900/30",
            ];

            const rowGradient = colorSchemes[index % 4];

            return (
              <tr
                key={node.nodeId}
                className={`${rowGradient} hover:brightness-95 dark:hover:brightness-110 transition-all`}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center h-full">
                    <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
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
                    </div>
                  </div>
                </td>
                {columns.map((col) => {
                  const serviceResult = getServiceResult(node.services, col.key);
                  const isSelected = selectedService === col.key;
                  if (!serviceResult) {
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-4 text-center text-xs text-slate-400 transition-all ${
                          isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        —
                      </td>
                    );
                  }
                  const statusClass = STATUS_COLORS[serviceResult.status];
                  const unlockType = serviceResult.unlockType ?? "unknown";
                  const unlockClass = UNLOCK_TYPE_COLORS[unlockType];
                  const showDetails =
                    STATUS_WITH_DETAILS.has(serviceResult.status) &&
                    (serviceResult.region || serviceResult.unlockType);

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-4 transition-all ${
                        isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-1 items-center">
                        {/* 第一行：状态文本 */}
                        <div className={`text-sm font-medium ${statusClass}`}>
                          {STATUS_TEXT[serviceResult.status]}
                        </div>

                        {/* 第二行：区域信息 */}
                        {STATUS_WITH_DETAILS.has(serviceResult.status) &&
                          serviceResult.region && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {serviceResult.region.toUpperCase()}
                            </div>
                          )}

                        {/* 第三行：解锁类型 */}
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
                      {isTesting ? "检测中..." : "复测"}
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
