import React, { useState, useEffect } from 'react';
import { apiService, type NodeData } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AgentDeployModal } from './AgentDeployModal';
import { 
  Server, 
  Search, 
  Edit2, 
  Trash2, 
  Globe,
  Plus,
  Filter,
  Download,
  RefreshCw,
  MapPin,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface NodeManagementProps {
  className?: string;
}

export const NodeManagement: React.FC<NodeManagementProps> = ({ className = '' }) => {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNodes();
      if (response.success && response.data) {
        setNodes(response.data);
      } else {
        setError(response.error || 'Failed to load nodes');
      }
    } catch {
      setError('Failed to load nodes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'offline':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'warning':
        return '警告';
      default:
        return '未知';
    }
  };

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.ipv4 && node.ipv4.includes(searchTerm));
    
    const matchesStatus = filterStatus === 'all' || node.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await apiService.deleteNode(nodeId);
      if (response.success) {
        setNodes(nodes.filter(n => n.id !== nodeId));
        setShowDeleteConfirm(null);
      } else {
        setError(response.error || 'Failed to delete node');
      }
    } catch {
      setError('Failed to delete node');
    }
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部区域 */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-6 lg:space-y-0">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white flex items-center justify-center lg:justify-start">
              <Server className="h-8 w-8 lg:h-10 lg:w-10 mr-3 text-blue-600 drop-shadow-sm" />
              节点管理
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-3 text-base lg:text-lg">
              管理和监控全球网络探针节点
            </p>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {filteredNodes.length > 0 && (
                <span>
                  共 {filteredNodes.length} 个节点 • {filteredNodes.filter(n => n.status === 'online').length} 在线
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={loadNodes}
              className="flex items-center space-x-2 min-w-[100px] shadow-sm hover:shadow-md transition-shadow"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </Button>
            <Button
              variant="outline"
              size="default"
              className="hidden sm:flex items-center space-x-2 min-w-[100px] shadow-sm hover:shadow-md transition-shadow"
            >
              <Download className="h-4 w-4" />
              <span>导出</span>
            </Button>
            <Button
              onClick={() => setShowDeployModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white flex items-center space-x-2 min-w-[120px] shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>部署探针</span>
            </Button>
          </div>
        </div>

        {/* 搜索和过滤器 */}
        <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg border-0 ring-1 ring-gray-200 dark:ring-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索节点名称、位置、IP地址或服务商..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-3 min-w-fit">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm min-w-[140px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">所有状态</option>
                <option value="online">在线</option>
                <option value="offline">离线</option>
                <option value="warning">警告</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <div className="text-red-500 mr-3">⚠️</div>
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

      {/* 节点网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredNodes.map((node) => (
          <Card key={node.id} className="bg-white dark:bg-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-blue-200 dark:hover:ring-blue-700 group">
            <div className="p-6">
              {/* 节点头部 */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(node.status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                      {node.name}
                    </h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(node.status)} mt-2`}>
                      {getStatusText(node.status)}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="编辑节点（暂不可用）"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(node.id)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="删除节点"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 节点信息 */}
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 mr-3 text-gray-500" />
                  <span className="font-medium">{node.city}, {node.country}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Globe className="h-4 w-4 mr-3 text-gray-500" />
                  <span className="font-medium">{node.provider}</span>
                </div>

                {node.ipv4 && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Activity className="h-4 w-4 mr-3 text-gray-500" />
                    <span className="font-mono font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{node.ipv4}</span>
                  </div>
                )}

                {node.lastSeen && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
                    <span className="font-medium">最后在线:</span> {new Date(node.lastSeen).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>

              {/* 节点操作 */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    诊断
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs font-medium hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:border-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    监控
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <Card className="bg-white dark:bg-gray-800 shadow-lg border-0 ring-1 ring-gray-200 dark:ring-gray-700">
          <div className="text-center py-16">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-full"></div>
              </div>
              <Server className="h-12 w-12 text-blue-600 mx-auto relative" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchTerm || filterStatus !== 'all' ? '没有找到匹配的节点' : '还没有监控节点'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || filterStatus !== 'all' 
                ? '请尝试调整搜索条件或过滤器' 
                : '开始部署您的第一个网络监控探针'
              }
            </p>
            {(!searchTerm && filterStatus === 'all') && (
              <Button
                onClick={() => setShowDeployModal(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                部署第一个探针
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Agent部署模态框 */}
      <AgentDeployModal
        isOpen={showDeployModal}
        onClose={() => {
          setShowDeployModal(false);
        }}
        onDeployed={() => {
          loadNodes();
          setError('');
        }}
      />

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white dark:bg-gray-800 p-0 rounded-2xl shadow-2xl max-w-md w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    删除节点
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    确定要删除这个监控节点吗？删除后将无法恢复该节点的所有历史数据和配置信息。
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  取消
                </Button>
                <Button
                  onClick={() => handleDeleteNode(showDeleteConfirm)}
                  className="bg-red-600 hover:bg-red-700 text-white min-w-[80px] shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  删除
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};