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
  "org",
  "failed",
  "unknown",
];

const unlockTypeOrder: Array<keyof typeof UNLOCK_TYPE_LABELS> = [
  "native",
  "dns",
  "idc",
  "unknown",
];

export const StreamingStatusLegend: React.FC = () => {
  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 md:grid-cols-2 lg:grid-cols-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          解锁状态说明
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
          解锁方式说明
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
          颜色含义提示
        </h3>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          绿色代表完全解锁，黄色表示地区受限或仅解锁自制内容，红色表示封锁或检测失败。解锁方式区分为原生 IP、DNS 解锁以及机房 IP，便于快速识别节点能力。
        </p>
      </div>
    </div>
  );
};
