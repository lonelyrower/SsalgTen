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
  tlsInsecure: boolean;
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

export interface CPUInfo {
  model: string;
  cores: number;
  threads: number;
  frequency: number; // MHz
  architecture: string;
  usage: number; // 百分比
  temperature?: number; // 摄氏度
}

export interface MemoryInfo {
  total: number; // MB
  used: number;  // MB
  free: number;  // MB
  available: number; // MB
  usage: number; // 百分比
  type?: string; // DDR4, DDR5, etc.
  speed?: number; // MHz
}

export interface DiskInfo {
  total: number; // GB
  used: number;  // GB  
  free: number;  // GB
  usage: number; // 百分比
  type?: string; // SSD, HDD, NVMe
  model?: string;
  health?: string;
  temperature?: number;
}

export interface NetworkStats {
  interface: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  speed?: number; // Mbps
  duplex?: string;
}

export interface ProcessInfo {
  total: number;
  running: number;
  sleeping: number;
  zombie: number;
}

export interface SystemInfo {
  // 基本系统信息
  platform: string;
  arch: string;
  hostname: string;
  version: string;
  uptime: number;
  nodeVersion: string;
  
  // CPU信息
  cpu: CPUInfo;
  cpuUsage: number; // 兼容性保留
  cpuCount: number; // 兼容性保留
  
  // 内存信息
  memory: MemoryInfo;
  memoryUsage: number; // 兼容性保留
  
  // 磁盘信息
  disk: DiskInfo;
  diskUsage: number; // 兼容性保留
  
  // 网络信息
  network: NetworkStats[];
  networkInterface: string; // 兼容性保留
  
  // 系统负载和进程
  loadAverage: number[];
  processes: ProcessInfo;
  
  // 虚拟化信息
  virtualization?: {
    type: string; // KVM, VMware, Docker, etc.
    provider?: string; // AWS, GCP, Azure, etc.
  };
  
  // 系统服务状态
  services?: {
    docker?: boolean;
    nginx?: boolean;
    apache?: boolean;
    mysql?: boolean;
    postgresql?: boolean;
    redis?: boolean;
    // 扩展常见服务
    caddy?: boolean;
    xray?: boolean;
    singbox?: boolean;
    openvpn?: boolean;
    wireguard?: boolean;
    tailscale?: boolean;
    frps?: boolean;
    frpc?: boolean;
  };

  // 安全监控数据
  security?: {
    ssh?: {
      enabled: boolean;
      alerts: Array<{
        ip: string;
        count: number;
        windowMinutes: number;
      }>;
    };
    processes?: {
      enabled: boolean;
      totalProcesses: number;
      suspiciousProcesses: Array<any>;
      summary: {
        highCpu: number;
        highMemory: number;
        suspiciousPath: number;
        hidden: number;
        miners: number;
      };
    };
    network?: any;
    files?: any;
  };
}

export interface HeartbeatData {
  agentId?: string;
  timestamp?: Date;
  status: string;
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  connectivity?: any;
  systemInfo?: {
    cpu?: CPUInfo;
    memory?: MemoryInfo;
    disk?: DiskInfo;
    network?: NetworkStats[];
    processes?: ProcessInfo;
    virtualization?: {
      type: string;
      provider?: string;
    };
    services?: {
      docker?: boolean;
      nginx?: boolean;
      apache?: boolean;
      mysql?: boolean;
      postgresql?: boolean;
      redis?: boolean;
      caddy?: boolean;
      xray?: boolean;
      singbox?: boolean;
      openvpn?: boolean;
      wireguard?: boolean;
      tailscale?: boolean;
      frps?: boolean;
      frpc?: boolean;
    };
    loadAverage?: number[];
  };
  security?: {
    ssh?: {
      alerts?: Array<{
        ip: string;
        count: number;
        windowMinutes: number;
      }>;
    };
  };
  version?: string;
}

// 服务检测相关类型
export type ServiceType = 'PROXY' | 'WEB' | 'DATABASE' | 'CONTAINER' | 'OTHER';
export type ServiceStatus = 'RUNNING' | 'STOPPED' | 'UNKNOWN';

export interface DetectedService {
  serviceType: ServiceType;
  serviceName: string;
  version?: string;
  status: ServiceStatus;
  port?: number;
  protocol?: string;
  configPath?: string;
  configHash?: string;
  domains?: string[];
  sslEnabled?: boolean;
  containerInfo?: {
    id?: string;
    image?: string;
    state?: string;
    [key: string]: any;
  };
  details?: Record<string, any>;
}

export interface ServiceReportPayload {
  nodeId: string;
  services: DetectedService[];
  scannedAt: string;
}
