import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

export interface PageHeaderProps {
  /** 页面标题 */
  title: string;
  /** 页面描述（可选） */
  description?: string;
  /** 标题图标（可选） */
  icon?: LucideIcon;
  /** 右侧操作区内容（可选） */
  actions?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

/**
 * 统一的页面标题栏组件
 *
 * 使用示例：
 * ```tsx
 * <PageHeader
 *   title="节点总览"
 *   description="管理和监控所有节点"
 *   icon={Server}
 *   actions={
 *     <>
 *       <Button onClick={handleRefresh}>刷新</Button>
 *       <Button onClick={handleExport}>导出</Button>
 *     </>
 *   }
 * />
 * ```
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  className = '',
}) => {
  return (
    <GlassCard
      variant="tech"
      className={`mb-6 ${className}`}
      glow={false}
      animated={false}
    >
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* 左侧：标题区 */}
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30">
                <Icon className="h-6 w-6 text-cyan-400" strokeWidth={2.5} />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* 右侧：操作区 */}
          {actions && (
            <div className="flex items-center gap-2 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
