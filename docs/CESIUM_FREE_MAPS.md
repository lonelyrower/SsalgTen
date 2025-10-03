// 🌍 Cesium 免费地图配置方案

/**
 * 方案对比：
 * 
 * 1. 当前方案（NaturalEarth II）- 完全离线
 *    ✅ 完全免费，无需网络
 *    ✅ 无流量限制
 *    ❌ 地图细节较少
 *    ❌ 无卫星影像
 * 
 * 2. OpenStreetMap（OSM）
 *    ✅ 完全免费开源
 *    ✅ 地图细节丰富
 *    ✅ 定期更新
 *    ❌ 需要网络请求
 *    ❌ 有使用限制（合理使用）
 * 
 * 3. Stamen 地图
 *    ✅ 免费使用
 *    ✅ 多种风格
 *    ❌ 需要网络
 * 
 * 4. CartoDB（现在叫 CARTO）
 *    ✅ 免费使用
 *    ✅ 简洁美观
 *    ❌ 需要网络
 */

// ==========================================
// 方案 1: 当前使用 - NaturalEarth II（完全离线）
// ==========================================
const useNaturalEarth = () => {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      )
    ),
    terrain: undefined,
    baseLayerPicker: false,
  };
};

// ==========================================
// 方案 2: OpenStreetMap（免费在线）
// ==========================================
const useOpenStreetMap = () => {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.OpenStreetMapImageryProvider.fromUrl(
        'https://tile.openstreetmap.org/'
      )
    ),
    terrain: undefined,
    baseLayerPicker: false,
  };
};

// ==========================================
// 方案 3: CartoDB 暗色主题（免费在线）
// ==========================================
const useCartoDark = () => {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.UrlTemplateImageryProvider.fromUrl(
        'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
        {
          credit: 'Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
          subdomains: ['a', 'b', 'c', 'd']
        }
      )
    ),
    terrain: undefined,
    baseLayerPicker: false,
  };
};

// ==========================================
// 方案 4: CartoDB 亮色主题（免费在线）
// ==========================================
const useCartoLight = () => {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.UrlTemplateImageryProvider.fromUrl(
        'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        {
          credit: 'Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
          subdomains: ['a', 'b', 'c', 'd']
        }
      )
    ),
    terrain: undefined,
    baseLayerPicker: false,
  };
};

// ==========================================
// 方案 5: Stamen Terrain（免费在线）
// ==========================================
const useStamenTerrain = () => {
  return {
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.UrlTemplateImageryProvider.fromUrl(
        'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
        {
          credit: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
        }
      )
    ),
    terrain: undefined,
    baseLayerPicker: false,
  };
};

// ==========================================
// 方案 6: 混合方案 - 让用户选择
// ==========================================
const useMultipleProviders = () => {
  // 创建多个 ImageryLayer
  const layers = [
    {
      name: 'NaturalEarth II (离线)',
      layer: new Cesium.ImageryLayer(
        new Cesium.TileMapServiceImageryProvider({
          url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
        })
      )
    },
    {
      name: 'OpenStreetMap',
      layer: new Cesium.ImageryLayer(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/'
        })
      )
    },
    {
      name: 'CartoDB Dark',
      layer: new Cesium.ImageryLayer(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c', 'd']
        })
      )
    }
  ];

  return {
    imageryProvider: false, // 禁用默认
    baseLayerPicker: true, // 启用选择器
    // 手动添加图层
    layers: layers
  };
};

// ==========================================
// 推荐使用（根据需求选择）
// ==========================================
export const recommendedConfig = {
  // 适合内网/离线环境
  offline: useNaturalEarth(),
  
  // 适合公网部署（最佳效果）
  online: useOpenStreetMap(),
  
  // 适合深色主题
  dark: useCartoDark(),
  
  // 适合浅色主题
  light: useCartoLight(),
  
  // 适合地形展示
  terrain: useStamenTerrain(),
};

// ==========================================
// 使用示例
// ==========================================
/*
// 在 Globe3D.tsx 中使用：

import { recommendedConfig } from './cesium-free-maps';

const viewer = new Cesium.Viewer(containerRef.current, {
  ...recommendedConfig.online, // 或 offline、dark、light、terrain
  
  // 其他配置...
  geocoder: false,
  homeButton: false,
  // ...
});
*/

// ==========================================
// 注意事项
// ==========================================
/*
1. 离线方案（NaturalEarth II）：
   - 完全免费，无需网络
   - 适合内网环境
   - 地图细节较少

2. 在线方案（OSM、CartoDB）：
   - 需要合理使用，避免滥用
   - 建议添加瓦片缓存
   - 遵守各服务的使用条款

3. 不要使用的（付费/限制）：
   ❌ Cesium Ion World Terrain（付费）
   ❌ Bing Maps（需要 API key）
   ❌ Mapbox（需要 token）
   ❌ Google Maps（违反条款）

4. Token 说明：
   - 当前代码中的 token 是公开的示例 token
   - 仅用于兼容性，实际不使用 Ion 服务
   - 可以设置为空字符串或删除
*/
