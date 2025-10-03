# 🌍 3D 地球地图源配置

## 改进说明

现在 **3D 地球和 2D 地图使用相同的配置**，统一通过环境变量控制！

---

## 📋 支持的地图源

### 1. OpenStreetMap（默认）

**特点**：
- ✅ 完全免费开源
- ✅ 地图细节丰富
- ✅ 3D 效果好
- ❌ 需要网络连接

**配置**：
```bash
# .env 或系统设置
MAP_PROVIDER=openstreetmap
```

**3D 效果**：
- 清晰的道路网络
- 详细的地理标注
- 适合城市区域展示

---

### 2. CartoDB（推荐）

**特点**：
- ✅ 完全免费
- ✅ 加载速度快
- ✅ 简洁美观
- ✅ CDN 加速
- ❌ 需要网络连接

**配置**：
```bash
# .env 或系统设置
MAP_PROVIDER=carto
```

**3D 效果**：
- 简洁的底图
- 快速加载
- 适合节点分布展示

---

### 3. Mapbox（高级）

**特点**：
- ✅ 卫星影像
- ✅ 高质量渲染
- ❌ 需要 API Key
- ❌ 有免费额度限制

**配置**：
```bash
# .env 或系统设置
MAP_PROVIDER=mapbox
MAP_API_KEY=your_mapbox_token_here
```

**3D 效果**：
- 真实的卫星影像
- 街道和地形结合
- 最佳视觉效果

**获取 API Key**：
1. 访问 https://www.mapbox.com/
2. 注册免费账号
3. 创建 Access Token
4. 免费额度：每月 50,000 次加载

---

### 4. NaturalEarth II（离线）

**特点**：
- ✅ 完全离线
- ✅ 无需网络
- ✅ 快速加载
- ❌ 细节较少
- ❌ 无地名标注

**配置**：
```bash
# .env 或系统设置
MAP_PROVIDER=offline
# 或留空使用默认
```

**3D 效果**：
- 基础的大陆轮廓
- 适合内网环境
- 适合演示用途

---

## 🎯 推荐方案对比

| 场景 | 推荐地图源 | 理由 |
|------|-----------|------|
| **生产环境** | CartoDB | 免费 + 快速 + 美观 |
| **演示展示** | Mapbox | 视觉效果最佳 |
| **开发测试** | OpenStreetMap | 完全免费，细节丰富 |
| **内网部署** | NaturalEarth II | 无需网络 |
| **低带宽环境** | CartoDB | CDN 加速，加载快 |

---

## ⚙️ 配置方式

### 方式一：环境变量（推荐）

编辑 `frontend/.env`：
```bash
VITE_MAP_PROVIDER=carto
VITE_MAP_API_KEY=
```

### 方式二：系统设置（动态）

1. 登录后台：http://your-ip:3000/admin
2. 导航到：系统设置
3. 筛选分类：map
4. 修改配置：
   - `map.provider`: openstreetmap / carto / mapbox / offline
   - `map.api_key`: (仅 Mapbox 需要)

### 方式三：运行时注入

通过 `window.APP_CONFIG` 注入：
```javascript
window.APP_CONFIG = {
  MAP_PROVIDER: 'carto',
  MAP_API_KEY: ''
};
```

---

## 🔄 2D 和 3D 地图统一

现在两者使用**完全相同的配置**：

```typescript
// 读取配置（2D 和 3D 共用）
const w: any = typeof window !== 'undefined' ? (window as any) : {};
const provider = (
  w.APP_CONFIG?.MAP_PROVIDER || 
  import.meta.env.VITE_MAP_PROVIDER || 
  'openstreetmap'
).toString().toLowerCase();

const apiKey = w.APP_CONFIG?.MAP_API_KEY || import.meta.env.VITE_MAP_API_KEY || '';
```

**切换地图源时**：
- ✅ 2D 和 3D 同时切换
- ✅ 保持一致的视觉风格
- ✅ 无需分别配置

---

## 🚀 性能对比

### 加载速度（首次加载）

1. **CartoDB**: ⭐⭐⭐⭐⭐ (最快)
   - CDN 加速
   - 瓦片小

2. **OpenStreetMap**: ⭐⭐⭐⭐
   - 稳定快速
   - 细节多

3. **Mapbox**: ⭐⭐⭐
   - 高质量
   - 稍慢

4. **NaturalEarth II**: ⭐⭐⭐⭐⭐
   - 离线最快
   - 但细节少

### 3D 渲染性能

所有地图源在 3D 模式下性能相近：
- ✅ 使用 Cesium 优化的渲染引擎
- ✅ 请求渲染模式（requestRenderMode）
- ✅ 视锥体剔除
- ✅ 级别细节（LOD）

---

## 🐛 常见问题

### Q1: 3D 地球显示黑屏？

**原因**：地图源配置错误或网络问题

**解决**：
1. 检查网络连接
2. 切换到离线模式：`MAP_PROVIDER=offline`
3. 查看浏览器控制台错误

### Q2: Mapbox 显示 401 错误？

**原因**：API Key 无效或未配置

**解决**：
1. 检查 `MAP_API_KEY` 是否正确
2. 确认 Token 未过期
3. 检查 Mapbox 账户额度

### Q3: 地图加载慢？

**原因**：网络慢或地图源服务器慢

**解决**：
1. 切换到 CartoDB：`MAP_PROVIDER=carto`
2. 使用离线模式：`MAP_PROVIDER=offline`
3. 检查网络连接

### Q4: 2D 和 3D 地图不一致？

**原因**：配置未同步

**解决**：
- 清除浏览器缓存（Ctrl + Shift + R）
- 确认配置已保存
- 重启服务

---

## 📊 费用说明

| 地图源 | 费用 | 限制 |
|--------|------|------|
| OpenStreetMap | ✅ 完全免费 | 合理使用 |
| CartoDB | ✅ 完全免费 | 合理使用 |
| NaturalEarth II | ✅ 完全免费 | 无限制 |
| Mapbox | ⚠️ 免费额度 | 50K/月 |

**结论**：除了 Mapbox，其他都是**完全免费**的！

---

## 🎨 视觉效果对比

### CartoDB
- 简洁的矢量风格
- 浅色背景
- 清晰的道路网络
- 适合节点分布图

### OpenStreetMap
- 详细的地理信息
- 完整的地名标注
- 丰富的 POI 点
- 适合位置导航

### Mapbox
- 真实的卫星影像
- 3D 建筑物（某些区域）
- 混合街道标注
- 最佳视觉体验

### NaturalEarth II
- 基础的大陆轮廓
- 简单的国家边界
- 无城市标注
- 适合全球视角

---

## 总结

**最佳实践**：
1. **生产环境**：使用 CartoDB（快速 + 免费）
2. **视觉展示**：使用 Mapbox（需要 API Key）
3. **开发测试**：使用 OpenStreetMap（免费 + 详细）
4. **内网环境**：使用 NaturalEarth II（离线）

**现在 3D 地球和 2D 地图使用统一配置，切换地图源更方便！** 🎉
