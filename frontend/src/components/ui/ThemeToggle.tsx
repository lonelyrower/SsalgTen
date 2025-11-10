import React from "react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  // 简单的亮/暗切换（移除跟随系统选项）
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-white/10 transition-all group"
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[hsl(var(--warning))] group-hover:text-[hsl(var(--warning))]/80 transition-colors" />
      ) : (
        <Moon className="h-4 w-4 text-[hsl(var(--info))] group-hover:text-[hsl(var(--info))]/80 transition-colors" />
      )}
    </Button>
  );
};
