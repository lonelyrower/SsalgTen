import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { NodeStreamingSummary } from "@/types/streaming";
import {
  STREAMING_DATA_EXPIRY_THRESHOLD,
  STATUS_TEXT,
  STATUS_COLORS,
  UNLOCK_TYPE_LABELS,
  UNLOCK_TYPE_COLORS,
} from "@/types/streaming";
import { Card } from "../ui/card";
import CountryFlagSvg from "../ui/CountryFlagSvg";
import { StreamingIcon } from "@/components/streaming/StreamingIcons";
import { Badge } from "../ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface StreamingNodeListProps {
  nodes: NodeStreamingSummary[];
  onNodeClick?: (nodeId: string) => void;
  onRetest?: (nodeId: string) => void;
  testingMap?: Record<string, boolean>;
}

export const StreamingNodeList: React.FC<StreamingNodeListProps> = ({
  nodes,
  onNodeClick,
  onRetest,
  testingMap = {},
}) => {
  const navigate = useNavigate();

  const handleNodeClick = (nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    } else {
      navigate(`/nodes?id=${nodeId}&tab=streaming`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {nodes.map((node) => (
        <NodeStreamingCard
          key={node.nodeId}
          node={node}
          testing={!!testingMap[node.nodeId]}
          onRetest={onRetest}
          onClick={() => handleNodeClick(node.nodeId)}
        />
      ))}
    </div>
  );
};

interface NodeStreamingCardProps {
  node: NodeStreamingSummary;
  onClick: () => void;
  onRetest?: (nodeId: string) => void;
  testing: boolean;
}

const NodeStreamingCard: React.FC<NodeStreamingCardProps> = ({
  node,
  onClick,
  onRetest,
  testing,
}) => {
  const isExpired = useMemo(() => {
    if (!node.lastScanned) return true;
    const lastScannedTime = new Date(node.lastScanned).getTime();
    return Date.now() - lastScannedTime > STREAMING_DATA_EXPIRY_THRESHOLD;
  }, [node.lastScanned]);

  const timeAgo = useMemo(() => {
    if (!node.lastScanned) return "从未检测";
    try {
      return formatDistanceToNow(new Date(node.lastScanned), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  }, [node.lastScanned]);

  return (
    <Card
      className="p-3 hover:shadow-lg transition-all cursor-pointer border-l-4"
      style={{
        borderLeftColor: isExpired
          ? "#f59e0b"
          : node.unlockedCount > node.restrictedCount
            ? "#10b981"
            : "#ef4444",
      }}
      onClick={onClick}
    >
      <div className="space-y-2.5">
        {/* 节点信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {node.country && (
              <CountryFlagSvg country={node.country} className="w-7 h-7 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-0.5 truncate">
                {node.nodeName}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Globe className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{node.city ? `${node.city}, ${node.country}` : node.country}</span>
              </p>
            </div>
          </div>

          {/* 快速统计 */}
          <div className="flex items-center gap-3 text-xs flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className="text-green-600 dark:text-green-400 font-bold text-lg">
                {node.unlockedCount}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-[10px]">解锁</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-red-600 dark:text-red-400 font-bold text-lg">
                {node.restrictedCount}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-[10px]">受限</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-gray-700 dark:text-gray-300 font-bold text-lg">
                {node.services.length}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-[10px]">总数</div>
            </div>
          </div>
        </div>

        {/* 流媒体服务状态 */}
        <div className="grid grid-cols-3 gap-2">
          {node.services.map((service) => {
            const unlockType = service.unlockType ?? "unknown";
            // 解锁、仅自制、待支持状态显示地区和解锁类型
            const showDetails = service.status === "yes" || service.status === "org" || service.status === "pending";

            return (
              <div
                key={service.service}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-2 py-1.5"
              >
                <StreamingIcon service={service.service} size="md" />

                <div className="flex flex-col gap-0.5 items-center w-full">
                  {/* 第一行：状态 */}
                  <div className={`text-xs font-semibold ${STATUS_COLORS[service.status]}`}>
                    {STATUS_TEXT[service.status]}
                  </div>

                  {/* 第二行：地区（仅解锁状态显示） */}
                  {showDetails && service.region && (
                    <div className="text-[10px] text-gray-600 dark:text-gray-400">
                      {service.region.toUpperCase()}
                    </div>
                  )}

                  {/* 第三行：解锁类型（仅解锁状态显示） */}
                  {showDetails && service.unlockType && (
                    <div>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${UNLOCK_TYPE_COLORS[unlockType]}`}
                      >
                        {UNLOCK_TYPE_LABELS[unlockType]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部信息栏 */}
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
                {testing ? "检测中..." : "检测"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
