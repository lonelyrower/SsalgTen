import React, { memo } from 'react';
import { Card } from '@/components/ui/card';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'strong' | 'tech' | 'gradient';
  animated?: boolean;
  glow?: boolean;
}

export const GlassCard = memo(({ 
  children, 
  className = '',
  variant = 'default',
  animated = false,
  glow = false
}: GlassCardProps) => {
  const variants = {
    default: 'glass border-white/20 dark:border-white/10',
    subtle: 'bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-white/10 dark:border-white/5',
    strong: 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-white/30 dark:border-white/20',
    tech: 'tech-card border-gradient-to-r from-blue-500/30 via-purple-500/20 to-blue-500/30',
    gradient: 'bg-gradient-to-br from-white/90 via-blue-50/80 to-purple-50/70 dark:from-gray-900/90 dark:via-blue-900/20 dark:to-purple-900/20 backdrop-blur-xl border-white/20 dark:border-white/10'
  };

  const animationClass = animated 
    ? 'transition-all duration-500 hover:transform hover:scale-[1.02] hover:-translate-y-1 card-3d'
    : 'transition-all duration-300';

  const glowClass = glow 
    ? 'pulse-glow shadow-2xl shadow-blue-500/25 dark:shadow-blue-400/20'
    : 'shadow-lg';

  return (
    <Card className={`
      ${variants[variant]}
      ${glowClass}
      ${animationClass}
      relative overflow-hidden
      ${className}
    `}>
      {/* 顶部装饰线 */}
      {(variant === 'tech' || variant === 'gradient') && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      )}
      
      {/* 内容区域 */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* 科技感背景效果 */}
      {variant === 'tech' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-blue-400/10 via-transparent to-transparent pointer-events-none" />
        </>
      )}
    </Card>
  );
});

GlassCard.displayName = 'GlassCard';