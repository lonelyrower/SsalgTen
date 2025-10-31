import React from "react";
import {
  STATUS_TEXT,
  STATUS_COLORS,
  UNLOCK_TYPE_LABELS,
  UNLOCK_TYPE_COLORS,
} from "@/types/streaming";

const statusOrder: Array<keyof typeof STATUS_TEXT> = [
  "yes",
  "no",
  "failed",
  "pending",
  "cn",
  "noprem",
  "org",
  "web",
  "app",
  "idc",
  "unknown",
];

const unlockTypeOrder: Array<keyof typeof UNLOCK_TYPE_LABELS> = [
  "native",
  "dns",
  "unknown",
];

export const StreamingStatusLegend: React.FC = () => {
  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 md:grid-cols-2 lg:grid-cols-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          流媒体状态说明
        </h3>
        <div className="flex flex-wrap gap-2">
          {statusOrder.map((status) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {STATUS_TEXT[status]}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          解锁类型说明
        </h3>
        <div className="flex flex-wrap gap-2">
          {unlockTypeOrder.map((type) => (
            <span
              key={type}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${UNLOCK_TYPE_COLORS[type]}`}
            >
              {UNLOCK_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 lg:col-span-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          颜色与含义
        </h3>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          绿色代表完全解锁，红色代表受限或需要会员，琥珀色用于仅自制/仅网页/仅 APP/机房等特殊状态，灰色表示检测失败或未测试。解锁类型与
          IPQuality 保持一致，指示是原生 IP 还是经 DNS 解锁。
        </p>
      </div>
    </div>
  );
};

