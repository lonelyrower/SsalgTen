import React from "react";
import type { ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { AlertCircle } from "lucide-react";

// 高阶组件版本，用于包装特定组件

// 用于页面级别的简化错误边界
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      // 在生产环境中，这里可以发送错误报告到监控服务
      console.error("Page Error:", error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

// 用于组件级别的简化错误边界
export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  componentName?: string;
}> = ({ children, componentName }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center space-x-2 text-red-700 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">
            {componentName ? `${componentName} 组件` : "组件"}加载失败
          </span>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          请刷新页面重试
        </p>
      </div>
    }
    onError={(error, errorInfo) => {
      console.error(`Component Error in ${componentName}:`, error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);
