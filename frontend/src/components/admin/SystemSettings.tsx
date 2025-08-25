import React, { useState, useEffect } from 'react';
import { apiService, type SystemConfig } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Settings,
  Save,
  RefreshCw,
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Shield,
  Bell,
  Globe,
  Zap
} from 'lucide-react';

interface SystemSettingsProps {
  className?: string;
}

interface ConfigGroup {
  category: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  configs: SystemConfig[];
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ className = '' }) => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['system']));
  const [changedConfigs, setChangedConfigs] = useState<Map<string, string>>(new Map());
  // const [downloading, setDownloading] = useState(false);
  // 修改密码表单状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSystemConfigs();
      if (response.success && response.data) {
        setConfigs(response.data);
        setChangedConfigs(new Map());
      } else {
        setError(response.error || 'Failed to load configurations');
      }
    } catch (err) {
      setError('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system':
        return <Settings className="h-5 w-5 text-blue-500" />;
      case 'monitoring':
        return <Clock className="h-5 w-5 text-green-500" />;
      case 'database':
        return <Database className="h-5 w-5 text-purple-500" />;
      case 'security':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'notifications':
        return <Bell className="h-5 w-5 text-yellow-500" />;
      case 'api':
        return <Globe className="h-5 w-5 text-indigo-500" />;
      case 'performance':
        return <Zap className="h-5 w-5 text-orange-500" />;
      default:
        return <Settings className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'system':
        return '系统设置';
      case 'monitoring':
        return '监控配置';
      case 'database':
        return '数据库设置';
      case 'security':
        return '安全配置';
      case 'notifications':
        return '通知设置';
      case 'api':
        return 'API设置';
      case 'performance':
        return '性能配置';
      default:
        return '其他设置';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'system':
        return '基础系统参数和全局设置';
      case 'monitoring':
        return '节点监控和心跳检测配置';
      case 'database':
        return '数据库连接和性能参数';
      case 'security':
        return '认证和权限安全设置';
      case 'notifications':
        return '邮件和Webhook通知配置';
      case 'api':
        return 'API限流和CORS设置';
      case 'performance':
        return '系统性能和优化配置';
      default:
        return '其他配置选项';
    }
  };

  // 按类别分组配置
  const groupedConfigs: ConfigGroup[] = React.useMemo(() => {
    // 确保 configs 是数组
    if (!Array.isArray(configs)) {
      return [];
    }

    const groups: { [key: string]: SystemConfig[] } = {};
    
    configs.forEach(config => {
      const category = config.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(config);
    });

    return Object.entries(groups).map(([category, configs]) => ({
      category,
      icon: getCategoryIcon(category),
      title: getCategoryTitle(category),
      description: getCategoryDescription(category),
      configs: configs.sort((a, b) => a.key.localeCompare(b.key))
    })).sort((a, b) => a.title.localeCompare(b.title));
  }, [configs]);

  const filteredGroups = groupedConfigs.filter(group => {
    if (selectedCategory !== 'all' && group.category !== selectedCategory) {
      return false;
    }
    
    if (searchTerm) {
      return group.configs.some(config =>
        config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (config.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return true;
  }).map(group => ({
    ...group,
    configs: group.configs.filter(config =>
      !searchTerm || 
      config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (config.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }));

  const handleConfigChange = (key: string, value: string) => {
    const newChanges = new Map(changedConfigs);
    const original = configs.find(c => c.key === key);
    
    if (original && value === original.value) {
      newChanges.delete(key);
    } else {
      newChanges.set(key, value);
    }
    
    setChangedConfigs(newChanges);
  };

  const handleSave = async () => {
    if (changedConfigs.size === 0) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const configsToUpdate = Array.from(changedConfigs.entries()).map(([key, value]) => ({
        key,
        value
      }));

      const response = await apiService.batchUpdateConfigs(configsToUpdate);
      
      if (response.success) {
        setSuccess(`成功更新了 ${configsToUpdate.length} 个配置项`);
        setChangedConfigs(new Map());
        await loadConfigs();
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || '保存配置失败');
      }
    } catch (err) {
      setError('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要将所有配置重置为默认值吗？此操作不可恢复。')) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const response = await apiService.resetConfigsToDefaults();
      
      if (response.success) {
        setSuccess('所有配置已重置为默认值');
        setChangedConfigs(new Map());
        await loadConfigs();
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || '重置配置失败');
      }
    } catch (err) {
      setError('重置配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存修改密码
  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword) {
      setError('请输入当前密码和新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    try {
      setSaving(true);
      const resp = await apiService.changePassword(currentPassword, newPassword);
      if (resp.success) {
        setSuccess('密码修改成功');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(resp.error || '密码修改失败');
      }
    } catch (_) {
      setError('密码修改失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (category: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedGroups(newExpanded);
  };

  const formatConfigKey = (key: string) => {
    return key.split('.').pop()?.replace(/_/g, ' ') || key;
  };

  const getInputType = (key: string, value: string) => {
    if (key.includes('password') || key.includes('secret') || key.includes('token')) {
      return 'password';
    }
    if (
      key.includes('port') ||
      key.includes('timeout') ||
      key.includes('interval') ||
      key.includes('limit') ||
      key.includes('window') ||
      key.includes('threshold')
    ) {
      return 'number';
    }
    if (value === 'true' || value === 'false') {
      return 'boolean';
    }
    return 'text';
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部区域 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Settings className="h-8 w-8 mr-3 text-blue-600" />
              系统设置
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              管理系统配置参数和运行时设置
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConfigs}
              disabled={saving}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
            >
              <RotateCcw className="h-4 w-4" />
              <span>重置默认</span>
            </Button>
            {changedConfigs.size > 0 && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>保存更改 ({changedConfigs.size})</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 修改密码 */}
        <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">账户安全 - 修改密码</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="请输入当前密码"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="至少6位"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleChangePassword} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? '保存中...' : '保存密码'}
            </Button>
          </div>
        </Card>

        {/* 搜索和过滤器 */}
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索配置项..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">所有分类</option>
                {groupedConfigs.map(group => (
                  <option key={group.category} value={group.category}>
                    {group.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* 状态消息 */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError('')}
                className="text-red-600 hover:text-red-700 mt-2"
              >
                关闭
              </Button>
            </div>
          </div>
        </Card>
      )}

      {success && (
        <Card className="p-4 mb-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        </Card>
      )}

      {/* 配置分组 */}
      <div className="space-y-6">
        {filteredGroups.map(group => (
          <Card key={group.category} className="bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
            {/* 分组标题 */}
            <div 
              className="p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleGroup(group.category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {group.icon}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {group.configs.length} 项
                  </span>
                  {expandedGroups.has(group.category) ? 
                    <ChevronDown className="h-5 w-5 text-gray-400" /> : 
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  }
                </div>
              </div>
            </div>

            {/* 配置项 */}
            {expandedGroups.has(group.category) && (
              <div className="p-6 space-y-8">
                {(() => {
                  // 针对 security 分类，提炼 SSH 监控默认项分组
                  const sshKeyMeta: Record<string, { label: string; desc: string }> = {
                    'security.ssh_monitor_default_enabled': {
                      label: 'SSH 监控默认启用',
                      desc: '开启后：新复制的 Agent 安装命令中会附带注释示例，安装者取消注释即可启用；不影响已安装的 Agent。'
                    },
                    'security.ssh_monitor_default_window_min': {
                      label: 'SSH 监控统计窗口（分钟）',
                      desc: '在该时间窗口内统计失败登录尝试次数（用于判断是否触发暴力破解）。'
                    },
                    'security.ssh_monitor_default_threshold': {
                      label: 'SSH 监控阈值（次数）',
                      desc: '时间窗口内尝试次数超过该阈值即判定为“暴力破解”，Agent 将上报事件。'
                    }
                  };

                  const isSecurity = group.category === 'security';
                  const sshConfigs = isSecurity
                    ? group.configs.filter(c => sshKeyMeta[c.key as keyof typeof sshKeyMeta])
                    : [];
                  const otherConfigs = isSecurity
                    ? group.configs.filter(c => !sshKeyMeta[c.key as keyof typeof sshKeyMeta])
                    : group.configs;

                  return (
                    <>
                      {isSecurity && sshConfigs.length > 0 && (
                        <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              SSH 监控默认项（安装引导模板）
                            </h3>
                            <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-1">
                              这些设置仅影响“新复制”的安装命令模板，已安装的 Agent 不受影响。
                            </p>
                          </div>
                          <div className="p-4 space-y-4">
                            {sshConfigs.map(config => {
                              const inputType = getInputType(config.key, config.value);
                              const currentValue = changedConfigs.get(config.key) ?? config.value;
                              const hasChanged = changedConfigs.has(config.key);
                              const meta = sshKeyMeta[config.key];
                              return (
                                <div key={config.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 mr-4">
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {meta?.label || formatConfigKey(config.key)}
                                        </h4>
                                        {hasChanged && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            已修改
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                                        {config.key}
                                      </p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                        {meta?.desc || config.description}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0 w-64">
                                      {inputType === 'boolean' ? (
                                        <select
                                          value={currentValue}
                                          onChange={(e) => handleConfigChange(config.key, e.target.value)}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                          <option value="true">启用</option>
                                          <option value="false">禁用</option>
                                        </select>
                                      ) : (
                                        <input
                                          type={inputType}
                                          value={currentValue}
                                          onChange={(e) => handleConfigChange(config.key, e.target.value)}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          step={inputType === 'number' ? 1 : undefined}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-between">
                                    <span>更新时间: {new Date(config.updatedAt).toLocaleString('zh-CN')}</span>
                                    {hasChanged && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newChanges = new Map(changedConfigs);
                                          newChanges.delete(config.key);
                                          setChangedConfigs(newChanges);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 h-auto p-1"
                                      >
                                        撤销
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 其余配置项 */}
                      <div className="space-y-6">
                        {otherConfigs.map(config => {
                          const inputType = getInputType(config.key, config.value);
                          const currentValue = changedConfigs.get(config.key) ?? config.value;
                          const hasChanged = changedConfigs.has(config.key);

                          return (
                            <div key={config.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className="flex items-center space-x-2">
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                      {formatConfigKey(config.key)}
                                    </h3>
                                    {hasChanged && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        已修改
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                                    {config.key}
                                  </p>
                                  {config.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                      {config.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0 w-64">
                                  {inputType === 'boolean' ? (
                                    <select
                                      value={currentValue}
                                      onChange={(e) => handleConfigChange(config.key, e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="true">启用</option>
                                      <option value="false">禁用</option>
                                    </select>
                                  ) : (
                                    <input
                                      type={inputType}
                                      value={currentValue}
                                      onChange={(e) => handleConfigChange(config.key, e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      step={inputType === 'number' ? 1 : undefined}
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-between">
                                <span>更新时间: {new Date(config.updatedAt).toLocaleString('zh-CN')}</span>
                                {hasChanged && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newChanges = new Map(changedConfigs);
                                      newChanges.delete(config.key);
                                      setChangedConfigs(newChanges);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 h-auto p-1"
                                  >
                                    撤销
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </Card>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <Card className="bg-white dark:bg-gray-800 shadow-lg p-12 text-center">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || selectedCategory !== 'all' ? '没有找到匹配的配置项' : '暂无系统配置'}
          </p>
        </Card>
      )}
    </div>
  );
};
