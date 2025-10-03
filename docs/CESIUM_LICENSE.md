# Cesium 收费说明

## 简单回答

**Cesium 本身是免费开源的**，但某些云服务需要付费。

---

## 详细说明

### ✅ 免费部分

#### 1. Cesium.js 库（完全免费）
- Apache 2.0 开源许可
- 3D 地球渲染引擎
- 可商用、修改、分发
- **我们项目使用的就是这个**

#### 2. 免费地图资源
- NaturalEarth II 离线地图（内置）
- OpenStreetMap 在线地图
- CartoDB 免费地图
- Stamen 免费地图

### ❌ 付费部分（我们不使用）

#### Cesium Ion 云服务
- 高精度全球地形
- Bing Maps 卫星影像
- 大流量使用（超过免费额度）

---

## 我们的实现方案

### 当前配置（完全免费）

```typescript
// ✅ 使用 Cesium 内置的离线地图
baseLayer: Cesium.ImageryLayer.fromProviderAsync(
  Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
  )
),

// ✅ 不使用地形服务
terrain: undefined,

// ✅ 禁用底图选择器（避免 Ion API 调用）
baseLayerPicker: false,
```

**特点**：
- ✅ 完全免费
- ✅ 无需注册账号
- ✅ 无流量限制
- ✅ 离线可用
- ✅ 无 401 错误
- ❌ 地图细节较少

---

## 可选的免费升级方案

### 方案 1: OpenStreetMap（推荐）

```typescript
baseLayer: Cesium.ImageryLayer.fromProviderAsync(
  Cesium.OpenStreetMapImageryProvider.fromUrl(
    'https://tile.openstreetmap.org/'
  )
),
```

**特点**：
- ✅ 完全免费
- ✅ 地图细节丰富
- ✅ 定期更新
- ❌ 需要网络连接

### 方案 2: CartoDB 暗色主题

```typescript
baseLayer: Cesium.ImageryLayer.fromProviderAsync(
  Cesium.UrlTemplateImageryProvider.fromUrl(
    'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    {
      subdomains: ['a', 'b', 'c', 'd']
    }
  )
),
```

**特点**：
- ✅ 完全免费
- ✅ 暗色主题美观
- ✅ 性能优秀
- ❌ 需要网络连接

---

## Token 说明

代码中的这行：

```typescript
Cesium.Ion.defaultAccessToken = 'eyJhbG...';
```

**这个 token 的作用**：
- 仅用于 Cesium 库的兼容性
- 我们实际不使用 Ion 服务
- 可以设置为空字符串或删除
- 不会产生任何费用

---

## 总结

| 项目 | 是否免费 | 我们是否使用 |
|------|---------|------------|
| Cesium.js 库 | ✅ 完全免费 | ✅ 使用 |
| NaturalEarth II 地图 | ✅ 完全免费 | ✅ 使用 |
| OpenStreetMap | ✅ 完全免费 | ⚪ 可选 |
| CartoDB 地图 | ✅ 完全免费 | ⚪ 可选 |
| Cesium Ion 地形 | ❌ 付费服务 | ❌ 不使用 |
| Bing Maps 影像 | ❌ 付费服务 | ❌ 不使用 |

**结论**：我们的实现**100% 免费**，不会产生任何费用！

---

## 如何切换地图

如果想使用更好的地图，编辑：

`frontend/src/components/map/Globe3D.tsx`

替换 `baseLayer` 配置即可。详见 `docs/CESIUM_FREE_MAPS.md`。
