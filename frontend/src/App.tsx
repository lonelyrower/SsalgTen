import { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ErrorBoundary from "@/components/error/ErrorBoundary";
import { PageErrorBoundary } from "@/components/error/ErrorBoundaryUtils";
import { apiService } from "@/services/api";
import "./App.css";

// Lazy load pages for better performance
const HomePage = lazy(() =>
  import("@/pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const UnifiedDashboardPage = lazy(() =>
  import("@/pages/UnifiedDashboardPage").then((module) => ({
    default: module.UnifiedDashboardPage,
  })),
);
const NodesPage = lazy(() =>
  import("@/pages/NodesPageNew").then((module) => ({
    default: module.NodesPageNew,
  })),
);
const AdminPage = lazy(() =>
  import("@/pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);
const StreamingPage = lazy(() =>
  import("@/pages/StreamingPage").then((module) => ({
    default: module.StreamingPage,
  })),
);
const ServicesPage = lazy(() =>
  import("@/pages/ServicesPage").then((module) => ({
    default: module.ServicesPage,
  })),
);

function App() {
  // 动态加载系统名称并更新页面标题
  useEffect(() => {
    const loadSystemName = async () => {
      try {
        const response = await apiService.getSystemConfig("system.name");
        if (response.success && response.data?.value) {
          document.title = response.data.value;
        }
      } catch (error) {
        // 加载失败时保持默认标题
        console.debug("Failed to load system name:", error);
      }
    };

    loadSystemName();
  }, []);

  // 记录访问者信息（仅在首次加载时）
  useEffect(() => {
    const recordVisit = async () => {
      try {
        // 调用访问者信息 API，自动记录访问
        await apiService.getVisitorInfo();
      } catch (error) {
        // 记录失败不影响应用运行
        console.debug("Failed to record visitor info:", error);
      }
    };

    recordVisit();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <Router>
            <AuthProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  {/* 公开路由 */}
                  <Route
                    path="/"
                    element={
                      <PageErrorBoundary>
                        <HomePage />
                      </PageErrorBoundary>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <PageErrorBoundary>
                        <LoginPage />
                      </PageErrorBoundary>
                    }
                  />

                  {/* 需要认证的路由 */}
                  {/* 统一监控中心 - 新的主页面 */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <PageErrorBoundary>
                          <UnifiedDashboardPage />
                        </PageErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* 节点管理 */}
                  <Route
                    path="/nodes"
                    element={
                      <ProtectedRoute>
                        <PageErrorBoundary>
                          <NodesPage />
                        </PageErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* 流媒体解锁 */}
                  <Route
                    path="/streaming"
                    element={
                      <ProtectedRoute>
                        <PageErrorBoundary>
                          <StreamingPage />
                        </PageErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* 服务总览 */}
                  <Route
                    path="/services"
                    element={
                      <ProtectedRoute>
                        <PageErrorBoundary>
                          <ServicesPage />
                        </PageErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* 系统管理 */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <PageErrorBoundary>
                          <AdminPage />
                        </PageErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* 默认重定向 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
