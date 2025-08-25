#!/bin/bash

# SsalgTen Frontend Update Script
# 用于解决端口冲突并更新前端的脚本

set -e  # 遇到错误立即退出

echo "🔄 SsalgTen 前端更新脚本启动..."

# 确保在正确目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "📍 项目目录: $PROJECT_DIR"

# 停止可能冲突的服务
echo "⏹️  停止可能冲突的PostgreSQL服务..."
sudo systemctl stop postgresql 2>/dev/null || true
sudo systemctl disable postgresql 2>/dev/null || true

# 检查并杀死占用5432端口的进程
echo "🔍 检查端口5432占用情况..."
if sudo lsof -ti:5432 >/dev/null 2>&1; then
    echo "⚠️  发现端口5432被占用，正在清理..."
    sudo lsof -ti:5432 | xargs sudo kill -9 2>/dev/null || true
    sleep 2
fi

# 强制清理Docker网络和容器
echo "🧹 强制清理Docker资源..."
# 尝试不同的Docker Compose命令格式
if command -v "docker" &> /dev/null && docker compose version &> /dev/null; then
    docker compose down -v --remove-orphans 2>/dev/null || true
elif command -v "docker-compose" &> /dev/null; then
    docker-compose down -v --remove-orphans 2>/dev/null || true
else
    echo "❌ Docker Compose 未安装或不可用"
    exit 1
fi
docker system prune -f --volumes 2>/dev/null || true

# 再次检查并强制清理端口
echo "🔍 再次检查端口5432..."
if sudo lsof -ti:5432 >/dev/null 2>&1; then
    echo "⚠️  仍有进程占用5432端口，执行强制清理..."
    sudo fuser -k 5432/tcp 2>/dev/null || true
    sleep 3
fi

# 检查是否有遗留的PostgreSQL Docker容器
echo "🔍 清理遗留的PostgreSQL容器..."
docker ps -a --format "table {{.Names}}" | grep -i postgres | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --format "table {{.Names}}" | grep -i database | xargs -r docker rm -f 2>/dev/null || true

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 这部分已经在上面的强制清理中处理了

# 重新构建前端
echo "🔨 重新构建前端容器..."
if command -v "docker" &> /dev/null && docker compose version &> /dev/null; then
    docker compose build --no-cache frontend
elif command -v "docker-compose" &> /dev/null; then
    docker-compose build --no-cache frontend
fi

# 启动所有服务
echo "🚀 启动所有服务..."
if command -v "docker" &> /dev/null && docker compose version &> /dev/null; then
    docker compose up -d
elif command -v "docker-compose" &> /dev/null; then
    docker-compose up -d
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "✅ 检查服务状态..."
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ssalgten || echo "未找到SsalgTen容器"

# 检查前端是否可访问
echo "----------------------------------------"
echo "🌐 检查前端服务..."
if curl -s http://localhost >/dev/null 2>&1; then
    echo "✅ 前端服务正常运行: http://localhost"
else
    echo "❌ 前端服务可能未正常启动"
fi

# 检查后端API
echo "🔧 检查后端API..."
if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ 后端API正常运行: http://localhost:3001/api/health"
else
    echo "❌ 后端API可能未正常启动"
fi

echo "----------------------------------------"
echo "🎉 前端更新完成！"
echo ""
echo "访问地址:"
echo "  前端: http://localhost"
echo "  后端API: http://localhost:3001/api/health"
echo ""
echo "如有问题，请检查日志:"
echo "  docker logs ssalgten-frontend"
echo "  docker logs ssalgten-backend"
echo "  docker logs ssalgten-database"