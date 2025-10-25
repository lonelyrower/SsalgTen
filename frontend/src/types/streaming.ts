/**
 * 流媒体解锁相关类型定义
 */

// 流媒体服务类型
export type StreamingService =
  | "tiktok"
  | "disney_plus"
  | "netflix"
  | "youtube"
  | "amazon_prime"
  | "spotify"
  | "chatgpt";

// 解锁状态
export type StreamingStatus =
  | "yes" // 完全解锁
  | "no" // 屏蔽
  | "org" // 仅自制内容 (Netflix)
  | "noprem" // 禁会员 (YouTube Premium)
  | "pending" // 待支持 (Disney+)
  | "cn" // 中国地区 (YouTube)
  | "failed" // 检测失败
  | "unknown"; // 未知/未测试

// 解锁类型（仅在解锁状态时显示）
export type UnlockType =
  | "native" // 原生IP
  | "dns" // DNS解锁
  | "unknown"; // 未知

// 单个流媒体服务的检测结果
export interface StreamingServiceResult {
  service: StreamingService;
  name: string; // 显示名称
  icon: string; // 图标 emoji
  status: StreamingStatus;
  region?: string; // 解锁区域，如 "US", "JP"
  unlockType?: UnlockType;
  lastTested?: string; // ISO 时间戳
}

// 节点的所有流媒体检测结果
export interface NodeStreamingData {
  nodeId: string;
  services: StreamingServiceResult[];
  lastScanned: string; // ISO 时间戳
}

// 流媒体服务配置（icon 字段用于卡片等非图标组件的 emoji 显示）
export const STREAMING_SERVICES: Record<
  StreamingService,
  { name: string; icon: string }
> = {
  tiktok: { name: "TikTok", icon: "🎵" },
  disney_plus: { name: "Disney+", icon: "✨" },
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

// 每个流媒体平台支持的状态类型
export const PLATFORM_SUPPORTED_STATUSES: Record<
  StreamingService,
  Array<{ status: StreamingStatus; label: string; color: string }>
> = {
  netflix: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "org", label: "仅自制", color: "text-amber-600 dark:text-amber-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  youtube: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "cn", label: "中国", color: "text-orange-600 dark:text-orange-400" },
    { status: "noprem", label: "禁会员", color: "text-rose-600 dark:text-rose-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  disney_plus: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "pending", label: "待支持", color: "text-amber-600 dark:text-amber-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  tiktok: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  amazon_prime: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  spotify: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
  chatgpt: [
    { status: "yes", label: "解锁", color: "text-emerald-600 dark:text-emerald-400" },
    { status: "no", label: "屏蔽", color: "text-rose-600 dark:text-rose-400" },
    { status: "failed", label: "失败", color: "text-gray-600 dark:text-gray-400" },
  ],
};

// 状态颜色映射
export const STATUS_COLORS: Record<StreamingStatus, string> = {
  yes: "text-green-600 dark:text-green-400",
  no: "text-red-600 dark:text-red-400",
  org: "text-yellow-600 dark:text-yellow-400",
  noprem: "text-red-600 dark:text-red-400",
  pending: "text-yellow-600 dark:text-yellow-400",
  cn: "text-orange-600 dark:text-orange-400",
  failed: "text-gray-600 dark:text-gray-400",
  unknown: "text-gray-600 dark:text-gray-400",
};

// 状态显示文本
export const STATUS_TEXT: Record<StreamingStatus, string> = {
  yes: "解锁",
  no: "屏蔽",
  org: "仅自制",
  noprem: "禁会员",
  pending: "待支持",
  cn: "中国",
  failed: "检测失败",
  unknown: "未测试",
};

// 解锁类型显示（仅在解锁状态时显示）
export const UNLOCK_TYPE_LABELS: Record<UnlockType, string> = {
  native: "原生",
  dns: "DNS",
  unknown: "未知",
};

export const UNLOCK_TYPE_COLORS: Record<UnlockType, string> = {
  native: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  dns: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
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
  china: number; // 中国地区节点数 (cn - YouTube only)
  failed: number; // 检测失败节点数
  unknown: number; // 未测试节点数
  total: number; // 总节点数
  unlockRate: number; // 解锁率 (0-100)
}

// 辅助函数：根据状态类型获取对应的计数
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
    case "failed":
      return platform.failed;
    case "unknown":
      return platform.unknown;
    default:
      return 0;
  }
}

// 流媒体解锁总览
export interface StreamingOverview {
  totalNodes: number;
  lastScanTime: string; // 最新检测时间
  expiredNodes: number; // 超过24小时未检测的节点数
  platformStats: StreamingPlatformStats[];
  globalUnlockRate: number; // 全局解锁率
}

// 节点流媒体摘要 (用于列表展示)
export interface NodeStreamingSummary {
  nodeId: string;
  nodeName: string;
  country: string;
  city?: string;
  services: StreamingServiceResult[];
  lastScanned: string;
  isExpired: boolean; // 是否超过24小时
  unlockedCount: number; // 解锁服务数量
  restrictedCount: number; // 受限服务数量
}

// 流媒体筛选条件
export interface StreamingFilters {
  platform?: StreamingService;
  status?: StreamingStatus;
  country?: string;
  region?: string;
  keyword?: string; // 节点名称搜索
  showExpired?: boolean; // 显示过期数据
}

// 流媒体时间范围
export type StreamingTimeRange = "latest" | "last7days";

// 数据过期阈值 (24小时)
export const STREAMING_DATA_EXPIRY_THRESHOLD = 24 * 60 * 60 * 1000;

// 批量操作类型
export type StreamingBulkAction = "retest" | "export" | "ignore";

// 导出格式
export type StreamingExportFormat = "json" | "csv" | "markdown";
