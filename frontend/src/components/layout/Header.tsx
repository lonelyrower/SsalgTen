import { Globe, Activity, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MobileNav } from '@/components/layout/MobileNav';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export const Header = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };


  return (
    <header className="relative glass sticky top-0 z-50 border-b border-white/10 rounded-b-2xl">
      {/* 简化背景 - 纯蓝科技渐变 */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/98 via-blue-900/95 to-slate-900/98 rounded-b-2xl" />

      <div className="relative z-10 mobile-container py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto mobile-safe">
          {/* Logo - 科技感3D效果 */}
          <Link to="/" className="flex items-center space-x-4 group">
            <div className="relative">
              {/* 外层光晕 */}
              <div className="absolute inset-0 bg-primary/30 rounded-xl opacity-75 group-hover:opacity-100 blur-sm group-hover:blur transition-all duration-500" />
              <div className="absolute inset-0 bg-primary/20 rounded-xl opacity-50 group-hover:opacity-75 blur group-hover:blur-md transition-all duration-500" />
              
              {/* 主Logo容器 */}
              <div className="relative p-3 bg-primary rounded-xl shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Globe className="h-8 w-8 text-white drop-shadow-lg" />
                
                {/* 内部发光点 */}
                <div className="absolute top-1 right-1 w-2 h-2 bg-white/50 rounded-full blur-sm animate-pulse" />
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text drop-shadow-sm">
                  SsalgTen
                </h1>
                <p className="text-xs text-primary font-medium tracking-wider hidden sm:block">
                  GLOBAL NETWORK MONITOR
                </p>
              </div>
            </div>
          </Link>

        {/* Navigation - 现代化扁平导航 */}
        <nav className="hidden md:flex items-center space-x-1">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors duration-200 group">
                <span className="relative z-10">监控面板</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              </Link>
              <Link to="/monitoring" className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors duration-200 group">
                <span className="relative z-10">监控概览</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              </Link>
              <Link to="/nodes" className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors duration-200 group">
                <span className="relative z-10">节点管理</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              </Link>
              <Link to="/security" className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors duration-200 group">
                <span className="relative z-10">威胁监控</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              </Link>
              {hasRole('ADMIN') && (
                <Link to="/admin" className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors duration-200 group">
                  <span className="relative z-10">系统管理</span>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                  </Link>
              )}
            </>
          ) : (
            <></>
          )}
        </nav>

        {/* Actions - 科技感操作区 */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* 主题切换器 */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* 如果已认证，显示简化的用户操作 */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* 退出按钮 - 扁平化样式 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="relative text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200 mobile-touch-target"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          ) : (
            /* 如果未认证，显示登录按钮 */
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button className="bg-primary hover:bg-primary/90 text-white transition-colors duration-200 mobile-touch-target">
                  <Activity className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">登录</span>
                </Button>
              </Link>
            </div>
          )}

          {/* 移动端菜单 */}
          <div className="md:hidden">
            <div className="glass rounded-lg p-1">
              <MobileNav />
            </div>
          </div>
        </div>
      </div>
      </div>
      
      {/* 底部装饰线 - 数据流效果 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent data-flow" />
    </header>
  );
};
