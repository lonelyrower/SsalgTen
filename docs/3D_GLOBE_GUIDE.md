# 3D 地球可视化指南

## 🌍 功能概述

SsalgTen 现在支持 **3D 地球可视化**，使用 Cesium.js 在真实的 3D 地球上显示所有网络节点。

### 主要特性

- ✅ **真实 3D 地球**（不是平面投影）
- ✅ **节点标记**（根据状态显示不同颜色）
- ✅ **动态效果**（在线节点跳动动画）
- ✅ **节点连线**（显示网络拓扑）
- ✅ **飞行动画**（点击节点平滑飞过去）
- ✅ **实时统计**（在线/离线节点数量）
- ✅ **地形 + 卫星影像**（真实地理环境）
- ✅ **自动旋转**（慢速旋转地球）

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

这将自动安装：
- `cesium@^1.123.1` - Cesium 3D 地球引擎
- `vite-plugin-cesium@^1.2.23` - Vite 插件
- `@types/cesium@^1.123.1` - TypeScript 类型定义

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 访问首页

打开浏览器访问 `http://localhost:3000`，点击右上角的 **"3D 地球"** 按钮切换到 3D 视图。

---

## 🎮 使用说明

### 2D/3D 视图切换

在首页右上角，你会看到两个按钮：
- **2D 地图** - 传统的 Leaflet 平面地图
- **3D 地球** - Cesium 3D 地球视图

### 3D 地球操作

| 操作 | 方法 |
|------|------|
| **旋转地球** | 鼠标左键拖动 |
| **放大缩小** | 鼠标滚轮 / 右侧按钮 |
| **倾斜角度** | 鼠标右键拖动 |
| **点击节点** | 左键点击标记 |
| **查看详情** | 点击后弹出信息框 |
| **飞往节点** | 点击后自动飞行 |
| **重置视图** | 点击右侧"主页"按钮 |

---

## 🎨 节点颜色说明

| 状态 | 颜色 | 效果 |
|------|------|------|
| **在线** (online) | 🟢 绿色 | 跳动动画 |
| **离线** (offline) | 🔴 红色 | 静态标记 |
| **警告** (warning) | 🟡 黄色 | 静态标记 |
| **未知** (unknown) | ⚪ 灰色 | 静态标记 |

---

## 🔧 高级配置

### 修改 Cesium Ion Access Token

默认使用 Cesium 官方的公开 token，如果需要自己的 token（更高配额）：

1. 访问 [Cesium Ion](https://ion.cesium.com/)
2. 注册免费账号
3. 创建 Access Token
4. 修改 `Globe3D.tsx` 第 20 行：

```typescript
Cesium.Ion.defaultAccessToken = 'your_token_here';
```

### 自定义地球样式

编辑 `frontend/src/components/map/Globe3D.tsx`：

```typescript
// 修改底图影像
imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }), // 2 = Bing Maps
// 可选：
// assetId: 3 - Sentinel-2 卫星影像
// assetId: 4 - OpenStreetMap

// 修改地形
terrainProvider: Cesium.createWorldTerrain({
  requestWaterMask: true, // 水面效果
  requestVertexNormals: true, // 地形光照
}),
```

### 调整节点高度

```typescript
// 在 Globe3D.tsx 第 96 行修改
position: Cesium.Cartesian3.fromDegrees(
  node.longitude,
  node.latitude,
  500000 // 高度 500km，可调整为 100000-1000000
),
```

### 修改旋转速度

```typescript
// 在 Globe3D.tsx 第 199 行修改
viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.02 * deltaTime);
// 增大 0.02 加快旋转，减小则减慢
```

---

## 🌐 免费资源说明

### Cesium Ion 免费额度

| 资源 | 免费额度 | 说明 |
|------|----------|------|
| **3D Tiles** | 每月 5GB | 3D 建筑模型数据流量 |
| **Terrain** | 每月 750K 次请求 | 地形瓦片请求 |
| **Imagery** | 每月 750K 次请求 | 卫星影像瓦片 |

**个人小项目完全够用！**

### Bing Maps

Cesium 默认使用 Bing Maps 卫星影像（免费）。

---

## 📊 性能优化

### 1. 启用请求渲染模式

```typescript
requestRenderMode: true, // 只在场景变化时渲染
maximumRenderTimeChange: Infinity, // 最大渲染时间
```

### 2. 减少节点标签

如果节点数量很多（>100），可以关闭部分标签：

```typescript
label: {
  text: node.name,
  show: new Cesium.CallbackProperty(() => {
    // 只在缩放到一定级别时显示
    return viewer.camera.positionCartographic.height < 10000000;
  }, false) as any,
},
```

### 3. LOD (Level of Detail)

Cesium 自动实现了 LOD，距离远的节点会简化渲染。

---

## 🐛 常见问题

### 问题 1: 地球显示空白

**原因**：
- Cesium 资源加载失败
- 网络无法访问 Cesium Ion CDN

**解决方案**：
1. 检查网络连接
2. 查看浏览器控制台错误信息
3. 尝试使用 VPN

---

### 问题 2: 性能卡顿

**原因**：
- GPU 性能不足
- 节点数量过多

**解决方案**：
```typescript
// 降低地形精度
terrainProvider: Cesium.createWorldTerrain({
  requestWaterMask: false, // 关闭水面
  requestVertexNormals: false, // 关闭光照
}),

// 减少节点高度（减少渲染距离）
position: Cesium.Cartesian3.fromDegrees(
  node.longitude,
  node.latitude,
  100000 // 降低到 100km
),
```

---

### 问题 3: TypeScript 错误

**原因**：
- Cesium 类型定义未安装

**解决方案**：
```bash
npm install --save-dev @types/cesium
```

---

## 🎯 未来增强

### 计划中的功能

- [ ] **热力图**（节点密度可视化）
- [ ] **实时数据流**（WebSocket 更新节点状态）
- [ ] **性能监控覆盖层**（显示延迟/带宽）
- [ ] **时间轴回放**（历史状态播放）
- [ ] **VR 模式**（支持 WebXR）
- [ ] **自定义节点图标**（不同类型不同图标）
- [ ] **路径追踪**（数据包传输可视化）

---

## 📚 学习资源

- [Cesium 官方文档](https://cesium.com/docs/)
- [Cesium Sandcastle](https://sandcastle.cesium.com/) - 在线示例
- [Cesium 教程](https://cesium.com/learn/)
- [Cesium GitHub](https://github.com/CesiumGS/cesium)

---

## 💡 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Cesium | 1.123.1 | 3D 地球引擎 |
| React | 19.1.0 | UI 框架 |
| TypeScript | 5.9.2 | 类型安全 |
| Vite | 7.1.3 | 构建工具 |
| vite-plugin-cesium | 1.2.23 | Cesium 打包支持 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

如果你有任何问题或建议，请在 GitHub 提 Issue。

---

## 📄 许可证

Cesium 使用 Apache 2.0 许可证，完全开源免费。

---

**享受你的 3D 地球之旅！** 🌍✨
