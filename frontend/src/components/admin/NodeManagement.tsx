import React, { useState, useEffect } from 'react';
import { apiService, type NodeData } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NodeModal } from './NodeModal';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeData | null>(null);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Server className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600" />
              节点管理
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base">
              管理网络监控节点和代理服务器
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadNodes}
              className="flex items-center space-x-2 flex-1 sm:flex-none justify-center"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>导出</span>
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2 flex-1 sm:flex-none justify-center"
            >
              <Plus className="h-4 w-4" />
              <span>添加节点</span>
            </Button>
          </div>
        </div>

        {/* 搜索和过滤器 */}
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索节点名称、位置、IP地址..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNodes.map((node) => (
          <Card key={node.id} className="bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              {/* 节点头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(node.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {node.name}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(node.status)}`}>
                      {getStatusText(node.status)}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNode(node)}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(node.id)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 节点信息 */}
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{node.city}, {node.country}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Globe className="h-4 w-4 mr-2" />
                  <span>{node.provider}</span>
                </div>

                {node.ipv4 && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Activity className="h-4 w-4 mr-2" />
                    <span className="font-mono">{node.ipv4}</span>
                  </div>
                )}

                {node.lastSeen && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    最后在线: {new Date(node.lastSeen).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>

              {/* 节点操作 */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    诊断
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
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
        <Card className="bg-white dark:bg-gray-800 shadow-lg">
          <div className="text-center py-12">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filterStatus !== 'all' ? '没有找到匹配的节点' : '还没有监控节点'}
            </p>
            {(!searchTerm && filterStatus === 'all') && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加第一个节点
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* 节点创建/编辑模态框 */}
      <NodeModal
        isOpen={showCreateModal || !!editingNode}
        onClose={() => {
          setShowCreateModal(false);
          setEditingNode(null);
        }}
        node={editingNode}
        onSaved={() => {
          loadNodes();
          setError('');
        }}
      />

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  删除节点
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  确定要删除这个监控节点吗？此操作不可恢复。
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
              >
                取消
              </Button>
              <Button
                onClick={() => handleDeleteNode(showDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                删除
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};