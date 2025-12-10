import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "orange";
  hover?: boolean;
}

export function GlassCard({
  children,
  className,
  variant = "default",
  hover = true,
}: GlassCardProps) {
  const variantStyles = {
    default: {
      border: "border-[hsl(var(--border-subtle))]",
      bg: "from-[hsl(var(--card))] via-[hsl(var(--muted))]/50 to-[hsl(var(--card))]",
      glow: "from-[hsl(var(--muted-foreground))]/10 via-transparent to-[hsl(var(--muted-foreground))]/10",
      glowCircle: "bg-[hsl(var(--muted-foreground))]/15",
    },
    success: {
      border: "border-[hsl(var(--status-success-200))]/60 dark:border-[hsl(var(--status-success-700))]/60",
      bg: "from-[hsl(var(--status-success-50))] via-[hsl(var(--card))] to-[hsl(var(--status-success-100))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--status-success-900))]/60 dark:to-[hsl(var(--status-success-900))]/60",
      glow: "from-[hsl(var(--status-success-400))]/15 via-transparent to-[hsl(var(--status-success-500))]/15",
      glowCircle: "bg-[hsl(var(--status-success-400))]/20",
    },
    warning: {
      border: "border-[hsl(var(--status-warning-200))]/60 dark:border-[hsl(var(--status-warning-700))]/60",
      bg: "from-[hsl(var(--status-warning-50))] via-[hsl(var(--card))] to-[hsl(var(--status-warning-100))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--status-warning-900))]/60 dark:to-[hsl(var(--status-warning-900))]/60",
      glow: "from-[hsl(var(--status-warning-400))]/15 via-transparent to-[hsl(var(--status-warning-500))]/15",
      glowCircle: "bg-[hsl(var(--status-warning-400))]/20",
    },
    danger: {
      border: "border-[hsl(var(--status-error-200))]/60 dark:border-[hsl(var(--status-error-700))]/60",
      bg: "from-[hsl(var(--status-error-50))] via-[hsl(var(--card))] to-[hsl(var(--status-error-100))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--status-error-900))]/60 dark:to-[hsl(var(--status-error-900))]/60",
      glow: "from-[hsl(var(--status-error-400))]/15 via-transparent to-[hsl(var(--status-error-500))]/15",
      glowCircle: "bg-[hsl(var(--status-error-400))]/20",
    },
    info: {
      border: "border-[hsl(var(--secondary))]/60 dark:border-[hsl(var(--secondary))]/60",
      bg: "from-[hsl(var(--secondary))]/10 via-[hsl(var(--card))] to-[hsl(var(--status-info-50))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--secondary))]/30 dark:to-[hsl(var(--status-info-900))]/60",
      glow: "from-[hsl(var(--secondary))]/15 via-transparent to-[hsl(var(--status-info-500))]/15",
      glowCircle: "bg-[hsl(var(--secondary))]/20",
    },
    purple: {
      border: "border-purple-200/60 dark:border-purple-700/60",
      bg: "from-purple-50 via-[hsl(var(--card))] to-violet-50 dark:from-[hsl(var(--card))] dark:via-purple-950/60 dark:to-violet-950/60",
      glow: "from-purple-400/15 via-transparent to-violet-500/15",
      glowCircle: "bg-purple-400/20",
    },
    orange: {
      border: "border-[hsl(var(--status-warning-300))]/60 dark:border-[hsl(var(--status-warning-600))]/60",
      bg: "from-[hsl(var(--status-warning-50))] via-[hsl(var(--card))] to-[hsl(var(--status-warning-100))] dark:from-[hsl(var(--card))] dark:via-[hsl(var(--status-warning-900))]/60 dark:to-[hsl(var(--status-warning-800))]/60",
      glow: "from-[hsl(var(--status-warning-400))]/15 via-transparent to-[hsl(var(--status-warning-500))]/15",
      glowCircle: "bg-[hsl(var(--status-warning-400))]/20",
    },
  };

  const colors = variantStyles[variant];
  const hoverClasses = hover ? "group hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)]" : "";

  return (
    <motion.div
      className={cn(
        "relative rounded-[var(--radius-2xl)] border-2 p-6 overflow-hidden",
        "bg-gradient-to-br shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)]",
        colors.border,
        colors.bg,
        hoverClasses,
        className,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect on hover */}
      {hover && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100",
            "bg-gradient-to-br rounded-[var(--radius-2xl)]",
            colors.glow,
          )}
        />
      )}

      {/* Decorative glow circle */}
      <div
        className={cn(
          "absolute -top-12 -right-14 h-28 w-28 rounded-full blur-3xl",
          colors.glowCircle,
        )}
      />

      {/* Content */}
      <div className="relative">{children}</div>
    </motion.div>
  );
}
