/**
 * 流媒体检测相关的公共类型与常量
 */

// 支持的流媒体服务
export type StreamingService =
  | "tiktok"
  | "disney_plus"
  | "netflix"
  | "youtube"
  | "amazon_prime"
  | "spotify"
  | "chatgpt";

// 流媒体检测状态
export type StreamingStatus =
  | "yes" // 完全解锁
  | "no" // 屏蔽
  | "org" // 仅自制内容 (Netflix)
  | "noprem" // 禁会员 (YouTube Premium)
  | "pending" // 待支持 (Disney+)
  | "cn" // 中国区 (YouTube)
  | "app" // 仅 APP (ChatGPT iOS)
  | "web" // 仅网页 (ChatGPT Web)
  | "idc" // 机房 IP (TikTok)
  | "failed" // 检测失败
  | "unknown"; // 未测试

// 解锁类型：与 IPQuality 的输出保持一致
export type UnlockType = "native" | "dns" | "unknown";

// 单个流媒体检测结果
export interface StreamingServiceResult {
  service: StreamingService;
  name: string;
  icon: string;
  status: StreamingStatus;
  region?: string;
  unlockType?: UnlockType;
  lastTested?: string;
}

// 节点下的全部流媒体检测数据
export interface NodeStreamingData {
  nodeId: string;
  services: StreamingServiceResult[];
  lastScanned: string;
}

// 状态与颜色映射
export const STATUS_TEXT: Record<StreamingStatus, string> = {
  yes: "解锁",
  no: "屏蔽",
  org: "仅自制",
  noprem: "禁会员",
  pending: "待支持",
  cn: "中国",
  app: "仅APP",
  web: "仅网页",
  idc: "机房",
  failed: "失败",
  unknown: "未知",
};

export const STATUS_COLORS: Record<StreamingStatus, string> = {
  yes: "text-emerald-600 dark:text-emerald-400",
  no: "text-rose-600 dark:text-rose-400",
  org: "text-amber-600 dark:text-amber-400",
  noprem: "text-rose-600 dark:text-rose-400",
  pending: "text-amber-600 dark:text-amber-400",
  cn: "text-rose-600 dark:text-rose-400",
  app: "text-amber-600 dark:text-amber-400",
  web: "text-amber-600 dark:text-amber-400",
  idc: "text-amber-600 dark:text-amber-400",
  failed: "text-gray-600 dark:text-gray-400",
  unknown: "text-gray-600 dark:text-gray-400",
};

// 解锁类型标签与颜色
export const UNLOCK_TYPE_LABELS: Record<UnlockType, string> = {
  native: "原生",
  dns: "DNS",
  unknown: "未知",
};

export const UNLOCK_TYPE_COLORS: Record<UnlockType, string> = {
  native: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  dns: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
};

// 流媒体服务展示配置
export const STREAMING_SERVICES: Record<
  StreamingService,
  { name: string; icon: string }
> = {
  tiktok: { name: "TikTok", icon: "🎵" },
  disney_plus: { name: "Disney+", icon: "🪄" },
  netflix: { name: "Netflix", icon: "🎬" },
  youtube: { name: "YouTube", icon: "▶️" },
  amazon_prime: { name: "Amazon Prime Video", icon: "📦" },
  spotify: { name: "Spotify", icon: "🎧" },
  chatgpt: { name: "ChatGPT", icon: "🤖" },
};

export const STREAMING_SERVICE_ORDER: StreamingService[] = [
  "tiktok",
  "disney_plus",
  "netflix",
  "youtube",
  "amazon_prime",
  "spotify",
  "chatgpt",
];

// 各平台支持的状态（保持与 IPQuality 一致的标签与色彩）
export const PLATFORM_SUPPORTED_STATUSES: Record<
  StreamingService,
  Array<{ status: StreamingStatus; label: string; color: string }>
