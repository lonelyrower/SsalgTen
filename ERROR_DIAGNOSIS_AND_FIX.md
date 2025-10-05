# 错误诊断与修复指南

## 📋 问题总结

根据浏览器控制台错误，发现以下主要问题：

### 1. ❌ Socket.IO 连接失败 (最严重)
```
WebSocket connection to 'ws://185.119.17.138:3000/socket.io/...' failed
Failed to load resource: the server responded with a status of 502 (Bad Gateway)
Socket.IO 连接错误: xhr poll error
Socket重连失败，已达到最大重试次数 (5)
```

**问题原因：**
- 后端服务未运行或无法访问
- 端口 `3000` 是前端端口，但 Socket.IO 尝试连接前端端口（应该连接后端 `3001`）
- 可能的配置错误导致 API 地址指向了错误的端口

### 2. ❌ Cesium 3D 地球渲染错误
```
TypeError: Cannot read properties of undefined (reading 'getDerivedResource')
at yle (Cesium.js:7475:18301)
```

**问题原因：**
- 使用了 `Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')` 
- 这个资源在生产环境中可能未正确打包或路径不正确
- Cesium 资源加载失败

### 3. ℹ️ 浏览器扩展错误 (可忽略)
```
content_script.js:7202 Uncaught (in promise) fetchError: Failed to fetch
```
这些错误来自浏览器扩展，不是应用程序本身的问题。

---

## 🔧 已实施的修复

### ✅ 修复 1: Cesium 地图源错误

**修改文件:** `frontend/src/components/map/Globe3D.tsx`

**问题代码:**
```typescript
// 有问题的代码 - 使用了可能不存在的本地资源
default:
  imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
  );
```

**修复后:**
```typescript
// 使用可靠的在线地图源
default:
  imageryProvider = new Cesium.ArcGisMapServerImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
  } as any);
```

**同样修复了图层切换中的 'natural' 选项:**
```typescript
case 'natural':
default:
  // 使用 ArcGIS 自然地球风格（更可靠）
  imageryProvider = new Cesium.ArcGisMapServerImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer'
  } as any);
  break;
```

### ✅ 修复 2: 添加错误日志

在 Cesium 初始化成功后添加日志：
```typescript
viewerRef.current = viewer;
console.log('✓ Cesium Viewer 初始化成功');
```

---

## 🔍 待修复：Socket.IO 连接问题

### 问题诊断步骤：

#### 1. 检查后端服务状态

```bash
# 检查 Docker 容器状态
docker ps

# 应该看到类似输出：
# ssalgten-backend    运行中   0.0.0.0:3001->3001/tcp
# ssalgten-frontend   运行中   0.0.0.0:3000->80/tcp
```

#### 2. 检查后端日志

```bash
# 查看后端日志
docker logs ssalgten-backend

# 或实时查看
docker logs -f ssalgten-backend
```

**正常输出应该包含：**
```
Server is running on port 3001
Database connected
Socket.IO initialized
```

#### 3. 检查网络配置

```bash
# 测试后端 API 是否可访问
curl http://localhost:3001/api/health
# 或
curl http://185.119.17.138:3001/api/health

# 应该返回：
# {"status":"ok"}
```

#### 4. 检查环境变量配置

检查 `.env` 或 `docker-compose.yml` 中的配置：

```bash
# 前端应该配置
VITE_API_URL=/api
# 或
VITE_API_URL=http://localhost:3001/api

# 后端应该配置
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## 🛠️ 解决方案

### 方案 1: 重启服务（推荐首先尝试）

```bash
# 停止所有容器
docker-compose down

# 清理旧容器和网络
docker system prune -f

# 重新启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 方案 2: 检查 Nginx 配置（如果使用了反向代理）

检查 `nginx.conf` 或相关配置文件，确保 WebSocket 升级配置正确：

