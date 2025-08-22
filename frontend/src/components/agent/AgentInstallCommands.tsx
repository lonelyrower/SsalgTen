import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiService, type InstallCommandData } from '@/services/api';
import { 
  Copy, 
  Check, 
  Terminal, 
  Server, 
  Key, 
  Shield,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

interface AgentInstallCommandsProps {
  compact?: boolean;
}

export const AgentInstallCommands: React.FC<AgentInstallCommandsProps> = ({ compact = false }) => {
  const [installData, setInstallData] = useState<InstallCommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchInstallCommand();
  }, []);

  const fetchInstallCommand = async () => {
    try {
      setLoading(true);
      const response = await apiService.getInstallCommand();
      if (response.success && response.data) {
        setInstallData(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch install command');
      }
    } catch (error) {
      console.error('Failed to fetch install command:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopied(type);
      setTimeout(() => setCopied(null), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('复制失败，请手动选择并复制命令');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">正在获取安装命令...</p>
        </div>
      </div>
    );
  }

  if (!installData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">获取安装命令失败</p>
        <Button onClick={fetchInstallCommand} className="mt-4" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        {/* 安全警告 (紧凑模式) */}
        {!installData.security.isSecure && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                API密钥安全警告 - 请在生产环境中更新密钥
              </span>
            </div>
          </div>
        )}

        {/* 快速安装命令 (紧凑版) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">快速安装命令</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(installData.quickCommand, 'quick')}
              className={copied === 'quick' ? 'text-green-600' : ''}
              aria-label={copied === 'quick' ? '安装命令已复制到剪贴板' : '复制安装命令到剪贴板'}
            >
              {copied === 'quick' ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  复制
                </>
              )}
            </Button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
            <code>{installData.quickCommand}</code>
          </pre>
        </div>
      </div>
    );
  }

  // 完整版本
  return (
    <div className="space-y-6">
      {/* 服务器信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Server className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">主服务器地址</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{installData.masterUrl}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Key className={`h-5 w-5 ${installData.security.isSecure ? 'text-green-600' : 'text-yellow-600'}`} />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">API密钥</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              {installData.apiKey.substring(0, 8)}...{installData.apiKey.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* 安全警告 */}
      {!installData.security.isSecure && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                API密钥安全警告
              </h3>
              <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                {installData.security.warnings.map((warning, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <AlertCircle className="h-3 w-3" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  建议操作：
                </h4>
                <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {installData.security.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="h-3 w-3" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 安全确认 */}
      {installData.security.isSecure && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                API密钥安全检查通过
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                您的系统使用了安全的API密钥，可以放心部署节点。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 快速安装命令 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Terminal className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            快速安装（推荐）
          </h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          在目标服务器上以root用户执行以下命令，自动完成节点安装和配置：
        </p>

        <div className="relative">
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            <code>{installData.quickCommand}</code>
          </pre>
          <Button
            size="sm"
            variant="outline"
            className={`absolute top-2 right-2 transition-all duration-200 ${
              copied === 'quick' 
                ? 'bg-green-600 border-green-500 hover:bg-green-700 text-white' 
                : 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
            }`}
            onClick={() => copyToClipboard(installData.quickCommand, 'quick')}
            aria-label={copied === 'quick' ? '安装命令已复制到剪贴板' : '复制安装命令到剪贴板'}
            title={copied === 'quick' ? '已复制！' : '复制命令'}
          >
            {copied === 'quick' ? (
              <>
                <Check className="h-4 w-4 text-white mr-1" />
                <span className="text-xs">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                <span className="text-xs">复制</span>
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">安装完成后：</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• 节点将自动注册到当前主服务器</li>
            <li>• 自动检测服务器地理位置和网络信息</li>
            <li>• 配置为系统服务，开机自启动</li>
            <li>• 几分钟后即可在监控界面看到新节点</li>
          </ul>
        </div>
      </div>
    </div>
  );
};