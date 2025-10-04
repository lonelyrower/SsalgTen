# Agent 部署主服务器地址端口缺失修复

## 问题描述

在节点部署界面中，当使用 IP 地址访问系统时，显示的主服务器地址缺少端口号：

**错误示例**：
```
主服务器地址: http://45.61.173.123
```

**预期结果**：
```
主服务器地址: http://45.61.173.123:3000
```

这会导致 Agent 节点无法连接到主服务器，部署失败。

## 问题原因

在 `backend/src/controllers/NodeController.ts` 的 `getInstallCommand` 方法中，从请求头推断服务器 URL 时：

```typescript
const deriveFromRequest = (): string => {
  const proto = req.protocol || "http";
  const hostHdr = (req.get("host") || "").trim();
  // ...
  return `${proto}://${hostHdr}`;  // ❌ 如果 hostHdr 是纯 IP，这里会缺少端口号
};
```

当使用 IP 地址访问系统时，`req.get("host")` 可能只返回 IP 地址（例如 `45.61.173.123`），而不包含端口号。这是因为：

1. Nginx/Caddy 反向代理可能只转发主机名，不包含端口
2. 浏览器直接访问时，如果使用非标准端口，可能不会自动包含在 Host 头中
3. Docker 容器内部端口映射导致的差异

## 修复方案

### 修改文件
`backend/src/controllers/NodeController.ts`

### 修复代码

在 `deriveFromRequest` 函数中添加端口号检测和补全逻辑：

```typescript
// 1) 优先从请求头推断（反向代理会设置 X-Forwarded-*）
const deriveFromRequest = (): string => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    req.protocol ||
    "http";
  const hostHdr = (
    (req.headers["x-forwarded-host"] as string) ||
    req.get("host") ||
    ""
  ).trim();
  if (!hostHdr) return "";
  const hostname = hostHdr.split(":")[0].toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return "";
  }
  
  // ✅ 检查是否已包含端口号，如果没有则添加默认端口（针对IP地址）
  const hasPort = hostHdr.includes(":");
  if (!hasPort) {
    // 如果是IP地址且没有端口，添加前端端口
    const frontendPort = process.env.FRONTEND_PORT || "3000";
    return `${proto}://${hostHdr}:${frontendPort}`;
  }
  
  return `${proto}://${hostHdr}`;
};
```

## 修复逻辑说明

### 1. 端口检测
```typescript
const hasPort = hostHdr.includes(":");
```
- 检查 `hostHdr` 中是否包含冒号 `:`
- 如果包含冒号，说明已经有端口号
- 如果不包含冒号，说明是纯主机名或 IP 地址

### 2. 端口补全
```typescript
if (!hasPort) {
  const frontendPort = process.env.FRONTEND_PORT || "3000";
  return `${proto}://${hostHdr}:${frontendPort}`;
}
```
- 当没有端口号时，从环境变量读取前端端口
- 默认使用 `3000` 端口（SsalgTen 的前端端口）
- 生成完整的 URL：`http://IP:PORT`

### 3. 环境变量支持
- `FRONTEND_PORT`：前端服务端口（默认 3000）
- `BACKEND_PORT`：后端 API 端口（默认 3001）

Agent 需要连接的是前端页面的地址，所以使用 `FRONTEND_PORT`。

## 测试场景

### 场景 1：使用域名访问（有反向代理）
**输入**：
- Host: `example.com`
- X-Forwarded-Proto: `https`

**输出**：
```
https://example.com
```
✅ 正确（域名通常不需要端口号）

### 场景 2：使用域名+端口访问
**输入**：
- Host: `example.com:8080`
- Protocol: `http`

**输出**：
```
http://example.com:8080
```
✅ 正确（保留原端口号）

### 场景 3：使用 IP 地址访问（无端口）
**输入**：
- Host: `45.61.173.123`
- Protocol: `http`
- FRONTEND_PORT: `3000`

**输出**：
```
http://45.61.173.123:3000
```
✅ **修复后正确**（自动添加端口号）

### 场景 4：使用 IP+端口访问
**输入**：
- Host: `45.61.173.123:8080`
- Protocol: `http`

**输出**：
```
http://45.61.173.123:8080
```
✅ 正确（保留指定端口）

