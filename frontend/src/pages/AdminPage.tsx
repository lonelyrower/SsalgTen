import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import { NodeManagement } from '@/components/admin/NodeManagement';
import { SystemSettings } from '@/components/admin/SystemSettings';
import { SystemOverview } from '@/components/admin/SystemOverview';
import { VisitorStatsCard } from '@/components/admin/VisitorStatsCard';
import { ApiKeyManagement } from '@/components/admin/ApiKeyManagement';
import { ActivityLog } from '@/components/dashboard/ActivityLog';
import { Shield, Server, RefreshCw, BarChart3, Settings } from 'lucide-react';
import { apiService } from '@/services/api';

export const AdminPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [versionInfo, setVersionInfo] = useState<{ localVersion?: string; latestCommit?: string; updateAvailable?: boolean } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateJobId, setUpdateJobId] = useState<string | null>(null);
  const [updateLog, setUpdateLog] = useState<string>('');

  useEffect(() => {
    apiService.getSystemVersion().then(res => {
      if (res.success) setVersionInfo(res.data as any);
    }).catch(() => void 0);
  }, []);

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

        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                系统概览
              </button>
              <button
                onClick={() => setActiveTab('statistics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'statistics'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                统计分析
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'system'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Settings className="h-4 w-4 inline mr-2" />
                系统配置
              </button>
              <button
                onClick={() => setActiveTab('nodes')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'nodes'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Server className="h-4 w-4 inline mr-2" />
                节点管理
              </button>
            </nav>
          </div>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'overview' && (
          <>

            {/* API密钥管理卡片 */}
            <div className="mt-8">
              <ApiKeyManagement />
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
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">系统版本</div>
                  <div className="text-sm font-mono text-purple-600 dark:text-purple-300">
                    {versionInfo?.localVersion || 'unknown'}
                  </div>
                  {versionInfo?.latestCommit && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      最新: {versionInfo.latestCommit.slice(0,7)}
                    </div>
                  )}
                  {!!versionInfo?.updateAvailable && (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">有可用更新</div>
                  )}
                </div>
              </div>
            </div>

            {/* 系统更新 */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">系统更新</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">检测并一键更新到最新版本</p>
                </div>
                <Button
                  variant={versionInfo?.updateAvailable ? 'default' : 'outline'}
                  disabled={updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      const res = await apiService.triggerSystemUpdate(false);
                      if (!res.success) throw new Error(res.error || '更新启动失败');
                      const job = (res.data as any)?.job;
                      if (job?.id) {
                        setUpdateJobId(job.id);
                        setUpdateLog('更新任务已启动，正在拉取日志...');
                        // 轮询日志
                        const timer = setInterval(async () => {
                          try {
                            const r = await fetch(`${(window as any).APP_CONFIG?.API_BASE_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api'}/admin/system/update/${job.id}/log?tail=500`);
                            const text = await r.text();
                            setUpdateLog(text);
                          } catch {}
                        }, 3000);
                        // 简单超时保护：10分钟后停止轮询
                        setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
                      }
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setUpdating(false);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {updating ? '更新中...' : (versionInfo?.updateAvailable ? '立即更新' : '检查并更新')}
                </Button>
              </div>
              {updateJobId && (
                <div className="mt-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">任务ID: {updateJobId}</div>
                  <pre className="h-60 overflow-auto bg-gray-50 dark:bg-gray-900 text-xs p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                    {updateLog || '暂无日志'}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'statistics' && (
          <div className="space-y-8">
            <SystemOverview />
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
      </main>

      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
};
