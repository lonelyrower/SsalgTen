import React, { useState, useEffect } from "react";
import {
  ThemeContext,
  type ThemeContextValue,
  type ThemeMode,
} from "./theme-context";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // 从localStorage读取保存的主题，默认为system
    const saved = localStorage.getItem("ssalgten-theme");
    return (saved as ThemeMode) || "system";
  });

  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // 监听系统主题变化
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateActualTheme = () => {
      let newTheme: "light" | "dark";

      if (theme === "system") {
        newTheme = mediaQuery.matches ? "dark" : "light";
      } else {
        newTheme = theme;
      }

      setActualTheme(newTheme);

      // 更新HTML class
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    updateActualTheme();

    // 监听系统主题变化
    const handleChange = () => {
      if (theme === "system") {
        updateActualTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem("ssalgten-theme", newTheme);
  };

  const value: ThemeContextValue = {
    theme,
    actualTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
