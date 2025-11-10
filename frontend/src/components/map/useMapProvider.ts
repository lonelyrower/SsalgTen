import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { logger } from "@/utils/logger";
import type { MapProvider, LayerConfig } from "./MapLayerConfig";
import {
  resolveStoredProvider,
  resolvePreferredProvider,
  resolveStoredLayerId,
  getDefaultLayerForProvider,
  getAllLayers,
  LOCAL_STORAGE_PROVIDER_KEY,
  LOCAL_STORAGE_LAYER_KEY,
  LOCAL_STORAGE_SELECTION_KEY,
} from "./MapLayerConfig";

interface UseMapProviderResult {
  currentProvider: MapProvider;
  currentLayerId: string;
  currentLayerConfig: LayerConfig;
  allLayers: Record<MapProvider, LayerConfig[]>;
  apiKey: string;
  switchMapLayer: (provider: MapProvider, layerId: string, options?: { persist?: boolean; manual?: boolean }) => void;
  tileErrorCountRef: React.MutableRefObject<number>;
  handleTileError: () => void;
}

export const useMapProvider = (): UseMapProviderResult => {
  const storedProvider = useMemo(() => resolveStoredProvider(), []);
  const initialProvider = useMemo(
    () => storedProvider ?? resolvePreferredProvider(),
    [storedProvider],
  );
  const manualPreferenceRef = useRef<boolean>(Boolean(storedProvider));
  const tileErrorCountRef = useRef(0);

  const [currentProvider, setCurrentProvider] = useState<MapProvider>(initialProvider);
  const [currentLayerId, setCurrentLayerId] = useState<string>(() => {
    const storedLayerId = resolveStoredLayerId(storedProvider);
    if (storedLayerId) {
      return storedLayerId;
    }
    return getDefaultLayerForProvider(initialProvider);
  });

  // 获取API key（用于Mapbox）- 使用 useState 确保响应式更新
  const [apiKey, setApiKey] = useState<string>(() => {
    const w: any = typeof window !== "undefined" ? (window as any) : {};
    return (
      w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || ""
    );
  });

  // 监听 APP_CONFIG 的变化，动态更新 apiKey
  useEffect(() => {
    const checkApiKey = () => {
      const w: any = typeof window !== "undefined" ? (window as any) : {};
      const newApiKey =
        w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || "";
      if (newApiKey && newApiKey !== apiKey) {
        setApiKey(newApiKey);
      }
    };

    // 立即检查一次
    checkApiKey();

    // 设置轮询检查（仅在 apiKey 为空时）
    let intervalId: NodeJS.Timeout | undefined;
    if (!apiKey) {
      intervalId = setInterval(checkApiKey, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [apiKey]);

  // 获取所有图层
  const allLayers = useMemo(() => getAllLayers(apiKey), [apiKey]);

  // 获取当前提供商的所有图层（带安全检查）
  const currentProviderLayers = useMemo(() => {
    return allLayers[currentProvider] || allLayers.carto || [];
  }, [allLayers, currentProvider]);

  // 获取当前选中的图层配置（带安全检查）
  const currentLayerConfig = useMemo(() => {
    if (!currentProviderLayers || currentProviderLayers.length === 0) {
      // 如果没有可用图层，返回一个默认配置
      return {
        id: "carto-light",
        name: "Light 亮色",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      };
    }
    const layer = currentProviderLayers.find((l) => l.id === currentLayerId);
    return layer || currentProviderLayers[0]; // 否则降级到第一个
  }, [currentProviderLayers, currentLayerId]);

  const fallbackToDefaultLayer = useCallback(
    (reason?: string) => {
      const fallbackProvider: MapProvider = "carto";
      const fallbackLayerId = getDefaultLayerForProvider(fallbackProvider);

      if (
        currentProvider === fallbackProvider &&
        currentLayerId === fallbackLayerId
      ) {
        return false;
      }

      if (reason) {
        logger.warn(
          `[EnhancedWorldMap] Fallback to default layer due to: ${reason}`,
        );
      }

      setCurrentProvider(fallbackProvider);
      setCurrentLayerId(fallbackLayerId);
      manualPreferenceRef.current = false;

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, fallbackProvider);
          localStorage.setItem(LOCAL_STORAGE_LAYER_KEY, fallbackLayerId);
          localStorage.setItem(LOCAL_STORAGE_SELECTION_KEY, "auto");
        } catch (error) {
          logger.warn("Failed to persist fallback map provider", error);
        }
      }
      return true;
    },
    [currentLayerId, currentProvider],
  );

  useEffect(() => {
    const hasValidUrl =
      currentLayerConfig &&
      typeof currentLayerConfig.url === "string" &&
      currentLayerConfig.url.trim().length > 0;

    if (hasValidUrl) {
      return;
    }

    fallbackToDefaultLayer("missing or invalid tile URL");
  }, [currentLayerConfig, fallbackToDefaultLayer]);

  // 切换地图提供商和图层，并保存到 localStorage
  const switchMapLayer = useCallback(
    (
      provider: MapProvider,
      layerId: string,
      options: { persist?: boolean; manual?: boolean } = {},
    ) => {
      const { persist = true, manual = true } = options;
      setCurrentProvider(provider);
      setCurrentLayerId(layerId);
      manualPreferenceRef.current = manual;
      if (persist && typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEY, provider);
          localStorage.setItem(LOCAL_STORAGE_LAYER_KEY, layerId);
          localStorage.setItem(
            LOCAL_STORAGE_SELECTION_KEY,
            manual ? "manual" : "auto",
          );
        } catch (error) {
          logger.warn("Failed to save map preferences to localStorage", error);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !manualPreferenceRef.current &&
      apiKey &&
      currentProvider !== "mapbox"
    ) {
      switchMapLayer("mapbox", getDefaultLayerForProvider("mapbox"), {
        manual: false,
      });
    }
  }, [apiKey, currentProvider, switchMapLayer]);

  useEffect(() => {
    tileErrorCountRef.current = 0;
  }, [currentProvider, currentLayerId]);

  const handleTileError = useCallback(() => {
    if (!currentLayerConfig?.requiresApiKey && currentProvider === "carto") {
      return;
    }

    tileErrorCountRef.current += 1;

    if (tileErrorCountRef.current >= 2) {
      fallbackToDefaultLayer(
        `tile load failure (${currentProvider}/${currentLayerId})`,
      );
    }
  }, [
    currentLayerConfig?.requiresApiKey,
    currentLayerId,
    currentProvider,
    fallbackToDefaultLayer,
  ]);

  return {
    currentProvider,
    currentLayerId,
    currentLayerConfig,
    allLayers,
    apiKey,
    switchMapLayer,
    tileErrorCountRef,
    handleTileError,
  };
};
