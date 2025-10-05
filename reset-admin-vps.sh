#!/bin/bash

# 🔧 远程 VPS 上重置管理员密码
# 使用方法: 
#   1. SSH 登录到 VPS
#   2. cd 到项目目录
#   3. 运行: bash reset-admin-vps.sh

set -e

echo "🔧 正在重置管理员密码..."
echo ""

# 检查 docker-compose 命令
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ 错误: 未找到 docker-compose 或 docker compose 命令"
    exit 1
fi

# 检查容器是否运行
echo "📋 检查容器状态..."
if ! $DOCKER_COMPOSE ps | grep -q backend.*Up; then
    echo "⚠️  backend 容器未运行，正在启动..."
    $DOCKER_COMPOSE up -d backend
    echo "⏳ 等待容器启动..."
    sleep 10
fi

# 方法1: 使用项目的 reset-admin 脚本（如果存在）
if $DOCKER_COMPOSE exec -T backend test -f /app/node_modules/.bin/ts-node 2>/dev/null; then
    echo "✅ 找到 reset-admin 脚本，正在执行..."
    $DOCKER_COMPOSE exec -T backend npm run reset-admin
else
    # 方法2: 直接使用 Prisma 重置密码
    echo "⚠️  未找到 reset-admin 脚本，使用 Prisma 直接重置..."
    
    # 生成密码哈希（bcrypt，12轮）
    # admin123 的 bcrypt 哈希
    HASHED_PASSWORD='$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIR.yvGuUS'
    
    $DOCKER_COMPOSE exec -T backend npx prisma db execute \
        --stdin <<EOF
UPDATE "User" 
SET 
    password = '${HASHED_PASSWORD}',
    "updatedAt" = NOW()
WHERE username = 'admin';
EOF
fi

echo ""
echo "✅ 密码重置完成！"
echo ""
echo "🔑 请使用以下凭据登录:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "⚠️  请在登录后立即更改密码！"
echo ""
echo "📍 访问地址: http://你的VPS_IP:3000"
echo "   或使用域名: https://你的域名"
echo ""
