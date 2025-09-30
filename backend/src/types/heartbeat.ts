// Heartbeat related TypeScript interfaces
// These mirror the JSON fields stored in Prisma HeartbeatLog (see schema.prisma)

export interface CPUDetail {
  model?: string;
  cores?: number;
  threads?: number;
  frequency?: number;
  usage?: number;
  temperature?: number;
  architecture?: string;
  [key: string]: unknown; // forward-compatible
}

export interface MemoryDetail {
  total?: number;
  used?: number;
  free?: number;
  available?: number;
  usage?: number;
  type?: string;
  speed?: number;
  [key: string]: unknown;
}

export interface DiskDetail {
  total?: number;
  used?: number;
  free?: number;
  usage?: number;
  type?: string;
  model?: string;
  health?: string;
  temperature?: number;
  [key: string]: unknown;
}

export interface NetworkInterfaceDetail {
  interface: string;
  bytesReceived?: number;
  bytesSent?: number;
  packetsReceived?: number;
  packetsSent?: number;
  speed?: number;
  duplex?: string;
  // Computed rates based on previous heartbeat (bps)
  rxBps?: number;
  txBps?: number;
  [key: string]: unknown;
}

export interface ProcessInfoDetail {
  total?: number;
  running?: number;
  sleeping?: number;
  zombie?: number;
  [key: string]: unknown;
}

export interface VirtualizationDetail {
  type?: string;
  provider?: string;
  [key: string]: unknown;
}

export interface ServicesDetail {
  docker?: boolean;
  nginx?: boolean;
  apache?: boolean;
  mysql?: boolean;
  postgresql?: boolean;
  redis?: boolean;
  [key: string]: unknown;
}

export interface HeartbeatDetail {
  timestamp: Date;
  status: string;
  uptime?: number | null;
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  diskUsage?: number | null;
  connectivity?: unknown;
  cpuInfo?: CPUDetail | null;
  memoryInfo?: MemoryDetail | null;
  diskInfo?: DiskDetail | null;
  networkInfo?: NetworkInterfaceDetail[] | null;
  processInfo?: ProcessInfoDetail | null;
  virtualization?: VirtualizationDetail | null;
  services?: ServicesDetail | null;
  loadAverage?: number[] | null;
}

export interface RecordHeartbeatInput {
  status: string;
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  connectivity?: unknown;
  systemInfo?: {
    cpu?: CPUDetail;
    memory?: MemoryDetail;
    disk?: DiskDetail;
    network?: NetworkInterfaceDetail[];
    processes?: ProcessInfoDetail;
    virtualization?: VirtualizationDetail;
    services?: ServicesDetail;
    loadAverage?: number[];
  };
}
