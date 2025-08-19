import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, Terminal, Globe, Key, Server } from 'lucide-react';

interface InstallCommandData {
  masterUrl: string;
  apiKey: string;
  command: string;
  quickCommand: string;
}

export const AgentInstaller: React.FC = () => {
  const [installData, setInstallData] = useState<InstallCommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchInstallCommand();
  }, []);

  const fetchInstallCommand = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents/install-command');
      if (!response.ok) {
        throw new Error('Failed to fetch install command');
      }
      const result = await response.json();
      if (result.success) {
        setInstallData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch install command');
      }
    } catch (error) {
      console.error('Failed to fetch install command:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      // 尝试使用现代的 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // 降级到传统的 execCommand 方法
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
      // 显示错误提示
      alert('复制失败，请手动选择并复制命令');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading installation commands...</p>
        </div>
      </div>
    );
  }

  if (!installData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Failed to load installation commands</p>
        <Button onClick={fetchInstallCommand} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Download className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              节点安装部署
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              使用下面的命令在新服务器上快速部署监控节点
            </p>
          </div>
        </div>

        {/* 服务器信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Server className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">主服务器地址</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{installData.masterUrl}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Key className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">API密钥</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {installData.apiKey.substring(0, 8)}...{installData.apiKey.slice(-4)}
              </p>
            </div>
          </div>
        </div>
      </div>

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

      {/* 详细安装命令 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            交互式安装
          </h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          如果需要自定义节点信息，可以使用交互式安装模式：
        </p>

        <div className="relative">
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            <code>{installData.command}</code>
          </pre>
          <Button
            size="sm"
            variant="outline"
            className={`absolute top-2 right-2 transition-all duration-200 ${
              copied === 'interactive' 
                ? 'bg-green-600 border-green-500 hover:bg-green-700 text-white' 
                : 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300'
            }`}
            onClick={() => copyToClipboard(installData.command, 'interactive')}
            title={copied === 'interactive' ? '已复制！' : '复制命令'}
          >
            {copied === 'interactive' ? (
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

        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">交互式安装特点：</h4>
          <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
            <li>• 可以自定义节点名称、位置等信息</li>
            <li>• 手动确认配置参数</li>
            <li>• 适合需要精确控制节点信息的场景</li>
          </ul>
        </div>
      </div>

      {/* 安装要求 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          系统要求
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">支持的操作系统</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Ubuntu 18.04+ / Debian 9+</li>
              <li>• CentOS 7+ / RHEL 7+</li>
              <li>• Fedora 30+</li>
              <li>• 其他主流Linux发行版</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">硬件要求</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 内存：最少512MB（推荐1GB+）</li>
              <li>• 存储：最少1GB可用空间</li>
              <li>• 网络：可访问互联网</li>
              <li>• 架构：x86_64</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">安装过程会自动：</h4>
          <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
            <li>• 检测并安装Docker环境</li>
            <li>• 下载监控程序代码</li>
            <li>• 配置网络监控工具</li>
            <li>• 设置防火墙规则</li>
            <li>• 创建系统服务</li>
          </ul>
        </div>
      </div>

      {/* 故障排除 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          故障排除
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">如果安装失败：</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 确保以root用户或sudo权限运行</li>
              <li>• 检查网络连接是否正常</li>
              <li>• 确认防火墙允许端口3002</li>
              <li>• 查看安装日志：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">docker logs ssalgten-agent</code></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">如果节点未显示：</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 等待1-2分钟让节点完成注册</li>
              <li>• 检查节点服务状态：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">docker ps</code></li>
              <li>• 验证API密钥是否正确</li>
              <li>• 确认主服务器地址可以访问</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};