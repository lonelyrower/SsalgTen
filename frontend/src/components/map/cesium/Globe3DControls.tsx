import React from "react";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Home,
  Pause,
  Play,
} from "lucide-react";

interface Globe3DControlsProps {
  isRotating: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleRotation: () => void;
}

export const Globe3DControls: React.FC<Globe3DControlsProps> = ({
  isRotating,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleRotation,
}) => {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
      <Button
        variant="secondary"
        size="icon"
        onClick={onToggleRotation}
        title={isRotating ? "暂停自转" : "恢复自转"}
        aria-label={isRotating ? "暂停地球自转" : "恢复地球自转"}
        className={`${
          isRotating
            ? "bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800"
            : "bg-primary hover:bg-primary/90"
        } shadow-lg border border-gray-200/50 dark:border-gray-600/50`}
      >
        {isRotating ? (
          <Pause className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        ) : (
          <Play className="h-4 w-4 text-white" />
        )}
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onZoomIn}
        title="放大"
        aria-label="放大地图"
        className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
      >
        <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-200" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onZoomOut}
        title="缩小"
        aria-label="缩小地图"
        className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
      >
        <ZoomOut className="h-4 w-4 text-gray-700 dark:text-gray-200" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onResetView}
        title="重置视图"
        aria-label="重置地图视图到初始位置"
        className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
      >
        <Home className="h-4 w-4 text-gray-700 dark:text-gray-200" />
      </Button>
    </div>
  );
};
