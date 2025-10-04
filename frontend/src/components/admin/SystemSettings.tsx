import React, { useState, useEffect } from 'react';
import { apiService, type SystemConfig } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import {
  Settings,
  Save,
  RefreshCw,
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Shield,
  Bell,
  Globe,
  Zap,
  Map as MapIcon,
  Lock,
  Key
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
  const [changedConfigs, setChangedConfigs] = useState<globalThis.Map<string, string>>(new globalThis.Map());
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // 定义分类显示顺序（按重要性排序）
  const CATEGORY_ORDER = React.useMemo(() => [
    'system',       // 系统设置
    'monitoring',   // 监控配置
    'diagnostics',  // 诊断配置
    'security',     // 安全配置
    'api',          // API设置
    'map',          // 地图配置
    'notifications' // 通知设置
  ], []);

  // 渲染配置输入控件
  const renderConfigInput = (config: SystemConfig) => {
    const inputType = config.inputType || 'text';
    const currentValue = changedConfigs.get(config.key) ?? config.value;
    const displayName = config.displayName || formatConfigKey(config.key);

    // 解析 JSON 值
    let parsedValue = currentValue;
    try {
      parsedValue = JSON.parse(currentValue);
    } catch {
      // 如果不是 JSON，使用原值
    }

    const handleChange = (newValue: string | boolean | number) => {
      // 转换为 JSON 字符串存储（与后端一致）
      const jsonValue = JSON.stringify(newValue);
      handleConfigChange(config.key, jsonValue);
    };

    // 布尔类型 - 下拉框
    if (inputType === 'boolean') {
      return (
        <>
          <label className="sr-only" htmlFor={`config-${config.id}`}>
            {displayName}
          </label>
          <select
            id={`config-${config.id}`}
            value={String(parsedValue)}
            onChange={(e) => handleChange(e.target.value === 'true')}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="true">✅ 启用</option>
            <option value="false">❌ 禁用</option>
          </select>
        </>
      );
    }

    // 下拉选择类型
    if (inputType === 'select' && config.options && config.options.length > 0) {
      return (
        <>
          <label className="sr-only" htmlFor={`config-${config.id}`}>
            {displayName}
          </label>
          <select
            id={`config-${config.id}`}
            value={String(parsedValue)}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {config.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      );
    }

    // 数字类型 - 带单位和范围限制
    if (inputType === 'number') {
      return (
        <div className="flex items-center space-x-2">
          <label className="sr-only" htmlFor={`config-${config.id}`}>
            {displayName}
          </label>
          <input
            id={`config-${config.id}`}
            type="number"
            value={Number(parsedValue)}
            onChange={(e) => handleChange(Number(e.target.value))}
            min={config.min}
            max={config.max}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {config.unit && (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {config.unit}
            </span>
          )}
        </div>
      );
    }

    // 文本类型 - 默认
    return (
      <>
        <label className="sr-only" htmlFor={`config-${config.id}`}>
          {displayName}
        </label>
        <input
          id={`config-${config.id}`}
          type="text"
          value={String(parsedValue)}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </>
    );
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSystemConfigs();
      if (response.success && response.data) {
        setConfigs(response.data);
        setChangedConfigs(new globalThis.Map());
      } else {
        setError(response.error || 'Failed to load configurations');
      }
    } catch {
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
      case 'map':
        return <MapIcon className="h-5 w-5 text-cyan-500" />;
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
      case 'map':
        return '地图配置';
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
      case 'map':
        return '地图服务提供商和API密钥配置';
      default:
        return '其他配置选项';
    }
  };

  // 按类别分组配置
  const groupedConfigs: ConfigGroup[] = React.useMemo(() => {
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

    return Object.entries(groups)
      .map(([category, configs]) => ({
        category,
        icon: getCategoryIcon(category),
        title: getCategoryTitle(category),
        description: getCategoryDescription(category),
        configs: configs.sort((a, b) => a.key.localeCompare(b.key))
      }))
      .filter(group => group.configs.length > 0)
      .sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a.category);
        const indexB = CATEGORY_ORDER.indexOf(b.category);
        
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        
        if (indexA === -1 && indexB !== -1) return 1;
        if (indexA !== -1 && indexB === -1) return -1;
        
        return a.title.localeCompare(b.title);
      });
  }, [configs, CATEGORY_ORDER]);

  const filteredGroups = groupedConfigs.filter(group => {
    if (selectedCategory !== 'all' && group.category !== selectedCategory) {
      return false;
    }
    
    if (searchTerm) {
      return group.configs.some(config =>
        config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (config.displayName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (config.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return true;
  }).map(group => ({
    ...group,
    configs: group.configs.filter(config =>
      !searchTerm || 
      config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (config.displayName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (config.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }));

  const handleConfigChange = (key: string, value: string) => {
    const newChanges = new globalThis.Map(changedConfigs);
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
        setChangedConfigs(new globalThis.Map());
        await loadConfigs();
        
        const hasMapConfigChange = configsToUpdate.some(c => c.key.startsWith('map.'));
        if (hasMapConfigChange) {
          setSuccess(`成功更新了 ${configsToUpdate.length} 个配置项。地图配置已更新，3秒后自动刷新页面...`);
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        setError(response.error || '保存配置失败');
      }
    } catch {
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
        setChangedConfigs(new globalThis.Map());
        await loadConfigs();
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || '重置配置失败');
      }
    } catch {
      setError('重置配置失败');
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
      {/* 优化的头部区域 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Settings className="h-8 w-8 mr-3 text-blue-600" />
              系统配置
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
              <span>恢复默认</span>
            </Button>
          </div>
        </div>

        {/* 账户安全卡片 */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-800 shadow-lg mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  账户安全
                  <span className="text-xs font-normal px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                    重要
                  </span>
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  修改您的登录密码，保护账户安全
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                  <AlertCircle className="h-4 w-4" />
                  <span>建议定期更换密码，密码长度至少6个字符</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setShowChangePasswordModal(true)}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              修改密码
            </Button>
          </div>
        </Card>

        {/* 增强的搜索和过滤工具栏 */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-xl"></div>
          <Card className="relative p-5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg border-2 border-gray-200/50 dark:border-gray-700/50">
            <div className="space-y-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索配置项名称、描述或键名..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="清除搜索"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* 快捷过滤按钮组 */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  快捷过滤:
                </span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  全部
                </button>
                {groupedConfigs.slice(0, 6).map(group => (
                  <button
                    key={group.category}
                    onClick={() => setSelectedCategory(group.category)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                      selectedCategory === group.category
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="flex-shrink-0">{group.icon}</span>
                    <span>{group.title}</span>
                  </button>
                ))}
                {(searchTerm || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all"
                  >
                    清除过滤
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
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

      {/* 未保存更改提示 */}
      {changedConfigs.size > 0 && !success && !error && (
        <Card className="p-4 mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-amber-500 mr-3" />
              <div>
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  您有 {changedConfigs.size} 项未保存的更改
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  请点击底部的"保存更改"按钮以应用配置，或点击"取消"放弃修改。
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 优化的配置分组 */}
      <div className="space-y-4">
        {filteredGroups.map(group => (
          <Card key={group.category} className="bg-white dark:bg-gray-800 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
            {/* 分组标题 */}
            <div 
              className="p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent dark:hover:from-gray-700/50 dark:hover:to-transparent transition-all"
              onClick={() => toggleGroup(group.category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">{group.icon}</div>
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
                  <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">
                    {group.configs.length} 项
                  </span>
                  <div className={`transition-transform duration-300 ${
                    expandedGroups.has(group.category) ? 'rotate-180' : ''
                  }`}>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* 配置项列表 - 带展开动画 */}
            {expandedGroups.has(group.category) && (
              <div className="p-6 space-y-4">
                {group.configs.map(config => {
                  const hasChanged = changedConfigs.has(config.key);
                  const displayName = config.displayName || formatConfigKey(config.key);

                  return (
                    <div 
                      key={config.id} 
                      className={`border rounded-lg p-4 transition-all ${
                        hasChanged 
                          ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 shadow-md' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              {displayName}
                            </h3>
                            {hasChanged && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white shadow-sm animate-pulse">
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
                        <div className="flex-shrink-0 w-full sm:w-80 lg:w-96">
                          {renderConfigInput(config)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-between">
                        <span>更新时间: {new Date(config.updatedAt).toLocaleString('zh-CN')}</span>
                        {hasChanged && (
                          <button
                            onClick={() => {
                              const newChanges = new globalThis.Map(changedConfigs);
                              newChanges.delete(config.key);
                              setChangedConfigs(newChanges);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                            title="撤销此项修改"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>撤销</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* 增强的固定底部保存栏 */}
      {changedConfigs.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t-2 border-blue-500 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    您有 <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">{changedConfigs.size}</span> 项未保存的更改
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">Ctrl</kbd>
                    +
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs">S</kbd>
                    保存
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">修改项:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(changedConfigs.keys()).slice(0, 5).map(key => {
                      const config = configs.find(c => c.key === key);
                      const displayName = config?.displayName || key.split('.').pop();
                      return (
                        <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {displayName}
                        </span>
                      );
                    })}
                    {changedConfigs.size > 5 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        +{changedConfigs.size - 5} 项
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('确定要放弃所有未保存的更改吗？')) {
                      setChangedConfigs(new globalThis.Map());
                    }
                  }}
                  disabled={saving}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white flex items-center space-x-2 px-6 shadow-lg hover:shadow-xl transition-all"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>保存更改</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 密码修改模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
};
