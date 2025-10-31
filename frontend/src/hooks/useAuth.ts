import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
};
