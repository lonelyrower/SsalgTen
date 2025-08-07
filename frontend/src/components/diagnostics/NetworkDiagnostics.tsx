import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Loader2, 
  Network, 
  Activity, 
  Gauge,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import type { NodeData } from '@/services/api';

interface DiagnosticResult {
  success: boolean;
  data?: any;
  error?: string;
  agent?: {
    id: string;
    name: string;
    location: string;
  };
  timestamp?: string;
}

interface NetworkDiagnosticsProps {
  node: NodeData;
  onClose?: () => void;
}

type DiagnosticType = 'ping' | 'traceroute' | 'mtr' | 'speedtest' | 'connectivity';

interface DiagnosticTest {
  type: DiagnosticType;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresTarget: boolean;
  estimatedTime: string;
}

export const NetworkDiagnostics = ({ node, onClose }: NetworkDiagnosticsProps) => {
  const [results, setResults] = useState<Record<DiagnosticType, DiagnosticResult | null>>({
    ping: null,
    traceroute: null,
    mtr: null,
    speedtest: null,
    connectivity: null
  });
  const [target, setTarget] = useState('google.com');
  const [loading, setLoading] = useState<Record<DiagnosticType, boolean>>({
    ping: false,
    traceroute: false,
    mtr: false,
    speedtest: false,
    connectivity: false
  });

  const diagnosticTests: DiagnosticTest[] = [
    {
      type: 'ping',
      name: 'Ping Test',
      description: 'Test basic connectivity and latency to a target',
      icon: <Activity className="h-4 w-4" />,
      requiresTarget: true,
      estimatedTime: '5s'
    },
    {
      type: 'traceroute',
      name: 'Traceroute',
      description: 'Trace the network path to a destination',
      icon: <Network className="h-4 w-4" />,
      requiresTarget: true,
      estimatedTime: '30s'
    },
    {
      type: 'mtr',
      name: 'MTR Test',
      description: 'Combined ping and traceroute analysis',
      icon: <Gauge className="h-4 w-4" />,
      requiresTarget: true,
      estimatedTime: '60s'
    },
    {
      type: 'speedtest',
      name: 'Speed Test',
      description: 'Test download and upload bandwidth',
      icon: <Zap className="h-4 w-4" />,
      requiresTarget: false,
      estimatedTime: '30s'
    },
    {
      type: 'connectivity',
      name: 'Connectivity',
      description: 'Test general internet connectivity',
      icon: <CheckCircle className="h-4 w-4" />,
      requiresTarget: false,
      estimatedTime: '10s'
    }
  ];

  const runDiagnostic = async (type: DiagnosticType) => {
    setLoading(prev => ({ ...prev, [type]: true }));

    try {
      // 构建Agent URL - 假设Agent运行在端口3002
      const agentUrl = `http://localhost:3002`;
      let endpoint = '';

      switch (type) {
        case 'ping':
        case 'traceroute':
        case 'mtr':
          endpoint = `/api/${type}/${encodeURIComponent(target)}`;
          break;
        case 'speedtest':
        case 'connectivity':
          endpoint = `/api/${type}`;
          break;
      }

      const response = await fetch(`${agentUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: DiagnosticResult = await response.json();
      
      setResults(prev => ({
        ...prev,
        [type]: result
      }));

    } catch (error) {
      const errorResult: DiagnosticResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };

      setResults(prev => ({
        ...prev,
        [type]: errorResult
      }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const formatResult = (type: DiagnosticType, result: DiagnosticResult) => {
    if (!result.success) {
      return (
        <div className="text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center space-x-1 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Error</span>
          </div>
          <p>{result.error}</p>
        </div>
      );
    }

    switch (type) {
      case 'ping':
        const pingData = result.data;
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Target:</span>
              <span className="font-mono">{pingData.host}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <Badge variant={pingData.alive ? "default" : "destructive"}>
                {pingData.alive ? "Online" : "Offline"}
              </Badge>
            </div>
            {pingData.alive && (
              <>
                <div className="flex justify-between">
                  <span>Average:</span>
                  <span className="font-mono">{pingData.avg}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Min/Max:</span>
                  <span className="font-mono">{pingData.min}/{pingData.max}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Packet Loss:</span>
                  <span className="font-mono">{pingData.packetLoss}%</span>
                </div>
              </>
            )}
          </div>
        );

      case 'traceroute':
        const traceData = result.data;
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Target:</span>
              <span className="font-mono">{traceData.target}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Hops:</span>
              <span className="font-mono">{traceData.totalHops}</span>
            </div>
            <div className="mt-2">
              <h4 className="font-medium mb-1">Route:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {traceData.hops?.slice(0, 5).map((hop: any, index: number) => (
                  <div key={index} className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-1 rounded">
                    {hop.hop}: {hop.ip} ({hop.rtt1 || 'timeout'}ms)
                  </div>
                ))}
                {traceData.hops?.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ...and {traceData.hops.length - 5} more hops
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'speedtest':
        const speedData = result.data;
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Download:</span>
              <span className="font-mono font-bold text-green-600">
                {speedData.download} Mbps
              </span>
            </div>
            <div className="flex justify-between">
              <span>Upload:</span>
              <span className="font-mono font-bold text-blue-600">
                {speedData.upload} Mbps
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ping:</span>
              <span className="font-mono">{speedData.ping}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Server:</span>
              <span className="text-xs">{speedData.server}</span>
            </div>
          </div>
        );

      case 'connectivity':
        const connData = result.data;
        return (
          <div className="space-y-2 text-sm">
            <h4 className="font-medium">Connectivity Test Results:</h4>
            {Object.entries(connData.connectivity || {}).map(([target, status]) => (
              <div key={target} className="flex justify-between">
                <span>{target}:</span>
                <Badge variant={status ? "default" : "destructive"}>
                  {status ? "OK" : "Failed"}
                </Badge>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="text-sm">
            <pre className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Network Diagnostics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {node.name} • {node.city}, {node.country}
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Target Input */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Test Target</h3>
        <div className="flex space-x-2">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Enter hostname or IP address"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Used for ping, traceroute, and MTR tests
        </p>
      </Card>

      {/* Diagnostic Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {diagnosticTests.map((test) => (
          <Card key={test.type} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {test.icon}
                <h3 className="font-medium">{test.name}</h3>
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{test.estimatedTime}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {test.description}
            </p>

            {/* Run Button */}
            <div className="space-y-3">
              <Button
                onClick={() => runDiagnostic(test.type)}
                disabled={loading[test.type] || (test.requiresTarget && !target.trim())}
                className="w-full"
                variant={results[test.type]?.success ? "default" : "outline"}
              >
                {loading[test.type] ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>

              {/* Results */}
              {results[test.type] && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Result</span>
                    {results[test.type]?.timestamp && (
                      <span className="text-xs text-gray-500">
                        {new Date(results[test.type]!.timestamp!).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {formatResult(test.type, results[test.type]!)}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};