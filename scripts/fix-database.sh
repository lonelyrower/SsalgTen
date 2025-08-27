#!/bin/bash

# 数据库修复脚本 - 用于修复现有安装中的数据库问题
echo "🔧 开始修复数据库..."

# Docker Compose兼容性函数
docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        echo "❌ Docker Compose not found"
        exit 1
    fi
}

cd /opt/ssalgten || exit 1

# 1. 检查当前状态
echo "📊 检查当前服务状态..."
docker_compose -f docker-compose.production.yml ps

# 2. 确保数据库正在运行
echo "🔄 确保数据库服务运行中..."
docker_compose -f docker-compose.production.yml up -d postgres

# 3. 等待数据库准备就绪
echo "⏳ 等待数据库准备就绪..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker_compose -f docker-compose.production.yml exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
        echo "✅ 数据库已准备就绪"
        break
    fi
    attempt=$((attempt + 1))
    echo "等待数据库... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ 数据库连接超时"
    exit 1
fi

# 4. 运行数据库迁移
echo "📊 运行数据库迁移..."
docker_compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ 数据库迁移失败"
    exit 1
fi

# 5. 检查数据库表是否创建成功
echo "🔍 验证数据库表..."
table_count=$(docker_compose -f docker-compose.production.yml exec postgres psql -U ssalgten -d ssalgten -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ "$table_count" -gt 0 ]; then
    echo "✅ 数据库表创建成功 (发现 $table_count 个表)"
else
    echo "❌ 数据库表创建失败"
    exit 1
fi

# 6. 运行数据库种子脚本
echo "👤 创建管理员用户..."
docker_compose -f docker-compose.production.yml run --rm backend npm run db:seed

# 7. 重启后端服务
echo "🔄 重启后端服务..."
docker_compose -f docker-compose.production.yml restart backend

# 8. 等待服务启动
echo "⏳ 等待服务重启..."
sleep 5

# 9. 测试API
echo "🧪 测试API连接..."
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API连接正常"
else
    echo "⚠️ API连接可能有问题，请检查日志"
fi

# 10. 显示最终状态
echo "📊 最终服务状态:"
docker_compose -f docker-compose.production.yml ps

echo ""
echo "✅ 数据库修复完成！"
echo ""
echo "🎯 默认登录信息:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "🔍 如果仍有问题，请查看日志:"
echo "   docker_compose -f docker-compose.production.yml logs backend"
echo "   docker_compose -f docker-compose.production.yml logs frontend"