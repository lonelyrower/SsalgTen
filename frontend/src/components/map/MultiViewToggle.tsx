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
        "relative inline-flex items-center rounded-xl border border-border surface-base p-1",
        "shadow-sm overflow-hidden",
        className,
      )}
      role="tablist"
      aria-label="视图模式切换"
    >
      {/* sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-1/3 rounded-lg transition-all duration-200 ease-out",
          "surface-elevated shadow-md",
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
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