```nginx
location /socket.io/ {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 方案 3: 修复环境变量

创建或更新 `.env` 文件：

```bash
# 在项目根目录创建 .env
cat > .env << 'EOF'
# 后端配置
BACKEND_PORT=3001
NODE_ENV=production

# 前端配置
FRONTEND_PORT=3000
VITE_API_URL=/api

# 数据库
DATABASE_URL=file:./dev.db

# CORS
CORS_ORIGIN=http://localhost:3000,http://185.119.17.138:3000
EOF
```

### 方案 4: 检查防火墙和端口

```bash
# 检查端口是否被占用
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :3000

# 如果端口被占用，停止相关进程或使用其他端口
```

### 方案 5: 验证 Socket.IO 服务

创建测试脚本检查 Socket.IO：

```bash
# 测试 Socket.IO 端点
curl http://localhost:3001/socket.io/?EIO=4&transport=polling

# 应该返回类似：
# 0{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}
```

---

## 📝 配置检查清单

- [ ] 后端服务运行在端口 3001
- [ ] 前端服务运行在端口 3000
- [ ] `VITE_API_URL` 设置为 `/api` 或正确的后端地址
- [ ] CORS 配置包含前端地址
- [ ] Nginx（如果使用）正确配置 WebSocket 升级
- [ ] 防火墙允许端口 3000 和 3001
- [ ] Docker 网络配置正确
- [ ] 环境变量在 docker-compose.yml 中正确传递

---

## 🔄 验证修复

修复后，按以下步骤验证：

### 1. 清除浏览器缓存
```
Ctrl + Shift + Delete (或 Cmd + Shift + Delete)
选择"缓存的图像和文件"
```

### 2. 打开浏览器控制台
```
F12 或 Ctrl + Shift + I
```

### 3. 检查控制台输出

**应该看到：**
```
✓ Cesium Viewer 初始化成功
Socket.IO 连接成功 { url: "http://localhost:3001" }
```

**不应该看到：**
```
❌ 502 Bad Gateway
❌ xhr poll error
❌ getDerivedResource 错误
```

### 4. 检查 Network 标签

- Socket.IO 连接应该显示状态 `101 Switching Protocols` (WebSocket)
- 或 `200 OK` (polling)
- 不应该有 `502 Bad Gateway`

### 5. 检查地图渲染

- 3D 地球应该正常显示
- 没有 Cesium 错误面板
- 可以正常缩放和旋转

---

## 🚀 快速恢复命令

如果一切都失败了，使用以下命令完全重置：

```bash
# 1. 停止所有服务
docker-compose down -v

# 2. 清理所有 Docker 资源
docker system prune -af --volumes

# 3. 重新构建和启动
docker-compose build --no-cache
docker-compose up -d

# 4. 等待服务启动（约 30 秒）
sleep 30

# 5. 检查服务状态
docker-compose ps
docker-compose logs

# 6. 测试连接
curl http://localhost:3001/api/health
curl http://localhost:3000
```

---

## 📞 进一步帮助

如果问题仍然存在，请提供以下信息：

1. **后端日志：**
   ```bash
   docker logs ssalgten-backend > backend.log
   ```

2. **前端日志：**
   ```bash
   docker logs ssalgten-frontend > frontend.log
   ```

3. **Docker 状态：**
   ```bash
   docker ps -a > docker-status.txt
   docker-compose config > docker-config.txt
   ```

4. **环境变量：**
   ```bash
   docker exec ssalgten-backend env > backend-env.txt
   ```

5. **浏览器控制台完整输出**（截图或复制所有错误）

---

## 🎯 预期结果

修复完成后，您应该能够：

- ✅ 看到 3D 地球正常渲染
- ✅ WebSocket 连接成功
- ✅ 实时接收节点数据更新
- ✅ 地图图层切换正常工作
- ✅ 无 502 或其他连接错误
- ✅ 无 Cesium 渲染错误

---

**最后更新：** 2025-10-05
**修复版本：** v1.0.0
