# 后台地图配置功能 - 更新摘要

## 🎉 新功能：Web 界面配置地图源

现在您可以在后台管理界面直接切换地图源，无需 SSH 操作！

## ✨ 主要特性

### 1. Web 界面配置
- 登录后台 → 系统配置 → 地图配置
- 修改 `map.provider` 和 `map.api_key`
- 保存后刷新页面即可生效

### 2. 支持的地图源
- **CartoDB** (carto) - 免费，推荐
- **OpenStreetMap** (openstreetmap) - 免费，开源
- **Mapbox** (mapbox) - 需要 API Key

### 3. 统一配置
- 2D 地图和 3D 地球使用相同配置
- 配置保存在数据库，重启不丢失

## 📦 部署方式

### 快速更新
```bash
cd /path/to/SsalgTen
./scripts/ssalgten.sh update
```

### 或者使用一键部署
```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- deploy --image ghcr.io/lonelyrower/ssalgten
```

## 🚀 使用步骤

1. **访问后台** - 登录管理界面
2. **打开系统配置** - 点击左侧菜单的"系统配置"
3. **找到地图配置** - 展开"地图配置"分类
4. **修改配置**
   - `map.provider`: 改为 `carto` 或 `openstreetmap` 或 `mapbox`
   - `map.api_key`: 仅 Mapbox 需要填写
5. **保存并刷新** - 点击保存，然后按 Ctrl+Shift+R 刷新页面

## 🔍 验证部署

```bash
# 检查 API 是否正常
curl http://localhost:3001/api/public/map-config

# 预期输出
{
  "success": true,
  "data": {
    "provider": "carto",
    "apiKey": ""
  }
}
```

## 📚 详细文档

- **使用指南**: [MAP_CONFIG_ADMIN.md](./MAP_CONFIG_ADMIN.md)
- **部署指南**: [MAP_CONFIG_DEPLOYMENT.md](./MAP_CONFIG_DEPLOYMENT.md)
- **3D地图配置**: [3D_MAP_PROVIDERS.md](./3D_MAP_PROVIDERS.md)

## 🛠️ 技术实现

### 后端
- 新增 `/api/public/map-config` API (公开，无需认证)
- 从数据库读取 `map.provider` 和 `map.api_key` 配置

### 前端
- 应用启动时自动加载地图配置
- 配置注入到 `window.APP_CONFIG`
- 2D/3D 地图读取统一配置

### 数据库
- 配置存储在 `setting` 表
- 系统启动时自动初始化默认值

## ❓ 常见问题

**Q: 修改后不生效？**
A: 确保点击了保存，并按 Ctrl+Shift+R 刷新页面

**Q: 地图显示空白？**
A: 检查 provider 值是否正确，使用 Mapbox 需要填写 API Key

**Q: 配置会丢失吗？**
A: 不会，配置存储在数据库中，只要数据库有持久化卷就不会丢失

## 📊 配置对比

| 方式 | 修改方式 | 需要重启 | 需要SSH | 难度 |
|------|---------|---------|---------|------|
| **新方式 (数据库)** | Web界面 | ❌ | ❌ | ⭐ |
| 旧方式 (环境变量) | 修改.env | ✅ | ✅ | ⭐⭐⭐ |

## 🎯 推荐配置

```
生产环境: map.provider = carto (免费+高质量)
开发环境: map.provider = openstreetmap (开源+快速)
```

---

**更新时间**: 2025-10-03  
**版本要求**: v1.0.0+  
**兼容性**: 向后兼容，支持环境变量作为备用配置