> = {
  netflix: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "org", label: STATUS_TEXT.org, color: STATUS_COLORS.org },
    { status: "no", label: STATUS_TEXT.no, color: STATUS_COLORS.no },
  ],
  youtube: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "cn", label: STATUS_TEXT.cn, color: STATUS_COLORS.cn },
    { status: "noprem", label: STATUS_TEXT.noprem, color: STATUS_COLORS.noprem },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
  disney_plus: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "pending", label: STATUS_TEXT.pending, color: STATUS_COLORS.pending },
    { status: "no", label: STATUS_TEXT.no, color: STATUS_COLORS.no },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
  tiktok: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "idc", label: STATUS_TEXT.idc, color: STATUS_COLORS.idc },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
  amazon_prime: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "no", label: STATUS_TEXT.no, color: STATUS_COLORS.no },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
  spotify: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "no", label: STATUS_TEXT.no, color: STATUS_COLORS.no },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
  chatgpt: [
    { status: "yes", label: STATUS_TEXT.yes, color: STATUS_COLORS.yes },
    { status: "app", label: STATUS_TEXT.app, color: STATUS_COLORS.app },
    { status: "web", label: STATUS_TEXT.web, color: STATUS_COLORS.web },
    { status: "no", label: STATUS_TEXT.no, color: STATUS_COLORS.no },
    { status: "failed", label: STATUS_TEXT.failed, color: STATUS_COLORS.failed },
  ],
};

// 流媒体平台统计
export interface StreamingPlatformStats {
  service: StreamingService;
  name: string;
  icon: string;
  unlocked: number; // 解锁节点数 (yes)
  originalOnly: number; // 仅自制节点数 (org)
  pending: number; // 待支持节点数 (pending)
  restricted: number; // 屏蔽节点数 (no)
  noPremium: number; // 禁会员节点数 (noprem)
  china: number; // 中国区节点数 (cn)
  appOnly: number; // 仅 APP 节点数 (app)
  webOnly: number; // 仅网页节点数 (web)
  idc: number; // 机房节点数 (idc)
  failed: number; // 检测失败节点数
  unknown: number; // 未测试节点数
  total: number; // 节点总数
  unlockRate: number; // 解锁率 (0-100)
}

// 根据状态获取统计数量
export function getStatusCount(
  platform: StreamingPlatformStats,
  status: StreamingStatus
): number {
  switch (status) {
    case "yes":
      return platform.unlocked;
    case "org":
      return platform.originalOnly;
    case "pending":
      return platform.pending;
    case "no":
      return platform.restricted;
    case "noprem":
      return platform.noPremium;
    case "cn":
      return platform.china;
    case "app":
      return platform.appOnly;
    case "web":
      return platform.webOnly;
    case "idc":
      return platform.idc;
    case "failed":
      return platform.failed;
    case "unknown":
      return platform.unknown;
    default:
      return 0;
  }
}

// 流媒体概览
export interface StreamingOverview {
  totalNodes: number;
  lastScanTime: string;
  expiredNodes: number;
  platformStats: StreamingPlatformStats[];
  globalUnlockRate: number;
}

// 节点流媒体摘要（列表视图使用）
export interface NodeStreamingSummary {
  nodeId: string;
  nodeName: string;
  country: string;
  city?: string;
  services: StreamingServiceResult[];
  lastScanned: string;
  isExpired: boolean;
  unlockedCount: number;
  restrictedCount: number;
}

// 流媒体筛选条件
export interface StreamingFilters {
  platform?: StreamingService;
  status?: StreamingStatus;
  country?: string;
  region?: string;
  keyword?: string;
  showExpired?: boolean;
}

// 流媒体时间范围
export type StreamingTimeRange = "latest" | "last7days";

// 数据过期阈值（24 小时）
export const STREAMING_DATA_EXPIRY_THRESHOLD = 24 * 60 * 60 * 1000;

// 批量操作
export type StreamingBulkAction = "retest" | "export" | "ignore";

// 导出格式
export type StreamingExportFormat = "json" | "csv" | "markdown";

