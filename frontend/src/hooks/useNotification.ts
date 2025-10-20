import { useContext } from "react";
import { NotificationContext } from "@/contexts/notification-context";

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification 必须在 NotificationProvider 内使用");
  }
  return context;
};
