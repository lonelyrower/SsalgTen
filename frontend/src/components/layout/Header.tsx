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
    <header className="sticky top-0 z-50 relative bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900">
      {/* 清晰的渐变背景 + 轻微模糊 */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-blue-900/85 to-slate-900/90 backdrop-blur-sm">
        {/* 扫描线动画 - 进一步减弱 */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.03) 2px, rgba(6, 182, 212, 0.03) 4px)",
          }}
        />
        {/* 底部发光线 */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </div>

      <div className="relative pointer-events-auto px-0">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          {/* Logo - 科技感设计 */}
          <Link to="/" className="flex items-center space-x-3 group pointer-events-auto">
            {/* Logo 图标 - 六边形边框 */}
            <div className="relative">
              {/* 外层发光 */}
              <div className="absolute inset-0 bg-cyan-500/30 blur-md group-hover:bg-cyan-400/40 transition-all" />
              {/* 六边形背景 */}
              <div className="relative p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-lg border border-cyan-500/30 group-hover:border-cyan-400/50 backdrop-blur-sm transition-all">
                <Network
                  className="h-6 w-6 text-cyan-400 group-hover:text-cyan-300 transition-colors"
                  strokeWidth={2.5}
                />
                {/* 内部闪光点 */}
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Logo 文字 */}
            <div className="flex flex-col">
              <h1 className="text-lg font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                SsalgTen
              </h1>
              <p className="text-[10px] text-cyan-400/80 font-medium tracking-[0.2em] uppercase hidden sm:block">
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
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>监控中心</span>
                  {isActive("/dashboard") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </Link>
                <Link
                  to="/nodes"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/nodes")
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Server className="h-4 w-4" />
                  <span>节点看板</span>
                  {isActive("/nodes") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </Link>
                <Link
                  to="/streaming"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/streaming")
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Film className="h-4 w-4" />
                  <span>流媒体</span>
                  {isActive("/streaming") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </Link>
                <Link
                  to="/services"
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive("/services")
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>服务总览</span>
                  {isActive("/services") && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </Link>
                {isAuthenticated && (
                  <Link
                    to="/admin"
                    className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive("/admin")
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                        : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>系统管理</span>
                    {isActive("/admin") && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
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
                    ? "bg-green-500/15 text-green-300 border border-green-500/30 hover:border-green-500/50"
                    : "bg-red-500/15 text-red-300 border border-red-500/30 hover:border-red-500/50"
                }`}
                title={connected ? "实时连接正常" : "实时连接断开"}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
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
                <Button className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/40 transition-all mobile-touch-target">
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
