import React from "react";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Satellite,
  Map,
  MapPin,
  Globe,
} from "lucide-react";
import type { CesiumLayerType } from "./CesiumConfig";

interface Globe3DLayerMenuProps {
  currentLayer: CesiumLayerType;
  showMenu: boolean;
  onToggleMenu: () => void;
  onLayerChange: (layer: CesiumLayerType) => void;
}

export const Globe3DLayerMenu: React.FC<Globe3DLayerMenuProps> = ({
  currentLayer,
  showMenu,
  onToggleMenu,
  onLayerChange,
}) => {
  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
      <div className="relative layer-menu-container">
        <Button
          variant="secondary"
          size="sm"
          onClick={onToggleMenu}
          className="bg-white/95 dark:bg-gray-800/95 hover:bg-white dark:hover:bg-gray-800 shadow-lg flex items-center gap-2 border border-gray-200/50 dark:border-gray-600/50 lg:bg-white/90 lg:dark:bg-gray-800/90 lg:backdrop-blur-[10px]"
        >
          <Layers className="h-4 w-4 text-gray-700 dark:text-gray-200" />
          <span className="hidden sm:inline text-gray-700 dark:text-gray-200">
            图层
          </span>
        </Button>

        {/* 图层选择菜单 */}
        {showMenu && (
          <div
            className="absolute top-14 right-0 bg-white dark:bg-gray-800  shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[280px] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
            role="menu"
          >
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-2">
                选择地图图层
              </p>
            </div>
            <div className="p-2 divide-y divide-gray-100 dark:divide-gray-700">
              {/* 高清卫星图 - 蓝色 */}
              <LayerButton
                label="高清卫星图"
                icon={<Satellite className="h-4 w-4" />}
                isActive={currentLayer === "satellite"}
                colorScheme="blue"
                onClick={() => {
                  onLayerChange("satellite");
                  onToggleMenu();
                }}
              />

              {/* 立体地形 - 绿色 */}
              <LayerButton
                label="立体地形"
                icon={<Map className="h-4 w-4" />}
                isActive={currentLayer === "terrain"}
                colorScheme="green"
                onClick={() => {
                  onLayerChange("terrain");
                  onToggleMenu();
                }}
              />

              {/* 街道标注 - 紫色 */}
              <LayerButton
                label="街道标注"
                icon={<MapPin className="h-4 w-4" />}
                isActive={currentLayer === "bluemarble"}
                colorScheme="purple"
                onClick={() => {
                  onLayerChange("bluemarble");
                  onToggleMenu();
                }}
              />

              {/* 国家地理风格 - 橙色 */}
              <LayerButton
                label="国家地理风格"
                icon={<Globe className="h-4 w-4" />}
                isActive={currentLayer === "natgeo"}
                colorScheme="orange"
                onClick={() => {
                  onLayerChange("natgeo");
                  onToggleMenu();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 图层按钮子组件
interface LayerButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  colorScheme: "blue" | "green" | "purple" | "orange";
  onClick: () => void;
}

const LayerButton: React.FC<LayerButtonProps> = ({
  label,
  icon,
  isActive,
  colorScheme,
  onClick,
}) => {
  const colorClasses = {
    blue: {
      active: "bg-blue-600/10 dark:bg-blue-900/30 border-l-2 border-blue-600 text-blue-800 dark:text-blue-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-blue-600 dark:bg-blue-300",
    },
    green: {
      active: "bg-green-600/10 dark:bg-green-900/30 border-l-2 border-green-600 text-green-800 dark:text-green-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-green-600 dark:bg-green-300",
    },
    purple: {
      active: "bg-purple-600/10 dark:bg-purple-900/30 border-l-2 border-purple-600 text-purple-800 dark:text-purple-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-purple-600 dark:bg-purple-300",
    },
    orange: {
      active: "bg-orange-600/10 dark:bg-orange-900/30 border-l-2 border-orange-600 text-orange-800 dark:text-orange-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-orange-600 dark:bg-orange-300",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isActive ? "true" : "false"}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
        isActive ? colors.active : colors.inactive
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {isActive && (
        <div className={`w-1.5 h-1.5 rounded-full ${colors.indicator}`}></div>
      )}
    </button>
  );
};
