import React, { useMemo } from "react";
import type { NodeStreamingSummary, StreamingStatus } from "@/types/streaming";
import {
  STREAMING_DATA_EXPIRY_THRESHOLD,
  STATUS_TEXT,
  STATUS_COLORS,
  UNLOCK_TYPE_LABELS,
  UNLOCK_TYPE_COLORS,
} from "@/types/streaming";
import { Card } from "@/components/ui/card";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface StreamingNodeListProps {
  nodes: NodeStreamingSummary[];
  onRetest?: (nodeId: string) => void;
  testingMap?: Record<string, boolean>;
}

const STATUS_WITH_DETAILS: ReadonlySet<StreamingStatus> = new Set([
  "yes",
  "org",
  "pending",
  "cn",
  "app",
  "web",
  "idc",
]);

export const StreamingNodeList: React.FC<StreamingNodeListProps> = ({
  nodes,
  onRetest,
  testingMap = {},
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {nodes.map((node, index) => (
        <NodeStreamingCard
          key={node.nodeId}
          node={node}
          testing={!!testingMap[node.nodeId]}
          onRetest={onRetest}
          colorIndex={index % 4}
        />
      ))}
    </div>
  );
};

interface NodeStreamingCardProps {
  node: NodeStreamingSummary;
  onRetest?: (nodeId: string) => void;
  testing: boolean;
  colorIndex: number;
}

const NodeStreamingCard: React.FC<NodeStreamingCardProps> = ({
  node,
  onRetest,
  testing,
  colorIndex,
}) => {
  const isExpired = useMemo(() => {
    if (typeof node.isExpired === "boolean") {
      return node.isExpired;
    }
    if (!node.lastScanned) return true;
    const lastScannedTime = new Date(node.lastScanned).getTime();
    return Date.now() - lastScannedTime > STREAMING_DATA_EXPIRY_THRESHOLD;
  }, [node.isExpired, node.lastScanned]);

  const timeAgo = useMemo(() => {
    if (!node.lastScanned) return "暂无检测";
    try {
      return formatDistanceToNow(new Date(node.lastScanned), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  }, [node.lastScanned]);

  // 与表格视图保持一致的 4 组渐变配色
  const colorSchemes = [
    {
      gradient:
        "bg-gradient-to-br from-blue-50/80 via-cyan-50/50 to-blue-100/60 dark:from-blue-950/30 dark:via-cyan-950/20 dark:to-blue-900/30",
      border: "border-l border-blue-400 dark:border-blue-500",
    },
    {
      gradient:
        "bg-gradient-to-br from-purple-50/80 via-violet-50/50 to-purple-100/60 dark:from-purple-950/30 dark:via-violet-950/20 dark:to-purple-900/30",
      border: "border-l border-purple-400 dark:border-purple-500",
    },
    {
      gradient:
        "bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-emerald-100/60 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-900/30",
      border: "border-l border-emerald-400 dark:border-emerald-500",
    },
    {
      gradient:
        "bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-100/60 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-900/30",
      border: "border-l border-orange-400 dark:border-orange-500",
    },
  ];

  const colorScheme = colorSchemes[colorIndex];

  return (
    <Card
      className={`p-3 transition-all shadow-md hover:shadow-lg ${colorScheme.gradient} ${colorScheme.border}`}
    >
      <div className="space-y-2.5">
        {/* 节点信息 */}
        <div className="flex items-center gap-2.5 justify-start">
          {node.country && (
            <CountryFlagSvg country={node.country} className="w-7 h-7 flex-shrink-0" />
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {node.nodeName}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {node.city ? `${node.city}, ${node.country}` : node.country}
              </span>
            </p>
          </div>
        </div>

        {/* 流媒体状态 */}
        <div className="grid grid-cols-3 gap-2">
          {node.services.map((service) => {
            const unlockType = service.unlockType ?? "unknown";
            const showRegion = STATUS_WITH_DETAILS.has(service.status) && service.region;
            const showUnlock =
              STATUS_WITH_DETAILS.has(service.status) && service.unlockType;

            return (
              <div
                key={service.service}
                className="flex flex-col items-center justify-between gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 px-2 py-2 min-h-[88px]"
              >
                <StreamingIcon service={service.service} size="md" />

                <div className="flex flex-col gap-0.5 items-center w-full">
                  {/* 状态文本 */}
                  <div className={`text-xs font-semibold ${STATUS_COLORS[service.status]}`}>
                    {STATUS_TEXT[service.status]}
                  </div>

                  {/* 区域信息 */}
                  <div className="text-[10px] text-gray-600 dark:text-gray-400 min-h-[14px]">
                    {showRegion ? service.region?.toUpperCase() : ""}
                  </div>

                  {/* 解锁类型 */}
                  <div className="min-h-[20px] flex items-center">
                    {showUnlock && service.unlockType && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${UNLOCK_TYPE_COLORS[unlockType]}`}
                      >
                        {UNLOCK_TYPE_LABELS[unlockType]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部信息 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>{timeAgo}</span>
          </div>

          <div className="flex items-center gap-3">
            {isExpired && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>数据过期</span>
              </Badge>
            )}
            {onRetest && (
              <Button
                size="sm"
                variant="outline"
                disabled={testing}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetest(node.nodeId);
                }}
              >
                {testing ? "检测中..." : "复测"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
