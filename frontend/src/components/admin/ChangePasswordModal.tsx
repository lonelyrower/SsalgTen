import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiService } from '@/services/api';
import { useNotification } from '@/contexts/NotificationContext';
import { 
  X, 
  Lock, 
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const { addNotification } = useNotification();

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = '请输入当前密码';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = '请输入新密码';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = '新密码长度至少6个字符';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = '请确认新密码';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = '新密码不能与当前密码相同';
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
      const response = await apiService.changePassword(currentPassword, newPassword);

      if (response.success) {
        addNotification({
          type: 'success',
          title: '密码修改成功',
          message: '您的密码已成功修改，请妥善保管新密码'
        });
        handleClose();
      } else {
        setErrors({
          currentPassword: response.error || '密码修改失败'
        });
      }
    } catch (error) {
      console.error('Change password error:', error);
      setErrors({
        currentPassword: '网络错误，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Lock className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              修改密码
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 当前密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                当前密码
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.currentPassword 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-700 dark:text-white`}
                  placeholder="请输入当前密码"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.currentPassword}
                </div>
              )}
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                新密码
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.newPassword 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-700 dark:text-white`}
                  placeholder="请输入新密码（至少6个字符）"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.newPassword}
                </div>
              )}
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                确认新密码
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } dark:bg-gray-700 dark:text-white`}
                  placeholder="请再次输入新密码"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.confirmPassword}
                </div>
              )}
            </div>

            {/* 密码强度提示 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">密码安全建议：</p>
                  <ul className="text-xs space-y-1">
                    <li>• 使用至少6个字符</li>
                    <li>• 包含字母、数字和特殊符号</li>
                    <li>• 避免使用个人信息</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? '修改中...' : '确认修改'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};