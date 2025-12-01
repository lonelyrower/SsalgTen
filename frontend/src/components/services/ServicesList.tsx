import React, { useEffect, useRef, useState } from "react";
import type { NodeService } from "@/types/services";
import {
  SERVICE_TYPE_CONFIG,
  SERVICE_STATUS_CONFIG,
  SERVICE_DATA_EXPIRY_THRESHOLD,
} from "@/types/services";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import CountryFlagSvg from "../ui/CountryFlagSvg";
import {
  Server,
  Globe,
  Clock,
  AlertCircle,
  Network,
  Shield,
  Activity,
  Link as LinkIcon,
  Box,
  Copy,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getServiceProtocol,
  getServicePort,
  getAllServicePorts,
  getServiceShareLinks,
  getServiceDomains,
} from "./service-utils";

interface ServicesListProps {
  services: NodeService[];
  onServiceClick?: (service: NodeService) => void;
  layout?: "grid" | "table";
}

export const ServicesList: React.FC<ServicesListProps> = ({
  services,
  onServiceClick,
  layout = "grid",
}) => {
  // 如果是表格布局，返回 null（由父组件使用 ServicesTable）
  if (layout === "table") {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {services.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          onClick={() => onServiceClick?.(service)}
          colorIndex={index % 4}
        />
      ))}
    </div>
  );
};

