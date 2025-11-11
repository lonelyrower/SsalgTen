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

/**
 * 统一的卡片组件 - 基于设计系统令牌
 *
 * @param variant - 卡片变体
 *   布局类型：
 *   - base: 基础白色卡片
 *   - tech: 科技感蓝色渐变卡片
 *   - stats: 统计卡片（适合数据展示）
 *   - content: 内容卡片（适合长文本）
 *
 *   状态类型（统一蓝色系）：
 *   - success: 成功状态（蓝绿渐变）
 *   - warning: 警告状态（蓝黄渐变）
 *   - danger: 危险状态（蓝红渐变）
 *   - info: 信息状态（纯蓝渐变）
 *
 * @param size - 内边距大小
 *   - sm: 16px (紧凑)
 *   - md: 20px (标准)
 *   - lg: 24px (宽松)
 *   - xl: 32px (超大)
 *
 * @param animated - 是否启用悬停动画
 * @param glow - 是否添加发光效果
 * @param interactive - 是否为交互式卡片（点击时缩放）
 * @param motionEnabled - 是否启用 framer-motion 入场动画
 */
export const GlassCard = memo(
  ({
    children,
    className = "",
    variant = "base",
    size = "lg",
    animated = true,
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
      default: "glass border-white/20",

      // 微妙：移动优先，无模糊
      subtle:
        "surface-elevated border-white/10 lg:bg-[hsl(var(--surface-elevated))]/70 lg:backdrop-blur-[8px]",

      // 强烈：仅桌面使用模糊，移动使用高不透明度
      strong:
        "bg-[hsl(var(--surface-elevated))]/95 border-white/30 lg:bg-[hsl(var(--surface-elevated))]/80 lg:backdrop-blur-[12px]",

      // 科技：响应式模糊
      tech: "tech-card border-primary/20",

      // 渐变：桌面模糊，移动纯色 - 使用品牌色系
      gradient:
        "bg-gradient-to-br from-[hsl(var(--surface-elevated))]/95 via-[hsl(var(--brand-cyan))]/5 to-[hsl(var(--brand-blue))]/10 border-white/20 lg:from-[hsl(var(--surface-elevated))]/80 lg:backdrop-blur-[12px]",
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

    // 交互式卡片
    const interactiveClass = interactive
      ? "cursor-pointer active:scale-[0.98] hover:scale-[1.01]"
      : "";

    // 发光效果
    const glowClass = glow
      ? "shadow-[0_0_30px_hsl(var(--card-accent-from)/0.3)]"
      : "";

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

        {/* 装饰性光点 */}
        <div
          className={cn(
            "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none",
            `bg-gradient-to-br ${config.glowColor}`
          )}
        />

        {/* 内容区域 */}
        <div className="relative z-10">{children}</div>
      </>
    );

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
