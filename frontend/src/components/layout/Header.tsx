import { Network, Activity, LogOut, LayoutDashboard, Monitor, Server, Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MobileNav } from '@/components/layout/MobileNav';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export const Header = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 dark:bg-slate-950/80 border-b border-cyan-500/20 shadow-lg shadow-cyan-500/5">
      <div className="mobile-container">
        <div className="flex items-center justify-between h-16 max-w-7xl mx-auto mobile-safe">
          {/* Logo - 简洁现代设计 */}
          <Link to="/" className="flex items-center space-x-3 group">
            {/* Logo 图标 */}
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-lg blur group-hover:bg-cyan-400/30 transition-all" />
              <div className="relative p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg group-hover:shadow-cyan-500/50 transition-all">
                <Network className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Logo 文字 */}
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-white tracking-tight">
                SsalgTen
              </h1>
              <p className="text-[10px] text-cyan-400 font-medium tracking-widest uppercase hidden sm:block">
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
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/dashboard')
                      ? 'bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>监控面板</span>
                </Link>
                <Link
                  to="/monitoring"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/monitoring')
                      ? 'bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  <span>监控概览</span>
                </Link>
                <Link
                  to="/nodes"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/nodes')
                      ? 'bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Server className="h-4 w-4" />
                  <span>节点管理</span>
                </Link>
                <Link
                  to="/security"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/security')
                      ? 'bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>威胁监控</span>
                </Link>
                {hasRole('ADMIN') && (
                  <Link
                    to="/admin"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive('/admin')
                        ? 'bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>系统管理</span>
                  </Link>
                )}
              </>
            ) : null}
          </nav>

          {/* Actions - 右侧操作区 */}
          <div className="flex items-center space-x-2">
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
