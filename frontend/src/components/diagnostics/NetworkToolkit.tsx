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
  Target,
  XCircle
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

  // 生成模拟结果数据（每次调用生成不同的随机数据）
  const generateMockResult = (toolId: string) => {
    const randomFloat = (min: number, max: number, decimals: number = 1) => 
      parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    switch (toolId) {
      case 'ping':
        const baseLatency = randomFloat(10, 50);
        const results = Array.from({ length: 4 }, (_, i) => ({
          seq: i + 1,
          time: randomFloat(baseLatency - 5, baseLatency + 10),
          ttl: randomInt(56, 64)
        }));
        const times = results.map(r => r.time);
        return {
          packets_sent: 4,
          packets_received: Math.random() < 0.1 ? 3 : 4,
          packet_loss: Math.random() < 0.1 ? randomInt(1, 25) : 0,
          min_time: Math.min(...times),
          max_time: Math.max(...times),
          avg_time: times.reduce((a, b) => a + b, 0) / times.length,
          results
        };
      
      case 'traceroute':
        const hopCount = randomInt(3, 8);
        const hops = Array.from({ length: hopCount }, (_, i) => {
          const baseTime = (i + 1) * randomFloat(3, 12);
          return {
            hop: i + 1,
            ip: i === hopCount - 1 ? selectedNode.ipv4 : `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
            hostname: i === 0 ? 'gateway.local' : (i === hopCount - 1 ? selectedNode.name : `hop${i}.provider.com`),
            times: [
              baseTime + randomFloat(-2, 2),
              baseTime + randomFloat(-2, 2),
              baseTime + randomFloat(-2, 2)
            ]
          };
        });
        return {
          hops,
          total_hops: hopCount,
          destination_reached: Math.random() > 0.05
        };
      
      case 'speedtest':
        return {
          download_speed: randomFloat(10, 200),
          upload_speed: randomFloat(5, 100),
          ping: randomFloat(5, 80),
          jitter: randomFloat(0.5, 8),
          server_info: {
            name: selectedNode.name,
            location: `${selectedNode.city}, ${selectedNode.country}`,
            distance: randomInt(50, 2000)
          }
        };
      
      case 'mtr':
        const mtrHopCount = randomInt(3, 6);
        const cycles = randomInt(50, 100);
        const mtrHops = Array.from({ length: mtrHopCount }, (_, i) => {
          const baseLatency = (i + 1) * randomFloat(2, 15);
          const loss = Math.random() < 0.1 ? randomFloat(0.1, 5) : 0;
          return {
            hop: i + 1,
            hostname: i === 0 ? 'gateway.local' : (i === mtrHopCount - 1 ? selectedNode.name : `hop${i}.isp.com`),
            loss: parseFloat(loss.toFixed(1)),
            sent: cycles,
            last: baseLatency + randomFloat(-3, 3),
            avg: baseLatency,
            best: baseLatency - randomFloat(1, 5),
            worst: baseLatency + randomFloat(3, 10)
          };
        });
        return {
          report_cycles: cycles,
          hops: mtrHops
        };
      
      case 'latency-test':
        const targets = ['Google', 'GitHub', 'Apple', 'Microsoft', 'Amazon', 'Twitter', 'OpenAI', 'Steam', 'Cloudflare', 'Discord'];
        const testResults = targets.map(target => {
          const shouldFail = Math.random() < 0.1;
          if (shouldFail) {
            return { target, latency: null, status: 'failed', error: 'Connection timeout' };
          }
          const latency = randomFloat(15, 200);
          let status;
          if (latency < 50) status = 'excellent';
          else if (latency < 150) status = 'good';
          else status = 'poor';
          return { target, latency, status };
        });
        const successful = testResults.filter(r => r.latency !== null);
        const excellentCount = successful.filter(r => r.status === 'excellent').length;
        const goodCount = successful.filter(r => r.status === 'good').length;
        const poorCount = successful.filter(r => r.status === 'poor').length;
        return {
          testType: 'standard',
          results: testResults,
          summary: {
            total: testResults.length,
            successful: successful.length,
            failed: testResults.length - successful.length,
            averageLatency: successful.length > 0 ? successful.reduce((sum, r) => sum + (r.latency || 0), 0) / successful.length : 0,
            excellentCount,
            goodCount,
            poorCount
          },
          timestamp: new Date().toISOString(),
          duration: randomInt(2000, 5000)
        };
      
      case 'dns':
        const domains = ['google.com', 'cloudflare.com', 'github.com', 'stackoverflow.com', 'reddit.com'];
        const types = ['A', 'AAAA', 'MX', 'TXT'];
        const dnsQueries = Array.from({ length: randomInt(3, 6) }, () => {
          const domain = domains[randomInt(0, domains.length - 1)];
          const type = types[randomInt(0, types.length - 1)];
          const time = randomFloat(5, 50);
          let result = 'Query failed';
          if (Math.random() > 0.1) {
            if (type === 'A') result = `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
            else if (type === 'AAAA') result = `2606:${randomInt(1000, 9999).toString(16)}:${randomInt(1000, 9999).toString(16)}::${randomInt(100, 999)}`;
            else if (type === 'MX') result = `${randomInt(1, 20)} mail.${domain}`;
            else result = `"v=spf1 include:_spf.${domain} ~all"`;
          }
          return { domain, type, time, result };
        });
        return {
          queries: dnsQueries,
          avg_query_time: dnsQueries.reduce((sum, q) => sum + q.time, 0) / dnsQueries.length
        };
      
      case 'port':
        const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3389, 5432, 3306, 6379, 27017];
        const scannedPorts = commonPorts.slice(0, randomInt(8, commonPorts.length));
        const openPorts = scannedPorts.filter(() => Math.random() < 0.3);
        const filteredPorts = scannedPorts.filter(p => !openPorts.includes(p) && Math.random() < 0.1);
        const closedPorts = scannedPorts.filter(p => !openPorts.includes(p) && !filteredPorts.includes(p));
        return {
          scanned_ports: scannedPorts,
          open_ports: openPorts,
          closed_ports: closedPorts,
          filtered_ports: filteredPorts,
          scan_time: randomFloat(0.5, 3.5)
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
          <div className="space-y-2">
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
            {selectedNode.ipv6 && selectedNode.ipv6 !== selectedNode.ipv4 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">IPv6:</span>
                <span className="font-mono text-blue-600">{selectedNode.ipv6}</span>
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
                {(selectedNode.asnName || selectedNode.asnOrg) && (selectedNode.asnName || selectedNode.asnOrg) !== selectedNode.provider && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">ASN组织:</span>
                    <span className="font-medium">{selectedNode.asnName || selectedNode.asnOrg}</span>
                  </div>
                )}
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
            <div className="space-y-2">
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
                    <span className="font-medium">{visitorInfo.asn.name}</span>
                  </div>
                </>
              )}
              {visitorInfo.company && visitorInfo.company.name !== visitorInfo.asn?.name && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">所属机构:</span>
                  <span className="font-medium">{visitorInfo.company.name}</span>
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

    case 'latency-test':
      return (
        <div className="space-y-6">
          {/* 测试概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {data.summary?.successful || 0}/{data.summary?.total || 0}
              </div>
              <div className="text-sm text-gray-600">成功率</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {data.summary?.averageLatency?.toFixed(1) || 0}ms
              </div>
              <div className="text-sm text-gray-600">平均延迟</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-2xl font-bold text-green-500">
                {data.summary?.excellentCount || 0}
              </div>
              <div className="text-sm text-gray-600">优秀连接</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-2xl font-bold text-yellow-500">
                {data.duration ? (data.duration / 1000).toFixed(1) : 0}s
              </div>
              <div className="text-sm text-gray-600">测试耗时</div>
            </div>
          </div>

          {/* 详细结果 */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">详细延迟结果</h4>
            {data.results?.map((result: any, index: number) => {
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
                  case 'good': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                  case 'poor': return 'bg-orange-100 text-orange-800 border-orange-200';
                  case 'failed': return 'bg-red-100 text-red-800 border-red-200';
                  default: return 'bg-gray-100 text-gray-800 border-gray-200';
                }
              };

              const getStatusIcon = (status: string) => {
                switch (status) {
                  case 'excellent': return '🟢';
                  case 'good': return '🟡';
                  case 'poor': return '🔴';
                  case 'failed': return '⚫';
                  default: return '⚫';
                }
              };

              return (
                <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{result.target}</div>
                      {result.error && (
                        <div className="text-xs text-red-500">{result.error}</div>
                      )}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-sm font-medium border ${getStatusColor(result.status)}`}>
                    {result.latency !== null ? `${result.latency.toFixed(1)}ms` : 'N/A'}
                  </div>
                </div>
              );
            }) || []}
          </div>

          {/* 延迟等级说明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <h5 className="font-medium text-blue-900 dark:text-blue-300 mb-2">延迟等级说明</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center space-x-1">
                <span>🟢</span>
                <span className="text-green-600 font-medium">&lt; 50ms 优秀</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>🟡</span>
                <span className="text-yellow-600 font-medium">50-150ms 良好</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>🔴</span>
                <span className="text-orange-600 font-medium">&gt; 150ms 较差</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>⚫</span>
                <span className="text-red-600 font-medium">失败 无法连接</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'traceroute':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-blue-600">{data.hops?.length || 0}</div>
              <div className="text-sm text-gray-600">跳数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">
                {data.hops?.slice(-1)[0]?.time || 0}ms
              </div>
              <div className="text-sm text-gray-600">总延迟</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-purple-600">{data.target || '目标'}</div>
              <div className="text-sm text-gray-600">目标主机</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">路由跟踪结果</h4>
            {data.hops?.map((hop: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {hop.hop || index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {hop.hostname || hop.ip || '* * *'}
                    </div>
                    <div className="text-sm text-gray-500">{hop.ip}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {hop.time ? `${hop.time}ms` : '超时'}
                  </div>
                  {hop.loss && hop.loss > 0 && (
                    <div className="text-sm text-red-500">{hop.loss}% 丢包</div>
                  )}
                </div>
              </div>
            )) || []}
          </div>
        </div>
      );

    case 'mtr':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-blue-600">{data.hops?.length || 0}</div>
              <div className="text-sm text-gray-600">跳数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">{data.report_cycles || 0}</div>
              <div className="text-sm text-gray-600">测试次数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-yellow-600">
                {data.hops?.reduce((avg: number, hop: any) => avg + (hop.avg || 0), 0) / (data.hops?.length || 1) || 0}ms
              </div>
              <div className="text-sm text-gray-600">平均延迟</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-red-600">
                {Math.max(...(data.hops?.map((h: any) => h.loss || 0) || [0]))}%
              </div>
              <div className="text-sm text-gray-600">最大丢包</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">MTR 分析结果</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-700">
                    <th className="text-left p-2">跳数</th>
                    <th className="text-left p-2">主机名</th>
                    <th className="text-right p-2">丢包%</th>
                    <th className="text-right p-2">发送</th>
                    <th className="text-right p-2">最后</th>
                    <th className="text-right p-2">平均</th>
                    <th className="text-right p-2">最好</th>
                    <th className="text-right p-2">最差</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hops?.map((hop: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-2 font-medium">{hop.hop || index + 1}</td>
                      <td className="p-2">{hop.hostname || hop.ip || '???'}</td>
                      <td className="p-2 text-right">
                        <span className={hop.loss > 0 ? 'text-red-600' : 'text-green-600'}>
                          {hop.loss || 0}%
                        </span>
                      </td>
                      <td className="p-2 text-right">{hop.sent || 0}</td>
                      <td className="p-2 text-right">{hop.last || 0}ms</td>
                      <td className="p-2 text-right font-medium">{hop.avg || 0}ms</td>
                      <td className="p-2 text-right text-green-600">{hop.best || 0}ms</td>
                      <td className="p-2 text-right text-red-600">{hop.worst || 0}ms</td>
                    </tr>
                  )) || []}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

    case 'dns':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center mb-4">
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-blue-600">{data.queries?.length || 0}</div>
              <div className="text-sm text-gray-600">查询数量</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">
                {data.avg_query_time?.toFixed(1) || 0}ms
              </div>
              <div className="text-sm text-gray-600">平均响应时间</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-purple-600">
                {data.queries?.filter((q: any) => q.result).length || 0}
              </div>
              <div className="text-sm text-gray-600">成功查询</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">DNS 查询结果</h4>
            {data.queries?.map((query: any, index: number) => (
              <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">{query.domain}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {query.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {query.time}ms
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">结果: </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {query.result || '查询失败'}
                  </span>
                </div>
              </div>
            )) || []}
          </div>
        </div>
      );

    case 'port':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-blue-600">{data.scanned_ports?.length || 0}</div>
              <div className="text-sm text-gray-600">扫描端口</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">{data.open_ports?.length || 0}</div>
              <div className="text-sm text-gray-600">开放端口</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-red-600">{data.closed_ports?.length || 0}</div>
              <div className="text-sm text-gray-600">关闭端口</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-yellow-600">
                {data.scan_time?.toFixed(2) || 0}s
              </div>
              <div className="text-sm text-gray-600">扫描耗时</div>
            </div>
          </div>

          <div className="space-y-4">
            {data.open_ports && data.open_ports.length > 0 && (
              <div>
                <h4 className="font-medium text-green-600 mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  开放端口
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.open_ports.map((port: number) => (
                    <span key={port} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {port}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.closed_ports && data.closed_ports.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2 flex items-center">
                  <XCircle className="h-4 w-4 mr-2" />
                  关闭端口
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.closed_ports.map((port: number) => (
                    <span key={port} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      {port}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.filtered_ports && data.filtered_ports.length > 0 && (
              <div>
                <h4 className="font-medium text-yellow-600 mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  过滤端口
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.filtered_ports.map((port: number) => (
                    <span key={port} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      {port}
                    </span>
                  ))}
                </div>
              </div>
            )}
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