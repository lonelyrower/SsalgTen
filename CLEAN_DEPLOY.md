# 清理并重新部署指南

## 问题诊断

错误信息：
```
Error response from daemon: failed to set up container networking: 
driver failed programming external connectivity on endpoint ssalgten-database: 
failed to listen on TCP socket: address already in use
```

**原因**：之前的容器还在运行，占用了端口 5432

## 🔍 第一步：检查运行的容器

```bash
docker ps -a | grep ssalgten
```

## 🧹 第二步：完全清理

### 方法 1：使用脚本清理（推荐）

```bash
cd /opt/ssalgten

# 停止所有服务
docker compose -f docker-compose.ghcr.yml down
docker compose down

# 删除所有 ssalgten 容器（如果存在）
docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
             ssalgten-backend ssalgten-frontend ssalgten-agent \
             ssalgten-updater 2>/dev/null || true
```

### 方法 2：手动清理每个容器

```bash
# 查看所有容器
docker ps -a | grep ssalgten

# 删除特定容器（根据实际情况）
docker rm -f <容器名称>

# 例如：
docker rm -f ssalgten-database
docker rm -f ssalgten-postgres
```

## 🔌 第三步：确认端口空闲

```bash
# 检查端口 5432（PostgreSQL）
sudo lsof -i :5432
# 或
sudo netstat -tlnp | grep 5432

# 检查端口 6379（Redis）
sudo lsof -i :6379

# 检查端口 3000（Backend）
sudo lsof -i :3000

# 检查端口 5173（Frontend）
sudo lsof -i :5173
```

**应该没有任何输出**，表示端口空闲。

如果仍有进程占用，可以强制停止：
```bash
# 查找占用进程
sudo lsof -i :5432

# 停止进程（替换 <PID> 为实际进程ID）
sudo kill -9 <PID>
```

## 🗑️ 第四步：清理 Docker 资源（可选）

```bash
# 清理未使用的容器、网络、镜像
docker system prune -f

# 如果需要完全重置（会删除所有数据卷）
docker system prune -a --volumes -f
```

⚠️ **警告**：`--volumes` 会删除数据库数据！

## 🚀 第五步：重新部署

### 方法 1：使用安装脚本（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

### 方法 2：手动部署

```bash
cd /opt/ssalgten

# 拉取最新代码
git pull origin main

# 拉取镜像
docker compose -f docker-compose.ghcr.yml pull

# 启动服务
docker compose -f docker-compose.ghcr.yml up -d
```

## ✅ 第六步：验证部署

```bash
# 查看运行的容器
docker ps | grep ssalgten

# 预期输出（所有容器都应该是 Up 状态）：
# ssalgten-database    Up
# ssalgten-redis       Up
# ssalgten-backend     Up
# ssalgten-frontend    Up
# ssalgten-agent       Up
# ssalgten-updater     Up

# 查看容器日志
docker logs ssalgten-backend
docker logs ssalgten-database

# 检查服务健康状态
curl -f http://localhost:3000/health || echo "Backend 未就绪"
curl -f http://localhost:5173 || echo "Frontend 未就绪"
```

## 🔄 完整清理脚本（一键执行）

创建文件 `/tmp/clean-ssalgten.sh`：

```bash
#!/bin/bash
set -e

echo "🧹 清理 SsalgTen 容器..."

# 1. 停止所有服务
cd /opt/ssalgten 2>/dev/null || true
docker compose -f docker-compose.ghcr.yml down 2>/dev/null || true
docker compose down 2>/dev/null || true

# 2. 删除所有容器
docker rm -f \
  ssalgten-database \
  ssalgten-postgres \
  ssalgten-redis \
  ssalgten-backend \
  ssalgten-frontend \
  ssalgten-agent \
  ssalgten-updater \
  2>/dev/null || true

# 3. 检查端口
echo "🔍 检查端口占用..."
for port in 5432 6379 3000 5173; do
  if sudo lsof -i :$port > /dev/null 2>&1; then
    echo "⚠️  端口 $port 仍被占用"
    sudo lsof -i :$port
  else
    echo "✅ 端口 $port 空闲"
  fi
done

# 4. 清理 Docker 资源
echo "🗑️  清理未使用的 Docker 资源..."
docker system prune -f

echo "✅ 清理完成！"
echo ""
echo "🚀 现在可以重新部署："
echo "curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install"
```

执行：
```bash
bash /tmp/clean-ssalgten.sh
```

## 🐛 常见问题

### Q1: 端口仍被占用
```bash
# 查找所有占用端口的进程
sudo netstat -tlnp | grep -E '5432|6379|3000|5173'

# 强制停止所有 Docker 容器
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
```

### Q2: 网络冲突
```bash
# 删除 SsalgTen 网络
docker network rm ssalgten-network 2>/dev/null || true

# 重新创建
docker network create ssalgten-network
```

### Q3: 数据卷问题
```bash
# 查看数据卷
docker volume ls | grep ssalgten

# 删除数据卷（会丢失数据！）
docker volume rm ssalgten-postgres-data 2>/dev/null || true
docker volume rm ssalgten-redis-data 2>/dev/null || true
```

## 📋 检查清单

部署前确认：

- [ ] 所有旧容器已删除（`docker ps -a | grep ssalgten` 无输出）
- [ ] 端口 5432 空闲（`sudo lsof -i :5432` 无输出）
- [ ] 端口 6379 空闲
- [ ] 端口 3000 空闲
- [ ] 端口 5173 空闲
- [ ] Docker 服务正常（`docker ps` 可执行）
- [ ] 有足够的磁盘空间（`df -h`）
- [ ] 网络连接正常（`ping github.com`）

部署后验证：

- [ ] 6 个容器全部运行（`docker ps | grep ssalgten | wc -l` = 6）
- [ ] 数据库可连接（`docker exec ssalgten-database pg_isready`）
- [ ] Backend 健康检查通过（`curl http://localhost:3000/health`）
- [ ] Frontend 可访问（`curl http://localhost:5173`）
- [ ] 日志无错误（`docker logs ssalgten-backend`）
