import React, { useState } from "react";
import type { NodeService } from "@/types/services";
import { SERVICE_TYPE_CONFIG } from "@/types/services";
import { Badge } from "../ui/badge";
import CountryFlagSvg from "../ui/CountryFlagSvg";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getServiceProtocols,
  getAllServicePorts,
  getServiceDomains,
} from "./service-utils";

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
      gradient: 'from-[hsl(var(--status-info-50))] to-[hsl(var(--secondary))]/10 dark:from-[hsl(var(--status-info-900)/0.3)] dark:to-[hsl(var(--secondary))]/20',
      activeColor: 'border-[hsl(var(--status-info-500))] text-[hsl(var(--status-info-600))] dark:text-[hsl(var(--status-info-400))]',
    },
    {
      key: 'web' as ServiceCategory,
      icon: '🌐',
      label: 'Web 服务',
      count: webServices.length,
      gradient: 'from-[hsl(var(--status-success-50))] to-[hsl(var(--status-success-100))] dark:from-[hsl(var(--status-success-900)/0.3)] dark:to-[hsl(var(--status-success-900)/0.2)]',
      activeColor: 'border-[hsl(var(--status-success-500))] text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))]',
    },
    {
      key: 'other' as ServiceCategory,
      icon: '📦',
      label: '基础组件 & 其他',
      count: otherServices.length,
      gradient: 'from-[hsl(var(--muted))] to-[hsl(var(--muted))]/80 dark:from-[hsl(var(--muted))]/50 dark:to-[hsl(var(--muted))]/30',
      activeColor: 'border-[hsl(var(--border-strong))] text-[hsl(var(--muted-foreground))]',
    },
  ];

  return (
    <div className="bg-[hsl(var(--card))] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* 标签页导航 */}
      <div className="border-b border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
        <nav className="flex -mb-px overflow-x-auto" aria-label="服务类型">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${activeTab === tab.key
                  ? `${tab.activeColor} bg-gradient-to-r ${tab.gradient}`
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--border-subtle))]'
                }
              `}
              disabled={tab.count === 0}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`
                px-2 py-0.5 text-xs rounded-full
                ${activeTab === tab.key
                  ? 'bg-[hsl(var(--background))]/50'
                  : 'bg-[hsl(var(--muted))]'
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

// Proxy 服务表格 - 显示:名称、节点、协议、更新时间
const ProxyServicesTable: React.FC<{ services: NodeService[] }> = ({ services }) => {
  return (
    <table className="min-w-full divide-y divide-[hsl(var(--border-subtle))]">
      <thead className="bg-[hsl(var(--muted))]">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            协议
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border-subtle))]">
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
    <table className="min-w-full divide-y divide-[hsl(var(--border-subtle))]">
      <thead className="bg-[hsl(var(--muted))]">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            域名
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            端口
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border-subtle))]">
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
    <table className="min-w-full divide-y divide-[hsl(var(--border-subtle))]">
      <thead className="bg-[hsl(var(--muted))]">
        <tr>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            服务名称
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            节点
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            类型
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            端口
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            更新时间
          </th>
        </tr>
      </thead>
      <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border-subtle))]">
        {services.map((service, index) => (
          <OtherServiceRow key={service.id} service={service} colorIndex={index % 4} />
        ))}
      </tbody>
    </table>
  );
};

// 渐变配色方案 - 与流媒体页面保持一致
const ROW_COLOR_SCHEMES = [
  "bg-gradient-to-r from-blue-50/80 via-cyan-50/50 to-blue-100/60 dark:from-blue-950/30 dark:via-cyan-950/20 dark:to-blue-900/30 hover:from-blue-100 hover:to-blue-150 dark:hover:from-blue-900/40 dark:hover:to-blue-800/40",
  "bg-gradient-to-r from-purple-50/80 via-violet-50/50 to-purple-100/60 dark:from-purple-950/30 dark:via-violet-950/20 dark:to-purple-900/30 hover:from-purple-100 hover:to-purple-150 dark:hover:from-purple-900/40 dark:hover:to-purple-800/40",
  "bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-100/60 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-900/30 hover:from-emerald-100 hover:to-emerald-150 dark:hover:from-emerald-900/40 dark:hover:to-emerald-800/40",
  "bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-orange-100/60 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-900/30 hover:from-orange-100 hover:to-orange-150 dark:hover:from-orange-900/40 dark:hover:to-orange-800/40",
];

// Proxy 服务行组件
const ProxyServiceRow: React.FC<{ service: NodeService; colorIndex: number }> = ({ service, colorIndex }) => {
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

  const protocols = getServiceProtocols(service);
  const protocolLines = protocols
    .map((value) => normalizeProtocolLabel(value))
    .filter((item): item is string => Boolean(item));

  return (
    <tr className={`transition-colors ${ROW_COLOR_SCHEMES[colorIndex]}`}>
      {/* 服务名称 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{typeIcon}</span>
          <div>
            <div className="text-sm font-medium text-[hsl(var(--foreground))]">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
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
          <span className="text-sm text-[hsl(var(--foreground))]">
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
          <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
        )}
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
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
            <div className="text-sm font-medium text-[hsl(var(--foreground))]">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
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
          <span className="text-sm text-[hsl(var(--foreground))]">
            {service.nodeName || service.nodeId}
          </span>
        </div>
      </td>

      {/* 域名 */}
      <td className="px-6 py-4">
        <div className="max-w-xs mx-auto text-center">
          {primaryDomain ? (
            <div className="text-sm text-[hsl(var(--foreground))] truncate">
              {primaryDomain}
            </div>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
          )}
        </div>
      </td>

      {/* 端口 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {allPorts.length > 0 ? (
          <span className="text-sm text-[hsl(var(--foreground))]">
            {allPorts.join(", ")}
          </span>
        ) : (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
        )}
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
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
            <div className="text-sm font-medium text-[hsl(var(--foreground))]">
              {service.name}
            </div>
            {service.version && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
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
          <span className="text-sm text-[hsl(var(--foreground))]">
            {service.nodeName || service.nodeId}
          </span>
        </div>
      </td>

      {/* 类型 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span className="text-sm text-[hsl(var(--foreground))]">
          {typeConfig.name}
        </span>
      </td>

      {/* 端口 */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {allPorts.length > 0 ? (
          <span className="text-sm text-[hsl(var(--foreground))]">
            {allPorts.join(", ")}
          </span>
        ) : (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
        )}
      </td>

      {/* 更新时间 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      </td>
    </tr>
  );
};
