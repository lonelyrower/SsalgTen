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
      border: "border-slate-200/60 dark:border-slate-700/60",
      bg: "from-white via-slate-50/50 to-white dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-800",
      glow: "from-slate-400/10 via-transparent to-slate-500/10",
      glowCircle: "bg-slate-400/15",
    },
    success: {
      border: "border-green-200/60 dark:border-green-700/60",
      bg: "from-green-50 via-white to-emerald-50 dark:from-slate-800 dark:via-green-950/60 dark:to-emerald-950/60",
      glow: "from-green-400/15 via-transparent to-emerald-500/15",
      glowCircle: "bg-green-400/20",
    },
    warning: {
      border: "border-yellow-200/60 dark:border-yellow-700/60",
      bg: "from-yellow-50 via-white to-amber-50 dark:from-slate-800 dark:via-yellow-950/60 dark:to-amber-950/60",
      glow: "from-yellow-400/15 via-transparent to-amber-500/15",
      glowCircle: "bg-yellow-400/20",
    },
    danger: {
      border: "border-red-200/60 dark:border-red-700/60",
      bg: "from-red-50 via-white to-rose-50 dark:from-slate-800 dark:via-red-950/60 dark:to-rose-950/60",
      glow: "from-red-400/15 via-transparent to-rose-500/15",
      glowCircle: "bg-red-400/20",
    },
    info: {
      border: "border-cyan-200/60 dark:border-cyan-700/60",
      bg: "from-cyan-50 via-white to-blue-50 dark:from-slate-800 dark:via-cyan-950/60 dark:to-blue-950/60",
      glow: "from-cyan-400/15 via-transparent to-blue-500/15",
      glowCircle: "bg-cyan-400/20",
    },
    purple: {
      border: "border-purple-200/60 dark:border-purple-700/60",
      bg: "from-purple-50 via-white to-violet-50 dark:from-slate-800 dark:via-purple-950/60 dark:to-violet-950/60",
      glow: "from-purple-400/15 via-transparent to-violet-500/15",
      glowCircle: "bg-purple-400/20",
    },
    orange: {
      border: "border-orange-200/60 dark:border-orange-700/60",
      bg: "from-orange-50 via-white to-amber-50 dark:from-slate-800 dark:via-orange-950/60 dark:to-amber-950/60",
      glow: "from-orange-400/15 via-transparent to-amber-500/15",
      glowCircle: "bg-orange-400/20",
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
