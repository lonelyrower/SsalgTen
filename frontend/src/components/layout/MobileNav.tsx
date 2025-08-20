import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X, 
  Activity, 
  Users, 
  Settings, 
  BarChart3, 
  LogOut,
  Shield
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const navItems = isAuthenticated ? [
    { path: '/dashboard', label: '监控面板', icon: Activity, show: true },
    { path: '/nodes', label: '节点管理', icon: Settings, show: hasRole('OPERATOR') },
    { path: '/diagnostics', label: '诊断记录', icon: BarChart3, show: true },
    { path: '/admin', label: '系统管理', icon: Users, show: hasRole('ADMIN') },
  ] : [
    { path: '/', label: '首页', icon: Activity, show: true },
  ];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'OPERATOR':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'VIEWER':
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Users className="h-4 w-4 text-gray-500" />;
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
    <div className="md:hidden">
      {/* 菜单按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* 移动端菜单覆盖层 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 侧边菜单 */}
          <div className="fixed top-0 left-0 w-80 max-w-[80vw] h-full bg-white dark:bg-gray-800 z-50 shadow-xl transform transition-transform duration-300">
            <div className="flex flex-col h-full">
              {/* 用户信息区域 */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                {isAuthenticated ? (
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-12 w-12">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                        {user?.name ? user.name.charAt(0).toUpperCase() : user?.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user?.name || user?.username}
                      </p>
                      <div className="flex items-center space-x-1 mt-1">
                        {getRoleIcon(user?.role || '')}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {getRoleText(user?.role || '')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      欢迎使用 SsalgTen
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      网络监控管理系统
                    </p>
                  </div>
                )}
              </div>

              {/* 导航菜单 */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {navItems.filter(item => item.show).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                      }`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* 底部操作区域 */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {isAuthenticated ? (
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    退出登录
                  </Button>
                ) : (
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <Button className="w-full">
                      登录
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};