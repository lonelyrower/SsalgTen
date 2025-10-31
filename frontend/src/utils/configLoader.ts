// 运行时配置加载器 - 应用启动时从后端获取最新的地图配置

import { apiService } from "@/services/api";

interface MapConfigResponse {
  provider?: string;
  apiKey?: string;
  cesiumIonToken?: string;
}

const ensureAppConfig = (): Record<string, unknown> => {
  if (!window.APP_CONFIG) {
    window.APP_CONFIG = {};
  }
  return window.APP_CONFIG;
};

const assignIfString = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  if (typeof value === "string") {
    target[key] = value;
  }
};

/**
 * 从后端加载地图配置并注入到 window.APP_CONFIG
 */
export async function loadMapConfig(): Promise<void> {
  try {
    const response = await apiService.getPublicMapConfig();

    if (response.success && response.data) {
      const config = ensureAppConfig();
      const data = response.data as MapConfigResponse;

      const envProvider =
        (import.meta.env.VITE_MAP_PROVIDER as string | undefined) ?? undefined;
      const envApiKey =
        (import.meta.env.VITE_MAP_API_KEY as string | undefined) ?? undefined;

      const incomingApiKey =
        typeof data.apiKey === "string" && data.apiKey.trim().length > 0
          ? data.apiKey.trim()
          : undefined;

      if (incomingApiKey) {
        config.MAP_API_KEY = incomingApiKey;
      } else if (typeof config.MAP_API_KEY !== "string" && envApiKey) {
        config.MAP_API_KEY = envApiKey;
      }

      assignIfString(config, "CESIUM_ION_TOKEN", data.cesiumIonToken);

      const resolvedApiKey =
        (typeof config.MAP_API_KEY === "string" &&
        config.MAP_API_KEY.trim().length > 0
          ? (config.MAP_API_KEY as string)
          : envApiKey) || "";

      const normalizeProvider = (value?: unknown): string | undefined => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim().toLowerCase();
        return ["carto", "openstreetmap", "mapbox"].includes(normalized)
          ? normalized
          : undefined;
      };

      let provider =
        normalizeProvider(data.provider) ??
        normalizeProvider(config.MAP_PROVIDER) ??
        normalizeProvider(envProvider);

      if (!provider) {
        provider = resolvedApiKey ? "mapbox" : "carto";
      }

      config.MAP_PROVIDER = provider;

      console.info(
        "%cMap Config Loaded",
        "color: #10b981; font-weight: bold",
        `Provider: ${config.MAP_PROVIDER}`,
      );
    } else {
      console.warn("Failed to load map config, using defaults");
    }
  } catch (error) {
    console.error("Error loading map config:", error);
    // 失败时使用兜底配置，确保组件仍可渲染
    const config = ensureAppConfig();
    if (typeof config.MAP_PROVIDER !== "string") {
      config.MAP_PROVIDER = "carto";
    }
    if (typeof config.MAP_API_KEY !== "string") {
      config.MAP_API_KEY = "";
    }
  }
}
