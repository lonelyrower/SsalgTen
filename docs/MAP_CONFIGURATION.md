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

### 2. **OpenStreetMap** (开源默认)

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

### 3. **Mapbox** (高级，矢量地图)

**特点**：
- ✅ **矢量地图** - 超清晰缩放
- ✅ **3D 支持** - 建筑物立体展示
- ✅ **多样式** - Streets, Satellite, Dark 等
- ✅ **免费额度大** - 50,000 次加载/月
- ⚠️ **需要注册** - 需要 Access Token

**配置**：
```bash
VITE_MAP_PROVIDER=mapbox
VITE_MAP_API_KEY=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJ5b3VyLWtleSJ9.example
```

**获取 Access Token**：
1. 访问 [Mapbox](https://www.mapbox.com/)
2. 注册免费账号（GitHub/Google 快速登录）
3. 进入 [Access tokens](https://account.mapbox.com/access-tokens/)
4. 复制默认的 **Default public token**（以 `pk.` 开头）
5. 或创建新 token（建议限制 HTTP referrer 为你的域名）

**适用场景**：
- 专业项目
- 需要矢量地图和 3D 效果
- 小型项目（免费额度足够）

---

## 🚀 快速配置

### 生产环境推荐配置

**国外VPS** (推荐 Carto)：
```env
VITE_MAP_PROVIDER=carto
```

**国内VPS** (可能需要代理)：
```env
VITE_MAP_PROVIDER=openstreetmap
```

**个人小项目** (推荐 Carto 或 Mapbox)：
```env
# Carto - 免配置，立即可用
VITE_MAP_PROVIDER=carto

# 或者 Mapbox - 注册后更美观
VITE_MAP_PROVIDER=mapbox
VITE_MAP_API_KEY=pk.ey...
```

---

## ⚙️ 配置方式

### 方式 1: 环境变量 (推荐新部署)

编辑 `.env` 文件：
```bash
VITE_MAP_PROVIDER=carto  # 或 openstreetmap / mapbox
VITE_MAP_API_KEY=        # Mapbox 需要填写
```

重启前端容器：
```bash
docker-compose restart frontend
```

---

### 方式 2: 管理后台动态配置 (推荐生产环境)

1. 登录管理后台 `/admin`
2. 进入 **系统设置** → **地图配置**
3. 修改：
   - `map.provider`: `carto` / `openstreetmap` / `mapbox`
   - `map.api_key`: Mapbox Access Token（如需要）
4. 点击 **保存更改**
5. **刷新首页即可**（无需重启容器）

---

## 📊 性能对比

| 提供商 | 速度 | 免费额度 | 样式选择 | 推荐指数 |
|--------|------|----------|----------|----------|
| **Carto** | ⭐⭐⭐⭐⭐ | 无限 | 简洁风格 | ⭐⭐⭐⭐⭐ |
| OpenStreetMap | ⭐⭐⭐ | 有限 | 基础 | ⭐⭐⭐ |
| **Mapbox** | ⭐⭐⭐⭐⭐ | 50k/月 | 10+ 样式 | ⭐⭐⭐⭐ |

**实测加载时间** (国外 VPS)：
- Carto: ~500ms
- OpenStreetMap: ~1200ms
- Mapbox: ~600ms (矢量瓦片)

---

## 🔧 常见问题

### 问题1: 地图加载慢

**原因**：
- OpenStreetMap 社区服务器负载高
- 国内网络访问国外地图服务慢

**解决方案**：
1. 切换到 **Carto**（速度提升 2-3 倍）
2. 如需更高性能，使用 **Mapbox**（矢量地图）

---

### 问题2: 地图显示空白

**原因**：
- Mapbox API token 无效或过期
- 网络无法访问地图服务器

**解决方案**：
1. 检查 `map.api_key` 是否正确
2. 验证 token 是否激活（Mapbox 控制台）
3. 尝试切换到 Carto（无需 API key）

---

### 问题3: Mapbox 显示 401 错误

**原因**：
- Access token 未配置
- Token 被禁用或删除
- Token 的 URL 限制不包含你的域名

**解决方案**：
1. 确认 `VITE_MAP_API_KEY` 或后台 `map.api_key` 已配置
2. 登录 Mapbox 控制台查看 token 状态
3. 检查 token 的 HTTP referrer 限制设置

---

## 💰 费用对比

| 提供商 | 免费额度 | 超额费用 | 适合规模 |
|--------|----------|----------|----------|
| Carto | 无限制 | - | 任何规模 |
| OpenStreetMap | 社区资源共享 | - | 小型项目 |
| **Mapbox** | 50k loads/月 | $5/1000 sessions | **小中型项目** |

**费用说明**：
- **Carto**: 完全免费，无流量限制
- **OpenStreetMap**: 免费但请遵守使用政策，避免滥用
- **Mapbox**: 免费额度对个人项目完全够用（50,000 次地图加载/月）

---

## �� 推荐配置方案

### 1. **个人小项目** → 使用 **Carto** 或 **Mapbox**
```env
VITE_MAP_PROVIDER=carto  # 或 mapbox
VITE_MAP_API_KEY=        # Mapbox 需填写
```

### 2. **开发测试** → 使用 **OpenStreetMap**
```env
VITE_MAP_PROVIDER=openstreetmap
```

### 3. **高流量项目** → 使用 **Mapbox**（付费计划）
```env
VITE_MAP_PROVIDER=mapbox
VITE_MAP_API_KEY=pk.ey...
```

---

## 🔄 动态切换示例

管理员可在后台实时切换地图提供商，无需重启服务：

```bash
# 初始配置：Carto（免费）
map.provider = carto

# 用户增长后：切换到 Mapbox（矢量地图）
map.provider = mapbox
map.api_key = pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJ5b3VyLWtleSJ9.example

# 刷新首页 → 立即生效！
```

---

## 📚 参考链接

- [Carto Base Maps](https://carto.com/basemaps/)
- [OpenStreetMap Tile Servers](https://wiki.openstreetmap.org/wiki/Tile_servers)
- [Mapbox Documentation](https://docs.mapbox.com/)
- [Mapbox Pricing](https://www.mapbox.com/pricing)
