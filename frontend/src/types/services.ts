/**
 * 服务总览相关类型定义
 */

// 服务类型
export type ServiceType =
  | "proxy" // ��������
  | "web" // Web ����
  | "database" // ���ݿ�
  | "container" // ����
  | "other"; // ����

// 服务状�?
export type ServiceStatus =
  | "running" // 运行�?
  | "stopped" // 已停�?
  | "failed" // 失败
  | "unknown" // 未知
  | "expired"; // 数据过期

// 部署方式
export type DeploymentType =
  | "docker" // Docker 容器
  | "systemd" // systemd 服务
  | "pm2" // PM2 进程管理
  | "manual" // 手动部署
  | "k8s" // Kubernetes
  | "unknown" // δ��ʽ
  | "other"; // 其他

// 服务访问方式
export interface ServiceAccess {
  domain?: string; // 域名
  port?: number; // 端口
  protocol?: string; // 协议 (http, https, tcp, etc.)
  path?: string; // 路径
  containerName?: string; // 容器名称
}

// 服务资源占用
export interface ServiceResources {
  cpuPercent?: number; // CPU 占用百分�?
  memoryMB?: number; // 内存占用 (MB)
  diskMB?: number; // 磁盘占用 (MB)
}

// 单个服务信息
export interface NodeService {
  id: string; // 服务唯一ID
  nodeId: string; // 所属节点ID
  nodeName?: string; // 节点名称 (用于显示)
  nodeCountry?: string; // 节点国家代码
  nodeCity?: string; // 节点城市
  nodeIp?: string; // 节点IP地址 (优先IPv4)
  name: string; // 服务名称
  type: ServiceType; // 服务类型
  status: ServiceStatus; // 服务状�?
  deploymentType: DeploymentType; // 部署方式
  access?: ServiceAccess; // 访问方式
  resources?: ServiceResources; // 资源占用
  tags?: string[]; // 标签
  priority?: number; // 优先�?(1-5)
  notes?: string; // 备注
  version?: string; // 版本�?
  lastUpdated: string; // 最后更新时�?(ISO)
  createdAt?: string; // 创建时间 (ISO)
  // 后端返回的额外字段
  port?: number; // 端口
  protocol?: string; // 协议
  domains?: string[]; // 域名列表
  sslEnabled?: boolean; // 是否启用SSL
  configPath?: string; // 配置文件路径
  containerInfo?: Record<string, unknown>; // 容器信息
  details?: Record<string, unknown>; // 详细信息
}

// 节点服务概览
export interface NodeServicesOverview {
  nodeId: string;
  nodeName: string;
  nodeCountry?: string;
  nodeCity?: string;
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  failedServices: number;
  services: NodeService[];
  lastReported: string; // 最后上报时�?
  isExpired: boolean; // 是否过期 (超过2�?
}

// 服务总览统计
export interface ServicesOverviewStats {
  totalNodes: number;
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  failedServices: number;
  expiredNodes: number; // 数据过期的节点数
  servicesByType: Record<ServiceType, number>;
  lastUpdated: string;
}

// 服务筛选条�?
export interface ServiceFilters {
  nodeId?: string;
  serviceType?: ServiceType;
  status?: ServiceStatus;
  deploymentType?: DeploymentType;
  tags?: string[];
  keyword?: string; // 关键字搜�?(名称/域名/端口)
  priority?: number;
  showExpired?: boolean; // 是否显示过期数据
}

// 服务视图模式
export type ServiceViewMode = "list" | "node"; // 列表视图 | 节点分组视图

// 服务类型配置
export const SERVICE_TYPE_CONFIG: Record<
  ServiceType,
  { name: string; icon: string; color: string }
> = {
  proxy: { name: "Proxy", icon: "PRX", color: "cyan" },
  web: { name: "Web", icon: "WEB", color: "blue" },
  database: { name: "Database", icon: "DB", color: "green" },
  container: { name: "Container", icon: "CTR", color: "teal" },
  other: { name: "Other", icon: "OTH", color: "gray" },
};

export const SERVICE_STATUS_CONFIG: Record<
  ServiceStatus,
  { name: string; color: string; className: string }
> = {
  running: {
    name: "Running",
    color: "success",
    className:
      "text-[hsl(var(--status-success-600))] dark:text-[hsl(var(--status-success-400))] bg-[hsl(var(--status-success-100))] dark:bg-[hsl(var(--status-success-900)/0.3)]",
  },
  stopped: {
    name: "Stopped",
    color: "gray",
    className:
      "text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]",
  },
  failed: {
    name: "Error",
    color: "warning",
    className:
      "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))] bg-[hsl(var(--status-warning-100))] dark:bg-[hsl(var(--status-warning-900)/0.3)]",
  },
  unknown: {
    name: "Unknown",
    color: "warning",
    className:
      "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))] bg-[hsl(var(--status-warning-100))] dark:bg-[hsl(var(--status-warning-900)/0.3)]",
  },
  expired: {
    name: "Expired",
    color: "warning",
    className:
      "text-[hsl(var(--status-warning-600))] dark:text-[hsl(var(--status-warning-400))] bg-[hsl(var(--status-warning-100))] dark:bg-[hsl(var(--status-warning-900)/0.3)]",
  },
};

export const DEPLOYMENT_TYPE_CONFIG: Record<
  DeploymentType,
  { name: string; icon: string }
> = {
  docker: { name: "Docker", icon: "DCK" },
  systemd: { name: "systemd", icon: "SYS" },
  pm2: { name: "PM2", icon: "PM2" },
  manual: { name: "Manual", icon: "MAN" },
  k8s: { name: "Kubernetes", icon: "K8S" },
  unknown: { name: "Unknown", icon: "UNK" },
  other: { name: "Other", icon: "OTH" },
};
export const SERVICE_DATA_EXPIRY_THRESHOLD = 2 * 24 * 60 * 60 * 1000; // 2??

// 快速筛选模�?
export interface QuickFilterTemplate {
  id: string;
  name: string;
  filters: ServiceFilters;
}

export const QUICK_FILTER_TEMPLATES: QuickFilterTemplate[] = [
  {
    id: "all",
    name: "All Services",
    filters: {},
  },
  {
    id: "web-services",
    name: "Web Services",
    filters: { serviceType: "web" },
  },
  {
    id: "running-only",
    name: "Running",
    filters: { status: "running" },
  },
  {
    id: "failed-services",
    name: "Unknown / Error",
    filters: { status: "unknown" },
  },
  {
    id: "docker-services",
    name: "Docker Deployments",
    filters: { deploymentType: "docker" },
  },
];




