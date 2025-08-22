import React, { useState } from 'react';
import { AgentInstallCommands } from './AgentInstallCommands';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

export const AgentInstaller: React.FC = () => {
  const [copied, setCopied] = useState(false);
  
  const uninstallCommand = 'curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --uninstall';
  
  const copyToClipboard = async (text: string) => {
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
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('复制失败，请手动选择并复制命令');
    }
  };

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
      </div>

      {/* 使用共享的安装命令组件 */}
      <AgentInstallCommands />

      {/* 卸载说明 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-orange-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            卸载节点
          </h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          如需卸载已安装的节点，请在目标服务器上执行：
        </p>

        <div className="relative">
          <pre className="bg-red-900 text-red-200 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            <code>{uninstallCommand}</code>
          </pre>
          <Button
            size="sm"
            variant="outline"
            className={`absolute top-2 right-2 transition-all duration-200 ${
              copied 
                ? 'bg-green-600 border-green-500 hover:bg-green-700 text-white' 
                : 'bg-red-800 border-red-600 hover:bg-red-700 text-red-200'
            }`}
            onClick={() => copyToClipboard(uninstallCommand)}
            aria-label={copied ? '卸载命令已复制到剪贴板' : '复制卸载命令到剪贴板'}
            title={copied ? '已复制！' : '复制命令'}
          >
            {copied ? (
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

        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">卸载操作将：</h4>
          <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
            <li>• 停止并删除节点容器</li>
            <li>• 删除系统服务</li>
            <li>• 清理配置文件和日志</li>
            <li>• 可选择是否保留Docker环境</li>
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