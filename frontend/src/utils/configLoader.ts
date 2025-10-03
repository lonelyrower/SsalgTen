// 配置加载器 - 在应用启动时从后端加载运行时配置

import { apiService } from '@/services/api';

/**
 * 从后端加载地图配置并注入到 window.APP_CONFIG
 */
export async function loadMapConfig(): Promise<void> {
  try {
    const response = await apiService.getPublicMapConfig();
    
    if (response.success && response.data) {
      // 确保 APP_CONFIG 对象存在
      if (!window.APP_CONFIG) {
        window.APP_CONFIG = {};
      }
      
      // 注入地图配置
      window.APP_CONFIG.MAP_PROVIDER = response.data.provider;
      window.APP_CONFIG.MAP_API_KEY = response.data.apiKey;
      
      console.info(
        '%c✅ Map Config Loaded',
        'color: #10b981; font-weight: bold',
        `Provider: ${response.data.provider}`
      );
    } else {
      console.warn('Failed to load map config, using defaults');
    }
  } catch (error) {
    console.error('Error loading map config:', error);
    // 失败时使用默认值
    if (!window.APP_CONFIG) {
      window.APP_CONFIG = {};
    }
    window.APP_CONFIG.MAP_PROVIDER = 'carto';
    window.APP_CONFIG.MAP_API_KEY = '';
  }
}
