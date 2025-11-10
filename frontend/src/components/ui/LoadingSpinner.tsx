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
            className={`${sizeClasses[size]} border-4 border-border border-t-[hsl(var(--info))] rounded-full animate-spin`}
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
          className={`${textSizeClasses[size]} text-muted-foreground font-medium animate-pulse`}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`min-h-screen surface-base flex items-center justify-center ${className}`}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--info))]/10 to-[hsl(var(--info))]/5 rounded-2xl blur-xl opacity-60 transform -rotate-6 scale-110"></div>
          <div className="relative surface-elevated/80 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-border/50">
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
          className={`${textSizeClasses[size]} text-muted-foreground font-medium`}
        >
          {text}
        </span>
      )}
    </div>
  );
};
