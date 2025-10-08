// 运行时配置加载器 - 应用启动时从后端获取最新的地图配置

import { apiService } from '@/services/api'

interface MapConfigResponse {
  provider?: string
  apiKey?: string
  cesiumIonToken?: string
}

const ensureAppConfig = () => {
  if (!window.APP_CONFIG) {
    window.APP_CONFIG = {}
  }
}

const assignIfString = (target: Record<string, unknown>, key: string, value: unknown) => {
  if (typeof value === 'string') {
    target[key] = value
  }
}

/**
 * 从后端加载地图配置并注入到 window.APP_CONFIG
 */
export async function loadMapConfig(): Promise<void> {
  try {
    const response = await apiService.getPublicMapConfig()

    if (response.success && response.data) {
      ensureAppConfig()

      const data = response.data as MapConfigResponse

      // Provider 优先使用后端返回，其次读取已有配置，最后使用安全默认值
      const provider =
        data.provider ??
        window.APP_CONFIG.MAP_PROVIDER ??
        (import.meta.env.VITE_MAP_PROVIDER as string | undefined) ??
        'carto'

      window.APP_CONFIG.MAP_PROVIDER = provider

      // API key 与 Cesium token 仅在后端提供时覆盖（保持前端注入的默认值）
      assignIfString(window.APP_CONFIG, 'MAP_API_KEY', data.apiKey)
      assignIfString(window.APP_CONFIG, 'CESIUM_ION_TOKEN', data.cesiumIonToken)

      console.info(
        '%cMap Config Loaded',
        'color: #10b981; font-weight: bold',
        `Provider: ${window.APP_CONFIG.MAP_PROVIDER}`
      )
    } else {
      console.warn('Failed to load map config, using defaults')
    }
  } catch (error) {
    console.error('Error loading map config:', error)
    // 失败时使用兜底配置，确保组件仍可渲染
    ensureAppConfig()
    if (typeof window.APP_CONFIG.MAP_PROVIDER !== 'string') {
      window.APP_CONFIG.MAP_PROVIDER = 'carto'
    }
    if (typeof window.APP_CONFIG.MAP_API_KEY !== 'string') {
      window.APP_CONFIG.MAP_API_KEY = ''
    }
  }
}
