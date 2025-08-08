import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, Check, ChevronDown } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, actualTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    { 
      value: 'light' as const, 
      label: '浅色模式', 
      icon: Sun,
      description: '始终使用浅色主题' 
    },
    { 
      value: 'dark' as const, 
      label: '深色模式', 
      icon: Moon,
      description: '始终使用深色主题' 
    },
    { 
      value: 'system' as const, 
      label: '跟随系统', 
      icon: Monitor,
      description: '根据系统设置自动切换' 
    },
  ];

  const currentTheme = themes.find(t => t.value === theme);
  const CurrentIcon = currentTheme?.icon || Sun;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <CurrentIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">
          {currentTheme?.label}
        </span>
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 下拉菜单 */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            <div className="py-2">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  主题设置
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  选择你喜欢的主题外观
                </p>
              </div>
              
              {themes.map((themeOption) => {
                const Icon = themeOption.icon;
                const isSelected = theme === themeOption.value;
                
                return (
                  <button
                    key={themeOption.value}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => {
                      setTheme(themeOption.value);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected 
                          ? 'bg-blue-100 dark:bg-blue-900/40' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isSelected 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${
                          isSelected 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {themeOption.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {themeOption.description}
                        </p>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                );
              })}
              
              {/* 当前主题状态 */}
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    actualTheme === 'dark' ? 'bg-gray-800 dark:bg-white' : 'bg-yellow-400'
                  }`}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    当前: {actualTheme === 'dark' ? '深色模式' : '浅色模式'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};