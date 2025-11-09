import React, { memo } from "react";
import { Card } from "@/components/ui/card";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "strong" | "tech" | "gradient";
  animated?: boolean;
  glow?: boolean;
  hoverTransform?: boolean;
}

export const GlassCard = memo(
  ({
    children,
    className = "",
    variant = "default",
    animated = false,
    glow = false,
    hoverTransform = true,
  }: GlassCardProps) => {
    const variants = {
      // 默认：轻量模糊（桌面10px，移动禁用）
      default: "glass border-white/20 dark:border-white/10",

      // 微妙：移动优先，无模糊
      subtle:
        "surface-elevated border-white/10 dark:border-white/5 lg:bg-[hsl(var(--surface-elevated))]/70 lg:backdrop-blur-[8px]",

      // 强烈：仅桌面使用模糊，移动使用高不透明度
      strong:
        "bg-[hsl(var(--surface-elevated))]/95 border-white/30 dark:border-white/20 lg:bg-[hsl(var(--surface-elevated))]/80 lg:backdrop-blur-[12px]",

      // 科技：响应式模糊
      tech: "tech-card border-primary/20",

      // 渐变：桌面模糊，移动纯色 - 使用品牌色系
      gradient:
        "bg-gradient-to-br from-[hsl(var(--surface-elevated))]/95 via-[hsl(var(--brand-cyan))]/5 to-[hsl(var(--brand-blue))]/10 border-white/20 dark:border-[hsl(var(--brand-cyan))]/10 lg:from-[hsl(var(--surface-elevated))]/80 lg:backdrop-blur-[12px]",
    };

    const animationClass = animated
      ? hoverTransform
        ? "transition-transform duration-500 hover:transform hover:scale-[1.02] hover:-translate-y-1 card-3d"
        : "transition-shadow duration-500 hover:shadow-xl"
      : "transition-colors duration-300";

    const glowClass = glow
      ? "pulse-glow shadow-2xl shadow-[hsl(var(--primary))]/25"
      : "shadow-lg";

    return (
      <Card
        className={`
      ${variants[variant]}
      ${glowClass}
      ${animationClass}
      relative overflow-hidden
      ${className}
    `}
      >
        {/* 顶部装饰线 */}
        {(variant === "tech" || variant === "gradient") && (
          <div className="absolute top-0 left-0 right-0 h-px bg-primary/30" />
        )}

        {/* 内容区域 */}
        <div className="relative z-10">{children}</div>

        {/* 科技感背景效果 */}
        {variant === "tech" && (
          <>
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 pointer-events-none" />
          </>
        )}
      </Card>
    );
  },
);

GlassCard.displayName = "GlassCard";
