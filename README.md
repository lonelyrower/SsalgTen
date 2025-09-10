# SsalgTen Network Monitor

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue.svg)](https://www.postgresql.org/)
[![Auth](https://img.shields.io/badge/Auth-JWT-orange.svg)](https://jwt.io/)
[![Deployment](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED.svg)](https://docs.docker.com/compose/)

**SsalgTen** 是一个生产就绪的分布式网络监控诊断系统。提供全球网络实时监控、全面诊断工具和交互式可视化，通过分布式代理架构和企业级管理功能，为网络运维提供专业解决方案。

## 🌟 核心特性

### 🚀 全面网络监控
- **🌍 全球节点部署** - 支持全球无限节点，实时网络可视化监控
- **📊 多维度诊断** - Ping、Traceroute、MTR、速度测试等专业网络工具
- **🗺️ 智能地图展示** - 交互式世界地图，实时显示节点状态和网络拓扑
- **⚡ 实时数据更新** - WebSocket 实时推送，毫秒级状态更新
- **🎯 同位置节点分散** - 智能坐标微调，完美解决节点重叠显示问题
 - **📦 资产占位节点** - 未安装/已过期 VPS 也可纳入清单并显示为离线（自动按 IP 填充地理/ASN，后续安装 Agent 会自动“升级”为正式节点）

### 🛡️ 企业级安全管理
- **🔐 完整权限体系** - 基于 JWT 的三级权限管理 (Admin/Operator/Viewer)
- **👥 用户生命周期** - 完整的用户增删改查，密码安全策略
- **🔑 API 密钥管理** - 安全的代理认证，支持密钥轮换和批量管理
- **📈 审计日志** - 完整操作记录，系统访问追踪
- **🚨 安全防护** - CORS、Helmet、输入验证等多重安全保障

### 🎛️ 智能运维管理
- **📱 现代化界面** - React + TypeScript + TailwindCSS，响应式设计
- **📊 数据分析中心** - 实时统计、历史趋势、性能指标分析
- **⚙️ 25+ 系统配置** - 灵活的参数配置，数据库持久化存储
- **🔍 节点生命周期** - 自动注册、状态监控、健康检查、故障告警
- **📡 心跳监控** - 30秒间隔状态上报，异常自动检测

### 🔄 零停机更新系统
- **🚀 一键更新** - Web界面一键更新，支持Git和归档包双模式
- **💾 自动备份** - 更新前自动备份数据库和配置文件
- **🔙 智能回滚** - 失败自动回滚，手动回滚到任意版本
- **📋 完整日志** - SSH终端输出优化，更新过程完整可见
- **⚡ 管理工具** - `ssalgten.sh` 脚本提供完整系统管理功能

## 🏗️ 系统架构

SsalgTen 采用微服务架构，由四个核心组件组成：

```mermaid
graph TB
    subgraph "用户接口层"
        A[前端 React UI<br/>端口: 3000] 
        B[管理脚本<br/>ssalgten.sh]
    end
    
    subgraph "服务层"
        C[后端 API 服务<br/>端口: 3001]
        D[更新服务<br/>端口: 8765] 
    end
    
    subgraph "数据层"
        E[(PostgreSQL<br/>端口: 5432)]
        F[(Redis 缓存<br/>端口: 6379)]
    end
    
    subgraph "监控层"
        G[代理节点 1<br/>端口: 3002]
        H[代理节点 2<br/>端口: 3002] 
        I[代理节点 N<br/>端口: 3002]
    end
    
    A --> C
    B --> C
    B --> D
    C --> E
    C --> F
    C --> G
    C --> H  
    C --> I
    D --> C
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style E fill:#e8f5e8
    style G fill:#fff3e0
```

### 🎨 前端 (React + TypeScript)
- **现代化框架**: React 18 + TypeScript + Vite 热重载
- **响应式设计**: TailwindCSS + shadcn/ui 组件库
- **地图可视化**: Leaflet + Supercluster 智能聚合
- **实时通信**: Socket.IO 客户端，毫秒级数据同步
- **状态管理**: Context + Hooks 架构，优化渲染性能

### ⚙️ 后端 (Node.js + Express)
- **现代化 API**: RESTful 设计，完整的接口规范
- **数据库**: Prisma ORM + PostgreSQL，自动迁移和种子数据
- **认证授权**: JWT + Refresh Token 机制，安全会话管理
- **实时推送**: Socket.IO 服务端，支持房间和命名空间
- **缓存策略**: Redis 多级缓存，优化数据库查询性能
- **监控日志**: 结构化日志记录和健康检查

### 🤖 代理系统 (Node.js)
- **跨平台兼容**: Linux/Windows/macOS 统一部署
- **网络诊断**: 原生系统命令集成，结果格式化处理
- **系统监控**: CPU、内存、磁盘、网络资源实时采集
- **安全通信**: API 密钥认证，TLS 加密传输
- **容错机制**: 自动重连、错误重试、优雅降级

### 🔄 更新服务 (Zero-Downtime)
- **双模式更新**: Git 仓库和归档包，适应不同部署环境
- **原子操作**: 数据库事务，配置文件版本控制
- **健康检查**: 自动服务验证，异常自动回滚
- **进度跟踪**: 实时日志推送，Web 界面进度展示

## 🛠️ 技术栈详情

### 前端技术栈
```typescript
{
  "framework": "React 18 + TypeScript + Vite",
  "styling": "TailwindCSS 3 + shadcn/ui + HeadlessUI", 
  "mapping": "react-leaflet + Supercluster + OpenStreetMap",
  "charts": "Recharts + D3.js 数据可视化",
  "icons": "Lucide React + Heroicons",
  "forms": "React Hook Form + Zod 验证",
  "routing": "React Router v6 + 代码分割",
  "state": "Context API + useReducer 模式",
  "realtime": "Socket.IO Client v4",
  "http": "Axios + React Query 数据获取"
}
```

### 后端技术栈  
```typescript
{
  "runtime": "Node.js 20+ + Express.js + TypeScript",
  "database": "PostgreSQL 15+ + Prisma ORM v5",
  "cache": "Redis 7+ + ioredis 客户端",
  "auth": "jsonwebtoken + bcryptjs + passport.js",
  "validation": "joi + express-validator",
  "security": "helmet + cors + rate-limiter",
  "realtime": "Socket.IO Server v4 + 适配器",
  "monitoring": "winston + morgan + 健康检查",
  "docs": "RESTful API + 标准化响应",
  "testing": "Jest + Supertest + 工厂模式"
}
```

### 运维技术栈
```bash
# 容器化部署
Docker 24+ + Docker Compose v2
Multi-stage builds + 优化镜像

# 数据库管理
PostgreSQL 15+ + 连接池 + 只读副本
Redis 7+ + 持久化 + 集群支持

# 监控运维
结构化日志 + 日志轮转
健康检查 + 优雅关闭
系统指标监控 + 状态追踪
```

## 🚀 快速开始

### 系统要求

**开发环境:**
- Node.js 20.0.0+ (推荐 20+ LTS)
- npm 10.0.0+ 
- Git 2.25+
- 8GB RAM 推荐

**生产环境:**
- Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- Docker 24.0+ + Docker Compose v2.20+
- 4 CPU 核心 / 8GB RAM / 100GB SSD
- 域名和 SSL 证书 (推荐)

### 🎯 一键部署 (推荐)

#### 生产环境部署
```bash
# 方法1: 远程一键安装 (最简单)
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh | bash

# 方法2: 本地克隆安装
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen
sudo ./scripts/deploy-production.sh --domain your-domain.com --ssl
```

#### 开发环境启动
```bash
# 克隆项目
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen

# 安装所有依赖
npm run install:all

# 一键启动开发环境 (包含数据库)
npm run dev:setup
npm run dev

# 或手动启动各个服务
npm run dev:db        # 启动数据库
npm run dev:backend   # 启动后端 API
npm run dev:frontend  # 启动前端界面
```

### 🔧 系统管理

SsalgTen 提供了强大的 `ssalgten.sh` 管理脚本：

```bash
# 远程安装管理脚本
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 本地使用管理脚本
./scripts/ssalgten.sh         # 交互式菜单
./scripts/ssalgten.sh status  # 检查系统状态  
./scripts/ssalgten.sh update  # 零停机更新
./scripts/ssalgten.sh backup  # 数据备份
./scripts/ssalgten.sh logs    # 查看日志
```

**系统管理功能:**
- 🚀 启动/停止/重启服务
- ⚡ 零停机系统更新  
- 📊 实时状态监控
- 📋 日志查看和分析
- 🔍 容器和端口检查
- 🗂️ 数据备份和恢复
- 🧹 系统清理和优化
- 📊 诊断报告生成

### 🌐 访问系统

部署完成后，访问以下地址：

- **🖥️ 主界面**: http://localhost:3000 - 实时监控地图
- **🛡️ 管理后台**: http://localhost:3000/admin - 系统管理
- **📊 API 接口**: http://localhost:3001/api - RESTful API  
- **⚙️ 代理接口**: http://localhost:3002 - 代理节点状态

**默认管理员账号:**
- 用户名: `admin`
- 密码: `admin123`
- ⚠️ **生产环境请立即修改密码！**

## 📁 项目结构

```
SsalgTen/
├── 📦 frontend/                 # React 前端应用
│   ├── src/
│   │   ├── components/         # 组件库
│   │   │   ├── admin/         # 管理界面组件
│   │   │   ├── dashboard/     # 仪表板组件  
│   │   │   ├── map/           # 地图可视化
│   │   │   ├── diagnostics/   # 诊断工具
│   │   │   ├── layout/        # 布局组件
│   │   │   └── ui/            # 基础UI组件
│   │   ├── pages/             # 路由页面
│   │   ├── hooks/             # 自定义Hooks
│   │   ├── contexts/          # Context状态
│   │   ├── services/          # API服务
│   │   └── lib/               # 工具函数
│   └── package.json
├── ⚙️ backend/                  # Express API 服务
│   ├── src/
│   │   ├── controllers/       # 路由控制器
│   │   ├── services/          # 业务逻辑层
│   │   ├── middleware/        # 中间件
│   │   ├── routes/            # API 路由
│   │   ├── utils/             # 工具函数
│   │   ├── types/             # TypeScript 类型
│   │   └── config/            # 配置管理
│   ├── prisma/                # 数据库schema和迁移
│   └── package.json
├── 🤖 agent/                    # 监控代理服务
│   ├── src/
│   │   ├── controllers/       # 代理控制器
│   │   ├── services/          # 网络诊断服务
│   │   ├── utils/             # 系统工具
│   │   ├── config/            # 代理配置
│   │   └── types/             # 类型定义
│   └── package.json
├── 🚀 scripts/                  # 部署和管理脚本
│   ├── ssalgten.sh           # 主管理脚本
│   ├── deploy-production.sh   # 生产部署脚本
│   ├── install-agent.sh       # 代理安装脚本
│   ├── updater-server.mjs     # 更新服务器
│   ├── backup-db.sh           # 数据库备份
│   ├── rollback.sh            # 版本回滚
│   └── test-update-system.sh  # 更新系统测试
├── 🐳 Docker 配置              # 容器化部署
│   ├── docker-compose.yml     # 生产环境编排
│   ├── docker-compose.dev.yml # 开发环境编排
│   ├── Dockerfile.*           # 多阶段构建文件
│   └── docker/                # Docker 配置目录
├── 📚 docs/                     # 项目文档
│   ├── api.md                 # API 接口文档
│   ├── PRODUCTION_UPDATE.md   # 生产更新指南
│   └── deployment.md          # 部署文档
├── 📋 配置文件
│   ├── CLAUDE.md              # Claude Code 指南
│   ├── UPDATE_SYSTEM.md       # 更新系统说明
│   ├── ASN_IMPLEMENTATION.md  # ASN 实现文档
│   └── package.json           # 根工作空间配置
└── 🔧 开发配置
    ├── .env.example           # 环境变量模板
    ├── .gitignore             # Git 忽略规则
    ├── LICENSE                # MIT 许可证
    └── README.md              # 项目说明文档
```

## 🎯 核心功能详解

### 🗺️ 智能地图系统
- **多层级聚合**: Supercluster 算法，智能节点聚合和展开
- **同位置处理**: 坐标微调技术，解决节点重叠显示
- **实时状态**: WebSocket 推送，毫秒级状态更新
- **交互体验**: 点击展开、弹窗详情、状态筛选
- **自适应**: 响应式设计，移动端完美适配

### 📊 网络诊断工具
```bash
# 支持的诊断类型
✅ Ping - 延迟和丢包测试
✅ Traceroute - 路由跟踪和跳数分析  
✅ MTR - 持续路由质量监控
✅ Speedtest - 带宽测试 (上传/下载)
✅ 连通性测试 - 批量目标检测
✅ DNS 解析 - 域名解析时间
✅ 端口扫描 - TCP/UDP 端口检测
```

### 🛡️ 企业级安全
- **三级权限**: Admin (全权限) / Operator (操作权限) / Viewer (查看权限)
- **JWT 安全**: Access Token + Refresh Token 机制
- **密码策略**: bcrypt 加密，强密码验证
- **API 保护**: 频率限制，输入验证，SQL注入防护
- **审计日志**: 完整操作记录，安全事件追踪

### 🔄 零停机更新
- **Web 界面**: 管理员可通过 Web 界面一键更新
- **双重模式**: 支持 Git 仓库和归档包更新方式
- **智能备份**: 自动备份数据库、配置文件和关键数据
- **健康检查**: 更新后自动验证服务状态
- **失败回滚**: 异常时自动回滚到稳定版本
- **进度跟踪**: 实时显示更新进度和详细日志

## 🎮 使用指南

### 🖥️ 管理界面功能

#### 系统概览
- **实时监控**: 节点状态、系统负载、网络质量
- **统计仪表盘**: 在线率、响应时间、地理分布
- **告警中心**: 故障节点、异常事件、性能警告
- **快速操作**: 批量重启、配置刷新、缓存清理

#### 节点管理  
- **生命周期**: 添加、编辑、删除、启用/禁用节点
- **批量操作**: 批量导入、导出、状态变更
- **配置管理**: 节点参数、监控间隔、告警规则
- **性能分析**: 历史趋势、对比分析、异常检测

#### 用户管理
- **角色权限**: 精细化权限控制，资源访问限制
- **会话管理**: 在线用户、会话超时、强制下线
- **操作审计**: 登录日志、操作记录、安全事件
- **密码策略**: 复杂度要求、定期更换、历史限制

### 🤖 代理部署

#### 自动部署 (推荐)
```bash
# 一键安装代理到远程服务器
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \
  --master-url "https://your-domain.com" \
  --api-key "your-secure-api-key" \
  --node-name "Tokyo-Node-1" \
  --country "Japan" \
  --city "Tokyo" \
  --provider "AWS" \
  --latitude "35.6762" \
  --longitude "139.6503"
```

#### 手动部署
```bash
# 1. 克隆项目
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen/agent

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 4. 启动代理
npm run start
```

#### Docker 部署
```bash
# 使用 Docker 运行代理
docker run -d --name ssalgten-agent \
  -e MASTER_URL="https://your-domain.com" \
  -e AGENT_API_KEY="your-api-key" \
  -e NODE_NAME="Docker-Node" \
  -e NODE_COUNTRY="China" \
  -e NODE_CITY="Beijing" \
  -e NODE_PROVIDER="Aliyun" \
  -e NODE_LATITUDE="39.9042" \
  -e NODE_LONGITUDE="116.4074" \
  --restart unless-stopped \
  ssalgten/agent:latest
```

## 📊 API 接口文档

### 🔐 认证接口
```http
POST   /api/auth/login      # 用户登录
POST   /api/auth/logout     # 用户登出  
POST   /api/auth/refresh    # 刷新Token
GET    /api/auth/profile    # 获取用户信息
PUT    /api/auth/profile    # 更新用户信息
POST   /api/auth/change-password  # 修改密码
```

### 🌐 节点管理
```http
GET    /api/nodes          # 获取节点列表
POST   /api/nodes          # 创建新节点
GET    /api/nodes/:id      # 获取节点详情
PUT    /api/nodes/:id      # 更新节点信息
DELETE /api/nodes/:id      # 删除节点
POST   /api/nodes/batch    # 批量操作
```

### 🔍 诊断接口  
```http
POST   /api/diagnostics/ping       # Ping 测试
POST   /api/diagnostics/traceroute # 路由跟踪
POST   /api/diagnostics/mtr        # MTR 测试  
POST   /api/diagnostics/speedtest  # 速度测试
GET    /api/diagnostics/history    # 历史记录
GET    /api/diagnostics/statistics # 统计数据
```

### 👥 用户管理
```http
GET    /api/admin/users     # 用户列表 (Admin)
POST   /api/admin/users     # 创建用户 (Admin)  
PUT    /api/admin/users/:id # 更新用户 (Admin)
DELETE /api/admin/users/:id # 删除用户 (Admin)
GET    /api/admin/logs      # 操作日志 (Admin)
```

### 🔑 API 密钥管理
```http
GET    /api/admin/api-keys  # 密钥列表 (Admin)
POST   /api/admin/api-keys  # 生成密钥 (Admin)  
PUT    /api/admin/api-keys/:id # 更新密钥 (Admin)  
DELETE /api/admin/api-keys/:id # 删除密钥 (Admin)
POST   /api/admin/api-keys/batch # 批量生成 (Admin)

# 资产占位（未安装 Agent 的 VPS 资产）
POST   /api/admin/nodes/placeholders/import  # 批量导入占位节点（Admin）
```

### 📈 统计接口
```http  
GET    /api/statistics/overview   # 系统概览
GET    /api/statistics/nodes      # 节点统计
GET    /api/statistics/performance # 性能指标
GET    /api/statistics/geographic # 地理分布
GET    /api/statistics/trends     # 趋势分析
```

## 🔧 开发指南

### 🛠️ 开发环境搭建

```bash
# 1. 系统要求检查
node --version  # >= 20.0.0
npm --version   # >= 10.0.0  
docker --version # >= 24.0.0

# 2. 克隆项目
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen

# 3. 安装依赖 (所有模块)
npm run install:all

# 4. 数据库初始化
npm run dev:db:start
cd backend
npx prisma migrate dev
npx prisma db seed

# 5. 启动开发服务
npm run dev  # 启动所有服务
# 或分别启动:
# Terminal 1: npm run dev:backend  
# Terminal 2: npm run dev:frontend
```

### 📦 构建和部署

```bash
# 开发环境构建
npm run build:dev

# 生产环境构建  
npm run build

# 类型检查
npm run type-check

# 代码规范检查
npm run lint

# 代码格式化
npm run format

# 测试执行
npm run test
npm run test:e2e

# 清理构建产物
npm run clean
```

### 🧪 测试策略

```bash
# 单元测试
npm run test:unit

# 集成测试  
npm run test:integration

# 端到端测试
npm run test:e2e

# 性能测试
npm run test:performance

# 覆盖率报告
npm run test:coverage

# 冒烟测试
npm run smoke:test
```

### 🔍 调试和监控

```bash
# 开发调试
npm run dev:debug

# 性能分析
npm run profile

# 内存分析
npm run memory-analysis

# 日志级别设置
export LOG_LEVEL=debug
npm run dev

# 数据库调试
npx prisma studio  # 可视化数据库管理

# Redis 调试  
redis-cli monitor  # 监控 Redis 操作
```

## 🏭 生产部署

### 🚀 Docker 生产部署

```yaml
# docker-compose.yml 主要配置
version: '3.8'
services:
  frontend:
    build: 
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      - VITE_API_BASE_URL=https://api.yourdomain.com
    restart: unless-stopped
    
  backend:
    build:
      context: .  
      dockerfile: Dockerfile.backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    
  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ssalgten
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASS}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  updater:
    build:
      context: .
      dockerfile: Dockerfile.updater  
    environment:
      - UPDATER_TOKEN=${UPDATER_TOKEN}
    restart: unless-stopped
```

### ⚙️ 环境变量配置

```bash
# .env 生产环境配置
NODE_ENV=production

# 数据库配置
DATABASE_URL="postgresql://user:pass@localhost:5432/ssalgten"
REDIS_URL="redis://localhost:6379"

# JWT 安全配置
JWT_SECRET="your-super-secure-256-bit-secret"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# API 安全配置  
API_KEY_SECRET="your-api-key-secret"
CORS_ORIGINS="https://yourdomain.com,https://api.yourdomain.com"

# 系统配置
PORT=3001
FRONTEND_PORT=3000
LOG_LEVEL=info
MAX_REQUEST_SIZE="10mb"

# 更新系统配置
UPDATER_TOKEN="secure-updater-token-change-in-production"
BACKUP_RETENTION_DAYS=30

# 邮件配置 (可选)
SMTP_HOST="smtp.yourdomain.com"  
SMTP_PORT=587
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-email-password"

# 监控配置 (可选)
ENABLE_SYSTEM_METRICS=true
HEALTH_CHECK_INTERVAL=30
```

### 🔒 SSL/HTTPS 配置

```bash
# 使用 Let's Encrypt 自动 SSL
./scripts/deploy-production.sh --domain yourdomain.com --ssl --email admin@yourdomain.com

# 或手动 Nginx 反向代理配置
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr; 
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 📊 监控和告警

```bash
# 系统监控端点
GET /api/system/info     # 系统信息
GET /api/system/version  # 版本信息

# 健康检查端点
GET /health      # 基础健康检查
GET /api/health  # API 健康检查  
GET /ready       # 就绪检查

# 日志聚合 (推荐)
# ELK Stack: Elasticsearch + Logstash + Kibana
# 或 Loki + Promtail + Grafana

# 监控告警示例
- 错误率监控: API 5xx 错误超过阈值时告警
- 节点离线监控: Agent 超过设定时间未心跳时告警
- 系统资源监控: CPU/内存使用率过高时告警
```

## 🔧 故障排除

### 🚨 常见问题及解决方案

#### 数据库连接问题
```bash
# 检查数据库状态
docker compose logs database

# 测试数据库连接
cd backend && npm run db:test-connection

# 重建数据库
npm run db:reset
npx prisma migrate reset --force
npx prisma db seed
```

#### Redis 缓存问题
```bash
# 检查 Redis 状态
docker compose logs redis
redis-cli ping

# 清理缓存
redis-cli flushall

# 重启 Redis
docker compose restart redis
```

#### 节点离线问题
```bash
# 检查代理状态
curl http://agent-ip:3002/health

# 检查网络连接
ping agent-ip
traceroute agent-ip

# 查看代理日志  
ssh agent-server
journalctl -u ssalgten-agent -f

# 重启代理服务
systemctl restart ssalgten-agent
```

#### 前端白屏问题
```bash
# 检查前端构建
npm run build:frontend
docker compose logs frontend

# 检查 API 连接
curl http://localhost:3001/api/health

# 清理浏览器缓存
强制刷新: Ctrl+Shift+R (或 Cmd+Shift+R)
```

#### 更新系统问题
```bash
# 测试更新系统
./scripts/test-update-system.sh

# 查看更新日志  
tail -f .update/logs/update_$(date +%Y%m%d).log

# 手动回滚
./scripts/rollback.sh BACKUP_ID

# 修复更新服务
docker compose restart updater
```

### 📋 性能优化建议

#### 数据库优化
```sql
-- 创建必要索引
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_diagnostic_records_node_id ON diagnostic_records(node_id);
CREATE INDEX idx_diagnostic_records_timestamp ON diagnostic_records(timestamp);

-- 定期清理历史数据
DELETE FROM diagnostic_records WHERE timestamp < NOW() - INTERVAL '30 days';
DELETE FROM visitor_logs WHERE timestamp < NOW() - INTERVAL '7 days';
```

#### Redis 缓存策略
```javascript
// 缓存配置优化
const cacheConfig = {
  nodes: { ttl: 300 },          // 节点信息 5分钟
  statistics: { ttl: 600 },      // 统计数据 10分钟
  diagnostics: { ttl: 1800 },    // 诊断结果 30分钟
  user_sessions: { ttl: 86400 }  // 用户会话 24小时
};
```

#### 前端性能优化
```typescript
// 组件懒加载
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));

// 图片优化  
const imageConfig = {
  formats: ['webp', 'png'],
  quality: 80,
  responsive: true
};

// 地图性能优化
const mapConfig = {
  clustering: true,
  maxZoom: 18,
  chunking: true,
  updateInterval: 30000
};
```

## 🤝 贡献指南

### 🛠️ 开发流程

1. **Fork 项目** - 点击右上角 Fork 按钮
2. **克隆仓库** - `git clone https://github.com/yourusername/SsalgTen.git`
3. **创建分支** - `git checkout -b feature/amazing-feature`
4. **开发功能** - 遵循代码规范，添加测试
5. **提交代码** - `git commit -m 'feat: add amazing feature'`
6. **推送分支** - `git push origin feature/amazing-feature` 
7. **创建 PR** - 提交 Pull Request，详细描述修改内容

### 📝 代码规范

```typescript
// TypeScript 规范
interface NodeData {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  location: {
    country: string;
    city: string; 
    latitude: number;
    longitude: number;
  };
}

// React 组件规范  
const NodeCard: FC<NodeCardProps> = ({ node, onSelect }) => {
  const [isSelected, setIsSelected] = useState(false);
  
  return (
    <div className="node-card">
      <h3>{node.name}</h3>
      <p>{node.location.city}, {node.location.country}</p>
    </div>
  );
};

// API 接口规范
router.get('/api/nodes', async (req, res) => {
  try {
    const nodes = await nodeService.getAllNodes();
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 🧪 测试要求

```typescript
// 单元测试示例
describe('NodeService', () => {
  it('should create node successfully', async () => {
    const nodeData = {
      name: 'Test Node',
      country: 'China', 
      city: 'Beijing',
      latitude: 39.9042,
      longitude: 116.4074
    };
    
    const result = await nodeService.createNode(nodeData);
    expect(result).toHaveProperty('id');
    expect(result.name).toBe(nodeData.name);
  });
});

// 集成测试示例
describe('API Integration', () => {
  it('should authenticate user and return token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
      
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.role).toBe('admin');
  });
});
```

### 📋 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

```bash
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具、依赖更新
perf: 性能优化
ci: CI/CD 相关
```

示例：
```bash
feat(map): 添加节点聚合功能
fix(auth): 修复 JWT token 过期问题  
docs(api): 更新 API 接口文档
perf(database): 优化节点查询性能
```

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## 🙏 致谢

- 🌍 网络监控: 专业的全球分布式网络诊断服务
- 🛠️ 技术栈: React, Node.js, TypeScript, PostgreSQL 等开源项目
- 🎨 UI 设计: TailwindCSS, shadcn/ui, Lucide Icons
- 🗺️ 地图服务: OpenStreetMap, Leaflet
- 🤝 社区贡献者和 Issue 反馈者们

## 📞 支持与联系

### 🆘 获取帮助

- 📋 **问题反馈**: [GitHub Issues](https://github.com/lonelyrower/SsalgTen/issues)
- 📖 **文档中心**: [项目文档](https://github.com/lonelyrower/SsalgTen/tree/main/docs)
- 💬 **讨论社区**: [GitHub Discussions](https://github.com/lonelyrower/SsalgTen/discussions)
- 📧 **邮件联系**: 通过 GitHub Profile 联系维护者

### 🔗 相关链接

- 🏠 **项目主页**: https://github.com/lonelyrower/SsalgTen
- 📊 **在线演示**: (即将推出)
- 📚 **API 文档**: http://localhost:3001/api (本地部署后访问)
- 🐳 **Docker Hub**: (即将推出)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**

[![GitHub stars](https://img.shields.io/github/stars/lonelyrower/SsalgTen?style=social)](https://github.com/lonelyrower/SsalgTen/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/lonelyrower/SsalgTen?style=social)](https://github.com/lonelyrower/SsalgTen/network/members)
[![GitHub issues](https://img.shields.io/github/issues/lonelyrower/SsalgTen)](https://github.com/lonelyrower/SsalgTen/issues)

**SsalgTen - 让全球网络监控变得简单而强大** 🚀

</div>
