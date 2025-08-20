import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, 
  Server, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Terminal,
  Globe,
  Shield,
  Zap
} from 'lucide-react';

interface AgentDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployed: () => void;
}

export const AgentDeployModal: React.FC<AgentDeployModalProps> = ({ 
  isOpen, 
  onClose, 
  onDeployed 
}) => {
  const [step, setStep] = useState(1);
  const [copySuccess, setCopySuccess] = useState('');

  const oneLineInstall = `curl -fsSL ${window.location.origin}/api/agents/install-script | bash`;
  const githubDirectInstall = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --master-url "${window.location.origin}" --auto-config`;

  const handleDownloadScript = async () => {
    try {
      const response = await fetch('/api/agents/install-script', {
        method: 'GET',
        headers: {
          'Accept': 'application/x-sh',
        },
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const scriptContent = await response.text();
      
      const blob = new Blob([scriptContent], { type: 'application/x-sh' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'install-agent.sh';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStep(2);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleCopyCommand = async (command: string, type: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      // 降级处理
      const textArea = document.createElement('textarea');
      textArea.value = command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    }
  };

  const handleDeploymentComplete = () => {
    onDeployed();
    onClose();
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Server className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              部署网络监控探针
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 步骤指示器 */}
        <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {/* 步骤1 */}
              <div className={`flex flex-col items-center transition-all duration-300 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step >= 1 
                    ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'border-gray-300 bg-white dark:bg-gray-700'
                }`}>
                  {step > 1 ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="font-bold">1</span>
                  )}
                  {step === 1 && (
                    <div className="absolute -inset-2 rounded-full border-2 border-blue-300 animate-pulse"></div>
                  )}
                </div>
                <span className="mt-2 text-sm font-semibold text-center max-w-20">选择部署方式</span>
              </div>

              {/* 连接线1 */}
              <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
                step >= 2 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}></div>

              {/* 步骤2 */}
              <div className={`flex flex-col items-center transition-all duration-300 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step >= 2 
                    ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'border-gray-300 bg-white dark:bg-gray-700'
                }`}>
                  {step > 2 ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="font-bold">2</span>
                  )}
                  {step === 2 && (
                    <div className="absolute -inset-2 rounded-full border-2 border-blue-300 animate-pulse"></div>
                  )}
                </div>
                <span className="mt-2 text-sm font-semibold text-center max-w-20">执行安装</span>
              </div>

              {/* 连接线2 */}
              <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
                step >= 3 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}></div>

              {/* 步骤3 */}
              <div className={`flex flex-col items-center transition-all duration-300 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step >= 3 
                    ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'border-gray-300 bg-white dark:bg-gray-700'
                }`}>
                  {step > 3 ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="font-bold">3</span>
                  )}
                  {step === 3 && (
                    <div className="absolute -inset-2 rounded-full border-2 border-blue-300 animate-pulse"></div>
                  )}
                </div>
                <span className="mt-2 text-sm font-semibold text-center max-w-20">完成部署</span>
              </div>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  选择部署方式
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  选择最适合您的Agent探针部署方式
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 自动安装 */}
                <Card className="p-6 border-2 border-dashed border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => setStep(2)}>
                  <div className="text-center">
                    <Zap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      一键安装（推荐）
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      自动下载并安装Agent，自动配置和注册
                    </p>
                    <div className="mt-4 flex items-center justify-center space-x-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">简单快速</span>
                    </div>
                  </div>
                </Card>

                {/* 手动安装 */}
                <Card className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-colors cursor-pointer"
                      onClick={handleDownloadScript}>
                  <div className="text-center">
                    <Download className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      下载脚本安装
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      下载安装脚本到本地，手动执行安装
                    </p>
                    <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">安全可控</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* 系统要求 */}
              <Card className="p-4 bg-gray-50 dark:bg-gray-900">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
                  系统要求
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <strong>操作系统:</strong><br />
                    Ubuntu 18.04+<br />
                    CentOS 7+<br />
                    Debian 9+
                  </div>
                  <div>
                    <strong>硬件要求:</strong><br />
                    CPU: 1核心<br />
                    内存: 512MB<br />
                    磁盘: 1GB
                  </div>
                  <div>
                    <strong>网络要求:</strong><br />
                    公网IP地址<br />
                    端口3002可访问<br />
                    到主服务器连通
                  </div>
                </div>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Terminal className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  在您的VPS上执行安装
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  复制以下命令到您的VPS终端中执行
                </p>
              </div>

              {/* 推荐安装命令 */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        智能一键安装（推荐）
                      </label>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        预配置
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCommand(oneLineInstall, 'smart')}
                      className="flex items-center space-x-1"
                    >
                      {copySuccess === 'smart' ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>复制</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-blue-500/30">
                    {oneLineInstall}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    ✨ 自动配置主服务器地址和API密钥，无需手动输入
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        GitHub直接安装
                      </label>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        最新版本
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCommand(githubDirectInstall, 'github')}
                      className="flex items-center space-x-1"
                    >
                      {copySuccess === 'github' ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>复制</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-gray-900 dark:bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    {githubDirectInstall}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    🚀 直接从GitHub获取最新脚本，自动更新和版本检查
                  </p>
                </div>
              </div>

              {/* 安装说明 */}
              <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  安装说明
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>确保您有VPS的root权限或sudo权限</li>
                  <li>将上述命令复制到您的VPS终端中</li>
                  <li>按回车键执行安装脚本</li>
                  <li>根据提示输入必要的配置信息</li>
                  <li>等待安装完成，Agent将自动注册到系统</li>
                </ol>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  返回上一步
                </Button>
                <Button onClick={() => setStep(3)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  安装完成，下一步
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mb-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  探针部署完成
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  您的网络监控探针已成功部署并注册到系统
                </p>
              </div>

              <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
                  接下来您可以：
                </h4>
                <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                  <div className="flex items-center justify-center space-x-2">
                    <Globe className="h-4 w-4" />
                    <span>在地图上查看新部署的节点</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <Terminal className="h-4 w-4" />
                    <span>执行网络诊断测试</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <Server className="h-4 w-4" />
                    <span>监控节点状态和性能</span>
                  </div>
                </div>
              </Card>

              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={onClose}>
                  关闭
                </Button>
                <Button 
                  onClick={handleDeploymentComplete}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  查看节点列表
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 底部帮助链接 */}
        {step !== 3 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>需要帮助？</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('https://github.com/lonelyrower/SsalgTen#agent-deployment', '_blank')}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="h-3 w-3" />
                <span>查看部署文档</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};