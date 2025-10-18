import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CountryFlagSvg from '@/components/ui/CountryFlagSvg';
import { 
  Activity, 
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

// 判断IP是否为公网地址的辅助函数
const isPublicIP = (ip: string): boolean => {
  if (!ip) return false;
  
  // IPv4 公网地址判断
  if (ip.includes('.')) {
    return !ip.startsWith('192.168.') && 
           !ip.startsWith('10.') && 
           !ip.startsWith('172.16.') && 
           !ip.startsWith('172.17.') && 
           !ip.startsWith('172.18.') && 
           !ip.startsWith('172.19.') && 
           !ip.startsWith('172.2') && 
           !ip.startsWith('172.30.') && 
           !ip.startsWith('172.31.') && 
           !ip.startsWith('127.') && 
           !ip.startsWith('169.254.');
  }
  
  // IPv6 公网地址判断（简化版）
  if (ip.includes(':')) {
    return !ip.startsWith('::1') && 
           !ip.startsWith('fe80:') && 
           !ip.startsWith('fc00:') && 
           !ip.startsWith('fd00:');
  }
  
  return false;
};

interface NetworkToolkitProps {
  selectedNode: NodeData;
  onClose: () => void;
}

interface DiagnosticResult {
  tool: string;
  status: 'running' | 'success' | 'failed' | 'idle';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [customTarget, setCustomTarget] = useState<string>('');
  const [preferIPv6, setPreferIPv6] = useState<boolean>(false);
  // 默认通过主控后端代理执行诊断，更可靠（浏览器无需直连 Agent 端口）
  const [useProxy, setUseProxy] = useState<boolean>(true);
  const [pingCount, setPingCount] = useState<number>(4);
  const [trMaxHops, setTrMaxHops] = useState<number>(30);

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

  const tools = useMemo(() => [
    {
      id: 'ping',
      name: 'Ping 测试',
      description: '测试节点到您IP的连通性和延迟',
      icon: Activity,
      color: 'blue',
      category: '基础诊断'
    },
    {
      id: 'traceroute',
      name: 'Traceroute',
      description: '从节点追踪到您IP的网络路径',
      icon: Route,
      color: 'green',
      category: '路径分析'
    },
    {
      id: 'speedtest',
      name: '速度测试',
      description: '测试节点的网络上传和下载速度',
      icon: Zap,
      color: 'orange',
      category: '性能测试'
    },
    {
      id: 'mtr',
      name: 'MTR 分析',
      description: '到您IP的综合网络质量分析',
      icon: TrendingUp,
      color: 'purple',
      category: '综合分析'
    },
    {
      id: 'latency-test',
      name: '延迟测试',
      description: '测试节点到主要网站的网络延迟',
      icon: Target,
      color: 'cyan',
      category: '延迟分析'
    }
  ], []);

  // 获取最佳测试目标的辅助函数
  const getBestTestTarget = useCallback((prefer: boolean = false): string => {
    if (customTarget && customTarget.trim().length > 0) return customTarget.trim();
    if (visitorInfo?.ip && isPublicIP(visitorInfo.ip)) {
      return visitorInfo.ip;
    }
    // 回退到公共DNS
    return prefer ? '2001:4860:4860::8888' : '8.8.8.8';
  }, [customTarget, visitorInfo?.ip]);

  // 调用真实诊断工具
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
      const agentHost = selectedNode.ipv4 || selectedNode.ipv6 || 'localhost';
      // 如果是IPv6地址，需要用方括号包裹
      const formattedHost = agentHost.includes(':') ? `[${agentHost}]` : agentHost;
      const agentEndpoint = `http://${formattedHost}:3002`;
      const proxyBase = `/api/diagnostics/${encodeURIComponent(selectedNode.id)}`;
      
      // 根据工具类型调用相应的Agent API
      // 注意：这些测试是从目标节点执行的
      if (toolId === 'ping') {
        // 优先ping访问者IP，如果无法获取或是私网IP，则使用公共DNS
        const testTarget = getBestTestTarget(preferIPv6);
        if (useProxy) {
          result = await callAgentAPI(`${proxyBase}/ping?target=${encodeURIComponent(testTarget)}&count=${pingCount}`);
        } else {
          result = await callAgentAPI(`${agentEndpoint}/api/ping/${testTarget}?count=${pingCount}`);
        }
      } else if (toolId === 'traceroute') {
        // 跟踪到访问者IP的路由（如果可达）或Google DNS，IPv6优先使用IPv6 DNS
        const testTarget = getBestTestTarget(preferIPv6 || !!visitorInfo?.ip?.includes(':'));
        if (useProxy) {
          result = await callAgentAPI(`${proxyBase}/traceroute?target=${encodeURIComponent(testTarget)}&maxHops=${trMaxHops}`);
        } else {
          result = await callAgentAPI(`${agentEndpoint}/api/traceroute/${testTarget}?maxHops=${trMaxHops}`);
        }
      } else if (toolId === 'speedtest') {
        if (useProxy) {
          result = await callAgentAPI(`${proxyBase}/speedtest`, 180000);
        } else {
          result = await callAgentAPI(`${agentEndpoint}/api/speedtest`, 120000);
        }
      } else if (toolId === 'mtr') {
        // MTR测试到访问者IP（如果是公网）或Google DNS
        const testTarget = getBestTestTarget(preferIPv6);
        if (useProxy) {
          result = await callAgentAPI(`${proxyBase}/mtr?target=${encodeURIComponent(testTarget)}&count=10`, 120000);
        } else {
          result = await callAgentAPI(`${agentEndpoint}/api/mtr/${testTarget}?count=10`, 120000);
        }
      } else if (toolId === 'latency-test') {
        if (useProxy) {
          result = await callAgentAPI(`${proxyBase}/latency-test?testType=standard`);
        } else {
          result = await callAgentAPI(`${agentEndpoint}/api/latency-test?testType=standard`);
        }
      } else {
        throw new Error('不支持的诊断工具');
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
      const errorMessage = error instanceof Error ? error.message : '诊断执行失败';
      console.error(`诊断工具 ${toolId} 执行失败:`, error);
      setResults(prev => ({
        ...prev,
        [toolId]: {
          ...prev[toolId],
          status: 'failed',
          error: errorMessage,
          duration: Date.now() - (prev[toolId]?.startTime || Date.now())
        }
      }));
    }
  }, [getBestTestTarget, pingCount, preferIPv6, selectedNode.id, selectedNode.ipv4, selectedNode.ipv6, tools, trMaxHops, useProxy, visitorInfo?.ip]);

  // 调用Agent API的辅助函数
  const callAgentAPI = async (url: string, timeout: number = 60000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`[诊断] 调用 API: ${url}, 超时: ${timeout}ms`);

      // 尝试携带登录令牌（后端代理端点需要鉴权）
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (url.startsWith('/api/')) {
        try {
          const token = localStorage.getItem('ssalgten_auth_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('[诊断] 添加认证令牌');
          }
        } catch (e) {
          console.warn('[诊断] 获取令牌失败:', e);
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include', // 尽量携带会话信息
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`[诊断] HTTP 响应: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[诊断] HTTP 错误响应: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[诊断] 响应数据:', data);

      if (!data.success) {
        throw new Error(data.error || '诊断测试失败');
      }

      return data.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[诊断] 请求超时 (${timeout}ms): ${url}`);
        throw new Error(`请求超时 (${timeout / 1000}秒)`);
      }
      console.error(`[诊断] API 调用失败: ${url}`, error);
      throw error;
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Timer className="h-4 w-4 text-primary animate-spin" />;
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
            <Timer className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
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
            <Server className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-gray-900 dark:text-white">目标节点信息</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">节点名称:</span>
              <span className="font-medium">{selectedNode.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">位置:</span>
              <div className="flex items-center space-x-2">
                <CountryFlagSvg country={selectedNode.country} />
                <span className="font-medium">{selectedNode.city}, {selectedNode.country}</span>
              </div>
            </div>
            {selectedNode.ipv4 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">IPv4:</span>
                <span className="font-mono text-primary">{selectedNode.ipv4}</span>
              </div>
            )}
            {selectedNode.ipv6 && selectedNode.ipv6.includes(':') && selectedNode.ipv6 !== selectedNode.ipv4 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">IPv6:</span>
                <span className="font-mono text-primary">{selectedNode.ipv6}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">服务商:</span>
              <span className="font-medium" title="Agent配置的服务提供商名称（如DigitalOcean、阿里云等）">{selectedNode.provider}</span>
            </div>
            {selectedNode.asnNumber && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">ASN编号:</span>
                <span className="font-mono text-purple-600" title="自治系统编号，通过IP地址自动查询获得">{selectedNode.asnNumber}</span>
              </div>
            )}
          </div>
        </Card>

        {/* 访问者信息 */}
        {/* 测试目标信息 */}
        <Card className="bg-primary/10 shadow-lg border-primary/30 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-gray-900 dark:text-white">测试目标</h3>
          </div>
          <div className="text-sm bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Ping/MTR目标：</span>
              {visitorInfo?.ip && isPublicIP(visitorInfo.ip) ? (
                <span className="text-primary font-mono ml-1">{visitorInfo.ip} (您的IP)</span>
              ) : (
                <span className="text-orange-600 font-mono ml-1">8.8.8.8 (Google DNS)</span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {visitorInfo?.ip && isPublicIP(visitorInfo.ip) 
                ? '✅ 检测到您的公网IP，将直接测试节点到您的网络连接' 
                : '⚠️ 未检测到公网IP或您使用代理，将测试到公共DNS服务器'}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2 mb-3">
            <MapPin className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">您的IP信息</h3>
            {loadingVisitorInfo && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
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
                  <div className="flex items-center space-x-2">
                    <CountryFlagSvg country={visitorInfo.country} />
                    <span className="font-medium">{visitorInfo.city}, {visitorInfo.country}</span>
                  </div>
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

      {/* 目标选项 */}
      <div className="flex items-center space-x-3">
        <input
          value={customTarget}
          onChange={(e) => setCustomTarget(e.target.value)}
          placeholder="自定义目标（留空使用您的IP或公共DNS）"
          className="px-3 py-2 border rounded-md flex-1 dark:bg-gray-700 dark:border-gray-600"
        />
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={preferIPv6} onChange={(e) => setPreferIPv6(e.target.checked)} />
          <span>优先IPv6</span>
        </label>
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
          <span>通过主控代理</span>
        </label>
      </div>

      {/* 参数选项（按工具类型动态显示） */}
      <div className="flex items-center space-x-4 text-sm">
        {activeTab === 'ping' && (
          <label className="flex items-center space-x-2">
            <span>包数</span>
            <input type="number" min={1} max={10} value={pingCount} onChange={(e) => setPingCount(parseInt(e.target.value || '4', 10))} className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </label>
        )}
        {activeTab === 'traceroute' && (
          <label className="flex items-center space-x-2">
            <span>最大跳数</span>
            <input type="number" min={5} max={64} value={trMaxHops} onChange={(e) => setTrMaxHops(parseInt(e.target.value || '30', 10))} className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </label>
        )}
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              <p className="text-2xl font-bold text-green-600">{data.alive ? '在线' : '离线'}</p>
              <p className="text-xs text-gray-600">状态</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{data.avg > 0 ? `${data.avg.toFixed(1)}ms` : 'N/A'}</p>
              <p className="text-xs text-gray-600">平均延迟</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{data.packetLoss}%</p>
              <p className="text-xs text-gray-600">丢包率</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{data.max > 0 ? `${data.max.toFixed(1)}ms` : 'N/A'}</p>
              <p className="text-xs text-gray-600">最大延迟</p>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">测试详情:</h4>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
              <p><span className="font-medium">目标:</span> {data.host}</p>
              <p><span className="font-medium">最小延迟:</span> {data.min > 0 ? `${data.min.toFixed(1)}ms` : 'N/A'}</p>
              <p><span className="font-medium">最大延迟:</span> {data.max > 0 ? `${data.max.toFixed(1)}ms` : 'N/A'}</p>
              <p><span className="font-medium">平均延迟:</span> {data.avg > 0 ? `${data.avg.toFixed(1)}ms` : 'N/A'}</p>
            </div>
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
              <p className="text-3xl font-bold text-green-600">{data.download?.toFixed(1) || '0.0'}</p>
              <p className="text-sm text-gray-600">Mbps</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Upload className="h-5 w-5 text-primary mr-2" />
                <span className="text-sm font-medium">上传速度</span>
              </div>
              <p className="text-3xl font-bold text-primary">{data.upload?.toFixed(1) || '0.0'}</p>
              <p className="text-sm text-gray-600">Mbps</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-lg font-bold text-orange-600">{data.ping?.toFixed(1) || 'N/A'}ms</p>
              <p className="text-xs text-gray-600">延迟</p>
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <p><span className="font-medium">测试服务器:</span> {data.server || 'Unknown'}</p>
            <p><span className="font-medium">服务器位置:</span> {data.location || 'Unknown'}</p>
            <p><span className="font-medium">测试时间:</span> {data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown'}</p>
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/30">
            <h5 className="font-medium text-primary mb-2">延迟等级说明</h5>
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
              <div className="text-xl font-bold text-primary">{data.totalHops || data.hops?.length || 0}</div>
              <div className="text-sm text-gray-600">跳数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">
                {data.hops?.slice(-1)[0]?.rtt1 ? `${data.hops.slice(-1)[0].rtt1}ms` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">最后一跳延迟</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-purple-600">{data.target || '目标'}</div>
              <div className="text-sm text-gray-600">目标主机</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">路由跟踪结果</h4>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                    <div className="text-sm text-gray-500">{hop.ip !== hop.hostname ? hop.ip : ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {hop.rtt1 ? `${hop.rtt1}ms` : hop.rtt2 ? `${hop.rtt2}ms` : hop.rtt3 ? `${hop.rtt3}ms` : '超时'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[hop.rtt1, hop.rtt2, hop.rtt3].filter(Boolean).map(rtt => `${rtt}ms`).join(' / ') || ''}
                  </div>
                </div>
              </div>
            )) || []}
          </div>
        </div>
      );

    case 'mtr': {
      const isWindowsType = data.type === 'windows-combined' || data.type === 'linux-fallback';
      const avgLatency = isWindowsType ? data.summary?.avgLatency : data.result?.report?.mtr?.avg || 0;
      const packetLoss = isWindowsType ? data.summary?.packetLoss : 0;
      const totalHops = isWindowsType ? data.summary?.totalHops : data.result?.report?.mtr?.hubs?.length || 0;
      
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-primary">{totalHops}</div>
              <div className="text-sm text-gray-600">跳数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-green-600">{data.cycles || 10}</div>
              <div className="text-sm text-gray-600">测试次数</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-yellow-600">
                {avgLatency?.toFixed(1) || '0.0'}ms
              </div>
              <div className="text-sm text-gray-600">平均延迟</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
              <div className="text-xl font-bold text-red-600">
                {packetLoss?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-gray-600">丢包率</div>
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <p><span className="font-medium">测试类型:</span> {data.type || 'Unknown'}</p>
            <p><span className="font-medium">目标:</span> {data.target}</p>
            <p><span className="font-medium">测试周期:</span> {data.cycles}</p>
          </div>

          {isWindowsType && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Ping 统计</h5>
                  <p className="text-sm">平均延迟: {data.ping?.avg?.toFixed(1) || 'N/A'}ms</p>
                  <p className="text-sm">丢包率: {data.ping?.packetLoss || 0}%</p>
                  <p className="text-sm">最小/最大: {data.ping?.min?.toFixed(1) || 'N/A'}ms / {data.ping?.max?.toFixed(1) || 'N/A'}ms</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h5 className="font-medium text-green-900 dark:text-green-300 mb-2">路由统计</h5>
                  <p className="text-sm">总跳数: {data.traceroute?.totalHops || 0}</p>
                  <p className="text-sm">路由可达: {data.traceroute?.hops?.length > 0 ? '是' : '否'}</p>
                </div>
              </div>
            </div>
          )}

          {data.result?.report?.mtr?.hubs && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">MTR 详细结果</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-2">跳数</th>
                      <th className="text-left p-2">主机</th>
                      <th className="text-right p-2">丢包%</th>
                      <th className="text-right p-2">平均</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.result.report.mtr.hubs.map((hub: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-2 font-medium">{hub.count || index + 1}</td>
                        <td className="p-2">{hub.host || 'Unknown'}</td>
                        <td className="p-2 text-right">
                          <span className={(hub.Loss || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                            {(hub.Loss || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-right font-medium">{(hub.Avg || 0).toFixed(1)}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

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
