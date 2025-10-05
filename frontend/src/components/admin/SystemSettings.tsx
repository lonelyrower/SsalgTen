import React, { useState, useEffect } from 'react';
import { apiService, type SystemConfig } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Settings,
  Clock,
  Activity,
  Database,
  Shield,
  Globe,
  Zap,
  Save,
  RefreshCw,
  AlertCircle,
  MapIcon,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  ChevronDown,
  Info,
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

  // 定义分类显示顺序（按使用频率排序，常用的放前面）
  const CATEGORY_ORDER = React.useMemo(() => [
    'map',          // 地图配置 - 最常用
    'monitoring',   // 监控配置 - 常用
    'diagnostics',  // 诊断配置 - 常用
    'system',       // 系统设置 - 较常用
    'security',     // 安全配置 - 中等
    'api',          // API设置 - 中等
    'other'         // 其他设置（最后）
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
            {config.options.map((option) => {
              // 如果有 optionLabels，使用标签；否则使用原值
              const label = config.optionLabels?.[option] || option;
              return (
                <option key={option} value={option}>
                  {label}
                </option>
              );
            })}
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
      case 'diagnostics':
        return <Activity className="h-5 w-5 text-purple-500" />;
      case 'database':
        return <Database className="h-5 w-5 text-purple-500" />;
      case 'security':
        return <Shield className="h-5 w-5 text-red-500" />;
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
      case 'diagnostics':
        return '诊断配置';
      case 'database':
        return '数据库设置';
      case 'security':
        return '安全配置';
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
        return '系统基础参数、名称、时区等全局配置';
      case 'monitoring':
        return '节点心跳检测、超时设置、数据保留策略';
      case 'diagnostics':
        return 'Ping、Traceroute、MTR 等诊断工具的默认参数';
      case 'database':
        return '数据库连接池、性能优化和存储参数';
      case 'security':
        return 'JWT认证、登录限制、密码策略、SSH监控设置';
      case 'api':
        return 'API速率限制、CORS跨域、日志级别设置';
      case 'performance':
        return '缓存策略、并发限制、资源优化配置';
      case 'map':
        return '地图服务商选择、API密钥配置（支持 CARTO/OpenStreetMap/Mapbox）';
      default:
        return '未分类的其他配置选项';
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

  // 获取配置项的详细说明
  const getConfigHelp = (key: string): string => {
    const helpTexts: Record<string, string> = {
      // 系统设置
      'system.name': '在页面标题和导航栏中显示的系统名称',
      'system.version': '当前系统版本号，用于版本追踪和兼容性检查',
      'system.timezone': '系统默认时区，影响所有时间戳的显示格式',
      'system.maintenance_mode': '开启后将限制系统访问，仅管理员可登录，用于系统维护期间',
      
      // 监控配置
      'monitoring.heartbeat_interval': 'Agent向服务器发送心跳的间隔时间，过短会增加网络负载',
      'monitoring.heartbeat_timeout': '超过此时间未收到心跳则判定Agent离线，应大于心跳间隔的2-3倍',
      'monitoring.max_offline_time': '节点持续离线超过此时间将被标记为不可用状态',
      'monitoring.cleanup_interval': '系统自动清理过期数据的时间间隔',
      'monitoring.retention_days': '历史监控数据的保留天数，过期数据将被自动清理以节省存储空间',
      
      // 诊断配置
      'diagnostics.default_ping_count': '执行Ping测试时的默认发包数量',
      'diagnostics.default_traceroute_hops': 'Traceroute测试的最大跳数限制，防止无限循环',
      'diagnostics.default_mtr_count': 'MTR测试的默认循环次数，影响测试精确度',
      'diagnostics.speedtest_enabled': '是否启用网络速度测试功能（需要Agent支持）',
      'diagnostics.max_concurrent_tests': '每个Agent同时执行的诊断任务数量上限，防止资源耗尽',
      'diagnostics.proxy_enabled': '是否允许后端代理诊断请求，关闭后诊断将直接由Agent执行',
      
      // 安全配置
      'security.jwt_expires_in': '用户登录令牌的有效期，过期后需要重新登录',
      'security.max_login_attempts': '允许的最大连续登录失败次数，超过后账户将被临时锁定',
      'security.lockout_duration': '账户被锁定后的冷却时间',
      'security.require_strong_passwords': '强制要求新用户使用强密码（包含大小写字母、数字和特殊字符）',
      'security.ssh_monitor_default_enabled': '新建Agent时是否默认启用SSH暴力破解监控功能',
      'security.ssh_monitor_default_window_min': 'SSH监控的时间窗口，在此时间内统计失败登录次数',
      'security.ssh_monitor_default_threshold': '时间窗口内失败登录次数达到此值时触发告警',
      
      // API配置
      'api.rate_limit_requests': '时间窗口内允许的最大API请求次数',
      'api.rate_limit_window': 'API速率限制的时间窗口长度',
      'api.cors_enabled': '是否启用跨域资源共享，关闭后仅允许同源请求',
      'api.log_level': 'API日志记录级别，debug级别会记录更详细的信息，适用于开发调试',
      
      // 地图配置
      'map.provider': '地图图层提供商。CARTO（免费无需密钥）、OpenStreetMap（免费开源）、Mapbox（需要API密钥，提供更丰富的样式）',
      'map.api_key': 'Mapbox 的 API 访问密钥，在 Mapbox 官网申请。选择 CARTO 或 OpenStreetMap 时可留空',
    };
    
    return helpTexts[key] || '';
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Settings className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600" />
              系统配置
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
              管理系统运行参数、监控设置和安全策略
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4" />
              <span>提示：修改配置后请点击底部的"保存更改"按钮应用设置</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConfigs}
              disabled={saving}
              className="flex items-center space-x-2 flex-1 sm:flex-none justify-center"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400 dark:border-orange-700 dark:hover:border-orange-600 flex-1 sm:flex-none justify-center"
            >
              <RotateCcw className="h-4 w-4" />
              <span>恢复默认</span>
            </Button>
          </div>
        </div>

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
                {/* 显示所有分类 */}
                {groupedConfigs.map(group => (
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

      {/* 优化的配置分组 - 紧凑网格布局 */}
      <div className="space-y-4">
        {filteredGroups.map((group, groupIndex) => {
          // 为每个分组定义颜色主题
          const colorClasses = [
            'from-cyan-500/20 to-cyan-500/40', // cyan - map
            'from-green-500/20 to-green-500/40', // green - monitoring
            'from-purple-500/20 to-purple-500/40', // purple - diagnostics
            'from-blue-500/20 to-blue-500/40', // blue - system
            'from-red-500/20 to-red-500/40', // red - security
            'from-indigo-500/20 to-indigo-500/40', // indigo - api
            'from-gray-500/20 to-gray-500/40', // gray - other
          ][groupIndex % 7];

          return (
          <Card 
            key={group.category} 
            className="bg-white dark:bg-gray-800 shadow-md hover:shadow-lg overflow-hidden transition-all duration-300 border border-gray-200 dark:border-gray-700"
          >
            {/* 紧凑的分组标题 */}
            <button 
              className="w-full p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all group text-left"
              onClick={() => toggleGroup(group.category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* 彩色图标 */}
                  <div 
                    className={`flex-shrink-0 p-2 rounded-lg group-hover:scale-110 transition-transform bg-gradient-to-br ${colorClasses}`}
                  >
                    {group.icon}
                  </div>
                  
                  {/* 标题和描述 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {group.title}
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {group.configs.length}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                      {group.description}
                    </p>
                  </div>
                </div>
                
                {/* 展开图标 */}
                <div className={`flex-shrink-0 ml-3 transition-transform duration-300 ${
                  expandedGroups.has(group.category) ? 'rotate-180' : ''
                }`}>
                  <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                </div>
              </div>
            </button>

            {/* 配置项列表 - 紧凑的网格布局 */}
            {expandedGroups.has(group.category) && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.configs.map(config => {
                    const hasChanged = changedConfigs.has(config.key);
                    const displayName = config.displayName || formatConfigKey(config.key);
                    const helpText = getConfigHelp(config.key);

                    return (
                      <div 
                        key={config.id} 
                        className={`group relative border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
                          hasChanged 
                            ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 shadow-md ring-2 ring-blue-200 dark:ring-blue-800' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900/30'
                        }`}
                      >
                        {/* 已修改标记 */}
                        {hasChanged && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg animate-pulse">
                              ●
                            </span>
                          </div>
                        )}

                        {/* 配置标题和帮助 */}
                        <div className="mb-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight flex-1">
                              {displayName}
                            </h3>
                            
                            {/* 帮助按钮 - 悬停或点击显示技术细节 */}
                            {(config.key || helpText) && (
                              <div className="relative group/help flex-shrink-0">
                                <button
                                  type="button"
                                  className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-colors"
                                  title="查看技术详情"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                                
                                {/* 悬停显示的技术信息 */}
                                <div className="absolute right-0 top-8 z-50 w-72 p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all duration-200">
                                  {/* 小箭头 */}
                                  <div className="absolute -top-2 right-2 w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-t-2 border-gray-200 dark:border-gray-600 transform rotate-45"></div>
                                  
                                  <div className="relative space-y-2">
                                    {/* 技术键名 */}
                                    <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">技术键名</p>
                                      <code className="text-xs text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                                        {config.key}
                                      </code>
                                    </div>
                                    
                                    {/* 详细帮助 */}
                                    {helpText && (
                                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                                          💡 {helpText}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* 更新时间 */}
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                                      <Clock className="h-3 w-3" />
                                      更新: {new Date(config.updatedAt).toLocaleString('zh-CN')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 中文描述 - 默认显示 */}
                          {config.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                              {config.description}
                            </p>
                          )}
                        </div>
                        
                        {/* 输入控件 */}
                        <div className="mb-3">
                          {renderConfigInput(config)}
                        </div>
                        
                        {/* 底部操作栏 */}
                        {hasChanged && (
                          <div className="flex items-center justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button
                              onClick={() => {
                                const newChanges = new globalThis.Map(changedConfigs);
                                newChanges.delete(config.key);
                                setChangedConfigs(newChanges);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all font-medium"
                              title="撤销此项修改"
                            >
                              <RotateCcw className="h-3 w-3" />
                              撤销
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );
        })}
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
    </div>
  );
};
