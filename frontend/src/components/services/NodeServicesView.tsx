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
        "bg-gradient-to-br from-[hsl(var(--info))]/5 via-[hsl(var(--info))]/3 to-[hsl(var(--info))]/8",
      border: "border-l border-[hsl(var(--info))]",
    },
    {
      gradient:
        "bg-gradient-to-br from-primary/5 via-primary/3 to-primary/8",
      border: "border-l border-primary",
    },
    {
      gradient:
        "bg-gradient-to-br from-[hsl(var(--success))]/5 via-[hsl(var(--success))]/3 to-[hsl(var(--success))]/8",
      border: "border-l border-[hsl(var(--success))]",
    },
    {
      gradient:
        "bg-gradient-to-br from-[hsl(var(--warning))]/5 via-[hsl(var(--warning))]/3 to-[hsl(var(--warning))]/8",
      border: "border-l border-[hsl(var(--warning))]",
    },
  ];

  const colorScheme = colorSchemes[colorIndex];

  return (
    <Card
      className={`p-3 transition-all shadow-md hover:shadow-lg ${colorScheme.gradient} ${colorScheme.border}`}
    >
      <div className="space-y-2.5">
        {/* 节点信息 */}
        <div className="flex items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5">
            {overview.nodeCountry && (
              <CountryFlagSvg country={overview.nodeCountry} className="w-7 h-7 flex-shrink-0" />
            )}
            <div>
              <h3 className="text-base font-semibold text-foreground truncate">
                {overview.nodeName}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                className="py-2 px-3 rounded-lg border border-border bg-surface-elevated hover:shadow-sm transition-shadow"
              >
                <div className="text-sm font-medium text-foreground text-center truncate">
                  {service.name}
                  {service.version && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      v{service.version}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            该节点暂无服务
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
