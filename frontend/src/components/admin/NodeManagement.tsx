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
  Plus,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Settings
} from 'lucide-react';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNeverAdopt, setImportNeverAdopt] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | { created: number; updated: number; skipped: number; total: number }>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState('');

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNodes();
      if (response.success && response.data) {
        // 规范化状态为小写，避免统计/筛选误差
        const normalized = response.data.map((n: NodeData) => ({
          ...n,
          status: (typeof n.status === 'string' ? n.status.toLowerCase() : n.status) as NodeData['status']
        }));
        setNodes(normalized);
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
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'offline':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'warning':
        return '警告';
      case 'maintenance':
        return '维护';
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
    
    const matchesStatus = filterStatus === 'all' || (node.status || '').toLowerCase() === filterStatus;
    
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

  const handleRenameNode = async (nodeId: string) => {
    if (!newNodeName.trim()) {
      setError('节点名称不能为空');
      return;
    }

    try {
      const response = await apiService.updateNode(nodeId, { name: newNodeName.trim() });
      if (response.success && response.data) {
        setNodes(nodes.map(n => n.id === nodeId ? { ...n, name: response.data?.name || newNodeName.trim() } : n));
        setShowRenameModal(null);
        setNewNodeName('');
        setError('');
      } else {
        setError(response.error || 'Failed to rename node');
      }
    } catch {
      setError('Failed to rename node');
    }
  };

  const openRenameModal = (nodeId: string, currentName: string) => {
    setShowRenameModal(nodeId);
    setNewNodeName(currentName);
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Settings className="h-6 w-6 mr-3 text-blue-600" />
              节点管理
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
              重命名、删除节点和部署新节点
            </p>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              共 {filteredNodes.length} 个节点 • {filteredNodes.filter(n => n.status === 'online').length} 在线 • 
              <a href="/nodes" className="text-blue-600 hover:text-blue-700 ml-1 inline-flex items-center">
                查看详细监控 <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadNodes}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新
            </Button>
            <Button
              onClick={() => setShowImportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              title="导入过期/未安装Agent的 VPS（作为离线节点）"
            >
              <Plus className="h-4 w-4 mr-1" />
              导入过期VPS
            </Button>
            <Button
              onClick={() => setShowDeployModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              部署节点
            </Button>
          </div>
        </div>

        {/* 搜索区域 */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索节点名称或位置..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
          </select>
        </div>
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

      {/* 导入过期VPS（占位节点）对话框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white dark:bg-gray-800 p-0 rounded-2xl shadow-2xl max-w-2xl w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">导入过期 VPS</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                支持两种方式：1) 选择文件（.txt 每行一个 IP；或 .json，数组为包含 ip 字段的对象）；2) 直接在文本框中粘贴 IP（每行一个）。
                这些节点将以“离线”状态显示；默认设置为“纪念/冻结”，不会被后续相同 IP 的新 Agent 自动合并。
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">选择文件（可选）</label>
                  <input
                    type="file"
                    accept=".txt,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        setImportText((prev) => prev ? (prev + '\n' + text) : text);
                      } catch {
                        setError('读取文件失败');
                      }
                    }}
                    className="block w-full text-sm text-gray-700 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">IP 列表（每行一个）或 JSON</label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={10}
                    placeholder={"示例:\n203.0.113.10\n2001:db8::1234\n或 JSON:\n[{\"ip\":\"203.0.113.10\",\"name\":\"Expired-1\"}]"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={importNeverAdopt} onChange={(e) => setImportNeverAdopt(e.target.checked)} />
                  <span className="text-gray-700 dark:text-gray-300">设置为“纪念/冻结”（neverAdopt）</span>
                </label>

                {importResult && (
                  <div className="text-sm text-gray-700 dark:text-gray-200 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded">
                    导入完成：新增 {importResult.created}，更新 {importResult.updated}，跳过 {importResult.skipped}，共 {importResult.total}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => { setShowImportModal(false); setImportText(''); setImportResult(null); }}
                  className="min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  取消
                </Button>
                <Button
                  onClick={async () => {
                    // 解析 importText 为 items
                    const raw = importText.trim();
                    if (!raw) { setError('请输入或选择包含 IP 的内容'); return; }
                    let items: Array<{ ip: string; name?: string; notes?: string; tags?: string[]; neverAdopt?: boolean }> = [];
                    try {
                      if (raw.startsWith('[') || raw.startsWith('{')) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) items = parsed;
                        else if (Array.isArray(parsed.items)) items = parsed.items;
                      }
                    } catch {
                      // JSON解析失败时忽略错误，继续处理原始文本
                    }
                    if (items.length === 0) {
                      // 逐行解析 IP
                      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                      items = lines.map(ip => ({ ip }));
                    }
                    // 填充 neverAdopt 默认值
                    items = items.map(it => ({ ...it, neverAdopt: typeof it.neverAdopt === 'boolean' ? it.neverAdopt : importNeverAdopt }));

                    setImporting(true);
                    setError('');
                    setImportResult(null);
                    try {
                      const resp = await apiService.importPlaceholderNodes(items);
                      if (resp.success && resp.data) {
                        setImportResult(resp.data);
                        // 刷新节点
                        await loadNodes();
                      } else {
                        setError(resp.error || '导入失败');
                      }
                    } catch (e: unknown) {
                      const msg = (e instanceof Error && e.message) ? String(e.message) : '';
                      if (msg.includes('Placeholder feature not available') || msg.includes('501')) {
                        setError('占位功能不可用：请先在后端执行数据库迁移（prisma migrate deploy）后重试。');
                      } else {
                        setError('导入失败');
                      }
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={importing || !importText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px] disabled:opacity-50"
                >
                  {importing ? '正在导入…' : '开始导入'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 节点表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '5%' }}>
                  {/* 状态指示 */}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '28%' }}>
                  节点信息
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '25%' }}>
                  位置
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '15%' }}>
                  状态
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '20%' }}>
                  最后在线
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '7%' }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNodes.map((node) => (
                <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-2 py-4 text-center" style={{ width: '5%' }}>
                    {getStatusIcon(node.status)}
                  </td>
                  <td className="px-4 py-4 text-center" style={{ width: '28%' }}>
                    <div className="inline-flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {node.name}
                        </div>
                        {node.ipv4 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {node.ipv4}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center" style={{ width: '25%' }}>
                    <div className="text-sm text-gray-900 dark:text-white inline-flex items-center justify-center gap-1">
                      <CountryFlagSvg country={node.country} />
                      <span>{node.city}, {node.country}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {node.provider}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center" style={{ width: '15%' }}>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(node.status)}`}>
                      {getStatusText(node.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-gray-500 dark:text-gray-400" style={{ width: '20%' }}>
                    {node.lastSeen ? new Date(node.lastSeen).toLocaleDateString('zh-CN') : '未知'}
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-medium" style={{ width: '10%' }}>
                    <div className="inline-flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRenameModal(node.id, node.name)}
                        className="text-gray-400 hover:text-blue-600"
                        title="重命名节点"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(node.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="删除节点"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filteredNodes.length === 0 && (
        <div className="text-center py-8">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm || filterStatus !== 'all' ? '没有找到匹配的节点' : '还没有节点'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? '请尝试调整搜索条件' 
              : '部署第一个节点开始监控'
            }
          </p>
          {(!searchTerm && filterStatus === 'all') && (
            <Button
              onClick={() => setShowDeployModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              部署节点
            </Button>
          )}
        </div>
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

      {/* 重命名节点对话框 */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white dark:bg-gray-800 p-0 rounded-2xl shadow-2xl max-w-md w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-4">
                  <Edit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    重命名节点
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    请输入新的节点名称
                  </p>
                  <input
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="输入节点名称"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameNode(showRenameModal);
                      } else if (e.key === 'Escape') {
                        setShowRenameModal(null);
                        setNewNodeName('');
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRenameModal(null);
                    setNewNodeName('');
                  }}
                  className="min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  取消
                </Button>
                <Button
                  onClick={() => handleRenameNode(showRenameModal)}
                  disabled={!newNodeName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
