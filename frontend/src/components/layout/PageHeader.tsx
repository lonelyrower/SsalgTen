import type { FC, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export interface PageHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle under the title */
  description?: string;
  /** Optional leading icon */
  icon?: LucideIcon;
  /** Optional action area rendered on the right */
  actions?: ReactNode;
  /** Additional class names applied to the outer card */
  className?: string;
  /** Optional extended content rendered below title row */
  children?: ReactNode;
}

export const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  className = "",
  children,
}) => {
  return (
    <GlassCard
      variant="tech"
      className={`mb-6 ${className}`}
      glow={false}
      animated={false}
    >
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-2.5 rounded-[var(--radius-lg)] bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30">
                <Icon className="h-6 w-6 text-cyan-400" strokeWidth={2.5} />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 flex-wrap">{actions}</div>
          )}
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </GlassCard>
  );
};