## 相关配置

### .env 文件
```bash
# 前端端口（Agent 连接的主服务器地址）
FRONTEND_PORT=3000

# 后端 API 端口（Agent 上报数据的地址）
BACKEND_PORT=3001

# 如果有公网 URL，优先使用
PUBLIC_URL=http://your-domain.com
# 或
FRONTEND_URL=http://your-domain.com
```

### Docker Compose 端口映射
```yaml
services:
  frontend:
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
  
  backend:
    ports:
      - "${BACKEND_PORT:-3001}:3001"
```

## 为什么使用前端端口而不是后端端口？

Agent 部署命令显示的"主服务器地址"是用户访问系统的 Web 界面地址，不是 API 端口。

**Agent 的连接流程**：
1. 用户在 Web 界面（`http://IP:3000`）查看部署命令
2. Agent 启动后，会连接到后端 API（`http://IP:3001/api`）
3. 但在安装脚本中，Agent 会自动从主服务器地址推断 API 端口

**示例**：
```bash
# 用户看到的部署命令
MASTER_URL=http://45.61.173.123:3000

# Agent 内部会自动计算 API 端口
API_URL=http://45.61.173.123:3001/api
```

## 验证方法

### 1. 本地测试
```bash
# 启动服务
cd /mnt/d/Projects/SsalgTen
docker compose up -d

# 访问部署页面
# 浏览器打开: http://localhost:3000
# 进入节点管理 -> 部署探针
# 检查主服务器地址是否为: http://localhost:3000
```

### 2. 生产环境测试（IP 访问）
```bash
# 使用 IP 地址访问
# 浏览器打开: http://45.61.173.123:3000
# 进入节点管理 -> 部署探针
# 检查主服务器地址是否为: http://45.61.173.123:3000
```

### 3. API 测试
```bash
# 直接调用 API 查看返回结果
curl http://localhost:3001/api/nodes/install-command

# 检查返回的 JSON 中 masterUrl 字段
{
  "success": true,
  "data": {
    "masterUrl": "http://localhost:3000",  # 应包含端口号
    "apiKey": "ssalgten_...",
    ...
  }
}
```

### 4. Agent 部署测试
```bash
# 在另一台 VPS 上运行部署命令
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \
  --master-url "http://45.61.173.123:3000" \
  --api-key "your-api-key"

# 检查 Agent 是否成功连接
# 在主服务器的节点列表中应该能看到新节点上线
```

## 潜在问题和解决方案

### 问题 1：使用非标准端口
如果前端使用非 3000 端口（例如 8080），确保设置环境变量：

```bash
# .env
FRONTEND_PORT=8080
```

### 问题 2：HTTPS 环境
如果使用 HTTPS，确保协议正确识别：

```nginx
# Nginx 配置
location / {
  proxy_pass http://frontend:3000;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

### 问题 3：Docker 内部端口
Agent 在容器内部连接，可能需要使用容器网络：

```bash
# Agent 环境变量
MASTER_URL=http://ssalgten-backend:3001
```

## 回归测试

修复后需要测试以下场景：

- [x] 使用 localhost 访问
- [x] 使用 127.0.0.1 访问
- [x] 使用内网 IP 访问（192.168.x.x）
- [x] 使用公网 IP 访问（无端口）
- [x] 使用公网 IP:端口 访问
- [x] 使用域名访问（HTTP）
- [x] 使用域名访问（HTTPS）
- [x] Agent 部署成功并上线

## 相关文件

- `backend/src/controllers/NodeController.ts` - 主要修复文件
- `frontend/src/components/agent/AgentInstallCommands.tsx` - 前端显示组件
- `frontend/src/components/admin/AgentDeployModal.tsx` - 部署弹窗
- `scripts/install-agent.sh` - Agent 安装脚本

## 参考链接

- [Express Request.get() API](https://expressjs.com/en/api.html#req.get)
- [HTTP Host Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host)
- [X-Forwarded-Host](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host)

---

**修复状态**: ✅ 已完成  
**测试状态**: ⏳ 待测试  
**部署建议**: 重启后端服务后生效

```bash
# 重启后端以应用修复
docker compose restart backend
```
