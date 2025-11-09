import {
  Network,
  Activity,
  LogOut,
  LayoutDashboard,
  Server,
  Settings,
  Film,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { useRealTime } from "@/hooks/useRealTime";
import { Link, useNavigate, useLocation } from "react-router-dom";

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { connected } = useRealTime();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 relative bg-brand-gradient">
      {/* 清晰的渐变背景 + 轻微模糊 */}
      <div className="absolute inset-0 bg-[hsl(var(--brand-dark))]/90 backdrop-blur-sm">
        {/* 扫描线动画 - 进一步减弱 */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--brand-cyan) / 0.03) 2px, hsl(var(--brand-cyan) / 0.03) 4px)",
          }}
        />
        {/* 底部发光线 */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--brand-cyan))]/50 to-transparent" />
      </div>

      <div className="relative pointer-events-auto px-0">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          {/* Logo - 科技感设计 */}
          <Link to="/" className="flex items-center space-x-3 group pointer-events-auto">
            {/* Logo 图标 - 六边形边框 */}
            <div className="relative">
              {/* 外层发光 */}
              <div className="absolute inset-0 bg-[hsl(var(--brand-cyan))]/30 blur-md group-hover:bg-[hsl(var(--brand-cyan))]/40 transition-all" />
              {/* 六边形背景 */}
              <div className="relative p-2.5 bg-gradient-to-br from-[hsl(var(--brand-cyan))]/20 to-[hsl(var(--brand-blue))]/20 rounded-lg border border-[hsl(var(--brand-cyan))]/30 group-hover:border-[hsl(var(--brand-cyan))]/50 backdrop-blur-sm transition-all">
                <Network
                  className="h-6 w-6 text-[hsl(var(--brand-cyan))] group-hover:text-[hsl(var(--brand-cyan))]/80 transition-colors"
                  strokeWidth={2.5}
                />
                {/* 内部闪光点 */}
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[hsl(var(--brand-cyan))] rounded-full animate-pulse" />
              </div>
            </div>

            {/* Logo 文字 */}
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-brand-gradient">
                SsalgTen
              </h1>
              <p className="text-[10px] text-[hsl(var(--brand-cyan))]/80 font-medium tracking-[0.2em] uppercase hidden sm:block">
                Network Monitor
              </p>
            </div>
          </Link>

          {/* Navigation - 带图标的现代导航 */}
          <nav className="hidden md:flex items-center space-x-1">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/dashboard")
                      ? "bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))] border border-[hsl(var(--brand-cyan))]/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>监控中心</span>
                  {isActive("/dashboard") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand-cyan))]" />
                  )}
                </Link>
                <Link
                  to="/nodes"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/nodes")
                      ? "bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))] border border-[hsl(var(--brand-cyan))]/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Server className="h-4 w-4" />
                  <span>节点看板</span>
                  {isActive("/nodes") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand-cyan))]" />
                  )}
                </Link>
                <Link
                  to="/streaming"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/streaming")
                      ? "bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))] border border-[hsl(var(--brand-cyan))]/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Film className="h-4 w-4" />
                  <span>流媒体</span>
                  {isActive("/streaming") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand-cyan))]" />
                  )}
                </Link>
                <Link
                  to="/services"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/services")
                      ? "bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))] border border-[hsl(var(--brand-cyan))]/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>服务总览</span>
                  {isActive("/services") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand-cyan))]" />
                  )}
                </Link>
                {isAuthenticated && (
                  <Link
                    to="/admin"
                    className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive("/admin")
                        ? "bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))] border border-[hsl(var(--brand-cyan))]/30"
                        : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>系统管理</span>
                    {isActive("/admin") && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand-cyan))]" />
                    )}
                  </Link>
                )}
              </>
            ) : null}
          </nav>

          {/* Actions - 右侧操作区 */}
          <div className="flex items-center space-x-2">
            {/* 连接状态指示器 - 仅在已认证时显示 */}
            {isAuthenticated && (
              <div
                className={`hidden lg:flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  connected
                    ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30 hover:border-[hsl(var(--success))]/50"
                    : "bg-[hsl(var(--error))]/15 text-[hsl(var(--error))] border border-[hsl(var(--error))]/30 hover:border-[hsl(var(--error))]/50"
                }`}
                title={connected ? "实时连接正常" : "实时连接断开"}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[hsl(var(--success))] animate-pulse" : "bg-[hsl(var(--error))]"}`}
                />
                <span>{connected ? "已连接" : "断开"}</span>
              </div>
            )}

            {/* 主题切换 */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {/* 用户操作 */}
            {isAuthenticated && user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all mobile-touch-target"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">退出</span>
              </Button>
            ) : (
              <Link to="/login">
                <Button className="btn-brand-gradient flex items-center space-x-1.5 px-4 py-2 text-sm font-medium mobile-touch-target">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">登录</span>
                </Button>
              </Link>
            )}

            {/* 移动端菜单 */}
            <div className="md:hidden">
              <MobileNav />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
