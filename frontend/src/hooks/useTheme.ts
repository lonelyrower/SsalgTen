import { useContext } from "react";
import { ThemeContext } from "@/contexts/theme-context";

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用");
  }
  return context;
};
