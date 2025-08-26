import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ErrorBoundary, { PageErrorBoundary } from '@/components/error/ErrorBoundary';
import './App.css';

// Lazy load pages for better performance
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(module => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const NodesPage = lazy(() => import('@/pages/NodesPage').then(module => ({ default: module.NodesPage })));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage').then(module => ({ default: module.MonitoringPage })));
const SecurityPage = lazy(() => import('@/pages/SecurityPage').then(module => ({ default: module.SecurityPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(module => ({ default: module.AdminPage })));

function App() {
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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <PageErrorBoundary>
                  <DashboardPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          
          {/* 管理员专用路由 */}
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
          
          {/* 操作员及以上权限路由 */}
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
          
          {/* 新增炫酷功能路由 */}
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
