import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Lock, User, Eye, EyeOff, Shield } from "lucide-react";

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 如果已经登录，重定向到目标页面或首页
  if (isAuthenticated) {
    const state = location.state as LocationState | null;
    const redirectTo = state?.from?.pathname ?? "/dashboard";
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除错误信息
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError("请输入用户名和密码");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const success = await login(formData.username, formData.password);
      if (!success) {
        setError("用户名或密码错误");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("登录失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 py-8">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-200/20 dark:bg-purple-600/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-indigo-200/20 dark:bg-indigo-600/10 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* 登录卡片 */}
        <div className="relative overflow-hidden rounded-[var(--radius-3xl)] border-2 border-cyan-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-[var(--shadow-2xl)] backdrop-blur-[var(--blur-xl)] dark:border-cyan-900/40 dark:from-slate-950/90 dark:via-sky-950/30 dark:to-cyan-950/25">
          <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen dark:mix-blend-normal bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.25),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.25),transparent_45%)]" />
          <div className="absolute -top-24 -right-16 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-500/20" />
          <div className="absolute -bottom-24 -left-20 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/20" />
          <div className="relative z-10 p-8">
            {/* Logo 和标题 */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <div className="p-4 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 rounded-[var(--radius-2xl)] shadow-[var(--shadow-lg)] shadow-sky-500/40">
                  <Shield className="h-12 w-12 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-sky-700 to-indigo-700 dark:from-white dark:via-sky-200 dark:to-indigo-200 bg-clip-text text-transparent mb-2">
                SsalgTen
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-lg">
                网络监控管理系统
              </p>
            </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3"
              >
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-cyan-500" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-4 border-2 border-slate-200/80 dark:border-slate-700/80 rounded-[var(--radius-xl)] focus:ring-4 focus:ring-primary/20 focus:border-primary dark:bg-slate-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-[var(--duration-normal)] bg-white/60 hover:bg-white/80 dark:hover:bg-slate-900/60"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-slate-200/80 dark:border-slate-700/80 rounded-[var(--radius-lg)] focus:ring-2 focus:ring-primary focus:border-primary bg-white/60 dark:bg-slate-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-[var(--duration-normal)]"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="p-3 border border-[hsl(var(--status-error-300)_/_0.8)] bg-[hsl(var(--status-error-50)_/_0.8)] dark:border-[hsl(var(--status-error-800)_/_0.6)] dark:bg-[hsl(var(--status-error-900)_/_0.3)] rounded-[var(--radius-lg)] shadow-[var(--shadow-inner)]">
                <p className="text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-300))]">
                  {error}
                </p>
              </div>
            )}

            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 text-white shadow-[var(--shadow-lg)] shadow-cyan-500/30 hover:shadow-cyan-500/40"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  登录中...
                </div>
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 默认账户提示 */}
          <div className="mt-8 rounded-[var(--radius-xl)] border border-cyan-200/70 bg-cyan-50/70 p-4 text-cyan-700 shadow-[var(--shadow-inner)] shadow-cyan-500/10 dark:border-cyan-900/50 dark:bg-sky-900/20 dark:text-cyan-200">
            <p className="text-sm text-center font-semibold">
              <strong>默认管理员账户：</strong>
            </p>
            <p className="text-sm text-center mt-1">
              用户名: admin | 密码: admin123
            </p>
            <p className="text-xs text-center mt-2 opacity-80">
              ⚠️ 首次登录后请立即更改密码
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
