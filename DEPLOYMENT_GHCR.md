# GitHub Container Registry 部署指南

本文档介绍如何使用GitHub Actions自动构建Docker镜像并推送到GitHub Container Registry (GHCR)，以及如何使用这些镜像进行部署。

## 🚀 自动化流程概述

### GitHub Actions 工作流

我们配置了两个主要的工作流：

1. **CI 工作流** (`.github/workflows/ci.yml`)
   - 代码检查 (lint)
   - 类型检查 (type-check)
   - 构建测试
   - Docker构建测试
   - 安全扫描 (Trivy)

2. **构建推送工作流** (`.github/workflows/build-and-push.yml`)
   - 多组件并行构建 (backend, frontend, updater, agent)
   - 多平台支持 (linux/amd64, linux/arm64)
   - 自动推送到GHCR
   - 智能标签管理

### 触发条件

- **推送到主分支**: 构建并推送 `latest` 标签
- **推送到develop分支**: 构建并推送 `develop` 标签
- **创建标签**: 构建并推送版本标签 (如 `v1.0.0`)
- **Pull Request**: 仅运行CI检查，不推送镜像

## 📦 镜像命名规则

镜像将推送到以下位置：

```
ghcr.io/lonelyrower/ssalgten/backend:latest
ghcr.io/lonelyrower/ssalgten/frontend:latest
ghcr.io/lonelyrower/ssalgten/updater:latest
ghcr.io/lonelyrower/ssalgten/agent:latest
```

### 标签策略

- `latest`: 主分支最新版本
- `main`: 主分支构建
- `develop`: 开发分支构建
- `v1.0.0`: 版本标签
- `1.0`: 主要+次要版本
- `1`: 主要版本

## 🛠️ 部署使用

### 1. 使用 docker-compose.ghcr.yml

```bash
# 复制环境配置文件
cp .env.ghcr.example .env.ghcr

# 编辑配置文件
nano .env.ghcr

# 启动服务
docker-compose -f docker-compose.ghcr.yml up -d
```

### 2. 使用便捷脚本

我们提供了一个管理脚本来简化操作：

```bash
# 查看帮助
./scripts/ghcr-deploy.sh help

# 拉取最新镜像
./scripts/ghcr-deploy.sh pull latest

# 启动所有服务
./scripts/ghcr-deploy.sh start

# 查看服务状态
./scripts/ghcr-deploy.sh status

# 查看日志
./scripts/ghcr-deploy.sh logs backend

# 更新到新版本
./scripts/ghcr-deploy.sh update v1.0.0

# 运行健康检查
./scripts/ghcr-deploy.sh health
```

## ⚙️ 环境配置

### 必要的环境变量

编辑 `.env.ghcr` 文件，配置以下重要参数：

```bash
# 镜像版本
IMAGE_TAG=latest

# 安全配置 (必须修改)
DB_PASSWORD=your_secure_password
JWT_SECRET=your-jwt-secret-key
API_KEY_SECRET=your-api-key-secret
DEFAULT_AGENT_API_KEY=your-agent-api-key

# 服务端口
FRONTEND_PORT=3000
BACKEND_PORT=3001
DB_PORT=5432

# 域名配置
DOMAIN=your-domain.com
CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

## 🔧 本地开发与测试

### 测试GitHub Actions本地运行

使用 [act](https://github.com/nektos/act) 在本地测试GitHub Actions：

```bash
# 安装act
brew install act  # macOS
# 或
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# 测试CI工作流
act pull_request

# 测试构建工作流 (需要GITHUB_TOKEN)
act push -s GITHUB_TOKEN=your_token
```

### 手动构建和推送

```bash
# 登录GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 构建单个组件
docker build -f Dockerfile.backend -t ghcr.io/lonelyrower/ssalgten/backend:test .

# 推送镜像
docker push ghcr.io/lonelyrower/ssalgten/backend:test
```

## 🔐 权限配置

### GitHub仓库设置

1. **启用GitHub Packages**:
   - 进入仓库设置 → Actions → General
   - 确保 "Read and write permissions" 已启用

2. **包可见性**:
   - 进入仓库设置 → Packages
   - 设置包为Public（推荐）或Private

### 拉取私有镜像

如果包设置为私有，需要认证：

```bash
# 创建Personal Access Token (PAT)
# 在GitHub: Settings → Developer settings → Personal access tokens

# 登录GHCR
docker login ghcr.io -u YOUR_USERNAME -p YOUR_PAT

# 或使用环境变量
export GHCR_TOKEN=your_pat
echo $GHCR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## 📊 监控和日志

### 查看构建状态

- 访问仓库的 Actions 标签页查看构建状态
- 检查 Packages 标签页查看已发布的镜像

### 运行时监控

```bash
# 查看所有服务状态
./scripts/ghcr-deploy.sh status

# 查看特定服务日志
./scripts/ghcr-deploy.sh logs backend

# 实时监控日志
docker-compose -f docker-compose.ghcr.yml logs -f
```

## 🚨 故障排除

### 常见问题

1. **权限被拒绝**
   ```bash
   # 检查GITHUB_TOKEN权限
   # 确保包设置正确
   ```

2. **镜像拉取失败**
   ```bash
   # 检查镜像是否存在
   docker manifest inspect ghcr.io/lonelyrower/ssalgten/backend:latest

   # 检查网络连接
   curl -I https://ghcr.io/v2/
   ```

3. **服务启动失败**
   ```bash
   # 检查环境配置
   cat .env.ghcr

   # 查看容器日志
   docker logs ssalgten-backend
   ```

### 健康检查

```bash
# 使用脚本进行健康检查
./scripts/ghcr-deploy.sh health

# 手动检查API
curl http://localhost:3001/api/health

# 检查前端
curl http://localhost:3000/health
```

## 🔄 更新流程

### 自动更新 (推荐)

1. 推送代码到主分支
2. GitHub Actions自动构建新镜像
3. 在生产环境运行更新：
   ```bash
   ./scripts/ghcr-deploy.sh update latest
   ```

### 版本发布流程

1. 创建版本标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions自动构建带版本标签的镜像

3. 在生产环境部署特定版本：
   ```bash
   ./scripts/ghcr-deploy.sh update v1.0.0
   ```

## 📝 最佳实践

1. **安全性**
   - 定期更新密钥和令牌
   - 使用强密码
   - 定期审查包权限

2. **版本管理**
   - 使用语义化版本标签
   - 在生产环境固定版本，避免使用 `latest`
   - 保留旧版本用于回滚

3. **监控**
   - 设置健康检查
   - 监控资源使用情况
   - 定期备份数据

4. **测试**
   - 在staging环境先测试新镜像
   - 使用滚动更新策略
   - 准备回滚计划