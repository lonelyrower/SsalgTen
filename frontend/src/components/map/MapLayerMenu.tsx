import React from "react";
import { Button } from "@/components/ui/button";
import { Layers, MapPin, Map as MapIcon } from "lucide-react";
import type { MapProvider, LayerConfig } from "./MapLayerConfig";
import { getAllLayers } from "./MapLayerConfig";

interface MapLayerMenuProps {
  currentProvider: MapProvider;
  currentLayerId: string;
  apiKey: string;
  showMenu: boolean;
  onToggleMenu: () => void;
  onLayerChange: (provider: MapProvider, layerId: string) => void;
}

export const MapLayerMenu: React.FC<MapLayerMenuProps> = ({
  currentProvider,
  currentLayerId,
  apiKey,
  showMenu,
  onToggleMenu,
  onLayerChange,
}) => {
  const allLayers = getAllLayers(apiKey);

  return (
    <div className="layer-menu-container relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={onToggleMenu}
        className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-white/95 text-gray-800 hover:bg-white shadow-lg border border-gray-200/60 lg:bg-white/90 lg:backdrop-blur-[10px] dark:bg-gray-800/95 dark:hover:bg-gray-700/95 dark:text-white dark:border-gray-600"
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        <Layers className="h-3 w-3 md:h-4 md:w-4 text-gray-700 dark:text-white" />
        <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-white">
          图层
        </span>
      </Button>

      {/* 图层选择菜单 */}
      {showMenu && (
        <div className="absolute top-14 right-0 bg-white dark:bg-gray-800  shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[280px] z-50 animate-in fade-in slide-in-from-top-2 duration-200 layer-menu-container">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-2">
              选择地图图层
            </p>
          </div>
          <div className="p-2 space-y-3 max-h-[500px] overflow-y-auto">
            {/* Carto 提供商组 */}
            <div className="border border-purple-200 dark:border-purple-700/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800/50">
                <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  CARTO
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allLayers.carto.map((layer) => (
                  <LayerButton
                    key={layer.id}
                    layer={layer}
                    isActive={currentProvider === "carto" && currentLayerId === layer.id}
                    colorScheme="purple"
                    onClick={() => {
                      onLayerChange("carto", layer.id);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* OpenStreetMap 提供商组 */}
            <div className="border border-green-200 dark:border-green-700/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800/50">
                <MapIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-700 dark:text-green-300">
                  OPENSTREETMAP
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allLayers.openstreetmap.map((layer) => (
                  <LayerButton
                    key={layer.id}
                    layer={layer}
                    isActive={currentProvider === "openstreetmap" && currentLayerId === layer.id}
                    colorScheme="green"
                    onClick={() => {
                      onLayerChange("openstreetmap", layer.id);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mapbox 提供商组 */}
            <div className="border border-blue-200 dark:border-blue-700/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/50">
                <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  MAPBOX
                </span>
                {!apiKey && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    (需要API密钥)
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allLayers.mapbox.map((layer) => (
                  <LayerButton
                    key={layer.id}
                    layer={layer}
                    isActive={currentProvider === "mapbox" && currentLayerId === layer.id}
                    colorScheme="blue"
                    disabled={!apiKey}
                    onClick={() => {
                      if (!apiKey) {
                        alert(
                          "Mapbox需要API密钥。如需使用Mapbox，请联系管理员配置环境变量 VITE_MAP_API_KEY",
                        );
                        return;
                      }
                      onLayerChange("mapbox", layer.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 图层按钮子组件
interface LayerButtonProps {
  layer: LayerConfig;
  isActive: boolean;
  colorScheme: "purple" | "green" | "blue";
  disabled?: boolean;
  onClick: () => void;
}

const LayerButton: React.FC<LayerButtonProps> = ({
  layer,
  isActive,
  colorScheme,
  disabled = false,
  onClick,
}) => {
  const colorClasses = {
    purple: {
      active: "bg-purple-600/10 dark:bg-purple-900/30 border-l-2 border-purple-600 text-purple-800 dark:text-purple-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-purple-600 dark:bg-purple-300",
    },
    green: {
      active: "bg-green-600/10 dark:bg-green-900/30 border-l-2 border-green-600 text-green-800 dark:text-green-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-green-600 dark:bg-green-300",
    },
    blue: {
      active: "bg-blue-600/10 dark:bg-blue-900/30 border-l-2 border-blue-600 text-blue-800 dark:text-blue-200",
      inactive: "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100",
      indicator: "bg-blue-600 dark:bg-blue-300",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <button
      role="menuitemradio"
      aria-checked={isActive}
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-600"
          : isActive
            ? colors.active
            : colors.inactive
      }`}
    >
      <span className="flex-1 text-left">{layer.name}</span>
      {isActive && !disabled && (
        <div className={`w-1.5 h-1.5 rounded-full ${colors.indicator}`}></div>
      )}
    </button>
  );
};
