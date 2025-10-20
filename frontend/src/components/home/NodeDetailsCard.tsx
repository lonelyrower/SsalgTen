import { GlassCard } from "@/components/ui/GlassCard";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { Activity } from "lucide-react";
import type { NodeData } from "@/services/api";

interface NodeDetailsCardProps {
  node: NodeData;
  showNetworkInfo?: boolean;
}

export const NodeDetailsCard: React.FC<NodeDetailsCardProps> = ({
  node,
  showNetworkInfo = false,
}) => {
  return (
    <GlassCard variant="tech" animated={false} glow={false} className="p-6">
      <div>
        <div className="flex-1">
          {/* 节点头部信息 */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <div className="p-3 bg-primary/15 rounded-xl border border-white/10">
                <Activity className="h-8 w-8 text-primary" />
              </div>
              {/* 只为在线节点保留脉冲动画 */}
              {node.status === "online" && (
                <div className="absolute -top-1 -right-1 status-indicator bg-green-400" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-bold gradient-text">{node.name}</h3>
              <p className="text-muted-foreground text-sm font-medium flex items-center">
                <Activity className="h-4 w-4 mr-2 text-purple-400" />
                已选中网络节点 • 正在监控
              </p>
            </div>
          </div>

          {/* 节点详细信息 - 分组优化 */}
          <div className="space-y-6">
            {/* 基础信息组 */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                基础信息
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="glass rounded-lg p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground/70 mb-1.5">
                    地理位置
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CountryFlagSvg country={node.country} />
                    <div className="font-semibold text-foreground text-sm">
                      {node.city}, {node.country}
                    </div>
                  </div>
                </div>

                <div className="glass rounded-lg p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground/70 mb-1.5">
                    服务提供商
                  </div>
                  <div className="font-semibold text-foreground text-sm text-center">
                    {node.provider}
                  </div>
                </div>

                <div className="glass rounded-lg p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground/70 mb-1.5">
                    运行状态
                  </div>
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                        node.status === "online"
                          ? "status-badge-online"
                          : "status-badge-offline"
                      }`}
                    >
                      {node.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 网络信息组 - 仅登录用户可见 */}
            {showNetworkInfo &&
              (node.ipv4 || (node.ipv6 && node.ipv6.includes(":"))) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    网络配置
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {node.ipv4 && (
                      <div className="glass rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-muted-foreground/70 mb-1.5">
                          IPv4 地址
                        </div>
                        <div className="font-mono text-sm text-primary font-semibold">
                          {node.ipv4}
                        </div>
                      </div>
                    )}

                    {node.ipv6 && node.ipv6.includes(":") && (
                      <div className="glass rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-muted-foreground/70 mb-1.5">
                          IPv6 地址
                        </div>
                        <div className="font-mono text-sm text-accent font-semibold break-all">
                          {node.ipv6}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* 状态信息组 */}
            {node.lastSeen && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  状态记录
                </h4>
                <div className="glass rounded-lg p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground/70 mb-1.5">
                    最后在线时间
                  </div>
                  <div className="font-medium text-sm text-foreground">
                    {new Date(node.lastSeen).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
