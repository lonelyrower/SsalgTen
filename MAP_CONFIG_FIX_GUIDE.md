# 地图配置功能修复指南

## 问题说明

**如果您已经安装了 SsalgTen，但在后台系统设置中看不到"地图配置"选项，这是因为之前的版本缺少数据库初始化。**

## 🚀 快速修复（推荐）

### 方法一：运行迁移脚本（已部署系统）

```bash
# 进入项目目录
cd /opt/ssalgten  # 或您的安装目录

# 运行迁移脚本
docker compose exec backend npm run migrate:map-config

# 或直接使用 tsx
docker compose exec backend npx tsx src/scripts/migrate-map-config.ts
```

### 方法二：使用 ssalgten 命令

```bash
# 执行迁移
ssalgten exec backend npm run migrate:map-config
```

### 方法三：手动添加配置（使用 Prisma Studio）

```bash
# 1. 打开 Prisma Studio
docker compose exec backend npx prisma studio

# 2. 访问 http://localhost:5555

# 3. 进入 setting 表

# 4. 添加以下两条记录：
```

**记录1:**
- key: `map.provider`
- value: `"carto"` (注意：包含引号，这是JSON格式)
- category: `map`
- description: `Map tile provider (carto, openstreetmap, mapbox)`

**记录2:**
- key: `map.api_key`
- value: `""` (注意：空字符串也要用引号)
- category: `map`
- description: `Map API key (required for mapbox)`

## ✅ 验证修复

### 1. 检查API

```bash
curl http://localhost:3001/api/public/map-config
```

**预期输出:**
```json
{
  "success": true,
  "data": {
    "provider": "carto",
    "apiKey": ""
  }
}
```

### 2. 检查后台界面

1. 登录后台: `http://your-ip:3000/admin`
2. 点击左侧菜单 "系统设置"
3. 应该能看到 **"地图配置"** 分类
4. 包含两个配置项:
   - `map.provider` - 地图服务提供商
   - `map.api_key` - 地图API密钥

## 🎯 如何使用地图配置

### 切换地图源

1. **访问系统设置**
   - 登录后台管理界面
   - 点击 "系统设置"
   - 找到 "地图配置" 分类

2. **选择地图提供商**
   
   修改 `map.provider` 为以下值之一：
   - `carto` - CartoDB (免费，高质量) ⭐推荐
   - `openstreetmap` - OpenStreetMap (免费，开源)
   - `mapbox` - Mapbox (需要API Key)

3. **配置 API Key (可选)**
   
   只有使用 Mapbox 时需要：
   - 访问 https://account.mapbox.com/access-tokens/
   - 获取 Access Token
   - 填入 `map.api_key` 配置项

4. **保存并应用**
   - 点击 "保存修改" 按钮
   - 刷新浏览器页面 (Ctrl+Shift+R 或 Cmd+Shift+R)
   - 2D地图和3D地球都会使用新配置

## 📋 全新安装（未来版本）

如果您是全新安装（在此修复之后）：

```bash
# 1. 正常安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- deploy

# 2. 地图配置会自动初始化
#    无需手动迁移

# 3. 直接使用
#    登录后台 → 系统设置 → 地图配置
```

## 🔧 重新初始化（高级）

如果需要重新初始化所有配置：

```bash
# ⚠️ 警告：这会重置所有系统配置（不会删除用户和节点数据）

docker compose exec backend npm run db:seed
```

## 📚 支持的地图源对比

| 地图源 | 免费 | 质量 | 需要Key | 特点 |
|--------|------|------|---------|------|
| **Carto** | ✅ | ⭐⭐⭐⭐⭐ | ❌ | 高质量免费地图，推荐首选 |
| **OpenStreetMap** | ✅ | ⭐⭐⭐⭐ | ❌ | 开源社区维护，无限制使用 |
| **Mapbox** | ❌ | ⭐⭐⭐⭐⭐ | ✅ | 商业级地图，需注册获取Key |

## ❓ 常见问题

### Q1: 修改后地图没变化？
**A:** 确保点击了保存按钮，然后按 **Ctrl+Shift+R** 强制刷新浏览器

### Q2: 显示空白地图？
**A:** 检查 provider 值是否拼写正确，必须是小写：
- ✅ `carto`
- ✅ `openstreetmap` 
- ✅ `mapbox`
- ❌ `Carto` (错误)
- ❌ `OpenStreetMap` (错误)

### Q3: Mapbox 地图不显示？
**A:** 需要配置有效的 API Key：
1. 访问 https://account.mapbox.com/
2. 创建免费账户
3. 复制 Access Token
4. 粘贴到 `map.api_key` 配置项

### Q4: 配置会丢失吗？
**A:** 不会！配置保存在数据库中，重启容器不会丢失

### Q5: 可以为不同用户配置不同地图吗？
**A:** 当前版本是全局配置，所有用户使用相同地图源

## 🆘 需要帮助？

如遇到问题，请提供以下信息：

1. **API测试结果**
   ```bash
   curl http://localhost:3001/api/public/map-config
   ```

2. **后台截图**
   - 系统设置页面的截图
   - 浏览器控制台的错误信息

3. **日志检查**
   ```bash
   docker compose logs backend | tail -100
   ```

提交 Issue: https://github.com/lonelyrower/SsalgTen/issues

## 📝 更新日志

- **2025-01-XX**: 修复地图配置缺失问题
- **2025-01-XX**: 添加迁移脚本
- **2025-01-XX**: 更新文档
