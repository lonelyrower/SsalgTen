import { List, Map as MapIcon, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiViewMode = "list" | "2d" | "3d";

interface Props {
  value: MultiViewMode;
  onChange: (v: MultiViewMode) => void;
  className?: string;
}

export function MultiViewToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-[var(--radius-xl)] border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))] bg-gray-100 dark:bg-gray-900 p-1",
        "shadow-[var(--shadow-sm)] dark:shadow-[var(--shadow-md)] overflow-hidden",
        className,
      )}
      role="tablist"
      aria-label="视图模式切换"
    >
      {/* sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-1/3 rounded-lg transition-all duration-200 ease-out",
          "bg-white dark:bg-gradient-to-br dark:from-gray-600 dark:to-gray-500 shadow-md dark:shadow-lg dark:shadow-cyan-500/20",
          value === "list"
            ? "left-1"
            : value === "2d"
              ? "left-[calc(33.333%+0.125rem)]"
              : "left-[calc(66.666%+0.25rem)]",
        )}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "relative z-10 w-24 md:w-28 px-3 py-2 text-sm font-medium rounded-lg",
          "flex items-center justify-center gap-2 transition-colors",
          value === "list"
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
        )}
      >
        <List
          className={cn("h-4 w-4", value === "list" ? "text-primary" : "")}
        />
        列表
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "2d"}
        onClick={() => onChange("2d")}
        className={cn(
          "relative z-10 w-24 md:w-28 px-3 py-2 text-sm font-medium rounded-lg",
          "flex items-center justify-center gap-2 transition-colors",
          value === "2d"
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
        )}
      >
        <MapIcon
          className={cn("h-4 w-4", value === "2d" ? "text-primary" : "")}
        />
        2D 地图
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "3d"}
        onClick={() => onChange("3d")}
        className={cn(
          "relative z-10 w-24 md:w-28 px-3 py-2 text-sm font-medium rounded-lg",
          "flex items-center justify-center gap-2 transition-colors",
          value === "3d"
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
        )}
      >
        <Globe
          className={cn("h-4 w-4", value === "3d" ? "text-primary" : "")}
        />
        3D 地球
      </button>
    </div>
  );
}
