/**
 * 流媒体解锁相关类型定义
 */

// 流媒体服务类型
export type StreamingService =
  | 'tiktok'
  | 'disney_plus'
  | 'netflix'
  | 'youtube'
  | 'amazon_prime'
  | 'spotify'
  | 'chatgpt';

// 解锁状态
export type StreamingStatus =
  | 'yes'       // 完全解锁
  | 'no'        // 封锁
  | 'org'       // 仅自制剧 (Netflix Only)
  | 'pending'   // 待支持
  | 'failed'    // 检测失败
  | 'unknown';  // 未知/未测试

// 解锁类型
export type UnlockType =
  | 'native'    // 原生IP
  | 'dns'       // DNS解锁
  | 'idc'       // 机房IP
  | 'unknown';  // 未知

// 单个流媒体服务的检测结果
export interface StreamingServiceResult {
  service: StreamingService;
  name: string;           // 显示名称
  icon: string;           // 图标 emoji
  status: StreamingStatus;
  region?: string;        // 解锁区域，如 "US", "JP"
  unlockType?: UnlockType;
  lastTested?: string;    // ISO 时间戳
}

// 节点的所有流媒体检测结果
export interface NodeStreamingData {
  nodeId: string;
  services: StreamingServiceResult[];
  lastScanned: string;    // ISO 时间戳
}

// 流媒体服务配置
export const STREAMING_SERVICES: Record<StreamingService, { name: string; icon: string }> = {
  tiktok: { name: 'TikTok', icon: '🎭' },
  disney_plus: { name: 'Disney+', icon: '🎵' },
  netflix: { name: 'Netflix', icon: '🎬' },
  youtube: { name: 'YouTube', icon: '📺' },
  amazon_prime: { name: 'AmazonPV', icon: '📦' },
  spotify: { name: 'Spotify', icon: '🎶' },
  chatgpt: { name: 'ChatGPT', icon: '🤖' },
};

export const STREAMING_SERVICE_ORDER: StreamingService[] = [
  'tiktok',
  'disney_plus',
  'netflix',
  'youtube',
  'amazon_prime',
  'spotify',
  'chatgpt',
];

// 状态颜色映射
export const STATUS_COLORS: Record<StreamingStatus, string> = {
  yes: 'text-green-600 dark:text-green-400',
  no: 'text-red-600 dark:text-red-400',
  org: 'text-yellow-600 dark:text-yellow-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
  failed: 'text-gray-600 dark:text-gray-400',
  unknown: 'text-gray-600 dark:text-gray-400',
};

// 状态显示文本
export const STATUS_TEXT: Record<StreamingStatus, string> = {
  yes: '完全解锁',
  no: '区域限制',
  org: '仅自制剧',
  pending: '待支持',
  failed: '检测失败',
  unknown: '未测试',
};
