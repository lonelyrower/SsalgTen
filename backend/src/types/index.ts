export interface Node {
  id: string;
  name: string;
  location: {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  provider: string;
  ipv4?: string;
  ipv6?: string;
  status: 'online' | 'offline' | 'unknown';
  lastHeartbeat?: Date;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagnosticResult {
  id: string;
  nodeId: string;
  tool: 'ping' | 'traceroute' | 'mtr' | 'speedtest' | 'iperf3';
  target: string;
  result: any;
  status: 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AgentHeartbeat {
  nodeId: string;
  status: 'online' | 'offline';
  timestamp: Date;
  systemInfo?: {
    platform: string;
    arch: string;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}