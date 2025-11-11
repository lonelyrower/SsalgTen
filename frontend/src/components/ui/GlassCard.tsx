import React, { memo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "base" | "tech" | "stats" | "content" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  glow?: boolean;
  interactive?: boolean;
  motionEnabled?: boolean;
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
    interactive = false,
    motionEnabled = false,
  }: GlassCardProps) => {
    const variants = {
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

    const config = variantConfig[variant];

    // 内边距大小映射
    const paddingClasses = {
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
      xl: "p-8",
    };

    // 动画类
    const animationClass = animated
      ? "transition-all duration-300 ease-out hover:-translate-y-1"
      : "";

    // 交互式卡片
    const interactiveClass = interactive
      ? "cursor-pointer active:scale-[0.98] hover:scale-[1.01]"
      : "";

    // 发光效果
    const glowClass = glow
      ? "shadow-[0_0_30px_hsl(var(--card-accent-from)/0.3)]"
      : "";

    const cardContent = (
      <>
        {/* 悬停光晕效果 */}
        {animated && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br rounded-[var(--radius-lg)]",
              config.glowColor
            )}
          />
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

    const baseClasses = cn(
      config.className,
      paddingClasses[size],
      animationClass,
      interactiveClass,
      glowClass,
      "relative overflow-hidden group",
      className
    );

    // 使用 framer-motion 或普通 Card
    if (motionEnabled) {
      return (
        <motion.div
          className={baseClasses}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {cardContent}
        </motion.div>
      );
    }

    return (
      <Card className={baseClasses}>
        {cardContent}
      </Card>
    );
  },
);

GlassCard.displayName = "GlassCard";
