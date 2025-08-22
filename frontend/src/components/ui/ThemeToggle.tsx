import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, Check, ChevronDown } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, actualTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // 键盘事件处理
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(themes.findIndex(t => t.value === theme));
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => (prev + 1) % themes.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev - 1 + themes.length) % themes.length);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        setTheme(themes[focusedIndex].value);
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(themes.length - 1);
        break;
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`主题设置：当前为${currentTheme?.label}，点击打开主题选择菜单`}
        id="theme-toggle-button"
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
            aria-hidden="true"
          />
          
          {/* 下拉菜单 */}
          <div 
            ref={menuRef}
            className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            role="menu"
            aria-labelledby="theme-toggle-button"
            onKeyDown={handleKeyDown}
          >
            <div className="py-2">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  主题设置
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  选择你喜欢的主题外观
                </p>
              </div>
              
              {themes.map((themeOption, index) => {
                const Icon = themeOption.icon;
                const isSelected = theme === themeOption.value;
                const isFocused = focusedIndex === index;
                
                return (
                  <button
                    key={themeOption.value}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${
                      isFocused ? 'ring-2 ring-blue-500 ring-inset' : ''
                    }`}
                    onClick={() => {
                      setTheme(themeOption.value);
                      setIsOpen(false);
                      buttonRef.current?.focus();
                    }}
                    onMouseEnter={() => setFocusedIndex(index)}
                    role="menuitem"
                    aria-checked={isSelected}
                    aria-describedby={`theme-${themeOption.value}-desc`}
                    tabIndex={isFocused ? 0 : -1}
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
                        <p 
                          className="text-xs text-gray-500 dark:text-gray-400"
                          id={`theme-${themeOption.value}-desc`}
                        >
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
              <div 
                className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      actualTheme === 'dark' ? 'bg-gray-800 dark:bg-white' : 'bg-yellow-400'
                    }`}
                    aria-hidden="true"
                  ></div>
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