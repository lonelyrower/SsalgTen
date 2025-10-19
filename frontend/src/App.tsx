import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/error/ErrorBoundary';
import { PageErrorBoundary } from '@/components/error/ErrorBoundaryUtils';
import { apiService } from '@/services/api';
import './App.css';

// Lazy load pages for better performance
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(module => ({ default: module.LoginPage })));
const UnifiedDashboardPage = lazy(() => import('@/pages/UnifiedDashboardPage').then(module => ({ default: module.UnifiedDashboardPage })));
const NodesPage = lazy(() => import('@/pages/NodesPage').then(module => ({ default: module.NodesPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(module => ({ default: module.AdminPage })));
// 保留旧页面用于向后兼容和逐步迁移
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage').then(module => ({ default: module.MonitoringPage })));
const SecurityPage = lazy(() => import('@/pages/SecurityPage').then(module => ({ default: module.SecurityPage })));

function App() {
  // 动态加载系统名称并更新页面标题
  useEffect(() => {
    const loadSystemName = async () => {
      try {
        const response = await apiService.getSystemConfig('system.name');
        if (response.success && response.data?.value) {
          document.title = response.data.value;
        }
      } catch (error) {
        // 加载失败时保持默认标题
        console.debug('Failed to load system name:', error);
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
        console.debug('Failed to record visitor info:', error);
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
          <Route path="/" element={
            <PageErrorBoundary>
              <HomePage />
            </PageErrorBoundary>
          } />
          <Route path="/login" element={
            <PageErrorBoundary>
              <LoginPage />
            </PageErrorBoundary>
          } />
          
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

          {/* 节点管理 - OPERATOR及以上权限 */}
          <Route
            path="/nodes"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <PageErrorBoundary>
                  <NodesPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />

          {/* 系统管理 - ADMIN权限 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <PageErrorBoundary>
                  <AdminPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />

          {/* 向后兼容路由 - 保留旧页面访问 */}
          <Route
            path="/monitoring"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <PageErrorBoundary>
                  <MonitoringPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/security"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <PageErrorBoundary>
                  <SecurityPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard-old"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <PageErrorBoundary>
                  <DashboardPage />
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
