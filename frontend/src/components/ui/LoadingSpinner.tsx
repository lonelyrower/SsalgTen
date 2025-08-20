import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = '加载中...', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
        <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
      </div>
    </div>
  );
};