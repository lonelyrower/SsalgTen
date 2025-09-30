export interface CpuInfo {
  model: string;
  cores: number;
  threads: number;
  frequency: number;
  usage: number;
  temperature?: number;
  architecture: string;
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  available: number;
  usage: number;
  type?: string;
  speed?: number;
}

export interface DiskInfo {
  total: number;
  used: number;
  free: number;
  usage: number;
  type?: string;
  model?: string;
  health?: string;
  temperature?: number;
}

export interface NetworkInterfaceInfo {
  interface: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  speed?: number;
  duplex?: string;
  rxBps?: number;
  txBps?: number;
}

export interface ProcessInfo {
  total: number;
  running: number;
  sleeping: number;
  zombie: number;
}

export interface VirtualizationInfo {
  type: string;
  provider?: string;
}

export interface ServiceStatusMap {
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
  [key: string]: boolean | undefined;
}

export interface SystemInfo {
  cpu?: CpuInfo;
  memory?: MemoryInfo;
  disk?: DiskInfo;
  network?: NetworkInterfaceInfo[];
  processes?: ProcessInfo;
  virtualization?: VirtualizationInfo;
  services?: ServiceStatusMap;
  loadAverage?: number[];
}

export interface HeartbeatData {
  uptime?: number;
  cpuInfo?: CpuInfo;
  memoryInfo?: MemoryInfo;
  diskInfo?: DiskInfo;
  networkInfo?: NetworkInterfaceInfo[];
  processInfo?: ProcessInfo;
  virtualization?: VirtualizationInfo;
  services?: ServiceStatusMap;
  loadAverage?: number[];
}
