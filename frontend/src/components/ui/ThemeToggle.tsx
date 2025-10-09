import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, actualTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const themes = [
    { value: 'light' as const, label: '浅色', icon: Sun },
    { value: 'dark' as const, label: '深色', icon: Moon },
    { value: 'system' as const, label: '系统', icon: Monitor },
  ];

  const currentTheme = themes.find(t => t.value === theme);
  const CurrentIcon = currentTheme?.icon || Sun;

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-2 rounded-lg hover:bg-white/10 border border-white/20 hover:border-white/30 transition-all"
        aria-label={`主题: ${currentTheme?.label}`}
      >
        <CurrentIcon className="h-4 w-4 text-white/90" />
        <span className="hidden lg:inline text-sm text-white/90 font-medium">
          {currentTheme?.label}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isSelected = theme === themeOption.value;

            return (
              <button
                key={themeOption.value}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center space-x-2.5 ${
                  isSelected ? 'bg-primary/10 text-primary' : 'text-gray-700 dark:text-gray-200'
                }`}
                onClick={() => {
                  setTheme(themeOption.value);
                  setIsOpen(false);
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{themeOption.label}</span>
                {isSelected && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
