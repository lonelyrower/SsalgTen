# SsalgTen 正式上线部署指南

## 🎯 上线前准备清单

### 1. 环境要求检查
- [ ] **服务器配置**
  - 最低：2核CPU, 4GB内存, 20GB存储
  - 推荐：4核CPU, 8GB内存, 50GB SSD
  - 操作系统：Ubuntu 20.04+ / CentOS 8+ / Docker兼容系统

- [ ] **软件依赖**
  - Docker 20.10+
  - Docker Compose 2.0+
  - PostgreSQL 13+ (如果不使用Docker)
  - 域名和SSL证书（可选但推荐）

### 2. 网络和安全要求
- [ ] **端口配置**
  - 80/443 (HTTP/HTTPS) 对外开放
  - 3001 (后端API) 内网访问
  - 5432 (PostgreSQL) 内网访问
  - 防火墙配置正确

- [ ] **DNS配置**
  - A记录指向服务器IP
  - CNAME记录（如有子域名）

## 🚀 部署步骤

### Phase 1: 服务器准备

#### 1.1 更新服务器
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install curl wget git -y

# CentOS/RHEL
sudo yum update -y
sudo yum install curl wget git -y
```

#### 1.2 安装Docker
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo apt-get update && sudo apt-get install -y docker-compose-plugin || true

# 验证安装
docker --version
docker compose version
```

### Phase 2: 代码部署

#### 2.1 克隆项目
```bash
# 克隆到生产目录
sudo mkdir -p /opt/ssalgten
cd /opt/ssalgten
sudo git clone https://github.com/lonelyrower/SsalgTen.git .
sudo chown -R $USER:$USER /opt/ssalgten
```

#### 2.2 环境配置
```bash
# 复制环境变量模板
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp agent/.env.example agent/.env

# 生成安全密钥
openssl rand -base64 64  # 用于JWT_SECRET
openssl rand -base64 32  # 用于API_KEY_SECRET
```

### Phase 3: 生产配置

#### 3.1 后端环境变量 (backend/.env)
```env
# 生产环境标识
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置（生产环境）
DATABASE_URL="postgresql://ssalgten:STRONG_PASSWORD@postgres:5432/ssalgten?schema=public"

# JWT安全配置
JWT_SECRET=your-super-secure-jwt-secret-64-chars-minimum
JWT_EXPIRES_IN=7d

# API安全配置
API_KEY_SECRET=your-strong-api-key-secret-32-chars
CORS_ORIGIN=https://your-domain.com

# 日志配置
LOG_LEVEL=info
ENABLE_MORGAN=true

# IP信息服务（推荐注册获取）
IPINFO_TOKEN=your-ipinfo-token-optional

# 代理配置
DEFAULT_AGENT_API_KEY=production-agent-key
AGENT_HEARTBEAT_INTERVAL=30000
```

#### 3.2 前端环境变量 (frontend/.env)
```env
# API配置
VITE_API_URL=https://your-domain.com/api

# 生产环境设置
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false

# 地图配置
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

#### 3.3 代理环境变量 (agent/.env)
```env
# 代理配置
AGENT_ID=your-unique-agent-id
MASTER_URL=https://your-domain.com
AGENT_API_KEY=production-agent-key

# 节点信息
NODE_NAME="Your Production Node"
NODE_COUNTRY="Your Country"
NODE_CITY="Your City"
NODE_PROVIDER="Your Provider"
NODE_LATITUDE=0.0
NODE_LONGITUDE=0.0
PORT=3002
```

### Phase 4: 数据库迁移 / 种子（自动化）

从当前版本起 (backend docker-start.sh)，后端容器启动时会自动：

1. 执行 `prisma migrate deploy`（如果存在迁移目录）
2. 检测用户表是否为空；若无管理员则运行 `dist/utils/seed.js` 创建 `admin / admin123` 与系统默认配置

无需手动进入容器执行迁移。首次启动只需直接 `docker compose up -d`（或脚本方式）。

可选开关（通过环境变量：在 backend 服务 environment 中或 docker run -e）：

```
DISABLE_DB_MIGRATE=true   # 禁止自动执行 migrate deploy
DISABLE_DB_SEED=true      # 禁止自动初始化种子数据
```

手动模式（若显式关闭自动化时）：

```bash
docker compose up -d postgres
sleep 10
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm backend node dist/utils/seed.js
```

## 🔧 部署脚本

### 一键部署脚本
```bash
#!/bin/bash
# 文件: deploy-production.sh

set -e

echo "🚀 开始 SsalgTen 生产环境部署..."

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

# 检查配置文件
if [[ ! -f ".env" ]]; then
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 构建和启动服务
echo "📦 构建 Docker 镜像..."
docker compose -f docker-compose.yml build --no-cache

echo "🗄️ 启动数据库..."
docker compose up -d postgres
sleep 15

echo "📊 运行数据库迁移..."
docker compose run --rm backend npm run db:migrate

echo "🌐 启动所有服务..."
docker compose up -d

