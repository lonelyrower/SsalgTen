import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AdminTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AdminTabsProps {
  tabs: AdminTab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function AdminTabs({ tabs, value, onChange, className }: AdminTabsProps) {
  const activeIndex = tabs.findIndex((tab) => tab.id === value);
  const tabWidth = 100 / tabs.length;
  const leftPosition = activeIndex * tabWidth;

  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-[var(--radius-xl)] border-2 border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))]",
        "bg-white/80 dark:bg-gray-800/80 backdrop-blur-[var(--blur-sm)] p-1.5",
        "shadow-[var(--shadow-lg)] dark:shadow-[var(--shadow-xl)] overflow-hidden",
        className,
      )}
      role="tablist"
      aria-label="管理页面标签"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-1.5 bottom-1.5 rounded-[var(--radius-lg)] transition-all duration-[var(--duration-normal)] ease-out",
          "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-[var(--shadow-md)]",
        )}
        style={{
          width: `calc(${tabWidth}% - 0.375rem)`,
          left: `calc(${leftPosition}% + 0.1875rem)`,
        }}
        aria-hidden
      />

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = value === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative z-10 flex-1 px-4 py-2.5 text-sm font-semibold rounded-[var(--radius-lg)]",
              "flex items-center justify-center gap-2 transition-colors duration-[var(--duration-fast)]",
              "min-w-[100px] sm:min-w-[120px]",
              isActive
                ? "text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-white" : "")} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
