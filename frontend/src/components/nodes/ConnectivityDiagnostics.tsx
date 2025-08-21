import React from 'react';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  checking: boolean;
  apiReachable: boolean;
  socketConnected: boolean;
  authOk: boolean;
  nodesCount: number | null;
  lastCheckedAt?: string;
  issues: string[];
  onRefresh: () => void;
  isAdmin?: boolean;
}

export const ConnectivityDiagnostics: React.FC<Props> = ({
  checking,
  apiReachable,
  socketConnected,
  authOk,
  nodesCount,
  lastCheckedAt,
  issues,
  onRefresh,
  isAdmin = false,
}) => {
  const healthy = apiReachable && socketConnected && authOk;

  return (
    <div className={`rounded-lg border p-4 mb-6 ${healthy ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5">
            {healthy ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              连接性自检 {checking && <Loader2 className="inline h-4 w-4 animate-spin ml-2 text-gray-500" />}
            </div>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex flex-wrap gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs ${apiReachable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>API {apiReachable ? '可达' : '不可达'}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${socketConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Socket {socketConnected ? '已连接' : '未连接'}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${authOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>认证 {authOk ? '正常' : '异常'}</span>
                {typeof nodesCount === 'number' && (
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">节点 {nodesCount}</span>
                )}
              </div>
              {issues.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {issues.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-green-700 dark:text-green-300">系统连接状态良好。</div>
              )}
              {lastCheckedAt && (
                <div className="text-xs text-gray-500 mt-2">上次检查：{new Date(lastCheckedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>
        <div className="ml-4 flex items-center space-x-2">
          <Button variant="outline" onClick={onRefresh} disabled={checking}>
            <RefreshCw className="h-4 w-4 mr-2" /> 重新检查
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await (await import('@/services/api')).apiService.getApiKeyInfo();
                    if (res.success && res.data) {
                      alert(`当前系统API密钥前缀: ${res.data.key.slice(0,8)}...\n使用次数: ${res.data.usageCount}`);
                    } else {
                      alert('读取API密钥信息失败');
                    }
                  } catch {
                    alert('读取API密钥信息失败');
                  }
                }}
              >查看密钥</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={async () => {
                  if (!confirm('确定要旋转系统API密钥吗？旧密钥将在宽限期内有效，之后Agent需更新。')) return;
                  try {
                    const res = await (await import('@/services/api')).apiService.regenerateApiKey();
                    if (res.success && res.data) {
                      alert(`新密钥前缀: ${res.data.newApiKey.slice(0,8)}...\n请尽快更新所有Agent的 AGENT_API_KEY`);
                  } else {
                      alert('旋转API密钥失败');
                    }
                  } catch {
                    alert('旋转API密钥失败');
                  }
                }}
              >旋转密钥</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
