import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  text?: string;
  className?: string;
  center?: boolean;
  fullScreen?: boolean;
  variant?: "default" | "elegant" | "minimal";
}

const sizeClasses = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const textSizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "lg",
  text,
  className = "",
  center = true,
  fullScreen = false,
  variant = "default",
}) => {
  const spinnerContent = () => {
    switch (variant) {
      case "elegant":
        return (
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <Loader2
              className={`${sizeClasses[size]} animate-spin text-primary relative z-10`}
            />
            <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin"></div>
          </div>
        );
      case "minimal":
        return (
          <div
            className={`${sizeClasses[size]} border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin`}
          ></div>
        );
      default:
        return (
          <Loader2
            className={`${sizeClasses[size]} animate-spin text-primary drop-shadow-sm`}
          />
        );
    }
  };

  const content = (
    <div className="flex flex-col items-center space-y-4">
      {spinnerContent()}
      {text && (
        <p
          className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400 font-medium animate-pulse`}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${className}`}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-[var(--radius-2xl)] blur-xl opacity-60 transform -rotate-6 scale-110"></div>
          <div className="relative bg-[var(--glass-bg)] dark:bg-[var(--glass-bg)] backdrop-blur-[var(--blur-md)] rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-2xl)] border border-[var(--glass-border)] dark:border-[var(--glass-border)]">
            {content}
          </div>
        </div>
      </div>
    );
  }

  if (center) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {spinnerContent()}
      {text && (
        <span
          className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400 font-medium`}
        >
          {text}
        </span>
      )}
    </div>
  );
};
