import React, { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import {
  NotificationContext,
  type Notification,
  type NotificationContextValue,
} from "./notification-context";

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      autoClose: true,
      duration: 5000,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    if (newNotification.autoClose) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id),
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const showError = (title: string, message?: string): string => {
    return addNotification({ type: "error", title, message, duration: 8000 });
  };

  const showSuccess = (title: string, message?: string): string => {
    return addNotification({ type: "success", title, message });
  };

  const showInfo = (title: string, message?: string): string => {
    return addNotification({ type: "info", title, message });
  };

  const showWarning = (title: string, message?: string): string => {
    return addNotification({ type: "warning", title, message, duration: 6000 });
  };

  const contextValue: NotificationContextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showError,
    showSuccess,
    showInfo,
    showWarning,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case "success":
        return "border-green-200 dark:border-green-800";
      case "error":
        return "border-red-200 dark:border-red-800";
      case "warning":
        return "border-yellow-200 dark:border-yellow-800";
      case "info":
      default:
        return "border-primary/30";
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case "success":
        return "bg-green-50 dark:bg-green-900/20";
      case "error":
        return "bg-red-50 dark:bg-red-900/20";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/20";
      case "info":
      default:
        return "bg-primary/10";
    }
  };

  return (
    <div
      className={`${getBorderColor()} ${getBackgroundColor()} border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-full duration-300`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {notification.title}
          </p>
          {notification.message && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {notification.message}
            </p>
          )}
        </div>
        <button
          onClick={() => onRemove(notification.id)}
          className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          aria-label="关闭通知"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
};
