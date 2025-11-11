import React, { useState } from "react";
import { logger } from "@/utils/logger";
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
      logger.error("Login failed:", error);
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
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-primary/8 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* 登录卡片 */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-primary/30 surface-elevated shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="absolute -top-24 -right-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative z-10 p-8">
            {/* Logo 和标题 */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <div className="p-4 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600  shadow-lg shadow-sky-500/40">
                  <Shield className="h-12 w-12 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent mb-2">
                SsalgTen
              </h1>
              <p className="text-muted-foreground text-lg">
                网络监控管理系统
              </p>
            </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-foreground mb-3"
              >
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-4 border-2 border-border rounded-xl focus:ring-4 focus:ring-primary/20 focus:border-primary bg-background/60 hover:bg-background/80 text-foreground transition-all duration-200"
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
                className="block text-sm font-medium text-foreground mb-2"
              >
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground transition-colors"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="p-3 border border-[hsl(var(--error))]/30 bg-[hsl(var(--error))]/10 rounded-xl shadow-inner">
                <p className="text-sm text-[hsl(var(--error))]">
                  {error}
                </p>
              </div>
            )}

            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/40"
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
          <div className="mt-8 rounded-xl border border-[hsl(var(--info))]/30 bg-[hsl(var(--info))]/10 p-4 text-[hsl(var(--info))] shadow-inner">
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
