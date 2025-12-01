import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

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

interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
  variant: "desktop" | "mobile";
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  tab,
  isActive,
  onClick,
  variant,
  onKeyDown,
}) => {
  const Icon = tab.icon;

  // 桌面端样式
  const desktopStyles = `
    flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap
    transition-all duration-[var(--duration-normal)] rounded-t-[var(--radius-lg)] transform
    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900
    ${
      isActive
        ? "border-primary text-primary bg-primary/10 dark:bg-primary/20 shadow-[var(--shadow-sm)] font-semibold scale-105"
        : "border-transparent text-gray-500 hover:text-primary hover:border-primary/50 hover:bg-primary/5 dark:text-gray-400 dark:hover:text-primary hover:scale-105 hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
    }
  `;

  // 移动端样式
  const mobileStyles = `
    w-full flex items-center space-x-3 p-3 text-left transition-all duration-[var(--duration-normal)] transform
    focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary
    ${
      isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-gray-700 dark:text-gray-300 hover:bg-primary/5 hover:text-primary dark:hover:bg-gray-700/50 hover:translate-x-1"
    }
  `;

  const iconSize = variant === "desktop" ? "h-4 w-4" : "h-5 w-5";

  // 根据变体决定属性
  if (variant === "desktop") {
    const ariaSelected = isActive ? "true" : "false";
    const ariaControls = `tabpanel-${tab.id}`;

    return (
      <button
        type="button"
        role="tab"
        aria-selected={ariaSelected}
        aria-controls={ariaControls}
        tabIndex={isActive ? 0 : -1}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={desktopStyles}
      >
        {Icon && <Icon className={iconSize} />}
        <span>{tab.label}</span>
      </button>
    );
  } else {
    const ariaSelected = isActive ? "true" : "false";

    return (
      <button
        type="button"
        role="option"
        aria-selected={ariaSelected}
        onClick={onClick}
        className={mobileStyles}
      >
        {Icon && <Icon className={iconSize} />}
        <span className="font-medium">{tab.label}</span>
      </button>
    );
  }
};

export const ResponsiveTabs: React.FC<ResponsiveTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 查找当前激活的标签信息，如果找不到则回退到第一个标签
  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  // 统一的点击处理函数
  const handleTabClick = (tabId: string, closeDropdown = false) => {
    // 避免重复触发
    if (tabId !== activeTab) {
      onTabChange(tabId);
    }
    if (closeDropdown) {
      setDropdownOpen(false);
    }
  };

  // 键盘导航处理
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case "ArrowRight":
        e.preventDefault();
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTabId = tabs[nextIndex].id;
    // 避免重复触发相同的 tab
    if (nextTabId !== activeTab) {
      onTabChange(nextTabId);
    }
  };

  return (
    <div className={className}>
      {/* 桌面端标签页 */}
      <div className="hidden md:block">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav
            className="-mb-px flex space-x-6"
            role="tablist"
            aria-label="内容选项卡"
          >
            {tabs.map((tab, index) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => handleTabClick(tab.id)}
                variant="desktop"
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      <div className="md:hidden relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen ? "true" : "false"}
          aria-haspopup="listbox"
          aria-label="选择标签页"
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-subtle))] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div className="flex items-center space-x-3">
            {activeTabInfo?.icon && (
              <activeTabInfo.icon className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              {activeTabInfo?.label}
            </span>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-[var(--duration-normal)] ${
              dropdownOpen ? "rotate-180" : ""
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
            <div
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-subtle))] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-20 overflow-hidden"
              role="listbox"
              aria-label="选择标签页"
            >
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabClick(tab.id, true)}
                  variant="mobile"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
