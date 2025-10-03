# 后台地图配置管理

## 概述

现在您可以在 Web 后台管理界面中直接配置地图源，无需 SSH 操作即可生效！

## 功能特点

✅ **Web 界面配置** - 在后台系统设置中直接修改地图配置  
✅ **实时生效** - 保存后刷新页面即可看到新地图源  
✅ **无需 SSH** - 不需要登录服务器修改环境变量  
✅ **统一管理** - 2D 和 3D 地图使用相同的配置  
✅ **持久化存储** - 配置保存在数据库中，重启不会丢失

## 如何使用

### 1. 访问系统设置

1. 登录后台管理界面
2. 点击左侧菜单的 **"系统配置"** 或 **"系统设置"**
3. 找到 **"地图配置"** 分类

### 2. 配置地图源

在地图配置分类中，您会看到两个配置项：

#### **map.provider** (地图服务提供商)

可选值：
- `carto` - CartoDB (推荐，免费高质量)
- `openstreetmap` - OpenStreetMap (免费开源)
- `mapbox` - Mapbox (需要 API Key，高级功能)

#### **map.api_key** (地图 API 密钥)

- 仅在使用 Mapbox 时需要填写
- 其他地图源可以留空

### 3. 保存并应用

1. 修改配置后点击 **"保存修改"** 按钮
2. 等待保存成功提示
3. **刷新浏览器页面** (Ctrl+Shift+R 或 Cmd+Shift+R)
4. 地图会自动加载新的配置

## 配置示例

### 使用 CartoDB (推荐)

```
map.provider: carto
map.api_key: (留空)
```

### 使用 OpenStreetMap

```
map.provider: openstreetmap
map.api_key: (留空)
```

### 使用 Mapbox

```
map.provider: mapbox
map.api_key: pk.ey... (您的 Mapbox API Key)
```

## 技术实现

### 配置加载流程

1. **应用启动** → 前端从 `/api/public/map-config` 获取配置
2. **注入配置** → 配置写入 `window.APP_CONFIG`
3. **地图初始化** → 2D/3D 地图读取配置并加载对应的地图源

### API 端点

- **GET** `/api/public/map-config` - 获取地图配置(公开，无需认证)
- **GET** `/api/admin/configs` - 获取所有系统配置(需要管理员权限)
- **PUT** `/api/admin/configs/:key` - 更新配置(需要管理员权限)

### 数据库存储

配置存储在 `setting` 表中：

```sql
key: 'map.provider'
value: '"carto"'  -- JSON 格式
category: 'map'

key: 'map.api_key'
value: '""'  -- JSON 格式
category: 'map'
```

## 常见问题

### Q: 修改配置后没有生效？

**A:** 请确保：
1. 点击了"保存修改"按钮并看到成功提示
2. 刷新了浏览器页面 (Ctrl+Shift+R)
3. 检查浏览器控制台是否有 "✅ Map Config Loaded" 日志

### Q: 地图显示空白或加载失败？

**A:** 检查：
1. `map.provider` 值是否正确 (carto/openstreetmap/mapbox)
2. 如果使用 Mapbox，API Key 是否正确
3. 打开浏览器控制台查看错误信息

### Q: 配置会在容器重启后丢失吗？

**A:** 不会！配置存储在数据库中，只要数据库有持久化卷，配置就会保留。

### Q: 可以为不同用户配置不同的地图源吗？

**A:** 当前版本是全局配置，所有用户使用相同的地图源。

## 地图源对比

| 地图源 | 免费 | 质量 | 3D支持 | API Key |
|--------|------|------|--------|---------|
| **CartoDB** | ✅ | ⭐⭐⭐⭐⭐ | ✅ | ❌ 不需要 |
| **OpenStreetMap** | ✅ | ⭐⭐⭐⭐ | ✅ | ❌ 不需要 |
| **Mapbox** | 部分 | ⭐⭐⭐⭐⭐ | ✅ | ✅ 需要 |

## 推荐配置

- **生产环境**: CartoDB (免费 + 高质量 + 稳定)
- **开发环境**: OpenStreetMap (开源 + 快速)
- **商业项目**: Mapbox (付费 + 最佳视觉效果)

## 更新日志

### 2025-10-03
- ✅ 添加公共地图配置 API
- ✅ 前端自动加载地图配置
- ✅ 后台系统设置支持地图配置修改
- ✅ 2D/3D 地图统一使用数据库配置
- ✅ 配置修改后无需重启服务
