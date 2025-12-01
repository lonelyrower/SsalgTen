import React, { memo } from "react";
import { Card } from "@/components/ui/card";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "strong" | "tech" | "gradient" | "success" | "warning" | "danger" | "info" | "orange";
  animated?: boolean;
  glow?: boolean;
  hoverTransform?: boolean;
  hover?: boolean;
}

export const GlassCard = memo(
  ({
    children,
    className = "",
    variant = "default",
    animated = false,
    glow = false,
    hoverTransform = true,
    hover = true,
  }: GlassCardProps) => {
    const variants = {
      // 默认：轻量模糊（桌面10px，移动禁用）
      default: "bg-[var(--glass-bg)] border-[var(--glass-border)] dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)]",

      // 微妙：移动优先，无模糊
      subtle:
        "bg-[var(--glass-bg-subtle)] border-[var(--glass-border-subtle)] lg:backdrop-blur-[var(--blur-md)]",

      // 强烈：仅桌面使用模糊，移动使用高不透明度
      strong:
        "bg-[var(--glass-bg-strong)] border-[var(--glass-border-strong)] lg:backdrop-blur-[var(--blur-lg)]",

      // 科技：响应式模糊
      tech: "tech-card border-primary/20",

      // 渐变：桌面模糊，移动纯色 - 纯蓝科技风
      gradient:
        "bg-gradient-to-br from-white/95 via-cyan-50/50 to-blue-50/85 dark:from-gray-900/95 dark:via-blue-950/30 dark:to-cyan-950/30 border-[var(--glass-border)] dark:border-cyan-500/10 lg:from-white/80 lg:via-cyan-50/40 lg:to-blue-50/65 lg:dark:from-gray-900/80 lg:backdrop-blur-[var(--blur-lg)]",

      // 状态变体 - 使用设计系统颜色
      success: "bg-[hsl(var(--status-success-50)/0.8)] dark:bg-[hsl(var(--status-success-900)/0.3)] border-[hsl(var(--status-success-200))] dark:border-[hsl(var(--status-success-800))]",
      warning: "bg-[hsl(var(--status-warning-50)/0.8)] dark:bg-[hsl(var(--status-warning-900)/0.3)] border-[hsl(var(--status-warning-200))] dark:border-[hsl(var(--status-warning-800))]",
      danger: "bg-[hsl(var(--status-error-50)/0.8)] dark:bg-[hsl(var(--status-error-900)/0.3)] border-[hsl(var(--status-error-200))] dark:border-[hsl(var(--status-error-800))]",
      info: "bg-[hsl(var(--status-info-50)/0.8)] dark:bg-[hsl(var(--status-info-900)/0.3)] border-[hsl(var(--status-info-200))] dark:border-[hsl(var(--status-info-800))]",
      orange: "bg-orange-50/80 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
    };

    const animationClass = animated
      ? hoverTransform
        ? "transition-transform duration-[var(--duration-slower)] hover:transform hover:scale-[1.02] hover:-translate-y-1 card-3d"
        : "transition-shadow duration-[var(--duration-slower)] hover:shadow-[var(--shadow-xl)]"
      : "transition-colors duration-[var(--duration-slow)]";

    const glowClass = glow
      ? "pulse-glow shadow-[var(--shadow-2xl)] shadow-[hsl(var(--primary))]/25"
      : "shadow-[var(--shadow-lg)]";

    const hoverClass = hover
      ? "hover:shadow-[var(--shadow-lg)]"
      : "";

    return (
      <Card
        className={`
      ${variants[variant]}
      ${glowClass}
      ${animationClass}
      ${hoverClass}
      relative overflow-hidden
      rounded-[var(--radius-xl)]
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
