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
  interactive?: boolean; // Interactive card (scales on click)
}

/**
 * 统一的卡片组件 - 基于设计系统令牌
 *
 * @param variant - 卡片变体
 *   布局类型：
 *   - default: 基础白色卡片
 *   - subtle: 微妙样式（移动优先）
 *   - strong: 强烈样式（桌面模糊）
 *   - tech: 科技感蓝色渐变卡片
 *   - gradient: 渐变卡片
 *
 *   状态类型：
 *   - success: 成功状态（绿色系）
 *   - warning: 警告状态（黄色系）
 *   - danger: 危险状态（红色系）
 *   - info: 信息状态（蓝色系）
 *   - purple: 紫色系
 *   - orange: 橙色系
 *
 * @param animated - 是否启用悬停动画
 * @param glow - 是否添加发光效果
 * @param interactive - 是否为交互式卡片（点击时缩放）
 * @param motion - 是否启用 framer-motion 入场动画
 */
export const GlassCard = memo(
  ({
    children,
    className = "",
    variant = "default",
    animated = true,
    glow = false,
    hoverTransform = true,
    hover,
    motion: enableMotion = false,
    interactive = false,
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

    // Color variants with design system tokens
    const colorVariants: Record<ColorVariant, {
      border: string;
      bg: string;
      glow: string;
      glowCircle: string;
    }> = {
      success: {
        border: "border-[hsl(var(--success))]/30",
        bg: "bg-gradient-to-br from-[hsl(var(--success))]/10 via-[hsl(var(--surface))]/95 to-[hsl(var(--success))]/5",
        glow: "from-[hsl(var(--success))]/15 via-transparent to-[hsl(var(--success))]/10",
        glowCircle: "bg-[hsl(var(--success))]/20",
      },
      warning: {
        border: "border-[hsl(var(--warning))]/30",
        bg: "bg-gradient-to-br from-[hsl(var(--warning))]/10 via-[hsl(var(--surface))]/95 to-[hsl(var(--warning))]/5",
        glow: "from-[hsl(var(--warning))]/15 via-transparent to-[hsl(var(--warning))]/10",
        glowCircle: "bg-[hsl(var(--warning))]/20",
      },
      danger: {
        border: "border-[hsl(var(--error))]/30",
        bg: "bg-gradient-to-br from-[hsl(var(--error))]/10 via-[hsl(var(--surface))]/95 to-[hsl(var(--error))]/5",
        glow: "from-[hsl(var(--error))]/15 via-transparent to-[hsl(var(--error))]/10",
        glowCircle: "bg-[hsl(var(--error))]/20",
      },
      info: {
        border: "border-[hsl(var(--info))]/30",
        bg: "bg-gradient-to-br from-[hsl(var(--info))]/10 via-[hsl(var(--surface))]/95 to-[hsl(var(--info))]/5",
        glow: "from-[hsl(var(--info))]/15 via-transparent to-[hsl(var(--info))]/10",
        glowCircle: "bg-[hsl(var(--info))]/20",
      },
      purple: {
        border: "border-purple-500/30",
        bg: "bg-gradient-to-br from-purple-500/10 via-[hsl(var(--surface))]/95 to-violet-500/5",
        glow: "from-purple-400/15 via-transparent to-violet-500/10",
        glowCircle: "bg-purple-400/20",
      },
      orange: {
        border: "border-orange-500/30",
        bg: "bg-gradient-to-br from-orange-500/10 via-[hsl(var(--surface))]/95 to-amber-500/5",
        glow: "from-orange-400/15 via-transparent to-amber-500/10",
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
      ? "shadow-[0_0_30px_hsl(var(--brand-cyan)/0.3)]"
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
          interactiveClass,
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

        {/* 科技感背景效果 (style variants) */}
        {variant === "tech" && (
          <>
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        {/* 内容区域 */}
        <div className="relative z-10">{children}</div>
      </Wrapper>
    );
  }
);

GlassCard.displayName = "GlassCard";
