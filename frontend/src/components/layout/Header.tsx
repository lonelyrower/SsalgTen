import { Globe, Activity, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MobileNav } from '@/components/layout/MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export const Header = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };


  return (
    <header className="relative glass sticky top-0 z-50 border-b border-white/10">
      {/* 动态背景效果 */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-purple-900/95 to-slate-900/95" />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, hsl(217 91% 60% / 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 75% 75%, hsl(280 100% 70% / 0.3) 0%, transparent 50%)`
        }}
      />
      
      <div className="relative z-10 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo - 科技感3D效果 */}
          <Link to="/" className="flex items-center space-x-4 group">
            <div className="relative">
              {/* 外层光晕 */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-75 group-hover:opacity-100 blur-sm group-hover:blur transition-all duration-500" />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl opacity-50 group-hover:opacity-75 blur group-hover:blur-md transition-all duration-500" />
              
              {/* 主Logo容器 */}
              <div className="relative p-3 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Globe className="h-8 w-8 text-white drop-shadow-lg" />
                
                {/* 内部发光点 */}
                <div className="absolute top-1 right-1 w-2 h-2 bg-white/50 rounded-full blur-sm animate-pulse" />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-3xl font-bold gradient-text drop-shadow-sm">
                  SsalgTen
                </h1>
                <p className="text-xs text-blue-200/80 font-medium tracking-wider">
                  GLOBAL NETWORK MONITOR
                </p>
              </div>
              
            </div>
          </Link>

        {/* Navigation - 科技感导航 */}
        <nav className="hidden md:flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                <span className="relative z-10">监控面板</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link to="/nodes" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                <span className="relative z-10">节点管理</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link to="/diagnostics" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                <span className="relative z-10">诊断记录</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link to="/security" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                <span className="relative z-10">威胁监控</span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link to="/universe" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                <span className="relative z-10">3D宇宙</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              {hasRole('ADMIN') && (
                <Link to="/admin" className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/10 group">
                  <span className="relative z-10">系统管理</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
              )}
            </>
          ) : (
            <></>
          )}
        </nav>

        {/* Actions - 科技感操作区 */}
        <div className="flex items-center space-x-3">
          {/* 主题切换器 */}
          <div className="hidden sm:block">
            <div className="glass rounded-lg p-1">
              <ThemeToggle />
            </div>
          </div>

          {/* 如果已认证，显示简化的用户操作 */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">

              {/* 退出按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="relative overflow-hidden bg-transparent border-red-500/50 text-red-400 hover:text-white hover:border-red-500 group transition-all duration-300"
              >
                <LogOut className="h-4 w-4 mr-2 relative z-10" />
                <span className="hidden sm:inline relative z-10">退出</span>
              </Button>
            </div>
          ) : (
            /* 如果未认证，显示登录按钮 */
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button className="gradient-btn">
                  <Activity className="h-4 w-4 mr-2" />
                  登录
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