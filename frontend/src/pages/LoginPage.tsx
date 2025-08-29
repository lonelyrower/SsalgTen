import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Lock, User, Eye, EyeOff, Shield } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 如果已经登录，重定向到目标页面或首页
  if (isAuthenticated) {
    const redirectTo = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <LoadingSpinner 
        fullScreen 
        text="正在验证身份..." 
        size="xl"
        variant="elegant"
      />
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // 清除错误信息
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const success = await login(formData.username, formData.password);
      if (!success) {
        setError('用户名或密码错误');
      }
    } catch (error) {
      setError('登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900/20 dark:to-purple-900/20 flex items-center justify-center px-4 py-8">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200/20 dark:bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-200/20 dark:bg-purple-600/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-indigo-200/20 dark:bg-indigo-600/10 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* 登录卡片 */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8">
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
                <Shield className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 dark:from-white dark:to-blue-300 bg-clip-text text-transparent mb-2">
              SsalgTen
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              网络监控管理系统
            </p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/30 dark:text-white transition-all duration-200 bg-gray-50/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </div>
            </div>

          {/* 密码输入 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <Button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                登录中...
              </div>
            ) : (
              '登录'
            )}
          </Button>
        </form>

          {/* 默认账户提示 */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
              <strong>默认管理员账户：</strong>
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 text-center mt-1">
              用户名: admin | 密码: admin123
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-500 text-center mt-2">
              ⚠️ 首次登录后请立即更改密码
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};