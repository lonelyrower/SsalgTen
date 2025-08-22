import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import { Shield, Key, Lock } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  if (!hasRole('ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              访问被拒绝
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              您需要管理员权限才能访问此页面
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 管理员欢迎信息 */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl">
              <Shield className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                系统管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                管理员 {user?.name || user?.username} - 系统控制中心
              </p>
            </div>
          </div>
        </div>

        {/* 管理功能卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 修改密码 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  修改密码
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  更改您的登录密码
                </p>
              </div>
            </div>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => setShowChangePasswordModal(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              修改密码
            </Button>
          </div>
        </div>

        {/* 系统状态概览 */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            系统状态概览
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                正常
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                系统状态
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {user?.role === 'ADMIN' ? '管理员' : '普通用户'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                当前权限
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                v0.1.0
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                系统版本
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
};