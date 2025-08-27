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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">系统更新</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    安全的零停机更新，自动备份数据和配置
                  </p>
                  {versionInfo && (
                    <div className="mt-2 flex items-center space-x-4 text-xs">
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-500">当前版本:</span>
                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {versionInfo.localVersion}
                        </span>
                      </div>
                      {versionInfo.latestCommit && (
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">最新版本:</span>
                          <span className="font-mono bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                            {versionInfo.latestCommit.slice(0, 7)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Button
                    variant={versionInfo?.updateAvailable ? 'default' : 'outline'}
                    disabled={updating}
                    onClick={async () => {
                      const confirmed = window.confirm(
                        '确定要开始系统更新吗？\n\n更新过程包括：\n• 自动备份数据和配置\n• 拉取最新代码\n• 重建和重启服务\n• 验证系统健康状态\n\n整个过程大约需要3-5分钟，期间服务会短暂中断。'
                      );
                      
                      if (!confirmed) return;
                      
                      setUpdating(true);
                      setUpdateLog('');
                      
                      try {
                        const res = await apiService.triggerSystemUpdate(false);
                        if (!res.success) throw new Error(res.error || '更新启动失败');
                        
                        const job = (res.data as any)?.job;
                        if (job?.id) {
                          setUpdateJobId(job.id);
                          setUpdateLog('✅ 更新任务已启动\n正在准备更新环境...\n');
                          
                          let pollCount = 0;
                          const maxPollCount = 200; // 10分钟超时 (3秒 * 200 = 10分钟)
                          
                          // 轮询日志
                          const timer = setInterval(async () => {
                            try {
                              pollCount++;
                              const apiUrl = `${(window as any).APP_CONFIG?.API_BASE_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api'}/admin/system/update/${job.id}/log?tail=1000`;
                              const r = await fetch(apiUrl);
                              
                              if (r.ok) {
                                const text = await r.text();
                                setUpdateLog(text);
                                
                                // 检查是否完成
                                if (text.includes('🎉 系统更新成功完成') || text.includes('✅ 生产环境更新完成')) {
                                  clearInterval(timer);
                                  setUpdating(false);
                                  // 刷新页面信息
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 2000);
                                } else if (text.includes('ERROR') && text.includes('exit')) {
                                  clearInterval(timer);
                                  setUpdating(false);
                                }
                              } else if (r.status === 404) {
                                // 任务可能已完成或失败
                                clearInterval(timer);
                                setUpdating(false);
                              }
                              
                              // 超时保护
                              if (pollCount >= maxPollCount) {
                                clearInterval(timer);
                                setUpdating(false);
                                setUpdateLog(prev => prev + '\n\n⚠️ 更新日志获取超时，但更新可能仍在进行中...');
                              }
                            } catch (err) {
                              console.warn('Failed to fetch update log:', err);
                            }
                          }, 3000);
                        } else {
                          setUpdateLog('⚠️ 更新启动成功，但未获得任务ID');
                          setUpdating(false);
                        }
                      } catch (e: any) {
                        console.error('Update failed:', e);
                        setUpdateLog(`❌ 更新启动失败: ${e.message || '未知错误'}\n\n请检查：\n• Updater服务是否正常运行\n• 网络连接是否正常\n• 是否有足够的系统资源`);
                        setUpdating(false);
                      }
                    }}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
                    {updating ? '更新中...' : (versionInfo?.updateAvailable ? '立即更新' : '检查并更新')}
                  </Button>
                  
                  {versionInfo?.updateAvailable && (
                    <div className="flex items-center text-xs text-amber-600 dark:text-amber-400">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mr-1 animate-pulse"></div>
                      发现新版本
                    </div>
                  )}
                </div>
              </div>
              
              {updateJobId && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">更新日志</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">任务ID: {updateJobId}</div>
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
              
              {!updateJobId && !updating && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>更新特性：</strong>
                    <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                      <li>零停机更新 - 服务仅短暂中断</li>
                      <li>自动数据备份 - 确保数据安全</li>
                      <li>健康检查验证 - 确保更新成功</li>
                      <li>失败自动回滚 - 最大化可用性</li>
                    </ul>
                  </div>
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