echo "⏳ 等待服务启动..."
sleep 30

echo "🔍 健康检查..."
curl -f http://localhost/api/health || {
    echo "❌ 健康检查失败"
    docker compose logs
    exit 1
}

echo "✅ 部署完成！"
echo "🌐 访问地址: http://localhost"
echo "📊 API地址: http://localhost/api"
```

## ✅ 上线测试用例

### 测试脚本 (test-production.sh)
```bash
#!/bin/bash
# 生产环境测试脚本

BASE_URL="https://your-domain.com"
API_URL="$BASE_URL/api"

echo "🧪 开始生产环境测试..."

# 1. 健康检查
echo "📡 测试健康检查..."
curl -f "$API_URL/health" | jq '.success' || exit 1

# 2. API信息
echo "📋 测试API信息..."
curl -f "$API_URL/info" | jq '.data.name' || exit 1

# 3. 节点列表
echo "🌐 测试节点列表..."
curl -f "$API_URL/nodes" | jq '.success' || exit 1

# 4. 访问者信息
echo "👤 测试访问者信息..."
curl -f "$API_URL/visitor/info" | jq '.data.ip' || exit 1

# 5. IP信息查询
echo "🔍 测试IP查询..."
curl -f "$API_URL/visitor/ip/8.8.8.8" | jq '.data.asn.asn' || exit 1

# 6. 前端页面
echo "🌐 测试前端页面..."
curl -f "$BASE_URL" | grep -q "SsalgTen" || exit 1

# 7. 数据库连接
echo "🗄️ 测试数据库..."
docker compose exec backend npm run db:generate > /dev/null || exit 1

echo "✅ 所有测试通过！"
```

## 📊 监控和日志

### 监控脚本 (monitor.sh)
```bash
#!/bin/bash
# 生产环境监控脚本

echo "📊 SsalgTen 系统状态监控"
echo "========================="

# 容器状态
echo "📦 Docker 容器状态:"
docker compose ps

echo ""

# 资源使用
echo "💻 资源使用情况:"
docker stats --no-stream

echo ""

# 健康检查
echo "🔍 应用健康检查:"
curl -s http://localhost/api/health | jq .

echo ""

# 磁盘使用
echo "💾 磁盘使用情况:"
df -h

echo ""

# 内存使用
echo "🧠 内存使用情况:"
free -h
```

### 日志查看
```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# 查看最近的错误
docker compose logs --tail=50 backend | grep ERROR
```

## 🔄 维护和更新

### 更新部署
```bash
#!/bin/bash
# 文件: update-production.sh

echo "🔄 开始更新部署..."

# 备份数据库
echo "💾 备份数据库..."
docker compose exec postgres pg_dump -U ssalgten ssalgten > backup_$(date +%Y%m%d_%H%M%S).sql

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 重建镜像
echo "🔨 重建镜像..."
docker compose build --no-cache

# 滚动更新
echo "🔄 滚动更新服务..."
docker compose up -d --no-deps backend
sleep 10

docker compose up -d --no-deps frontend
sleep 5

# 健康检查
echo "🔍 健康检查..."
curl -f http://localhost/api/health || {
    echo "❌ 更新失败，开始回滚..."
    git checkout HEAD~1
    docker compose build --no-cache
    docker compose up -d
    exit 1
}

echo "✅ 更新完成！"
```

## 🚨 故障排除

### 常见问题和解决方案

1. **端口冲突**
   ```bash
   # 检查端口占用
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :3001
   
   # 停止冲突服务或修改端口配置
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库状态
   docker compose logs postgres
   
   # 重启数据库
   docker compose restart postgres
   ```

3. **内存不足**
   ```bash
   # 检查内存使用
   free -h
   docker stats
   
   # 清理Docker缓存
   docker system prune -a
   ```

4. **SSL证书问题**
   ```bash
   # 使用Certbot自动获取SSL证书
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 📋 上线检查清单

### 部署前检查
- [ ] 服务器资源充足
- [ ] 域名DNS配置正确
- [ ] SSL证书已配置（如需要）
- [ ] 环境变量已正确设置
- [ ] 数据库备份已完成
- [ ] 防火墙规则已配置

### 部署过程检查
- [ ] Docker镜像构建成功
- [ ] 数据库迁移完成
- [ ] 所有服务启动正常
- [ ] 健康检查通过
- [ ] 监控系统正常

### 部署后验证
- [ ] 前端页面可访问
- [ ] API端点正常响应
- [ ] 数据库连接正常
- [ ] ASN功能工作正常
- [ ] 访问者信息获取正常
- [ ] 日志记录正常

## 🎉 上线完成

恭喜！如果以上所有检查都通过，您的SsalgTen系统已成功上线。

### 下一步建议：
1. 设置定期备份
2. 配置监控告警
3. 准备灾难恢复计划
4. 建立日常维护流程
5. 收集用户反馈并持续优化

---

*如有问题，请参考 `TEST_RESULTS.md` 中的调试信息或联系技术支持。*
