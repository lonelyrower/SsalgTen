import { logger } from "@/utils/logger";

// 地图提供商类型
export type MapProvider = "carto" | "openstreetmap" | "mapbox";

// 图层配置接口
export interface LayerConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  requiresApiKey?: boolean;
}

export const SUPPORTED_PROVIDERS: MapProvider[] = ["carto", "openstreetmap", "mapbox"];
export const LOCAL_STORAGE_PROVIDER_KEY = "map_provider";
export const LOCAL_STORAGE_LAYER_KEY = "map_layer_id";
export const LOCAL_STORAGE_SELECTION_KEY = "map_provider_selected";

export const normalizeProvider = (value?: unknown): MapProvider | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return (SUPPORTED_PROVIDERS as string[]).includes(normalized)
    ? (normalized as MapProvider)
    : undefined;
};

export const resolveStoredSelectionMode = (): "manual" | "auto" | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_SELECTION_KEY);
    return stored === "manual" || stored === "auto" ? stored : null;
  } catch (error) {
    logger.warn(
      "Failed to read map provider selection mode from localStorage",
      error,
    );
    return null;
  }
};

export const hasAnyApiKeyAvailable = (): boolean => {
  const envKey = import.meta.env.VITE_MAP_API_KEY as string | undefined;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return true;
  }
  if (typeof window !== "undefined") {
    const w: any = window;
    const runtimeKey = w.APP_CONFIG?.MAP_API_KEY;
    return typeof runtimeKey === "string" && runtimeKey.trim().length > 0;
  }
  return false;
};

export const resolveStoredProvider = (): MapProvider | undefined => {
  if (typeof window === "undefined") return undefined;
  if (resolveStoredSelectionMode() !== "manual") return undefined;
  try {
    const stored = normalizeProvider(
      localStorage.getItem(LOCAL_STORAGE_PROVIDER_KEY),
    );
    if (stored === "mapbox" && !hasAnyApiKeyAvailable()) {
      return undefined;
    }
    return stored;
  } catch (error) {
    logger.warn("Failed to read map provider from localStorage", error);
    return undefined;
  }
};

export const resolveStoredLayerId = (provider?: MapProvider): string | undefined => {
  if (!provider) return undefined;
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_LAYER_KEY);
    return typeof stored === "string" && stored.trim().length > 0
      ? stored
      : undefined;
  } catch (error) {
    logger.warn("Failed to read map layer ID from localStorage", error);
    return undefined;
  }
};

export const resolvePreferredProvider = (): MapProvider => {
  const storedProvider = resolveStoredProvider();
  if (storedProvider) {
    return storedProvider;
  }

  const w: any = typeof window !== "undefined" ? (window as any) : {};
  const runtimeProvider = normalizeProvider(w.APP_CONFIG?.MAP_PROVIDER);
  if (runtimeProvider) {
    if (runtimeProvider === "mapbox" && !hasAnyApiKeyAvailable()) {
      logger.warn(
        "[EnhancedWorldMap] MAP_PROVIDER=mapbox but no API key detected, falling back to carto",
      );
    } else {
      return runtimeProvider;
    }
  }

  const envProvider = normalizeProvider(
    import.meta.env.VITE_MAP_PROVIDER as string | undefined,
  );
  if (envProvider) {
    if (envProvider === "mapbox" && !hasAnyApiKeyAvailable()) {
      logger.warn(
        "[EnhancedWorldMap] VITE_MAP_PROVIDER=mapbox without API key, falling back to carto",
      );
    } else {
      return envProvider;
    }
  }

  return hasAnyApiKeyAvailable() ? "mapbox" : "carto";
};

export const getDefaultLayerForProvider = (provider: MapProvider): string => {
  switch (provider) {
    case "mapbox":
      return "mapbox-streets";
    case "openstreetmap":
      return "osm-standard";
    case "carto":
    default:
      return "carto-light";
  }
};

// 获取所有图层配置
export const getAllLayers = (
  apiKey: string = "",
): Record<MapProvider, LayerConfig[]> => {
  return {
    carto: [
      {
        id: "carto-light",
        name: "Light 亮色",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
      {
        id: "carto-dark",
        name: "Dark 暗色",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
      {
        id: "carto-voyager",
        name: "Voyager 航海",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OSM contributors',
        subdomains: ["a", "b", "c", "d"],
      },
    ],
    openstreetmap: [
      {
        id: "osm-standard",
        name: "Standard 标准",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ["a", "b", "c"],
      },
      {
        id: "osm-hot",
        name: "HOT 人道主义",
        url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, HOT',
        subdomains: ["a", "b"],
      },
      {
        id: "osm-cycle",
        name: "CycleMap 自行车",
        url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, CyclOSM',
        subdomains: ["a", "b", "c"],
      },
    ],
    mapbox: [
      {
        id: "mapbox-streets",
        name: "Streets 街道",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-satellite",
        name: "Satellite 卫星",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-dark",
        name: "Dark 暗色",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
      {
        id: "mapbox-light",
        name: "Light 亮色",
        url: apiKey
          ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${apiKey}`
          : "",
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OSM contributors',
        requiresApiKey: true,
        subdomains: [],
      },
    ],
  };
};
