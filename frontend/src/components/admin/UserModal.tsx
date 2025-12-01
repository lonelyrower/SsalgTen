import React, { useState, useEffect } from "react";
import { apiService, type User } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotification } from "@/hooks/useNotification";
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
} from "lucide-react";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onSaved: () => void;
}

interface FormData {
  username: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  active: boolean;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaved,
}) => {
  const { showSuccess } = useNotification();
  const [formData, setFormData] = useState<FormData>({
    username: "",
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    role: "VIEWER",
    active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isEditing = !!user;

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        name: user.name || "",
        password: "",
        confirmPassword: "",
        role: user.role,
        active: user.active,
      });
    } else {
      setFormData({
        username: "",
        email: "",
        name: "",
        password: "",
        confirmPassword: "",
        role: "VIEWER",
        active: true,
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const newValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // 清除相关错误
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = "用户名不能为空";
    } else if (formData.username.length < 3) {
      newErrors.username = "用户名至少3个字符";
    }

    if (!formData.email.trim()) {
      newErrors.email = "邮箱不能为空";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "请输入有效的邮箱地址";
    }

    // 密码验证逻辑
    if (!isEditing) {
      // 新建用户：密码必填
      if (!formData.password.trim()) {
        newErrors.password = "密码不能为空";
      } else if (formData.password.length < 6) {
        newErrors.password = "密码至少6个字符";
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "密码确认不匹配";
      }
    } else {
      // 编辑用户：如果输入了密码，则进行验证
      if (formData.password.trim()) {
        if (formData.password.length < 6) {
          newErrors.password = "密码至少6个字符";
        }

        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = "密码确认不匹配";
        }
      } else if (formData.confirmPassword.trim()) {
        // 如果只填了确认密码而没填密码
        newErrors.password = "请输入新密码";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const userData = {
        username: formData.username,
        email: formData.email,
        name: formData.name,
        role: formData.role,
        active: formData.active,
        ...((!isEditing || formData.password.trim()) && {
          password: formData.password,
        }),
      };

      let response;
      if (isEditing && user) {
        response = await apiService.updateUser(user.id, userData);
      } else {
        response = await apiService.createUser({
          ...userData,
          password: formData.password || "",
        });
      }

      if (response.success) {
        // 显示成功提示
        if (isEditing && formData.password.trim()) {
          showSuccess("密码修改成功", "用户密码已成功更新");
        } else if (isEditing) {
          showSuccess("用户更新成功", "用户信息已成功更新");
        } else {
          showSuccess("用户创建成功", "新用户已成功创建");
        }
        onSaved();
        onClose();
      } else {
        setErrors({
          submit: response.error || `${isEditing ? "更新" : "创建"}用户失败`,
        });
      }
    } catch {
      setErrors({
        submit: `${isEditing ? "更新" : "创建"}用户失败`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] shadow-[var(--shadow-2xl)] max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/15 rounded-[var(--radius-lg)]">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? "编辑用户" : "添加用户"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isEditing ? "修改用户信息和权限" : "创建新的系统用户"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 全局错误 */}
          {errors.submit && (
            <div className="p-4 bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)] border border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-800))] rounded-[var(--radius-lg)] flex items-center">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--status-error-500))] mr-3" />
              <span className="text-[hsl(var(--status-error-700))] dark:text-[hsl(var(--status-error-400))]">
                {errors.submit}
              </span>
            </div>
          )}

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              用户名 *
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                  errors.username
                    ? "border-[hsl(var(--status-error-300))] dark:border-[hsl(var(--status-error-600))]"
                    : "border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))]"
                }`}
                placeholder="请输入用户名"
                disabled={loading}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]">
                {errors.username}
              </p>
            )}
          </div>

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              邮箱地址 *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                  errors.email
                    ? "border-[hsl(var(--status-error-300))] dark:border-[hsl(var(--status-error-600))]"
                    : "border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))]"
                }`}
                placeholder="请输入邮箱地址"
                disabled={loading}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]">
                {errors.email}
              </p>
            )}
          </div>

          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              显示名称
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="请输入显示名称（可选）"
              disabled={loading}
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isEditing ? "新密码（留空则不修改）" : "密码 *"}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-12 py-3 border rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                  errors.password
                    ? "border-[hsl(var(--status-error-300))] dark:border-[hsl(var(--status-error-600))]"
                    : "border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))]"
                }`}
                placeholder={isEditing ? "留空表示不修改密码" : "请输入密码"}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]">
                {errors.password}
              </p>
            )}
          </div>

          {/* 确认密码 */}
          {(!isEditing || formData.password.trim()) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                确认密码 *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
                    errors.confirmPassword
                      ? "border-[hsl(var(--status-error-300))] dark:border-[hsl(var(--status-error-600))]"
                      : "border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))]"
                  }`}
                  placeholder="请再次输入密码"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))]">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* 角色选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              用户角色 *
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                name="role"
                aria-label="用户角色"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                disabled={loading}
              >
                <option value="VIEWER">查看者 - 只读权限</option>
                <option value="OPERATOR">操作员 - 可管理节点</option>
                <option value="ADMIN">管理员 - 完全权限</option>
              </select>
            </div>
          </div>

          {/* 账户状态 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              name="active"
              checked={formData.active}
              onChange={handleInputChange}
              className="h-4 w-4 text-primary focus:ring-primary border-[hsl(var(--border-muted))] rounded-[var(--radius-sm)]"
              disabled={loading}
            />
            <label
              htmlFor="active"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              启用账户
            </label>
          </div>

          {/* 按钮组 */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading} className="">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isEditing ? "更新中..." : "创建中..."}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>{isEditing ? "更新用户" : "创建用户"}</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
