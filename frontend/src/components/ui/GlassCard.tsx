import React, { memo } from 'react';
import { Card } from '@/components/ui/card';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'strong';
  animated?: boolean;
}

export const GlassCard = memo(({ 
  children, 
  className = '',
  variant = 'default',
  animated = false 
}: GlassCardProps) => {
  const variants = {
    default: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-white/20',
    subtle: 'bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/10',
    strong: 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-white/30'
  };

  const animationClass = animated 
    ? 'transition-all duration-300 hover:bg-white/90 dark:hover:bg-gray-800/90 hover:backdrop-blur-lg hover:transform hover:scale-[1.02] hover:shadow-xl'
    : '';

  return (
    <Card className={`
      ${variants[variant]}
      shadow-lg 
      border 
      ${animationClass}
      ${className}
    `}>
      {children}
    </Card>
  );
});

GlassCard.displayName = 'GlassCard';