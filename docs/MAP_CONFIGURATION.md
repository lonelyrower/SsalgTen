# 地图配置指南 (Map Configuration Guide)

## 📍 支持的地图提供商

SsalgTen 支持多种地图底图，您可以根据需求选择：

### 1. **Carto** (推荐 ⭐)

**特点**：
- ✅ **速度快** - 全球 CDN，加载迅速
- ✅ **免费** - 无需 API key
- ✅ **简洁美观** - Light All 风格
- ✅ **稳定可靠** - 企业级服务

**配置**：
```bash
VITE_MAP_PROVIDER=carto
VITE_MAP_API_KEY=  # 留空
```

**适用场景**：
- 国外VPS部署
- 追求加载速度
- 不想申请API key

---

### 2. **OpenStreetMap** (默认)

**特点**：
- ✅ **完全免费** - 开源社区维护
- ✅ **无需注册** - 即用即走
- ⚠️ **速度一般** - 依赖社区服务器
- ⚠️ **可能限流** - 高并发时不稳定

**配置**：
```bash
VITE_MAP_PROVIDER=openstreetmap
VITE_MAP_API_KEY=  # 留空
```

**适用场景**：
- 开发测试
- 低流量个人项目
- 不在意加载速度

---

### 3. **MapTiler** (高级)

**特点**：
- ✅ **高性能** - 矢量瓦片
- ✅ **可定制** - 多种样式
- ⚠️ **需要注册** - 需要 API key
- ⚠️ **有限额** - 免费版 100k 次/月

**配置**：
```bash
VITE_MAP_PROVIDER=maptiler
VITE_MAP_API_KEY=your_maptiler_api_key
```

**获取 API Key**：
1. 访问 [MapTiler Cloud](https://cloud.maptiler.com/)
2. 注册免费账号
3. 创建 API key
4. 添加到 `.env` 文件

**适用场景**：
- 需要高性能
- 追求视觉效果
- 中高流量项目

---

## 🚀 快速配置

### 生产环境推荐配置

**国外VPS** (推荐 Carto)：
```bash
# .env 文件
VITE_MAP_PROVIDER=carto
```

**国内VPS** (需要使用国内地图服务，如高德/百度)：
```bash
# 需要自行集成国内地图SDK
# 当前版本暂不支持
```

### 修改配置步骤

1. **编辑环境变量文件**：
   ```bash
   cd /path/to/ssalgten
   nano .env
   ```

2. **设置地图提供商**：
   ```bash
   VITE_MAP_PROVIDER=carto  # 或 openstreetmap / maptiler
   VITE_MAP_API_KEY=        # MapTiler 需要填写
   ```

3. **重建前端容器**（重要！）：
   ```bash
   # 使用镜像模式
   docker compose -f docker-compose.ghcr.yml up -d --force-recreate frontend
   
   # 或使用源码模式
   docker compose up -d --force-recreate frontend
   ```

4. **清除浏览器缓存**：
   - 按 `Ctrl+Shift+R` (Windows/Linux)
   - 或 `Cmd+Shift+R` (Mac)

---

## 🔍 性能对比

| 提供商 | 加载速度 | 稳定性 | 成本 | 推荐度 |
|--------|----------|--------|------|---------|
| **Carto** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费 | ⭐⭐⭐⭐⭐ |
| OpenStreetMap | ⭐⭐⭐ | ⭐⭐⭐ | 免费 | ⭐⭐⭐ |
| MapTiler | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 有限免费 | ⭐⭐⭐⭐ |

---

## 🛠️ 故障排查

### 问题1: 地图不显示

**可能原因**：
- 环境变量未生效
- 前端容器未重启
- 浏览器缓存

**解决方法**：
```bash
# 1. 检查环境变量
docker compose exec frontend env | grep VITE_MAP

# 2. 强制重建容器
docker compose up -d --force-recreate frontend

# 3. 清除浏览器缓存 (Ctrl+Shift+R)
```

### 问题2: 地图加载很慢

**可能原因**：
- 使用了 OpenStreetMap
- 网络连接慢
- MapTiler API key 配额用完

**解决方法**：
```bash
# 切换到 Carto（速度更快）
VITE_MAP_PROVIDER=carto

# 重启容器
docker compose restart frontend
```

### 问题3: MapTiler 显示错误

**可能原因**：
- API key 无效
- 超出免费配额
- API key 未设置

**解决方法**：
1. 检查 API key 是否正确
2. 登录 MapTiler Cloud 查看使用量
3. 切换回 Carto 或 OpenStreetMap

---

## 📊 使用量估算

假设您的网站：
- 每天 **100** 个独立访客
- 每人浏览 **3** 个页面（包含地图）
- 每月约 **9,000** 次地图加载

**各服务商对比**：
| 提供商 | 免费额度 | 是否足够 | 超出成本 |
|--------|----------|----------|----------|
| Carto | 无限制 | ✅ | N/A |
| OpenStreetMap | 无限制 | ✅ | N/A |
| MapTiler | 100k/月 | ✅ | $25/100k |

---

## 🔮 未来计划

我们计划支持更多地图服务：

- [ ] **Mapbox GL JS** - 高性能矢量地图
- [ ] **高德地图** - 国内用户优化
- [ ] **百度地图** - 国内备选方案
- [ ] **Google Maps** - 国际标准
- [ ] **自定义瓦片** - 完全自主控制

---

## 💡 最佳实践

1. **国外VPS** → 使用 **Carto** (最佳性能)
2. **开发测试** → 使用 **OpenStreetMap** (无需配置)
3. **高流量项目** → 使用 **MapTiler** (专业方案)
4. **定期检查** → 监控地图加载速度
5. **备用方案** → 准备多个提供商配置

---

**相关文档**：
- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
- [Docker 部署指南](./installation.md)
- [性能优化指南](./PERFORMANCE.md)

**问题反馈**：
- GitHub Issues: https://github.com/lonelyrower/SsalgTen/issues
