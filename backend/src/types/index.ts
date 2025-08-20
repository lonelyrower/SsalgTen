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
  // ASN信息
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  asnRoute?: string;
  asnType?: string;
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

export interface VisitorInfo {
  ip: string;
  userAgent: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  company?: string;
  endpoint?: string;
  method?: string;
  referer?: string;
  nodeId?: string;
}

export interface ASNInfo {
  asn: string;
  name: string;
  org: string;
  route: string;
  type: string;
}

export interface IPGeolocation {
  ip: string;
  hostname?: string;
  city: string;
  region: string;
  country: string;
  loc: string; // "latitude,longitude"
  postal?: string;
  timezone: string;
  asn: ASNInfo;
  company?: {
    name: string;
    domain?: string;
    type?: string;
  };
}