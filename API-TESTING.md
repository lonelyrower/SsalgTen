# API 测试文档

本文档说明如何测试新增的流媒体解锁和服务总览API接口。

## 前提条件

1. **启动 PostgreSQL 数据库**
   ```bash
   # Windows - 如果使用 Windows 服务
   net start postgresql-x64-17

   # 或者使用其他方式启动 PostgreSQL
   # 确保数据库运行在 localhost:5432
   ```

2. **运行数据库迁移**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

3. **启动后端服务器**
   ```bash
   cd backend
   npm run dev
   ```
   服务器将运行在 `http://localhost:3001`

4. **启动前端开发服务器**
   ```bash
   cd frontend
   npm run dev
   ```
   前端将运行在 `http://localhost:5173`

## 新增API接口清单

### 流媒体解锁 API

#### 1. 获取流媒体解锁总览
```bash
GET /api/streaming/overview
```
**说明**: 获取所有平台的解锁统计，包括总节点数、全局解锁率、各平台解锁情况等。

**测试命令**:
```bash
curl http://localhost:3001/api/streaming/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalNodes": 10,
    "lastScanTime": "2025-10-19T12:00:00.000Z",
    "expiredNodes": 2,
    "platformStats": [
      {
        "service": "netflix",
        "name": "Netflix",
        "icon": "🎬",
        "unlocked": 8,
        "restricted": 1,
        "failed": 0,
        "unknown": 1,
        "total": 10,
        "unlockRate": 80
      }
    ],
    "globalUnlockRate": 75.5
  }
}
```

#### 2. 获取流媒体节点摘要
```bash
GET /api/streaming/nodes?service=netflix&status=yes&country=US&showExpired=false&search=tokyo
```
**说明**: 获取所有节点的流媒体解锁摘要，支持按服务、状态、国家筛选。

**查询参数**:
- `service` (可选): 流媒体服务名 (netflix, youtube, disney_plus等)
- `status` (可选): 解锁状态 (yes, no, failed, unknown)
- `country` (可选): 国家代码
- `showExpired` (可选): 是否显示过期数据 (true/false)
- `search` (可选): 搜索关键词

**测试命令**:
```bash
curl http://localhost:3001/api/streaming/nodes
```

#### 3. 批量触发流媒体检测
```bash
POST /api/streaming/test/bulk
```
**说明**: 批量触发多个节点的流媒体检测 (需要认证)。

**请求体**:
```json
{
  "nodeIds": ["node_id_1", "node_id_2"]
}
```

**测试命令**:
```bash
curl -X POST http://localhost:3001/api/streaming/test/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"nodeIds": ["node_id_1", "node_id_2"]}'
```

#### 4. 导出流媒体数据
```bash
GET /api/streaming/export?format=json&service=netflix&status=yes
```
**说明**: 导出流媒体数据为 JSON/CSV/Markdown 格式 (需要认证)。

**查询参数**:
- `format`: 导出格式 (json, csv, markdown)
- `service` (可选): 流媒体服务名
- `status` (可选): 解锁状态
- `country` (可选): 国家代码

**测试命令**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/streaming/export?format=csv" \
  -o streaming-export.csv
```

### 服务总览 API

#### 1. 获取服务总览统计
```bash
GET /api/services/overview
```
**说明**: 获取所有节点的服务统计，包括总服务数、运行/停止/失败数量、服务类型分布等。

**测试命令**:
```bash
curl http://localhost:3001/api/services/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalNodes": 10,
    "totalServices": 45,
    "runningServices": 38,
    "stoppedServices": 5,
    "failedServices": 2,
    "serviceTypeDistribution": [
      { "type": "proxy", "count": 15 },
      { "type": "web", "count": 20 },
      { "type": "database", "count": 5 },
      { "type": "container", "count": 5 }
    ]
  }
}
```

#### 2. 获取所有服务列表
```bash
GET /api/services?nodeId=node_123&serviceType=proxy&status=running&search=nginx
```
**说明**: 获取所有服务列表，支持按节点、服务类型、状态筛选。

**查询参数**:
- `nodeId` (可选): 节点ID
- `serviceType` (可选): 服务类型 (proxy, web, database, container, other)
- `status` (可选): 服务状态 (running, stopped, unknown)
- `search` (可选): 搜索关键词

**测试命令**:
```bash
curl http://localhost:3001/api/services
```

#### 3. 获取服务按节点分组
```bash
GET /api/services/grouped
```
**说明**: 获取服务按节点分组的视图，每个节点显示其所有服务及统计。

**测试命令**:
```bash
curl http://localhost:3001/api/services/grouped
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "nodeId": "node_123",
      "nodeName": "Tokyo Server",
      "country": "JP",
      "city": "Tokyo",
      "services": [
        {
          "id": "service_1",
          "name": "Nginx",
          "type": "web",
          "status": "running",
          "port": 80,
          "version": "1.24.0"
        }
      ],
      "totalServices": 5,
      "runningServices": 4,
      "stoppedServices": 1,
      "failedServices": 0
    }
  ]
}
```

#### 4. 更新服务信息
```bash
PUT /api/services/:id
```
**说明**: 更新服务的详细信息 (需要管理员权限)。

**请求体**:
```json
{
  "details": {
    "notes": "Production service",
    "priority": 1
  }
}
```

**测试命令**:
```bash
curl -X PUT http://localhost:3001/api/services/service_123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"details": {"notes": "Test service"}}'
```

#### 5. 删除服务
```bash
DELETE /api/services/:id
```
**说明**: 删除指定服务 (需要管理员权限)。

**测试命令**:
```bash
curl -X DELETE http://localhost:3001/api/services/service_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 6. 导出服务数据
```bash
GET /api/services/export?format=json&nodeId=node_123&serviceType=web
```
**说明**: 导出服务数据为 JSON/CSV/Markdown 格式 (需要认证)。

