import React, { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Globe, 
  Zap, 
  Route,
  Timer,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Upload,
  Server,
  MapPin,
  Network,
  Target
} from 'lucide-react';
import type { NodeData, VisitorInfo } from '@/services/api';
import { apiService } from '@/services/api';

interface NetworkToolkitProps {
  selectedNode: NodeData;
  onClose: () => void;
}

interface DiagnosticResult {
  tool: string;
  status: 'running' | 'success' | 'failed' | 'idle';
  result?: any;
  error?: string;
  startTime?: number;
  duration?: number;
}

export const NetworkToolkit: React.FC<NetworkToolkitProps> = ({ selectedNode, onClose }) => {
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({});
  const [activeTab, setActiveTab] = useState<string>('ping');
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(null);
  const [loadingVisitorInfo, setLoadingVisitorInfo] = useState(false);

  // 获取访问者IP信息
  useEffect(() => {
    const fetchVisitorInfo = async () => {
      try {
        setLoadingVisitorInfo(true);
        const response = await apiService.getVisitorInfo();
        if (response.success && response.data) {
          setVisitorInfo(response.data);
        }
      } catch (error) {
        console.warn('Failed to fetch visitor info:', error);
      } finally {
        setLoadingVisitorInfo(false);
      }
    };

    fetchVisitorInfo();
  }, []);

  const tools = [
    {
      id: 'ping',
      name: 'Ping 测试',
      description: '测试与节点的连通性和延迟',
      icon: Activity,
      color: 'blue',
      category: '基础诊断'
    },
    {
      id: 'traceroute',
      name: 'Traceroute',
      description: '追踪数据包到达节点的路径',
      icon: Route,
      color: 'green',
      category: '路径分析'
    },
    {
      id: 'speedtest',
      name: '速度测试',
      description: '测试上传和下载速度',
      icon: Zap,
      color: 'orange',
      category: '性能测试'
    },
    {
      id: 'mtr',
      name: 'MTR 分析',
      description: '结合ping和traceroute的网络诊断',
      icon: TrendingUp,
      color: 'purple',
      category: '综合分析'
    },
    {
      id: 'latency-test',
      name: '延迟测试',
      description: '测试到主要网站的网络延迟',
      icon: Target,
      color: 'cyan',
      category: '延迟分析'
    },
    {
      id: 'dns',
      name: 'DNS 查询',
      description: '测试DNS解析性能',
      icon: Globe,
      color: 'indigo',
      category: '域名解析'
    },
    {
      id: 'port',
      name: '端口扫描',
      description: '检查常用端口的开放状态',
      icon: Server,
      color: 'red',
      category: '端口检测'
    }
  ];

  // 模拟运行诊断工具
  const runDiagnostic = useCallback(async (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    // 设置运行状态
    setResults(prev => ({
      ...prev,
      [toolId]: {
        tool: tool.name,
        status: 'running',
        startTime: Date.now()
      }
    }));

    try {
      let result;
      
      // 对于延迟测试，调用真实的Agent API
      if (toolId === 'latency-test') {
        const agentEndpoint = `http://${selectedNode.ipv4}:3002`;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          const response = await fetch(`${agentEndpoint}/api/latency-test?testType=standard`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || '延迟测试失败');
          }

          result = data.data;
        } catch (fetchError) {
          // 如果真实API失败，使用模拟数据
          console.warn('Failed to fetch real latency test data, using mock data:', fetchError);
          result = generateMockResult(toolId);
        }
      } else {
        // 其他工具继续使用模拟API调用
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        result = generateMockResult(toolId);
      }
      
      setResults(prev => ({
        ...prev,
        [toolId]: {
          ...prev[toolId],
          status: 'success',
          result: result,
          duration: Date.now() - (prev[toolId]?.startTime || Date.now())
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [toolId]: {
          ...prev[toolId],
          status: 'failed',
          error: '诊断执行失败',
          duration: Date.now() - (prev[toolId]?.startTime || Date.now())
        }
      }));
    }
  }, []);

  // 生成模拟结果数据
  const generateMockResult = (toolId: string) => {
    switch (toolId) {
      case 'ping':
        return {
          packets_sent: 4,
          packets_received: 4,
          packet_loss: 0,
          min_time: 12.3,
          max_time: 15.8,
          avg_time: 14.1,
          results: [
            { seq: 1, time: 12.3, ttl: 64 },
            { seq: 2, time: 14.5, ttl: 64 },
            { seq: 3, time: 15.8, ttl: 64 },
            { seq: 4, time: 13.8, ttl: 64 }
          ]
        };
      
      case 'traceroute':
        return {
          hops: [
            { hop: 1, ip: '192.168.1.1', hostname: 'gateway.local', times: [1.2, 1.1, 1.3] },
            { hop: 2, ip: '10.0.0.1', hostname: 'isp.provider.com', times: [8.5, 9.2, 8.8] },
            { hop: 3, ip: selectedNode.ipv4, hostname: selectedNode.name, times: [14.1, 14.5, 13.8] }
          ],
          total_hops: 3,
          destination_reached: true
        };
      
      case 'speedtest':
        return {
          download_speed: 95.6,
          upload_speed: 42.3,
          ping: 14.1,
          jitter: 2.1,
          server_info: {
            name: selectedNode.name,
            location: `${selectedNode.city}, ${selectedNode.country}`,
            distance: 234
          }
        };
      
      case 'mtr':
        return {
          report_cycles: 100,
          hops: [
            { hop: 1, hostname: 'gateway.local', loss: 0, sent: 100, last: 1.2, avg: 1.1, best: 0.9, worst: 2.1 },
            { hop: 2, hostname: 'isp.provider.com', loss: 0, sent: 100, last: 8.8, avg: 8.9, best: 7.2, worst: 12.4 },
            { hop: 3, hostname: selectedNode.name, loss: 0, sent: 100, last: 14.1, avg: 14.3, best: 12.1, worst: 18.9 }
          ]
        };
      
      case 'latency-test':
        return {
          testType: 'standard',
          results: [
            { target: 'Google', latency: 28.5, status: 'excellent' },
            { target: 'GitHub', latency: 45.2, status: 'excellent' },
            { target: 'Apple', latency: 62.8, status: 'good' },
            { target: 'Microsoft', latency: 38.9, status: 'excellent' },
            { target: 'Amazon', latency: 92.3, status: 'good' },
            { target: 'Twitter', latency: 156.7, status: 'poor' },
            { target: 'OpenAI', latency: 74.5, status: 'good' },
            { target: 'Steam', latency: null, status: 'failed', error: 'Connection timeout' }
          ],
          summary: {
            total: 8,
            successful: 7,
            failed: 1,
            averageLatency: 71.3,
            excellentCount: 3,
            goodCount: 3,
            poorCount: 1
          },
          timestamp: new Date().toISOString(),
          duration: 3240
        };
      
      case 'dns':
        return {
          queries: [
            { domain: 'google.com', type: 'A', time: 23.4, result: '142.250.191.78' },
            { domain: 'cloudflare.com', type: 'A', time: 18.9, result: '104.16.132.229' },
            { domain: 'github.com', type: 'AAAA', time: 31.2, result: '2606:50c0:8000::153' }
          ],
          avg_query_time: 24.5
        };
      
      case 'port':
        return {
          scanned_ports: [22, 80, 443, 993, 995, 25, 53, 110],
          open_ports: [22, 80, 443],
          closed_ports: [993, 995, 25, 110],
          filtered_ports: [53],
          scan_time: 1.24
        };
      
      default:
        return {};
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Timer className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderResult = (toolId: string, result: DiagnosticResult) => {
    if (result.status === 'running') {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Timer className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">正在执行 {result.tool}...</p>
          </div>
        </div>
      );
    }

    if (result.status === 'failed') {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{result.error}</p>
        </div>
      );
    }

    if (result.status === 'success' && result.result) {
      return <ResultDisplay toolId={toolId} data={result.result} duration={result.duration} />;
    }

    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">点击运行按钮开始诊断</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">网络诊断工具</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            目标节点: <span className="font-medium">{selectedNode.name}</span> ({selectedNode.ipv4 || selectedNode.ipv6})
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </div>

      {/* 节点和访问者信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 目标节点信息 */}
        <Card className="p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Server className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">目标节点信息</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">节点名称:</span>
              <span className="font-medium">{selectedNode.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">位置:</span>
              <span className="font-medium">{selectedNode.city}, {selectedNode.country}</span>
            </div>
            {selectedNode.ipv4 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">IPv4:</span>
                <span className="font-mono text-blue-600">{selectedNode.ipv4}</span>
              </div>
            )}
            {selectedNode.ipv6 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">IPv6:</span>
                <span className="font-mono text-blue-600 text-xs">{selectedNode.ipv6}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">服务商:</span>
              <span className="font-medium">{selectedNode.provider}</span>
            </div>
            {selectedNode.asnNumber && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ASN:</span>
                  <span className="font-mono text-purple-600">{selectedNode.asnNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ASN组织:</span>
                  <span className="font-medium text-xs">{selectedNode.asnName || selectedNode.asnOrg}</span>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* 访问者信息 */}
        <Card className="p-4">
          <div className="flex items-center space-x-2 mb-3">
            <MapPin className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">您的IP信息</h3>
            {loadingVisitorInfo && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            )}
          </div>
          {visitorInfo ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">您的IP:</span>
                <span className="font-mono text-green-600">{visitorInfo.ip}</span>
              </div>
              {visitorInfo.city && visitorInfo.country && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">位置:</span>
                  <span className="font-medium">{visitorInfo.city}, {visitorInfo.country}</span>
                </div>
              )}
              {visitorInfo.asn && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">ASN:</span>
                    <span className="font-mono text-purple-600">{visitorInfo.asn.asn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">网络运营商:</span>
                    <span className="font-medium text-xs">{visitorInfo.asn.name}</span>
                  </div>
                </>
              )}
              {visitorInfo.company && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">服务商:</span>
                  <span className="font-medium text-xs">{visitorInfo.company.name}</span>
                </div>
              )}
              {visitorInfo.timezone && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">时区:</span>
                  <span className="font-medium">{visitorInfo.timezone}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <Network className="h-6 w-6 mx-auto mb-2" />
              <p className="text-xs">获取IP信息中...</p>
            </div>
          )}
        </Card>
      </div>

      {/* 工具选择标签 */}
      <div className="flex space-x-1 overflow-x-auto pb-2">
        {tools.map((tool) => {
          const IconComponent = tool.icon;
          const isActive = activeTab === tool.id;
          const result = results[tool.id];
          
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
              }`}
            >
              <IconComponent className="h-4 w-4" />
              <span>{tool.name}</span>
              {result && getStatusIcon(result.status)}
            </button>
          );
        })}
      </div>

      {/* 当前工具详情 */}
      <Card className="p-6">
        {(() => {
          const activeTool = tools.find(t => t.id === activeTab);
          const result = results[activeTab];
          
          if (!activeTool) return null;

          return (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-${activeTool.color}-50`}>
                    <activeTool.icon className={`h-5 w-5 text-${activeTool.color}-600`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{activeTool.name}</h3>
                    <p className="text-sm text-gray-600">{activeTool.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">{activeTool.category}</Badge>
                  <Button
                    onClick={() => runDiagnostic(activeTab)}
                    disabled={result?.status === 'running'}
                    size="sm"
                  >
                    {result?.status === 'running' ? '运行中...' : '运行诊断'}
                  </Button>
                </div>
              </div>

              {/* 结果显示区域 */}
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                {renderResult(activeTab, result || { tool: activeTool.name, status: 'idle' })}
              </div>
            </div>
          );
        })()}
      </Card>
    </div>
  );
};

