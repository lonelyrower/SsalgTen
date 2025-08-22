import React from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Users, Settings, BarChart3, Download, Shield, Database, Key } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { user, hasRole } = useAuth();

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
          {/* 用户管理 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  用户管理
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  管理系统用户和权限
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Users className="h-4 w-4 mr-2" />
              管理用户
            </Button>
          </div>

          {/* 系统设置 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Settings className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  系统设置
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  配置系统参数和行为
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              系统配置
            </Button>
          </div>

          {/* 数据分析 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  数据分析
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  查看系统分析报告
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              查看分析
            </Button>
          </div>

          {/* 节点部署 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Download className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  节点部署
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  管理监控节点部署
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              节点部署
            </Button>
          </div>

          {/* 数据库管理 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  数据库管理
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  管理系统数据和备份
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Database className="h-4 w-4 mr-2" />
              数据管理
            </Button>
          </div>

          {/* 安全管理 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Key className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  安全管理
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  管理访问权限和安全策略
                </p>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Key className="h-4 w-4 mr-2" />
              安全设置
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
    </div>
  );
};