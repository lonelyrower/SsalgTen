// no default React import needed with react-jsx runtime
import { Map as MapIcon, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "2d" | "3d";

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}

// Segmented toggle with sliding indicator for 2D/3D
export function ViewModeToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-[var(--radius-xl)] border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))] bg-gray-100 dark:bg-gray-800/90 p-1",
        "shadow-[var(--shadow-sm)] overflow-hidden",
        className,
      )}
      role="tablist"
      aria-label="地图视图切换"
    >
      {/* sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-1/2 rounded-[var(--radius-lg)] transition-all duration-[var(--duration-normal)] ease-out",
          "bg-white dark:bg-gray-600 shadow-[var(--shadow-md)] dark:shadow-gray-900/50",
          value === "2d" ? "left-1" : "left-1/2",
        )}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "2d"}
        onClick={() => onChange("2d")}
        className={cn(
          "relative z-10 w-28 md:w-32 px-3 py-2 text-sm font-medium rounded-[var(--radius-lg)]",
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
          "relative z-10 w-28 md:w-32 px-3 py-2 text-sm font-medium rounded-[var(--radius-lg)]",
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
