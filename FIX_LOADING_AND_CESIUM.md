# 首页加载问题修复指南

## 问题描述

### 问题1：首页一直显示加载中
- 页面卡在"正在加载节点数据..."
- 一直显示加载动画，无法进入主界面

### 问题2：Cesium 沙盒错误
浏览器控制台出现大量错误：
```
Blocked script execution in 'about:blank' because the document's frame is sandboxed 
and the 'allow-scripts' permission is not set.
```

## 根本原因

### 1. Cesium Ion 沙盒问题
- Cesium 默认会尝试连接 Cesium Ion 服务器
- Ion 服务器会创建 iframe 并尝试执行脚本
- 由于沙盒安全策略，这些脚本被阻止
- 导致控制台出现大量错误信息

### 2. 首页加载超时
- 如果没有节点数据或API连接失败
- 页面会一直显示加载状态
- 缺少超时机制和错误处理
- 用户无法判断是加载中还是出错了

## 已修复内容

### 1. Globe3D.tsx - 禁用 Cesium Ion

**修改前：**
```typescript
// 使用公共 token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJ...';
```

**修改后：**
```typescript
// 完全禁用 Cesium Ion 避免沙盒错误
Cesium.Ion.defaultAccessToken = '';

// 禁用Ion服务器连接
try {
  (Cesium.Ion as any).defaultServer = 'about:blank';
} catch {
  // 忽略错误，某些Cesium版本可能不支持
}
```

**效果：**
- ✅ 不再尝试连接 Cesium Ion 服务器
- ✅ 消除沙盒错误信息
- ✅ 使用本地地图瓦片（Carto/OSM/Mapbox）

### 2. HomePage.tsx - 添加加载超时

**新增功能：**
```typescript
// 添加加载超时机制（10秒后即使没有数据也显示页面）
useEffect(() => {
  const timer = setTimeout(() => {
    if (isInitialLoad && nodes.length === 0) {
      console.warn('Data loading timeout, showing page anyway');
      setIsInitialLoad(false);
      setLoadTimeout(true);
    }
  }, 10000); // 10秒超时

  return () => clearTimeout(timer);
}, [isInitialLoad, nodes.length]);
```

**改进的加载提示：**
```typescript
// 根据连接状态显示不同提示
text={connected ? "正在加载节点数据..." : "正在连接服务器..."}
```

**效果：**
- ✅ 10秒后自动显示页面（即使没有数据）
- ✅ 更清晰的加载状态提示
- ✅ 避免永久卡在加载状态

## 如何应用修复

### 方法1：重新构建（源码安装）

```bash
# 进入项目目录
cd /opt/ssalgten

# 拉取最新代码
git pull

# 重新构建前端
docker compose build frontend

# 重启服务
docker compose up -d frontend
```

### 方法2：使用镜像更新

```bash
# 使用 ssalgten 命令更新
ssalgten update --image

# 或手动拉取最新镜像
docker compose pull frontend
docker compose up -d frontend
```

### 方法3：清除缓存

有时浏览器缓存会导致问题，请强制刷新：
- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

## 验证修复

### 1. 检查控制台错误

打开浏览器开发者工具（F12）：
- ✅ 不应再看到 Cesium 沙盒错误
- ✅ 可能会有正常的警告信息（可忽略）

### 2. 检查加载行为

访问首页：
- ✅ 应该在10秒内完成加载
- ✅ 如果没有节点，会显示空状态而不是一直加载
- ✅ 加载提示会根据连接状态变化

### 3. 检查3D地球

如果页面正常加载：
- ✅ 切换到 3D 视图
- ✅ 地球应该正常显示
- ✅ 不应有沙盒错误

## 可能的其他问题

### 如果仍然卡在加载中

#### 1. 检查后端连接

```bash
# 检查后端是否运行
curl http://localhost:3001/api/health

# 预期输出: {"success":true,"data":{"status":"healthy",...}}
```

#### 2. 检查WebSocket连接

打开浏览器开发者工具 → Network → WS（WebSocket）：
- 应该看到一个 WebSocket 连接
- 状态应该是 101 Switching Protocols

#### 3. 检查数据库

```bash
# 进入后端容器
docker compose exec backend sh

# 检查节点数量
npx prisma studio
# 访问 http://localhost:5555 查看 node 表
```

### 如果没有节点数据

这是正常的！系统需要 Agent 注册节点：

1. **部署 Agent**
   ```bash
   # 在其他服务器上部署 Agent
   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash
   ```

2. **手动添加节点**
   - 登录后台: http://your-ip:3000/admin
   - 进入"节点管理"
   - 点击"添加节点"

3. **运行种子数据**（测试用）
   ```bash
   docker compose exec backend npm run db:seed
   ```

## 技术说明

### Cesium Ion 是什么？

- Cesium Ion 是 Cesium 的云服务平台
- 提供地形数据、影像数据、3D模型等
- 需要注册账号和 Access Token
- 我们的系统使用免费的地图瓦片，不需要 Ion

### 为什么会有沙盒错误？

1. Cesium 默认配置会连接 Ion 服务器
2. Ion 服务器返回包含 iframe 的内容
3. 浏览器安全策略阻止 iframe 中的脚本执行
4. 产生沙盒错误（虽然不影响功能，但很烦人）

### 修复后的工作方式

- ✅ 完全离线工作（不依赖 Ion）
- ✅ 使用开源/免费地图瓦片
- ✅ 支持 Carto、OpenStreetMap、Mapbox
- ✅ 无需注册、无需 Token（Mapbox除外）

## 相关文档

- **地图配置**: MAP_CONFIG_FIX_GUIDE.md
- **3D地图说明**: docs/3D_MAP_PROVIDERS.md
- **完整文档**: docs/

## 需要帮助？

如果问题仍然存在：

1. **提供信息**
   - 浏览器控制台截图
   - 网络请求截图（Network标签）
   - 后端日志：`docker compose logs backend | tail -100`

2. **提交 Issue**
   - GitHub: https://github.com/lonelyrower/SsalgTen/issues
   - 包含详细的错误信息和复现步骤

3. **临时解决方案**
   - 不使用 3D 视图，只用 2D 地图
   - 2D 地图不依赖 Cesium，不会有这个问题
