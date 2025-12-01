import { useEffect, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import { Activity, MapPin, Server, X, Clock } from "lucide-react";
import type { NodeData } from "@/services/api";
import { cn } from "@/lib/utils";

interface NodeDetailsPopoverProps {
  node: NodeData;
  showNetworkInfo?: boolean;
  onClose: () => void;
}

export const NodeDetailsPopover: React.FC<NodeDetailsPopoverProps> = ({
  node,
  showNetworkInfo = false,
  onClose,
}) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const lastSeen = useMemo(() => {
    if (!node.lastSeen) {
      return null;
    }
    try {
      return new Date(node.lastSeen).toLocaleString("zh-CN");
    } catch {
      return node.lastSeen;
    }
  }, [node.lastSeen]);

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-auto sm:right-6 sm:bottom-6 pointer-events-none">
      <div className="pointer-events-auto sm:w-[360px] md:w-[380px]">
        <GlassCard
          variant="tech"
          animated
          hoverTransform={false}
          glow
          className="p-4 sm:p-5 shadow-2xl"
        >
          <div className="relative">
            <div className="absolute top-0 left-0">
              <div className="relative">
                <div className="p-2 bg-primary/15 rounded-xl border border-white/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                {node.status === "online" && (
                  <span className="absolute -top-1 -right-1 status-indicator bg-[hsl(var(--status-success-400))]" />
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="关闭节点详情"
              onClick={onClose}
              className="absolute top-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="text-center pt-2">
              <h3 className="text-xl font-semibold text-foreground">
                {node.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                正在监控该节点的实时状态
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3">
              <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  地理位置
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 font-medium text-foreground">
                  <CountryFlagSvg country={node.country} />
                  <span>
                    {node.city}, {node.country}
                  </span>
                </div>
              </div>

              <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Server className="h-4 w-4" />
                  服务提供商
                </div>
                <div className="mt-2 font-medium text-foreground">
                  {node.provider}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                  <div className="text-xs text-muted-foreground">运行状态</div>
                  <div className="mt-2 flex justify-center">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                        node.status === "online"
                          ? "status-badge-online"
                          : "status-badge-offline",
                      )}
                    >
                      {node.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                {lastSeen && (
                  <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      最后在线
                    </div>
                    <div className="mt-2 text-xs font-medium text-foreground">
                      {lastSeen}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showNetworkInfo &&
              (node.ipv4 || (node.ipv6 && node.ipv6.includes(":"))) && (
                <div className="grid grid-cols-1 gap-3">
                  {node.ipv4 && (
                    <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                      <div className="text-xs text-muted-foreground">
                        IPv4 地址
                      </div>
                      <div className="mt-1 font-mono text-sm text-primary font-semibold">
                        {node.ipv4}
                      </div>
                    </div>
                  )}
                  {node.ipv6 && node.ipv6.includes(":") && (
                    <div className="glass rounded-lg border border-white/10 px-4 py-3 text-center">
                      <div className="text-xs text-muted-foreground">
                        IPv6 地址
                      </div>
                      <div className="mt-1 font-mono text-sm text-accent font-semibold break-all">
                        {node.ipv6}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
