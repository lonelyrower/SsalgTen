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
      border: "border-border/60",
      bg: "from-[hsl(var(--surface-elevated))] via-[hsl(var(--surface-base))]/50 to-[hsl(var(--surface-elevated))]",
      glow: "from-muted/10 via-transparent to-muted/10",
      glowCircle: "bg-muted/15",
    },
    success: {
      border: "border-[hsl(var(--success))]/30",
      bg: "from-[hsl(var(--success))]/5 via-[hsl(var(--surface-elevated))] to-[hsl(var(--success))]/5",
      glow: "from-[hsl(var(--success))]/15 via-transparent to-[hsl(var(--success))]/15",
      glowCircle: "bg-[hsl(var(--success))]/20",
    },
    warning: {
      border: "border-[hsl(var(--warning))]/30",
      bg: "from-[hsl(var(--warning))]/5 via-[hsl(var(--surface-elevated))] to-[hsl(var(--warning))]/5",
      glow: "from-[hsl(var(--warning))]/15 via-transparent to-[hsl(var(--warning))]/15",
      glowCircle: "bg-[hsl(var(--warning))]/20",
    },
    danger: {
      border: "border-[hsl(var(--error))]/30",
      bg: "from-[hsl(var(--error))]/5 via-[hsl(var(--surface-elevated))] to-[hsl(var(--error))]/5",
      glow: "from-[hsl(var(--error))]/15 via-transparent to-[hsl(var(--error))]/15",
      glowCircle: "bg-[hsl(var(--error))]/20",
    },
    info: {
      border: "border-[hsl(var(--info))]/30",
      bg: "from-[hsl(var(--info))]/5 via-[hsl(var(--surface-elevated))] to-[hsl(var(--info))]/5",
      glow: "from-[hsl(var(--info))]/15 via-transparent to-[hsl(var(--info))]/15",
      glowCircle: "bg-[hsl(var(--info))]/20",
    },
    purple: {
      border: "border-secondary/30",
      bg: "from-secondary/5 via-[hsl(var(--surface-elevated))] to-secondary/5",
      glow: "from-secondary/15 via-transparent to-secondary/15",
      glowCircle: "bg-secondary/20",
    },
    orange: {
      border: "border-[hsl(var(--warning))]/30",
      bg: "from-[hsl(var(--warning))]/5 via-[hsl(var(--surface-elevated))] to-[hsl(var(--warning))]/5",
      glow: "from-[hsl(var(--warning))]/15 via-transparent to-[hsl(var(--warning))]/15",
      glowCircle: "bg-[hsl(var(--warning))]/20",
    },
  };

  const colors = variantStyles[variant];
  const hoverClasses = hover ? "group hover:-translate-y-0.5 hover:shadow-xl" : "";

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl border-2 p-6 overflow-hidden",
        "bg-gradient-to-br shadow-lg transition-all duration-300",
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
            "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            "bg-gradient-to-br rounded-2xl",
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
