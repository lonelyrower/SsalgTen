#!/bin/bash

# 强制重建和重新部署脚本
echo "🔧 开始强制重建和重新部署..."

# 1. 停止所有服务
echo "⏹️ 停止所有服务..."
docker-compose -f docker-compose.production.yml down

# 2. 清理Docker资源
echo "🧹 清理Docker资源..."
docker system prune -f
docker volume ls -q | grep ssalgten | xargs -r docker volume rm

# 3. 重新拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 4. 强制重新构建（无缓存）
echo "🔨 强制重新构建所有镜像..."
docker-compose -f docker-compose.production.yml build --no-cache --pull

# 5. 启动服务
echo "🚀 启动服务..."
docker-compose -f docker-compose.production.yml up -d

# 6. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 7. 检查服务状态
echo "📊 检查服务状态..."
docker-compose -f docker-compose.production.yml ps

echo "✅ 强制重建完成！"
echo ""
echo "🔍 如果仍有问题，请查看日志："
echo "  docker-compose -f docker-compose.production.yml logs frontend"
echo "  docker-compose -f docker-compose.production.yml logs backend"