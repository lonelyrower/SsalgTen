import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-full)] border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-[var(--duration-fast)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-[hsl(var(--status-error-600))] text-white hover:bg-[hsl(var(--status-error-500))]",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-[hsl(var(--status-success-600))] text-white hover:bg-[hsl(var(--status-success-500))]",
        warning:
          "border-transparent bg-[hsl(var(--status-warning-500))] text-white hover:bg-[hsl(var(--status-warning-400))]",
        info:
          "border-transparent bg-[hsl(var(--status-info-500))] text-white hover:bg-[hsl(var(--status-info-400))]",
        // 柔和变体 - 浅背景深文字
        "success-soft":
          "border-[hsl(var(--status-success-200))] bg-[hsl(var(--status-success-100))] text-[hsl(var(--status-success-700))] dark:border-[hsl(var(--status-success-800))] dark:bg-[hsl(var(--status-success-900)/0.3)] dark:text-[hsl(var(--status-success-300))]",
        "warning-soft":
          "border-[hsl(var(--status-warning-200))] bg-[hsl(var(--status-warning-100))] text-[hsl(var(--status-warning-700))] dark:border-[hsl(var(--status-warning-800))] dark:bg-[hsl(var(--status-warning-900)/0.3)] dark:text-[hsl(var(--status-warning-300))]",
        "error-soft":
          "border-[hsl(var(--status-error-200))] bg-[hsl(var(--status-error-100))] text-[hsl(var(--status-error-700))] dark:border-[hsl(var(--status-error-800))] dark:bg-[hsl(var(--status-error-900)/0.3)] dark:text-[hsl(var(--status-error-300))]",
        "info-soft":
          "border-[hsl(var(--status-info-200))] bg-[hsl(var(--status-info-100))] text-[hsl(var(--status-info-700))] dark:border-[hsl(var(--status-info-800))] dark:bg-[hsl(var(--status-info-900)/0.3)] dark:text-[hsl(var(--status-info-300))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
