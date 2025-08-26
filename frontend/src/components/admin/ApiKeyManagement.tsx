import React, { useState, useEffect } from 'react';
import { apiService, ApiKeyInfo } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Key,
  RotateCcw,
  Copy,
  AlertTriangle,
  CheckCircle,
  Shield,
  Activity,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  Download,
  ExternalLink,
  Info,
  Zap
} from 'lucide-react';

export const ApiKeyManagement: React.FC = () => {
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  const fetchApiKeyInfo = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await apiService.getApiKeyInfo();
      
      if (response.success && response.data) {
        setApiKeyInfo(response.data);
      } else {
        setError(response.error || '获取API密钥信息失败');
      }
    } catch (err) {
      console.error('Failed to fetch API key info:', err);
      setError('网络错误，无法获取API密钥信息');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm('确定要重新生成API密钥吗？这将使所有现有的Agent节点失去连接，需要手动更新配置文件。')) {
      return;
    }

    try {
      setRegenerating(true);
      setError(null);
      setSuccess(null);

      const response = await apiService.regenerateApiKey();
      
      if (response.success && response.data) {
        setSuccess(`新API密钥已生成！请尽快更新所有Agent配置。`);
        await fetchApiKeyInfo(); // 重新获取密钥信息
        setShowRegenerateModal(true);
        setTimeout(() => {
          setSuccess(null);
        }, 10000); // 10秒后自动隐藏成功消息
      } else {
        setError(response.error || 'API密钥重新生成失败');
      }
    } catch (err) {
      console.error('Failed to regenerate API key:', err);
      setError('API密钥重新生成失败');
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatLastUsed = (lastUsed?: string) => {
    if (!lastUsed) return '从未使用';
    const date = new Date(lastUsed);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else {
      return '刚刚';
    }
  };

  const getSecurityStatus = () => {
    if (!apiKeyInfo?.security) return 'unknown';
    return apiKeyInfo.security.isSecure ? 'secure' : 'warning';
  };

  const getSecurityColor = () => {
    const status = getSecurityStatus();
    switch (status) {
      case 'secure':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  useEffect(() => {
    fetchApiKeyInfo();
    
    // 每5分钟刷新一次
    const interval = setInterval(fetchApiKeyInfo, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 状态消息 */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </Card>
      )}

      {success && (
        <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        </Card>
      )}

      {/* API密钥管理主卡片 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Key className="h-5 w-5 mr-2 text-indigo-600" />
              API 密钥管理
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              管理Agent节点连接的API密钥和安全配置
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={fetchApiKeyInfo} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新
            </Button>
            <Button 
              onClick={handleRegenerateApiKey} 
              disabled={regenerating}
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-600 dark:hover:bg-orange-900/20"
            >
              {regenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                  生成中...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重新生成
                </>
              )}
            </Button>
          </div>
        </div>

        {apiKeyInfo && (
          <div className="space-y-6">
            {/* 密钥信息卡片 */}
            <div className={`p-4 rounded-lg border-2 ${getSecurityColor()}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-white/50">
                    {getSecurityStatus() === 'secure' ? (
                      <Shield className="h-6 w-6" />
                    ) : (
                      <AlertTriangle className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      密钥状态: {getSecurityStatus() === 'secure' ? '安全' : '需要注意'}
                    </h4>
                    <p className="text-sm opacity-80">
                      {apiKeyInfo.description || '系统默认API密钥'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-80">创建时间</div>
                  <div className="font-medium">
                    {new Date(apiKeyInfo.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* 密钥显示 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">API 密钥</label>
                  <Button
                    onClick={() => setShowKey(!showKey)}
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">
                    {showKey ? apiKeyInfo.key : `${apiKeyInfo.key.slice(0, 8)}${'*'.repeat(32)}`}
                  </code>
                  <Button
                    onClick={() => copyToClipboard(apiKeyInfo.key)}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 使用统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">使用次数</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {apiKeyInfo.usageCount.toLocaleString()}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 dark:text-green-300">最后使用</p>
                    <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                      {formatLastUsed(apiKeyInfo.lastUsed)}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">密钥类型</p>
                    <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                      {apiKeyInfo.isDefault ? '系统默认' : '自定义'}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {/* 安全警告和建议 */}
            {apiKeyInfo.security && (
              <div className="space-y-3">
                {apiKeyInfo.security.warnings.length > 0 && (
                  <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                    <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      安全警告
                    </h5>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      {apiKeyInfo.security.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-yellow-600 mr-2">•</span>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Agent更新指南
                  </h5>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                    <p>如果您重新生成了API密钥，需要更新所有Agent节点的配置：</p>
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded font-mono text-xs">
                      # 1. 编辑Agent配置文件<br/>
                      nano /etc/ssalgten-agent/.env<br/><br/>
                      # 2. 更新API密钥<br/>
                      AGENT_API_KEY=新的密钥<br/><br/>
                      # 3. 重启Agent服务<br/>
                      systemctl restart ssalgten-agent
                    </div>
                    <div className="flex items-center space-x-2 mt-3">
                      <Button
                        onClick={() => window.open('/admin', '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        获取安装命令
                      </Button>
                      <Button
                        onClick={() => window.open('https://github.com/lonelyrower/SsalgTen/blob/main/docs/deployment.md', '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        部署文档
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};