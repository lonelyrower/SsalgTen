# 后台地图配置功能 - 部署指南

## 快速部署

### 方式一：完整重新部署 (推荐新安装)

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- deploy --image ghcr.io/lonelyrower/ssalgten
```

### 方式二：更新现有安装

```bash
cd /path/to/SsalgTen
./scripts/ssalgten.sh update
```

### 方式三：手动构建和部署

```bash
cd /path/to/SsalgTen

# 1. 拉取最新代码
git pull

# 2. 重新构建服务
docker compose down
docker compose build --no-cache backend frontend
docker compose up -d

# 3. 检查服务状态
docker compose ps
docker compose logs -f backend frontend
```

## 验证部署

### 1. 检查后端 API

```bash
curl http://localhost:3001/api/public/map-config
```

预期输出：
```json
{
  "success": true,
  "data": {
    "provider": "carto",
    "apiKey": ""
  }
}
```

### 2. 检查前端日志

打开浏览器控制台 (F12)，刷新页面，查找：

```
✅ Map Config Loaded Provider: carto
```

### 3. 测试后台配置

1. 登录后台管理界面
2. 进入 "系统配置"
3. 找到 "地图配置" 分类
4. 确认能看到 `map.provider` 和 `map.api_key` 配置项

## 功能测试

### 测试地图配置切换

1. **修改配置**
   - 后台系统设置 → 地图配置
   - 将 `map.provider` 改为 `openstreetmap`
   - 点击保存

2. **验证 API**
   ```bash
   curl http://localhost:3001/api/public/map-config
   ```
   确认返回的 provider 已更新

3. **刷新前端**
   - 按 Ctrl+Shift+R 硬刷新
   - 查看控制台日志确认新配置已加载
   - 检查地图是否使用新的地图源

4. **测试 3D 地球**
   - 打开首页地图
   - 切换到 3D 地球视图
   - 确认 3D 地球也使用了新配置

## 故障排查

### 问题：API 返回 404

**原因**: 后端没有更新

**解决**:
```bash
docker compose restart backend
docker compose logs backend | grep "map-config"
```

### 问题：配置修改后不生效

**检查步骤**:

1. 确认配置已保存到数据库
   ```bash
   docker compose exec backend npx prisma studio
   # 打开浏览器访问 http://localhost:5555
   # 查看 setting 表中的 map.provider 值
   ```

2. 确认 API 返回正确值
   ```bash
   curl http://localhost:3001/api/public/map-config
   ```

3. 确认前端加载了配置
   - 打开浏览器控制台
   - 输入: `window.APP_CONFIG`
   - 检查 MAP_PROVIDER 和 MAP_API_KEY 值

### 问题：地图显示空白

**可能原因**:

1. **provider 值不正确** - 检查是否为 carto/openstreetmap/mapbox
2. **Mapbox 缺少 API Key** - 如果使用 mapbox，确保填写了 api_key
3. **网络问题** - 检查是否能访问地图服务器

**调试步骤**:
```bash
# 1. 查看前端控制台错误
# 打开 F12 → Console

# 2. 查看网络请求
# F12 → Network → 筛选 "tiles" 或 "maps"

# 3. 测试地图源连接
curl -I https://basemaps.cartocdn.com/light_all/0/0/0.png
```

## 数据库迁移

如果数据库中没有地图配置，系统会在启动时自动初始化：

```typescript
// 自动创建的默认配置
map.provider = "carto"
map.api_key = ""
```

如果需要手动初始化：

```bash
docker compose exec backend npx ts-node -e "
import { prisma } from './src/lib/prisma';
async function init() {
  await prisma.setting.upsert({
    where: { key: 'map.provider' },
    update: {},
    create: {
      key: 'map.provider',
      value: JSON.stringify('carto'),
      category: 'map',
      description: 'Map tile provider (carto, openstreetmap, mapbox)'
    }
  });
  await prisma.setting.upsert({
    where: { key: 'map.api_key' },
    update: {},
    create: {
      key: 'map.api_key',
      value: JSON.stringify(''),
      category: 'map',
      description: 'Map API key (required for mapbox)'
    }
  });
  console.log('Map config initialized');
}
init();
"
```

## 环境变量对比

### 旧方式 (环境变量)

```env
# .env
VITE_MAP_PROVIDER=carto
VITE_MAP_API_KEY=

# 缺点：
# - 需要重新构建前端
# - 需要重启容器
# - 需要 SSH 访问
```

### 新方式 (数据库配置)

```
后台系统设置 → 地图配置

优点：
✅ Web 界面修改
✅ 无需重启服务
✅ 无需 SSH 访问
✅ 配置持久化
✅ 实时生效
```

## 配置优先级

系统按以下优先级读取地图配置：

1. **数据库配置** (最高优先级)
   - `window.APP_CONFIG.MAP_PROVIDER`
   - `window.APP_CONFIG.MAP_API_KEY`

2. **环境变量** (备用)
   - `import.meta.env.VITE_MAP_PROVIDER`
   - `import.meta.env.VITE_MAP_API_KEY`

3. **默认值** (最后)
   - provider: 'openstreetmap'
   - apiKey: ''

## 性能影响

### 加载时间

- **额外 API 请求**: 1 次 (约 50-100ms)
- **总启动延迟**: < 200ms
- **用户体验**: 几乎无感知

### 优化

配置会在应用启动时一次性加载，后续不会重复请求：

```typescript
// main.tsx - 启动时加载一次
loadMapConfig().then(() => {
  createRoot(...).render(...)
})

// 地图组件 - 直接读取 window.APP_CONFIG
const provider = window.APP_CONFIG?.MAP_PROVIDER || 'carto'
```

## 总结

### 主要变更

- ✅ 添加 `/api/public/map-config` API
- ✅ 前端启动时自动加载配置
- ✅ 后台系统设置支持地图配置
- ✅ 2D/3D 地图统一配置源

### 使用流程

```
1. 部署新版本
   ↓
2. 登录后台 → 系统配置 → 地图配置
   ↓
3. 修改 map.provider 和 map.api_key
   ↓
4. 保存配置
   ↓
5. 刷新浏览器 (Ctrl+Shift+R)
   ↓
6. 地图自动使用新配置 ✅
```

### 下一步

- [ ] 考虑添加配置热更新 (无需刷新页面)
- [ ] 添加地图源预览功能
- [ ] 支持自定义地图服务器 URL
- [ ] 添加地图性能监控