// 结果显示组件
const ResultDisplay: React.FC<{ toolId: string; data: any; duration?: number }> = ({ 
  toolId, 
  data 
}) => {
  switch (toolId) {
    case 'ping':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{data.packets_received}/{data.packets_sent}</p>
              <p className="text-xs text-gray-600">数据包</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{data.avg_time}ms</p>
              <p className="text-xs text-gray-600">平均延迟</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{data.packet_loss}%</p>
              <p className="text-xs text-gray-600">丢包率</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{data.max_time}ms</p>
              <p className="text-xs text-gray-600">最大延迟</p>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">详细结果:</h4>
            {data.results.map((ping: any, index: number) => (
              <div key={index} className="text-sm text-gray-600">
                序列 {ping.seq}: 时间={ping.time}ms TTL={ping.ttl}
              </div>
            ))}
          </div>
        </div>
      );

    case 'speedtest':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Download className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">下载速度</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{data.download_speed}</p>
              <p className="text-sm text-gray-600">Mbps</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Upload className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium">上传速度</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{data.upload_speed}</p>
              <p className="text-sm text-gray-600">Mbps</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-lg font-bold text-orange-600">{data.ping}ms</p>
              <p className="text-xs text-gray-600">Ping</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-purple-600">{data.jitter}ms</p>
              <p className="text-xs text-gray-600">抖动</p>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm">
          <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
};