**查询参数**:
- `format`: 导出格式 (json, csv, markdown)
- `nodeId` (可选): 节点ID
- `serviceType` (可选): 服务类型
- `status` (可选): 服务状态

**测试命令**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/services/export?format=csv" \
  -o services-export.csv
```

## 前端页面测试

### 1. 流媒体解锁页面
访问: `http://localhost:5173/streaming`

**功能测试**:
- ✅ 查看平台解锁统计卡片
- ✅ 查看节点列表及解锁状态
- ✅ 使用筛选功能 (平台、状态、国家)
- ✅ 搜索节点
- ✅ 触发批量检测
- ✅ 导出数据 (JSON/CSV/Markdown)
- ✅ 查看数据过期警告 (>24小时)

### 2. 服务总览页面
访问: `http://localhost:5173/services`

**功能测试**:
- ✅ 查看服务统计卡片
- ✅ 在列表视图和节点分组视图间切换
- ✅ 使用快速筛选模板
- ✅ 高级筛选 (节点、类型、状态)
- ✅ 搜索服务
- ✅ 查看服务详情
- ✅ 编辑/删除服务
- ✅ 导出数据
- ✅ 查看数据过期警告 (>2天)

## 注意事项

1. **数据库准备**: 确保 PostgreSQL 数据库已启动并完成迁移
2. **认证令牌**: 需要认证的接口请先登录获取 JWT token
3. **测试数据**: 数据库中需要有节点和检测数据才能看到有意义的结果
4. **Agent上报**: 流媒体检测和服务检测数据由 Agent 定期上报，前端页面显示的是数据库中的历史记录

## 调试技巧

1. **查看后端日志**: 后端控制台会显示详细的错误信息
2. **使用浏览器开发工具**: Network标签可以查看API请求和响应
3. **检查数据库**: 使用 `npx prisma studio` 查看数据库内容
4. **TypeScript检查**: 运行 `npm run type-check` 确保类型安全

## 已实现功能总结

### 后端 API
- ✅ 4个流媒体解锁API接口
- ✅ 6个服务总览API接口
- ✅ 完整的类型定义和错误处理
- ✅ 支持筛选、搜索、分页
- ✅ 支持多格式导出 (JSON/CSV/Markdown)

### 前端页面
- ✅ 流媒体解锁页面 (StreamingPage)
- ✅ 服务总览页面 (ServicesPage)
- ✅ 完整的组件库 (卡片、列表、筛选器等)
- ✅ 响应式设计
- ✅ 实时数据刷新
- ✅ 数据过期提示
- ✅ TypeScript类型安全

### 导航
- ✅ 桌面端导航 (Header)
- ✅ 移动端导航 (MobileNav)
- ✅ 路由配置 (App.tsx)
- ✅ 权限简化 (移除多角色检查)

### UI/UX
- ✅ 官方品牌图标 (simple-icons + Disney+ from Wikimedia)
- ✅ 一致的设计语言
- ✅ Tailwind CSS v4
- ✅ 暗色模式支持
- ✅ 加载状态和错误处理

## 下一步

1. 启动 PostgreSQL 数据库
2. 运行数据库迁移
3. 启动后端和前端服务器
4. 使用浏览器访问新页面进行功能测试
5. 根据实际需求调整UI或添加新功能
