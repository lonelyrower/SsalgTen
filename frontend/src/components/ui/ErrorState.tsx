import React from 'react';
import { AlertTriangle, RefreshCw, Home, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  type?: 'error' | 'network' | 'not-found' | 'access-denied' | 'server';
  showRetry?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const errorConfig = {
  error: {
    icon: AlertTriangle,
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    defaultTitle: '出现错误',
    defaultMessage: '抱歉，发生了意外错误。'
  },
  network: {
    icon: WifiOff,
    color: 'text-orange-500 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    defaultTitle: '网络连接失败',
    defaultMessage: '请检查网络连接并重试。'
  },
  'not-found': {
    icon: AlertCircle,
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    defaultTitle: '页面未找到',
    defaultMessage: '抱歉，您访问的页面不存在。'
  },
  'access-denied': {
    icon: AlertTriangle,
    color: 'text-yellow-500 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    defaultTitle: '访问被拒绝',
    defaultMessage: '您没有权限访问此资源。'
  },
  server: {
    icon: Wifi,
    color: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    defaultTitle: '服务器连接失败',
    defaultMessage: '无法连接到服务器，请稍后重试。'
  }
};

const sizeConfig = {
  sm: {
    container: 'p-6',
    icon: 'h-8 w-8',
    title: 'text-lg',
    message: 'text-sm',
    button: 'text-sm px-3 py-2'
  },
  md: {
    container: 'p-8',
    icon: 'h-12 w-12',
    title: 'text-xl',
    message: 'text-base',
    button: 'text-base px-4 py-2'
  },
  lg: {
    container: 'p-12',
    icon: 'h-16 w-16',
    title: 'text-2xl',
    message: 'text-lg',
    button: 'text-lg px-6 py-3'
  }
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  type = 'error',
  showRetry = true,
  showHome = false,
  onRetry,
  className = '',
  size = 'md'
}) => {
  const config = errorConfig[type];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className={`flex items-center justify-center min-h-64 ${className}`}>
      <div className={`
        max-w-md w-full text-center rounded-2xl border shadow-lg
        ${config.bgColor} ${config.borderColor} ${sizeStyles.container}
      `}>
        {/* 图标装饰 */}
        <div className="relative mb-6">
          <div className={`
            absolute inset-0 rounded-full opacity-20 blur-xl
            ${config.bgColor.replace('50', '200').replace('900/20', '600/40')}
          `}></div>
          <div className="relative">
            <Icon className={`${sizeStyles.icon} mx-auto ${config.color}`} />
          </div>
        </div>

        {/* 标题 */}
        <h3 className={`${sizeStyles.title} font-bold text-gray-900 dark:text-white mb-3`}>
          {title || config.defaultTitle}
        </h3>

        {/* 消息 */}
        <p className={`${sizeStyles.message} text-gray-600 dark:text-gray-400 mb-6 leading-relaxed`}>
          {message || config.defaultMessage}
        </p>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              size="sm"
              className={`
                ${sizeStyles.button} inline-flex items-center space-x-2
                bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200
                shadow-lg hover:shadow-xl transform hover:scale-105
              `}
            >
              <RefreshCw className="h-4 w-4" />
              <span>重新加载</span>
            </Button>
          )}
          
          {showHome && (
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              size="sm"
              className={`
                ${sizeStyles.button} inline-flex items-center space-x-2
                border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200
              `}
            >
              <Home className="h-4 w-4" />
              <span>返回首页</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};