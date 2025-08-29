import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ResponsiveTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const ResponsiveTabs: React.FC<ResponsiveTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const activeTabInfo = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={className}>
      {/* 桌面端标签页 */}
      <div className="hidden md:block">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap
                    transition-all duration-200 rounded-t-lg
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800/50'
                    }
                  `}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      <div className="md:hidden relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
        >
          <div className="flex items-center space-x-3">
            {activeTabInfo?.icon && (
              <activeTabInfo.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              {activeTabInfo?.label}
            </span>
          </div>
          <ChevronDown 
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              dropdownOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {dropdownOpen && (
          <>
            {/* 遮罩层 */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setDropdownOpen(false)}
            />
            
            {/* 下拉菜单 */}
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center space-x-3 p-3 text-left transition-colors duration-200
                      ${activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};