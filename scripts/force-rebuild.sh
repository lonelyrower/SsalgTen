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

# 5. 启动数据库
echo "🚀 启动数据库..."
docker-compose -f docker-compose.production.yml up -d postgres

# 6. 等待数据库启动
echo "⏳ 等待数据库启动..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -f docker-compose.production.yml exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
        echo "✅ 数据库已启动完成"
        break
    fi
    attempt=$((attempt + 1))
    echo "等待数据库启动... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ 数据库启动超时"
    exit 1
fi

# 7. 运行数据库迁移
echo "📊 运行数据库迁移..."
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy

# 8. 运行数据库种子脚本
echo "👤 创建管理员用户..."
docker-compose -f docker-compose.production.yml run --rm backend npm run db:seed

# 9. 启动所有服务
echo "🚀 启动所有服务..."
docker-compose -f docker-compose.production.yml up -d

# 10. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 11. 检查服务状态
echo "📊 检查服务状态..."
docker-compose -f docker-compose.production.yml ps

echo "✅ 强制重建完成！"
echo ""
echo "🔍 如果仍有问题，请查看日志："
echo "  docker-compose -f docker-compose.production.yml logs frontend"
echo "  docker-compose -f docker-compose.production.yml logs backend"