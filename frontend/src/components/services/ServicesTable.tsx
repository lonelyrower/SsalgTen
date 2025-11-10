import React, { useState } from "react";
import type { NodeService } from "@/types/services";
import { SERVICE_TYPE_CONFIG } from "@/types/services";
import { Badge } from "../ui/badge";
import CountryFlagSvg from "../ui/CountryFlagSvg";
import { Clock, Copy, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getServiceProtocols,
  getAllServicePorts,
  getServiceShareLinks,
  getServiceDomains,
} from "./service-utils";
import { useNotification } from "@/hooks/useNotification";

interface ServicesTableProps {
  services: NodeService[];
}

// 服务类型图标映射 (使用 emoji)
const SERVICE_TYPE_ICONS: Record<string, string> = {
  proxy: "🔐",
  web: "🌐",
  database: "💾",
  container: "📦",
  other: "⚙️",
};

const SHARE_LINK_SCHEME_REGEX = /^([a-z0-9+.-]+):\/\//i;

const extractProtocolFromLink = (link: string): string | undefined => {
  const match = link.trim().match(SHARE_LINK_SCHEME_REGEX);
  return match ? match[1] : undefined;
};

const normalizeProtocolLabel = (value?: string): string | undefined => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  const alias: Record<string, string> = {
    shadowsocks: "SS",
    ss: "SS",
    shadowsocksr: "SSR",
    ssr: "SSR",
    vmess: "VMESS",
    vless: "VLESS",
    trojan: "TROJAN",
    hysteria: "HYSTERIA",
    hy: "HYSTERIA",
    socks: "SOCKS",
    socks5: "SOCKS",
    http: "HTTP",
    https: "HTTPS",
  };

  if (alias[lower]) {
    return alias[lower];
  }

  return lower.toUpperCase();
};

type ServiceCategory = 'proxy' | 'web' | 'other';

