import React, { useMemo } from "react";
import type { NodeServicesOverview } from "@/types/services";
import { Card } from "../ui/card";
import CountryFlagSvg from "../ui/CountryFlagSvg";
import { Badge } from "../ui/badge";
import { AlertCircle, Clock, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface NodeServicesViewProps {
  nodeOverviews: NodeServicesOverview[];
  onNodeClick?: (nodeId: string) => void;
}

export const NodeServicesView: React.FC<NodeServicesViewProps> = ({
  nodeOverviews,
  onNodeClick,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {nodeOverviews.map((overview, index) => (
        <NodeServiceCard
          key={overview.nodeId}
          overview={overview}
          onClick={() => onNodeClick?.(overview.nodeId)}
          colorIndex={index % 4}
        />
      ))}
    </div>
  );
};

interface NodeServiceCardProps {
  overview: NodeServicesOverview;
  onClick?: () => void;
  colorIndex: number;
}

const NodeServiceCard: React.FC<NodeServiceCardProps> = ({
  overview,
  colorIndex,
}) => {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(overview.lastReported), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  }, [overview.lastReported]);

  // 与流媒体页面保持一致的 4 组渐变配色
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
      className={`p-3 transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] ${colorScheme.gradient} ${colorScheme.border}`}
    >
      <div className="space-y-2.5">
        {/* 节点信息 */}
        <div className="flex items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5">
            {overview.nodeCountry && (
              <CountryFlagSvg country={overview.nodeCountry} className="w-7 h-7 flex-shrink-0" />
            )}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {overview.nodeName}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Globe className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {overview.nodeCity ? `${overview.nodeCity}, ${overview.nodeCountry}` : overview.nodeCountry}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {overview.totalServices} 个服务
            </Badge>
          </div>
        </div>

        {/* 服务列表 - 简化显示 */}
        {overview.services.length > 0 ? (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {overview.services.map((service) => (
              <div
                key={service.id}
                className="py-2 px-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))] bg-white/50 dark:bg-gray-800/50 hover:shadow-sm transition-shadow"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center truncate">
                  {service.name}
                  {service.version && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      v{service.version}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            该节点暂无服务
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeAgo}</span>
          </div>

          {overview.isExpired && (
            <Badge variant="warning" className="flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>数据过期</span>
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
