import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import './App.css';

// Lazy load pages for better performance
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(module => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const NodesPage = lazy(() => import('@/pages/NodesPage').then(module => ({ default: module.NodesPage })));
const DiagnosticsPage = lazy(() => import('@/pages/DiagnosticsPage').then(module => ({ default: module.DiagnosticsPage })));
const SecurityPage = lazy(() => import('@/pages/SecurityPage').then(module => ({ default: module.SecurityPage })));
const UniversePage = lazy(() => import('@/pages/UniversePage').then(module => ({ default: module.UniversePage })));

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* 公开路由 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* 需要认证的路由 */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          {/* 管理员专用路由 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <DashboardPage view="settings" />
              </ProtectedRoute>
            }
          />
          
          {/* 操作员及以上权限路由 */}
          <Route
            path="/nodes"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <NodesPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/diagnostics"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <DiagnosticsPage />
              </ProtectedRoute>
            }
          />
          
          {/* 新增炫酷功能路由 */}
          <Route
            path="/security"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <SecurityPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/universe"
            element={
              <ProtectedRoute requiredRole="VIEWER">
                <UniversePage />
              </ProtectedRoute>
            }
          />
          
          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;