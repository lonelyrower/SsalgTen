export interface AgentConfig {
  id: string;
  name: string;
  location: {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  provider: string;
  masterUrl: string;
  apiKey: string;
  heartbeatInterval: number;
}

export interface DiagnosticRequest {
  id: string;
  tool: 'ping' | 'traceroute' | 'mtr' | 'speedtest' | 'iperf3';
  target: string;
  options?: {
    count?: number;
    maxHops?: number;
    serverId?: string;
    duration?: number;
  };
}

export interface DiagnosticResult {
  id: string;
  tool: string;
  target: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result: any;
  error?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  diskUsage: {
    total: number;
    used: number;
    free: number;
  };
  networkInterface: string;
  uptime: number;
}

export interface HeartbeatData {
  agentId: string;
  timestamp: Date;
  status: 'online';
  systemInfo: SystemInfo;
  version: string;
}