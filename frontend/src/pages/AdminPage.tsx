import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
import { Shield, Server, RefreshCw, BarChart3, Settings, Copy, Check, Users, Key } from 'lucide-react';
import { apiService } from '@/services/api';

export const AdminPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [versionInfo, setVersionInfo] = useState<{ localVersion?: string; latestCommit?: string; updateAvailable?: boolean; message?: string } | null>(null);
  const [updating] = useState(false);
  const [updateJobId] = useState<string | null>(null);
  const [updateLog] = useState<string>('');
  // SSH 更新指令显示在子组件中

  useEffect(() => {
    apiService.getSystemVersion().then(res => {
      if (res.success) setVersionInfo(res.data as any);
    }).catch(() => void 0);
  }, []);

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
                  {/* 不显示最新版本commit 信息 */}
                  {versionInfo?.message && (
                    <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400" title={versionInfo.message}>
                      版本检查失败
                    </div>
                  )}
                  {/* 不显示有可用更新标记 */}
                </div>
              </div>
            </div>

            {/* 系统更新 */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">系统更新</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    为保证安全与可控性，请通过 SSH 执行一键命令更新
                  </p>
                  {/* 系统更新区域不显示 当前/最新 版本信息 */}
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => alert('请通过 SSH 执行页面下方的一键命令进行更新')}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    使用 SSH 更新
                  </Button>
                </div>
              </div>
              
              {false && (updateJobId || updateLog) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">更新日志</div>
                      {updateJobId && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">任务ID: {updateJobId}</div>
                      )}
                    </div>
                    {updating && (
                      <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                        实时更新中
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <pre className="h-96 overflow-auto bg-gray-50 dark:bg-gray-900 text-xs p-4 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {updateLog || '等待日志输出...'}
                    </pre>
                    
                    {/* 滚动到底部按钮 */}
                    <button
                      onClick={() => {
                        const logElement = document.querySelector('.h-96.overflow-auto');
                        if (logElement) {
                          logElement.scrollTop = logElement.scrollHeight;
                        }
                      }}
                      className="absolute bottom-2 right-2 p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                      title="滚动到底部"
                    >
                      ↓
                    </button>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    💡 提示：更新完成后页面将自动刷新
                    {!updating && updateLog.includes('ERROR') && (
                      <span className="ml-4 text-amber-600 dark:text-amber-400">
                        如遇问题，可联系管理员或查看系统日志
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <SSHUpdateInstruction />
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

// SSH 更新指引组件（带复制按钮）
const SSHUpdateInstruction: React.FC = () => {
  const cmd = 'curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/vps-update.sh | sudo bash -s -- --force-reset';
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cmd);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = cmd;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert('复制失败，请手动选择并复制命令');
    }
  };
  return (
    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
      <div className="text-sm text-blue-800 dark:text-blue-300">
        <strong>更新指引：</strong>
        <div className="mt-2 text-xs">请通过 SSH 执行以下命令更新：</div>
        <div className="mt-2">
          <div className="flex items-center space-x-2">
            <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
{cmd}
            </code>
            <Button
              onClick={copy}
              variant="outline"
              size="sm"
              className="px-3"
              aria-label={copied ? '命令已复制到剪贴板' : '复制命令到剪贴板'}
              title={copied ? '已复制！' : '复制命令'}
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