export const ServicesTable: React.FC<ServicesTableProps> = ({
  services,
}) => {
  // 按服务类型分组
  const proxyServices = services.filter(s => s.type === 'proxy');
  const webServices = services.filter(s => s.type === 'web');
  const otherServices = services.filter(s => s.type !== 'proxy' && s.type !== 'web');

  // 确定默认选中的标签页 (选择有数据的第一个类型)
  const getDefaultTab = (): ServiceCategory => {
    if (proxyServices.length > 0) return 'proxy';
    if (webServices.length > 0) return 'web';
    if (otherServices.length > 0) return 'other';
    return 'proxy';
  };

  const [activeTab, setActiveTab] = useState<ServiceCategory>(getDefaultTab);

  // 标签页配置
  const tabs = [
    {
      key: 'proxy' as ServiceCategory,
      icon: '🔐',
      label: '代理服务',
      count: proxyServices.length,
      gradient: 'from-[hsl(var(--info))]/5 to-[hsl(var(--info))]/8',
      activeColor: 'border-[hsl(var(--info))] text-[hsl(var(--info))]',
    },
    {
      key: 'web' as ServiceCategory,
      icon: '🌐',
      label: 'Web 服务',
      count: webServices.length,
      gradient: 'from-[hsl(var(--success))]/5 to-[hsl(var(--success))]/8',
      activeColor: 'border-[hsl(var(--success))] text-[hsl(var(--success))]',
    },
    {
      key: 'other' as ServiceCategory,
      icon: '📦',
      label: '基础组件 & 其他',
      count: otherServices.length,
      gradient: 'from-surface-elevated to-surface-elevated',
      activeColor: 'border-border text-muted-foreground',
    },
  ];

  return (
    <div className="bg-surface-base rounded-lg shadow overflow-hidden">
      {/* 标签页导航 */}
      <div className="border-b border-border">
        <nav className="flex -mb-px overflow-x-auto" aria-label="服务类型">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${activeTab === tab.key
                  ? `${tab.activeColor} bg-gradient-to-r ${tab.gradient}`
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
              disabled={tab.count === 0}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`
                px-2 py-0.5 text-xs rounded-full
                ${activeTab === tab.key
                  ? 'bg-surface-elevated'
                  : 'bg-surface-elevated'
                }
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* 表格内容区域 */}
      <div className="overflow-x-auto">
        {activeTab === 'proxy' && <ProxyServicesTable services={proxyServices} />}
        {activeTab === 'web' && <WebServicesTable services={webServices} />}
        {activeTab === 'other' && <OtherServicesTable services={otherServices} />}
      </div>
    </div>
  );
};

// Proxy 服务表格 - 显示:名称、节点、协议、分享链接、更新时间
const ProxyServicesTable: React.FC<{ services: NodeService[] }> = ({ services }) => {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-surface-elevated">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            协议
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            分享链接
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-surface-base divide-y divide-border">
        {services.map((service, index) => (
          <ProxyServiceRow key={service.id} service={service} colorIndex={index % 4} />
        ))}
      </tbody>
    </table>
  );
};

// Web 服务表格 - 显示:名称、节点、域名、端口、更新时间
const WebServicesTable: React.FC<{ services: NodeService[] }> = ({ services }) => {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-surface-elevated">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            域名
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            端口
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-surface-base divide-y divide-border">
        {services.map((service, index) => (
          <WebServiceRow key={service.id} service={service} colorIndex={index % 4} />
        ))}
      </tbody>
    </table>
  );
};

// 其他服务表格 - 显示:名称、节点、类型、端口、更新时间
const OtherServicesTable: React.FC<{ services: NodeService[] }> = ({ services }) => {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-surface-elevated">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            类型
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            端口
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-surface-base divide-y divide-border">
        {services.map((service, index) => (
          <OtherServiceRow key={service.id} service={service} colorIndex={index % 4} />
        ))}
      </tbody>
    </table>
  );
};

// 渐变配色方案 - 与流媒体页面保持一致
const ROW_COLOR_SCHEMES = [
  "bg-gradient-to-r from-[hsl(var(--info))]/5 via-[hsl(var(--info))]/3 to-[hsl(var(--info))]/8 hover:from-[hsl(var(--info))]/10 hover:to-[hsl(var(--info))]/15",
  "bg-gradient-to-r from-primary/5 via-primary/3 to-primary/8 hover:from-primary/10 hover:to-primary/15",
  "bg-gradient-to-r from-[hsl(var(--success))]/5 via-[hsl(var(--success))]/3 to-[hsl(var(--success))]/8 hover:from-[hsl(var(--success))]/10 hover:to-[hsl(var(--success))]/15",
  "bg-gradient-to-r from-[hsl(var(--warning))]/5 via-[hsl(var(--warning))]/3 to-[hsl(var(--warning))]/8 hover:from-[hsl(var(--warning))]/10 hover:to-[hsl(var(--warning))]/15",
];

// Proxy 服务行组件
const ProxyServiceRow: React.FC<{ service: NodeService; colorIndex: number }> = ({ service, colorIndex }) => {
  const { showSuccess } = useNotification();
  const typeIcon = SERVICE_TYPE_ICONS[service.type] ?? SERVICE_TYPE_ICONS.other;

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

  const domains = getServiceDomains(service);
  const primaryDomain = domains[0];
  const protocols = getServiceProtocols(service);
  const shareLinks = getServiceShareLinks(service);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const replacementHost = primaryDomain || service.nodeIp;
  const processedShareLinks = shareLinks.map((link) => {
    if (!replacementHost) return link;
    return link.replace(/your_server_ip/gi, replacementHost);
  });

  const displayedShareLinks = processedShareLinks;
  let protocolLines = displayedShareLinks
    .map((link, index) => {
      const protocolFromLink = normalizeProtocolLabel(extractProtocolFromLink(link));
      if (protocolFromLink) {
        return protocolFromLink;
      }
      return normalizeProtocolLabel(protocols[index]);
    })
    .filter((item): item is string => Boolean(item));

  if (protocolLines.length === 0) {
    protocolLines = protocols
      .map((value) => normalizeProtocolLabel(value))
      .filter((item): item is string => Boolean(item));
  }

  const handleCopyLink = async (link: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      showSuccess("已复制到剪贴板");
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <tr className={`transition-colors ${ROW_COLOR_SCHEMES[colorIndex]}`}>
      {/* 服务名称 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-muted-foreground">
                v{service.version}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* 节点 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          {service.nodeCountry && (
            <CountryFlagSvg
              country={service.nodeCountry}
              className="w-5 h-5"
            />
          )}
          <span className="text-sm text-foreground">
            {service.nodeName || service.nodeId}
          </span>
        </div>
      </td>

      {/* 协议 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {protocolLines.length > 0 ? (
          <div className="flex flex-col items-center gap-1">
            {protocolLines.map((label, index) => (
              <Badge
                key={`protocol-${service.id}-${index}`}
                variant="outline"
                className="text-xs uppercase"
              >
                {label ?? "-"}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>

      {/* 分享链接 */}
      <td className="px-6 py-4">
        <div className="max-w-md space-y-1 mx-auto text-center">
          {processedShareLinks.length > 0 ? (
            displayedShareLinks.map((link, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-2 group"
              >
                <code
                  className="block text-xs text-muted-foreground font-mono truncate max-w-xs text-center"
                  title={link}
                >
                  {link}
                </code>
                <button
                  onClick={(e) => handleCopyLink(link, e)}
                  className={`flex-shrink-0 p-1 rounded hover:bg-surface-elevated transition-colors ${
                    copiedLink === link
                      ? "text-[hsl(var(--success))]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={copiedLink === link ? "已复制" : "复制链接"}
                >
                  {copiedLink === link ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="text-center text-xs text-muted-foreground">-</div>
          )}
        </div>
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      </td>
    </tr>
  );
};

// Web 服务行组件
const WebServiceRow: React.FC<{ service: NodeService; colorIndex: number }> = ({ service, colorIndex }) => {
  const typeIcon = SERVICE_TYPE_ICONS[service.type] ?? SERVICE_TYPE_ICONS.other;

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

  const domains = getServiceDomains(service);
  const primaryDomain = domains[0];
  const allPorts = getAllServicePorts(service);

  return (
    <tr className={`transition-colors ${ROW_COLOR_SCHEMES[colorIndex]}`}>
      {/* 服务名称 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-muted-foreground">
                v{service.version}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* 节点 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          {service.nodeCountry && (
            <CountryFlagSvg
              country={service.nodeCountry}
              className="w-5 h-5"
            />
          )}
          <span className="text-sm text-foreground">
            {service.nodeName || service.nodeId}
          </span>
        </div>
      </td>

      {/* 域名 */}
      <td className="px-6 py-4">
        <div className="max-w-xs mx-auto text-center">
          {primaryDomain ? (
            <div className="text-sm text-foreground truncate">
              {primaryDomain}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      </td>

      {/* 端口 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {allPorts.length > 0 ? (
          <span className="text-sm text-foreground">
            {allPorts.join(", ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      </td>
    </tr>
  );
};

// 其他服务行组件
const OtherServiceRow: React.FC<{ service: NodeService; colorIndex: number }> = ({ service, colorIndex }) => {
  const typeIcon = SERVICE_TYPE_ICONS[service.type] ?? SERVICE_TYPE_ICONS.other;
  const typeConfig = SERVICE_TYPE_CONFIG[service.type] ?? SERVICE_TYPE_CONFIG.other;

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

  const allPorts = getAllServicePorts(service);

  return (
    <tr className={`transition-colors ${ROW_COLOR_SCHEMES[colorIndex]}`}>
      {/* 服务名称 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-muted-foreground">
                v{service.version}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* 节点 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          {service.nodeCountry && (
            <CountryFlagSvg
              country={service.nodeCountry}
              className="w-5 h-5"
            />
          )}
          <span className="text-sm text-foreground">
            {service.nodeName || service.nodeId}
          </span>
        </div>
      </td>

      {/* 类型 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span className="text-sm text-foreground">
          {typeConfig.name}
        </span>
      </td>

      {/* 端口 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {allPorts.length > 0 ? (
          <span className="text-sm text-foreground">
            {allPorts.join(", ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      </td>
    </tr>
  );
};
