import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download, RefreshCw, Activity, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DiagnosticRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  testType: 'ping' | 'traceroute' | 'speedtest' | 'iperf3';
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  results: any;
  createdAt: string;
}

export const DiagnosticsPage: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<DiagnosticRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ping' | 'traceroute' | 'speedtest' | 'iperf3'>('all');
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticRecord | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockRecords: DiagnosticRecord[] = [
      {
        id: '1',
        nodeId: 'node1',
        nodeName: 'Agent-tokyo-001',
        testType: 'ping',
        status: 'completed',
        startTime: '2024-01-15T10:30:00Z',
        endTime: '2024-01-15T10:30:05Z',
        duration: 5000,
        results: {
          avgLatency: 45.2,
          minLatency: 42.1,
          maxLatency: 52.3,
          packetLoss: 0
        },
        createdAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        nodeId: 'node2',
        nodeName: 'Agent-london-002',
        testType: 'speedtest',
        status: 'completed',
        startTime: '2024-01-15T09:15:00Z',
        endTime: '2024-01-15T09:16:30Z',
        duration: 90000,
        results: {
          downloadSpeed: 245.7,
          uploadSpeed: 123.4,
          ping: 28.5
        },
        createdAt: '2024-01-15T09:15:00Z'
      },
      {
        id: '3',
        nodeId: 'node3',
        nodeName: 'Agent-newyork-003',
        testType: 'traceroute',
        status: 'running',
        startTime: '2024-01-15T11:00:00Z',
        results: null,
        createdAt: '2024-01-15T11:00:00Z'
      },
      {
        id: '4',
        nodeId: 'node1',
        nodeName: 'Agent-tokyo-001',
        testType: 'iperf3',
        status: 'failed',
        startTime: '2024-01-15T08:45:00Z',
        endTime: '2024-01-15T08:45:30Z',
        duration: 30000,
        results: {
          error: 'Connection timeout'
        },
        createdAt: '2024-01-15T08:45:00Z'
      }
    ];

    setTimeout(() => {
      setRecords(mockRecords);
      setLoading(false);
    }, 1000);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    // 模拟刷新
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const getTestTypeText = (type: string) => {
    switch (type) {
      case 'ping':
        return 'Ping 测试';
      case 'traceroute':
        return '路由追踪';
      case 'speedtest':
        return '速度测试';
      case 'iperf3':
        return 'iPerf3 测试';
      default:
        return type;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  // 过滤记录
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.nodeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.testType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesType = typeFilter === 'all' || record.testType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const renderResults = (record: DiagnosticRecord) => {
    if (!record.results) return null;

    switch (record.testType) {
      case 'ping':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">平均延迟:</span>
              <span className="ml-2 font-medium">{record.results.avgLatency}ms</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">最小延迟:</span>
              <span className="ml-2 font-medium">{record.results.minLatency}ms</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">最大延迟:</span>
              <span className="ml-2 font-medium">{record.results.maxLatency}ms</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">丢包率:</span>
              <span className="ml-2 font-medium">{record.results.packetLoss}%</span>
            </div>
          </div>
        );
      
      case 'speedtest':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">下载速度:</span>
              <span className="ml-2 font-medium">{record.results.downloadSpeed} Mbps</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">上传速度:</span>
              <span className="ml-2 font-medium">{record.results.uploadSpeed} Mbps</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">延迟:</span>
              <span className="ml-2 font-medium">{record.results.ping}ms</span>
            </div>
          </div>
        );
      
      case 'iperf3':
        if (record.results.error) {
          return (
            <div className="text-sm text-red-600 dark:text-red-400">
              错误: {record.results.error}
            </div>
          );
        }
        return null;
      
      default:
        return (
          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
            {JSON.stringify(record.results, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                诊断记录
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                查看所有网络诊断测试的历史记录和结果
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总测试数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{records.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">运行中</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {records.filter(r => r.status === 'running').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">已完成</p>
                <p className="text-2xl font-bold text-green-600">
                  {records.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">失败</p>
                <p className="text-2xl font-bold text-red-600">
                  {records.filter(r => r.status === 'failed').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索节点名称或测试类型..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">所有状态</option>
                <option value="running">运行中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">所有类型</option>
                <option value="ping">Ping 测试</option>
                <option value="traceroute">路由追踪</option>
                <option value="speedtest">速度测试</option>
                <option value="iperf3">iPerf3 测试</option>
              </select>
              
              <span className="text-sm text-gray-500 dark:text-gray-400">
                显示 {filteredRecords.length} / {records.length} 条记录
              </span>
            </div>
          </div>
        </div>

        {/* 记录列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              诊断记录
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">暂无诊断记录</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getStatusIcon(record.status)}
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {getTestTypeText(record.testType)} - {record.nodeName}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                          record.status === 'running' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {getStatusText(record.status)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span>开始时间: {new Date(record.startTime).toLocaleString()}</span>
                        {record.endTime && (
                          <span>结束时间: {new Date(record.endTime).toLocaleString()}</span>
                        )}
                        <span>耗时: {formatDuration(record.duration)}</span>
                      </div>
                      
                      {record.status === 'completed' && renderResults(record)}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                    >
                      {selectedRecord?.id === record.id ? '收起' : '详情'}
                    </Button>
                  </div>
                  
                  {/* 详细结果展开 */}
                  {selectedRecord?.id === record.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">详细结果</h5>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-4 rounded overflow-x-auto">
                        {JSON.stringify(record.results, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};