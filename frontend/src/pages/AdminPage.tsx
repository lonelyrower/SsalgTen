import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveTabs } from '@/components/ui/ResponsiveTabs';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import { NodeManagement } from '@/components/admin/NodeManagement';
import { SystemSettings } from '@/components/admin/SystemSettings';
import { SystemOverview } from '@/components/admin/SystemOverview';
import { VisitorStatsCard } from '@/components/admin/VisitorStatsCard';
import { ApiKeyManagement } from '@/components/admin/ApiKeyManagement';
import { UserManagement } from '@/components/admin/UserManagement';
import { ActivityLog } from '@/components/dashboard/ActivityLog';
import { Shield, Server, BarChart3, Settings, Users, Key } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  // 系统更新相关状态已移至SystemOverview组件中管理

  // 定义标签页配置
  const adminTabs = [
    { id: 'overview', label: '系统概览', icon: Shield },
    { id: 'statistics', label: '统计分析', icon: BarChart3 },
    { id: 'system', label: '系统配置', icon: Settings },
    { id: 'nodes', label: '节点管理', icon: Server },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'keys', label: 'API密钥', icon: Key },
  ];

  if (!hasRole('ADMIN')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50 dark:from-gray-900 dark:via-red-900/20 dark:to-orange-900/20">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorState
            type="access-denied"
            title="访问被拒绝"
            message="您需要管理员权限才能访问此页面"
            showHome={true}
            size="lg"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50/30 to-pink-50/30 dark:from-gray-900 dark:via-red-900/10 dark:to-pink-900/10">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 管理员欢迎信息 */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-pink-500/5 to-purple-500/5 dark:from-red-400/5 dark:via-pink-400/5 dark:to-purple-400/5"></div>
            <div className="relative z-10 flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-red-700 dark:from-white dark:to-red-300 bg-clip-text text-transparent">
                  系统管理
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  管理员 {user?.name || user?.username} - 系统控制中心
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 响应式标签页导航 */}
        <ResponsiveTabs
          tabs={adminTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mb-8"
        />

        {/* 标签页内容 */}
        {activeTab === 'overview' && (
          <SystemOverview />
        )}

        {activeTab === 'statistics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <VisitorStatsCard />
              <ActivityLog />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <SystemSettings />
        )}

        {activeTab === 'nodes' && (
          <NodeManagement />
        )}

        {activeTab === 'users' && (
          <UserManagement />
        )}

        {activeTab === 'keys' && (
          <ApiKeyManagement />
        )}
      </main>

      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
};

