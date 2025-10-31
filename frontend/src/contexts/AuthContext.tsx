import React, { useState, useEffect } from "react";
import { apiService, type User } from "@/services/api";
import { useApiNotifications } from "@/hooks/useApiNotifications";
import { AuthContext, type AuthContextValue } from "./auth-context";

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化API通知系统
  useApiNotifications();

  useEffect(() => {
    // 检查是否已登录
    const checkAuth = async () => {
      if (apiService.isLoggedIn()) {
        try {
          const response = await apiService.getCurrentUser();
          if (response.success && response.data) {
            setUser(response.data);
          } else {
            // 清除无效的令牌
            await apiService.logout();
          }
        } catch (error) {
          console.error("Failed to get current user:", error);
          try {
            await apiService.logout();
          } catch (logoutError) {
            console.warn("Failed to logout:", logoutError);
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth().catch((error) => {
      console.error("Auth check failed:", error);
      setIsLoading(false);
    });
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const response = await apiService.login({ username, password });
      if (response.success && response.data) {
        setUser(response.data.user);
        return true;
      } else {
        console.error("Login failed:", response.error);
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;

    // 检查特定角色
    switch (role) {
      case "ADMIN":
        return user.role === "ADMIN";
      case "OPERATOR":
        return user.role === "ADMIN" || user.role === "OPERATOR";
      case "VIEWER":
        return (
          user.role === "ADMIN" ||
          user.role === "OPERATOR" ||
          user.role === "VIEWER"
        );
      default:
        return false;
    }
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
