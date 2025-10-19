/**
 * 服务总览相关类型定义
 */

// 服务类型
export type ServiceType =
  | 'web'        // Web 服务
  | 'api'        // API 服务
  | 'database'   // 数据库
  | 'cache'      // 缓存服务
  | 'proxy'      // 代理服务
  | 'monitor'    // 监控服务
  | 'storage'    // 存储服务
  | 'message'    // 消息队列
  | 'docker'     // Docker 容器
  | 'other';     // 其他

// 服务状态
export type ServiceStatus =
  | 'running'    // 运行中
  | 'stopped'    // 已停止
  | 'failed'     // 失败
  | 'unknown'    // 未知
  | 'expired';   // 数据过期

// 部署方式
export type DeploymentType =
  | 'docker'     // Docker 容器
  | 'systemd'    // systemd 服务
  | 'pm2'        // PM2 进程管理
  | 'manual'     // 手动部署
  | 'k8s'        // Kubernetes
  | 'other';     // 其他

// 服务访问方式
export interface ServiceAccess {
  domain?: string;         // 域名
  port?: number;           // 端口
  protocol?: string;       // 协议 (http, https, tcp, etc.)
  path?: string;           // 路径
  containerName?: string;  // 容器名称
}

// 服务资源占用
export interface ServiceResources {
  cpuPercent?: number;     // CPU 占用百分比
  memoryMB?: number;       // 内存占用 (MB)
  diskMB?: number;         // 磁盘占用 (MB)
}

// 单个服务信息
export interface NodeService {
  id: string;                    // 服务唯一ID
  nodeId: string;                // 所属节点ID
  nodeName?: string;             // 节点名称 (用于显示)
  name: string;                  // 服务名称
  type: ServiceType;             // 服务类型
  status: ServiceStatus;         // 服务状态
  deploymentType: DeploymentType; // 部署方式
  access?: ServiceAccess;        // 访问方式
  resources?: ServiceResources;  // 资源占用
  tags?: string[];               // 标签
  priority?: number;             // 优先级 (1-5)
  notes?: string;                // 备注
  version?: string;              // 版本号
  lastUpdated: string;           // 最后更新时间 (ISO)
  createdAt?: string;            // 创建时间 (ISO)
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
  lastReported: string;          // 最后上报时间
  isExpired: boolean;            // 是否过期 (超过2天)
}

// 服务总览统计
export interface ServicesOverviewStats {
  totalNodes: number;
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  failedServices: number;
  expiredNodes: number;          // 数据过期的节点数
  servicesByType: Record<ServiceType, number>;
  lastUpdated: string;
}

// 服务筛选条件
export interface ServiceFilters {
  nodeId?: string;
  serviceType?: ServiceType;
  status?: ServiceStatus;
  deploymentType?: DeploymentType;
  tags?: string[];
  keyword?: string;              // 关键字搜索 (名称/域名/端口)
  priority?: number;
  showExpired?: boolean;         // 是否显示过期数据
}

// 服务视图模式
export type ServiceViewMode = 'list' | 'node';  // 列表视图 | 节点分组视图

// 服务类型配置
export const SERVICE_TYPE_CONFIG: Record<ServiceType, { name: string; icon: string; color: string }> = {
  web: { name: 'Web 服务', icon: '🌐', color: 'blue' },
  api: { name: 'API 服务', icon: '🔌', color: 'purple' },
  database: { name: '数据库', icon: '💾', color: 'green' },
  cache: { name: '缓存服务', icon: '⚡', color: 'yellow' },
  proxy: { name: '代理服务', icon: '🔀', color: 'cyan' },
  monitor: { name: '监控服务', icon: '📊', color: 'orange' },
  storage: { name: '存储服务', icon: '📦', color: 'indigo' },
  message: { name: '消息队列', icon: '📨', color: 'pink' },
  docker: { name: 'Docker 容器', icon: '🐳', color: 'teal' },
  other: { name: '其他', icon: '⚙️', color: 'gray' },
};

// 服务状态配置
export const SERVICE_STATUS_CONFIG: Record<ServiceStatus, { name: string; color: string; className: string }> = {
  running: {
    name: '运行中',
    color: 'green',
    className: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
  },
  stopped: {
    name: '已停止',
    color: 'gray',
    className: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30'
  },
  failed: {
    name: '失败',
    color: 'red',
    className: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
  },
  unknown: {
    name: '未知',
    color: 'gray',
    className: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30'
  },
  expired: {
    name: '数据过期',
    color: 'yellow',
    className: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
  },
};

// 部署方式配置
export const DEPLOYMENT_TYPE_CONFIG: Record<DeploymentType, { name: string; icon: string }> = {
  docker: { name: 'Docker', icon: '🐳' },
  systemd: { name: 'systemd', icon: '⚙️' },
  pm2: { name: 'PM2', icon: '📦' },
  manual: { name: '手动部署', icon: '🔧' },
  k8s: { name: 'Kubernetes', icon: '☸️' },
  other: { name: '其他', icon: '❓' },
};

// 数据过期阈值 (毫秒)
export const SERVICE_DATA_EXPIRY_THRESHOLD = 2 * 24 * 60 * 60 * 1000; // 2天

// 快速筛选模板
export interface QuickFilterTemplate {
  id: string;
  name: string;
  filters: ServiceFilters;
}

export const QUICK_FILTER_TEMPLATES: QuickFilterTemplate[] = [
  {
    id: 'all',
    name: '全部服务',
    filters: {},
  },
  {
    id: 'web-services',
    name: '仅 Web 服务',
    filters: { serviceType: 'web' },
  },
  {
    id: 'running-only',
    name: '仅运行中',
    filters: { status: 'running' },
  },
  {
    id: 'failed-services',
    name: '失败服务',
    filters: { status: 'failed' },
  },
  {
    id: 'docker-services',
    name: 'Docker 服务',
    filters: { deploymentType: 'docker' },
  },
];
