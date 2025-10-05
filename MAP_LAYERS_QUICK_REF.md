# 地图图层快速参考

## ✅ 修复完成

### 问题 1: 3D 地球图层按钮对比度差
**修复：** 使用高对比度配色方案
- 选中状态：彩色背景 + 白色文字
- 未选中状态：深色文字 + 浅色背景
- 添加动画和阴影增强反馈

### 问题 2: 3D 地球出现 2D 地图样式
**修复：** 移除 OpenStreetMap 和 CartoDB，替换为 4 种专业 3D 图层
- 🛰️ 卫星影像 (Esri World Imagery)
- 🗺️ 地形图 (Esri World Terrain)
- 📍 街道底图 (Esri World Street Map)
- 🌍 国家地理 (NatGeo World Map)

### 问题 3: 2D 地图缺少样式选择
**现状：** EnhancedWorldMap 已有完整的 10 种样式！
- CARTO: 3 种 (Light/Dark/Voyager)
- OpenStreetMap: 3 种 (Standard/HOT/CycleMap)
- Mapbox: 4 种 (Streets/Satellite/Dark/Light)

---

## 🎯 图层选择建议

### 3D 地球 (Globe3D)
| 图层 | 适用场景 |
|------|---------|
| 🛰️ 卫星影像 | 真实地貌展示、地理分析 |
| 🗺️ 地形图 | 地形起伏可视化、教学 |
| 📍 街道底图 | 地名定位、位置查询 |
| 🌍 国家地理 | 演示展示、美观风格 |

### 2D 地图 (EnhancedWorldMap)
| 图层 | 适用场景 |
|------|---------|
| CARTO Light | 数据可视化、亮色主题 |
| CARTO Dark | 深色主题、夜间模式 |
| CARTO Voyager | 中性配色、通用场景 |
| OSM Standard | 免费开源、详细准确 |
| OSM HOT | 人道主义、医疗设施 |
| OSM CycleMap | 自行车路线、户外活动 |
| Mapbox Streets | 最详细街道（需 API Key） |
| Mapbox Satellite | 2D 卫星图（需 API Key） |
| Mapbox Dark/Light | 精美主题（需 API Key） |

---

## 🔧 如何使用

### 切换 3D 图层
1. 打开 3D 地球视图
2. 点击右上角 "图层" 按钮
3. 选择需要的底图样式

### 切换 2D 图层
1. 打开 2D 地图视图
2. 点击右上角 "图层" 按钮
3. 选择提供商（CARTO/OSM/Mapbox）
4. 选择具体样式

### 配置 Mapbox
1. 系统设置 → 地图配置
2. 设置 `MAP_API_KEY`
3. 保存并刷新页面

---

**修改文件：** `frontend/src/components/map/Globe3D.tsx`  
**详细文档：** `MAP_LAYERS_OPTIMIZATION.md`