interface ServiceCardProps {
  service: NodeService;
  onClick?: () => void;
  colorIndex: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  colorIndex,
}) => {

  const typeConfig =
    SERVICE_TYPE_CONFIG[service.type] ?? SERVICE_TYPE_CONFIG.other;
  const statusConfig =
    SERVICE_STATUS_CONFIG[service.status] ?? SERVICE_STATUS_CONFIG.unknown;

  const isExpired =
    Date.now() - new Date(service.lastUpdated).getTime() >
    SERVICE_DATA_EXPIRY_THRESHOLD;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(service.lastUpdated), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "未知";
    }
  })();

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
        {/* 服务类型图标和名称 */}
        <div className="flex items-start gap-2">
          <span className="text-3xl flex-shrink-0">{typeConfig.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {service.name}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {typeConfig.name}
              {service.version && ` v${service.version}`}
            </p>
          </div>
          <Badge
            variant={
              service.status === "running"
                ? "default"
                : service.status === "stopped"
                  ? "secondary"
                  : "destructive"
            }
            className="text-xs flex-shrink-0"
          >
            {statusConfig.name}
          </Badge>
        </div>

        {/* 节点信息 */}
        <div className="flex items-center gap-2 p-2 rounded-[var(--radius-lg)] bg-white/50 dark:bg-gray-900/30">
          {service.nodeCountry && (
            <CountryFlagSvg country={service.nodeCountry} className="w-5 h-5 flex-shrink-0" />
          )}
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 truncate">
            <Server className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{service.nodeName || service.nodeId}</span>
          </div>
        </div>

        {/* 服务详细信息 - 根据服务类型显示不同内容 */}
        <ServiceDetails service={service} />

        {/* 底部信息 */}
        <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          {isExpired && (
            <Badge variant="warning" className="text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>过期</span>
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};

// 根据服务类型显示不同的详细信息
const ServiceDetails: React.FC<{ service: NodeService }> = ({ service }) => {
  const serviceName = service.name.toLowerCase();
  const domains = getServiceDomains(service);
  const primaryDomain = domains[0];
  const extraDomainsCount = domains.length > 1 ? domains.length - 1 : 0;
  const port = getServicePort(service);
  const allPorts = getAllServicePorts(service);
  const protocol = getServiceProtocol(service);
  const shareLinks = getServiceShareLinks(service);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const replacementHost = primaryDomain || service.nodeIp;

  // 替换分享链接中的 your_server_ip 为实际可用的域名或节点IP
  const processedShareLinks = shareLinks.map((link) => {
    if (!replacementHost) return link;
    return link.replace(/your_server_ip/gi, replacementHost);
  });

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
      copyResetTimer.current = window.setTimeout(() => {
        setCopiedLink(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const shareLinkSection =
    processedShareLinks.length > 0 ? (
      <div className="space-y-1">
        {processedShareLinks.slice(0, 2).map((link, index) => (
          <div
            key={index}
            className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 group"
          >
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-mono flex-1" title={link}>
              {link}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyLink(link);
              }}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ${copiedLink === link ? "opacity-100 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]" : ""}`}
              title={copiedLink === link ? "已复制" : "复制链接"}
            >
              {copiedLink === link ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}
        {processedShareLinks.length > 2 && (
          <div className="text-[11px] text-gray-500 dark:text-gray-500">
            +{processedShareLinks.length - 2} 条更多链接
          </div>
        )}
      </div>
    ) : null;

  // Xray / V2Ray / 代理类服务
  if (
    service.type === "proxy" ||
    serviceName.includes("xray") ||
    serviceName.includes("v2ray") ||
    serviceName.includes("sing") ||
    serviceName.includes("trojan") ||
    serviceName.includes("shadowsocks") ||
    serviceName.includes("ssr") ||
    serviceName.includes("socks") ||
    serviceName.includes("hysteria")
  ) {
    return (
      <div className="space-y-1.5 p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        {protocol && (
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <Shield className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">类型:</span>
            <Badge variant="outline" className="text-xs uppercase tracking-wide">
              {protocol.toUpperCase()}
            </Badge>
          </div>
        )}
        {allPorts.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <Network className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">端口:</span>
            <span className="flex gap-1 flex-wrap">
              {allPorts.map((p, idx) => (
                <span key={p}>
                  {p}
                  {idx < allPorts.length - 1 && ','}
                </span>
              ))}
            </span>
          </div>
        )}
        {primaryDomain && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{primaryDomain}</span>
          </div>
        )}
        {shareLinkSection}
      </div>
    );
  }

  // Web 服务 (Nginx, Apache, Caddy, etc.)
  if (
    service.type === "web" ||
    serviceName.includes("nginx") ||
    serviceName.includes("apache") ||
    serviceName.includes("caddy")
  ) {
    const webProtocol =
      service.access?.protocol ||
      (protocol && ["http", "https"].includes(protocol.toLowerCase())
        ? protocol
        : undefined);

    return (
      <div className="space-y-1.5 p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        {primaryDomain && (
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-medium">{primaryDomain}</span>
            {service.sslEnabled && (
              <Shield className="h-3 w-3 text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] ml-1" />
            )}
          </div>
        )}
        {port && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Network className="h-3 w-3 flex-shrink-0" />
            <span>端口: {port}</span>
            {webProtocol && (
              <Badge variant="outline" className="text-xs ml-1 uppercase">
                {webProtocol.toUpperCase()}
              </Badge>
            )}
          </div>
        )}
        {extraDomainsCount > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-500">
            +{extraDomainsCount} 个额外域名
          </div>
        )}
        {shareLinkSection}
      </div>
    );
  }

  // SsalgTen Agent
  if (serviceName.includes("agent") || serviceName.includes("ssalgten")) {
    return (
      <div className="space-y-1.5 p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
          <Activity className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">节点基础组件</span>
        </div>
        {port && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Network className="h-3 w-3 flex-shrink-0" />
            <span>端口: {port}</span>
          </div>
        )}
        {service.containerInfo && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Box className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {(service.containerInfo as { containerName?: string }).containerName || "Docker 运行中"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 数据库服务
  if (service.type === "database") {
    return (
      <div className="space-y-1.5 p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        {port && (
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <Network className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">端口:</span>
            <span>{port}</span>
          </div>
        )}
        {service.containerInfo && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Box className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {(service.containerInfo as { containerName?: string }).containerName || "运行实例"}
            </span>
          </div>
        )}
        {shareLinkSection}
      </div>
    );
  }

  // 容器运行时 - 默认只提示
  if (service.type === "container" || serviceName === "docker") {
    return (
      <div className="p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Box className="h-3 w-3 flex-shrink-0" />
          <span>容器运行时</span>
        </div>
      </div>
    );
  }

  // 默认展示 - 尽量提供域名、端口和分享链接
  if (primaryDomain || port || shareLinkSection) {
    return (
      <div className="space-y-1.5 p-2 rounded-[var(--radius-lg)] bg-white/30 dark:bg-gray-900/20">
        {primaryDomain && (
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{primaryDomain}</span>
          </div>
        )}
        {port && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Network className="h-3 w-3 flex-shrink-0" />
            <span>端口: {port}</span>
          </div>
        )}
        {shareLinkSection}
      </div>
    );
  }

  // 没有任何可展示的信息时返回 null
  return null;
};
