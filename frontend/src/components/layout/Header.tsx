import { Globe, Activity, Settings, LogOut, User, Shield } from 'lucide-react';
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'OPERATOR':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'VIEWER':
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '管理员';
      case 'OPERATOR':
        return '操作员';
      case 'VIEWER':
        return '查看者';
      default:
        return '未知';
    }
  };

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50 px-4 py-3 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center space-x-3 group">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SsalgTen
            </h1>
            <span className="text-xs font-medium text-gray-500 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 px-2 py-1 rounded-full shadow-sm">
              v0.1.0
            </span>
          </div>
        </Link>

        {/* Navigation - 根据登录状态显示不同导航 */}
        <nav className="hidden md:flex items-center space-x-6">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                监控面板
              </Link>
              <Link to="/nodes" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                节点管理
              </Link>
              <Link to="/diagnostics" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                诊断记录
              </Link>
              {hasRole('ADMIN') && (
                <Link to="/admin" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                  系统管理
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                首页
              </Link>
              <a href="#nodes" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                节点
              </a>
              <a href="#about" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                关于
              </a>
            </>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* 主题切换器 - 总是显示 */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          
          {/* 桌面端用户信息和操作 */}
          {isAuthenticated ? (
            <>
              {/* 用户信息 */}
              <div className="hidden lg:flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {getRoleIcon(user?.role || '')}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user?.name || user?.username}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({getRoleText(user?.role || '')})
                </span>
              </div>

              {/* 退出按钮 - 桌面端 */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="hidden md:flex text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Activity className="h-4 w-4" />
              </Button>
              <Link to="/login" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  登录
                </Button>
              </Link>
            </>
          )}

          {/* 移动端导航 */}
          <MobileNav />
        </div>
      </div>
    </header>
  );
};