import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "OPERATOR" | "VIEWER";
  requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requireAuth = true,
}) => {
  const { isAuthenticated, hasRole, isLoading } = useAuth();
  const location = useLocation();

  // 如果正在加载认证状态，显示加载器
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // 如果需要认证但未登录，重定向到登录页
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果需要特定角色但权限不足，显示权限不足页面
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-6">
            <div className="mx-auto h-24 w-24 text-[hsl(var(--status-error-500))] mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              权限不足
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              您没有访问此页面的权限。需要{" "}
              {requiredRole === "ADMIN"
                ? "管理员"
                : requiredRole === "OPERATOR"
                  ? "操作员"
                  : "查看者"}{" "}
              权限。
            </p>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
