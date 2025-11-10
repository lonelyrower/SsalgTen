import React, { memo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StyleVariant = "default" | "subtle" | "strong" | "tech" | "gradient";
type ColorVariant = "success" | "warning" | "danger" | "info" | "purple" | "orange";
type Variant = StyleVariant | ColorVariant;

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  animated?: boolean;
  glow?: boolean;
  hoverTransform?: boolean;
  hover?: boolean; // Alias for animated (backward compatibility)
  motion?: boolean; // Enable framer-motion animations
}

export const GlassCard = memo(
  ({
    children,
    className = "",
    variant = "default",
    animated = false,
    glow = false,
    hoverTransform = true,
    hover,
    motion: enableMotion = false,
  }: GlassCardProps) => {
    // Backward compatibility: hover prop maps to animated
    const isAnimated = animated || (hover !== undefined ? hover : false);

    // Style variants (original ui/GlassCard)
    const styleVariants: Record<StyleVariant, string> = {
      // 默认：轻量模糊（桌面10px，移动禁用）
      default: "glass border-white/20 dark:border-white/10",

      // 微妙：移动优先，无模糊
      subtle:
        "bg-white/90 dark:bg-gray-900/90 border-white/10 dark:border-white/5 lg:bg-white/70 lg:dark:bg-gray-900/70 lg:backdrop-blur-[8px]",

      // 强烈：仅桌面使用模糊，移动使用高不透明度
      strong:
        "bg-white/95 dark:bg-gray-900/95 border-white/30 dark:border-white/20 lg:bg-white/80 lg:dark:bg-gray-900/80 lg:backdrop-blur-[12px]",

      // 科技：响应式模糊
      tech: "tech-card border-primary/20",

      // 渐变：桌面模糊，移动纯色 - 纯蓝科技风
      gradient:
        "bg-gradient-to-br from-white/95 via-cyan-50/50 to-blue-50/85 dark:from-gray-900/95 dark:via-blue-950/30 dark:to-cyan-950/30 border-white/20 dark:border-cyan-500/10 lg:from-white/80 lg:via-cyan-50/40 lg:to-blue-50/65 lg:dark:from-gray-900/80 lg:backdrop-blur-[12px]",
    };

    // Color variants (from admin/GlassCard)
    const colorVariants: Record<ColorVariant, {
      border: string;
      bg: string;
      glow: string;
      glowCircle: string;
    }> = {
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

    const isColorVariant = (v: Variant): v is ColorVariant => {
      return ['success', 'warning', 'danger', 'info', 'purple', 'orange'].includes(v);
    };

    const isStyleVariant = (v: Variant): v is StyleVariant => {
      return ['default', 'subtle', 'strong', 'tech', 'gradient'].includes(v);
    };

    // Animation classes
    const animationClass = isAnimated
      ? hoverTransform
        ? "transition-transform duration-500 hover:transform hover:scale-[1.02] hover:-translate-y-1 card-3d"
        : "transition-shadow duration-500 hover:shadow-xl"
      : "transition-colors duration-300";

    const glowClass = glow
      ? "pulse-glow shadow-2xl shadow-[hsl(var(--primary))]/25"
      : "shadow-lg";

    // Build className based on variant type
    let variantClasses = "";
    let colorConfig: typeof colorVariants[ColorVariant] | null = null;

    if (isStyleVariant(variant)) {
      variantClasses = styleVariants[variant];
    } else if (isColorVariant(variant)) {
      colorConfig = colorVariants[variant];
      variantClasses = cn(
        "rounded-2xl border-2 p-6 overflow-hidden",
        "bg-gradient-to-br shadow-lg transition-all duration-300",
        colorConfig.border,
        colorConfig.bg,
        isAnimated && "group hover:-translate-y-0.5 hover:shadow-xl"
      );
    }

    // Use motion or regular Card
    const Wrapper = enableMotion ? motion.div : Card;
    const motionProps = enableMotion
      ? {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3 },
        }
      : {};

    return (
      <Wrapper
        className={cn(
          variantClasses,
          glowClass,
          animationClass,
          "relative overflow-hidden",
          className
        )}
        {...motionProps}
      >
        {/* Color variant decorations */}
        {colorConfig && (
          <>
            {/* Glow effect on hover */}
            {isAnimated && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  "bg-gradient-to-br rounded-2xl",
                  colorConfig.glow
                )}
              />
            )}

            {/* Decorative glow circle */}
            <div
              className={cn(
                "absolute -top-12 -right-14 h-28 w-28 rounded-full blur-3xl",
                colorConfig.glowCircle
              )}
            />
          </>
        )}

        {/* 顶部装饰线 (style variants) */}
        {(variant === "tech" || variant === "gradient") && (
          <div className="absolute top-0 left-0 right-0 h-px bg-primary/30" />
        )}

        {/* 内容区域 */}
        <div className="relative z-10">{children}</div>

        {/* 科技感背景效果 (style variants) */}
        {variant === "tech" && (
          <>
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 pointer-events-none" />
          </>
        )}
      </Wrapper>
    );
  }
);

GlassCard.displayName = "GlassCard";
