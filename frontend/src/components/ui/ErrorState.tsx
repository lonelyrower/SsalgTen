import React from "react";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  type?: "error" | "network" | "not-found" | "access-denied" | "server";
  showRetry?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const errorConfig = {
  error: {
    icon: AlertTriangle,
    color: "text-[hsl(var(--error))]",
    bgColor: "bg-[hsl(var(--error))]/10",
    borderColor: "border-[hsl(var(--error))]/30",
    defaultTitle: "出现错误",
    defaultMessage: "抱歉，发生了意外错误。",
  },
  network: {
    icon: WifiOff,
    color: "text-[hsl(var(--warning))]",
    bgColor: "bg-[hsl(var(--warning))]/10",
    borderColor: "border-[hsl(var(--warning))]/30",
    defaultTitle: "网络连接失败",
    defaultMessage: "请检查网络连接并重试。",
  },
  "not-found": {
    icon: AlertCircle,
    color: "text-muted-foreground",
    bgColor: "surface-elevated",
    borderColor: "border-border",
    defaultTitle: "页面未找到",
    defaultMessage: "抱歉，您访问的页面不存在。",
  },
  "access-denied": {
    icon: AlertTriangle,
    color: "text-[hsl(var(--warning))]",
    bgColor: "bg-[hsl(var(--warning))]/10",
    borderColor: "border-[hsl(var(--warning))]/30",
    defaultTitle: "访问被拒绝",
    defaultMessage: "您没有权限访问此资源。",
  },
  server: {
    icon: Wifi,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    defaultTitle: "服务器连接失败",
    defaultMessage: "无法连接到服务器，请稍后重试。",
  },
};

const sizeConfig = {
  sm: {
    container: "p-6",
    icon: "h-8 w-8",
    title: "text-lg",
    message: "text-sm",
    button: "text-sm px-3 py-2",
  },
  md: {
    container: "p-8",
    icon: "h-12 w-12",
    title: "text-xl",
    message: "text-base",
    button: "text-base px-4 py-2",
  },
  lg: {
    container: "p-12",
    icon: "h-16 w-16",
    title: "text-2xl",
    message: "text-lg",
    button: "text-lg px-6 py-3",
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  type = "error",
  showRetry = true,
  showHome = false,
  onRetry,
  className = "",
  size = "md",
}) => {
  const config = errorConfig[type];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className={`flex items-center justify-center min-h-64 ${className}`}>
      <div
        className={`
        max-w-md w-full text-center border shadow-[var(--shadow-lg)]
        ${config.bgColor} ${config.borderColor} ${sizeStyles.container}
      `}
        style={{ borderRadius: 'var(--radius-2xl)' }}
      >
        {/* 图标装饰 */}
        <div className="relative mb-6">
          <div
            className={`
            absolute inset-0 rounded-full opacity-20 blur-xl
            ${config.bgColor.replace("50", "200").replace("900/30", "600/40")}
          `}
          ></div>
          <div className="relative">
            <Icon className={`${sizeStyles.icon} mx-auto ${config.color}`} />
          </div>
        </div>

        {/* 标题 */}
        <h3
          className={`${sizeStyles.title} font-bold text-foreground mb-3`}
        >
          {title || config.defaultTitle}
        </h3>

        {/* 消息 */}
        <p
          className={`${sizeStyles.message} text-muted-foreground mb-6 leading-relaxed`}
        >
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
                shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transform hover:scale-105
              `}
            >
              <RefreshCw className="h-4 w-4 text-primary" />
              <span>重新加载</span>
            </Button>
          )}

          {showHome && (
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
              size="sm"
              className={`
                ${sizeStyles.button} inline-flex items-center space-x-2
                border-border text-muted-foreground
                hover:surface-elevated transition-all duration-200
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
