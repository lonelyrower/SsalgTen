#!/bin/bash

# 🔑 重置管理员密码脚本
# 适用于所有环境：开发环境和生产环境
# 
# 使用方法:
#   chmod +x scripts/reset-admin-password.sh
#   ./scripts/reset-admin-password.sh
#
# 或者从项目根目录:
#   bash scripts/reset-admin-password.sh

set -e

echo ""
echo "🔑 SsalgTen 管理员密码重置工具"
echo "=================================="
echo ""

# 检测 docker-compose 命令
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ 错误: 未找到 docker-compose 或 docker compose 命令"
    echo "请先安装 Docker 和 Docker Compose"
    exit 1
fi

# 检查后端容器状态
echo "📋 检查容器状态..."
BACKEND_RUNNING=$($DOCKER_COMPOSE ps backend 2>/dev/null | grep -c "Up" || echo "0")

if [ "$BACKEND_RUNNING" = "0" ]; then
    echo "⚠️  backend 容器未运行"
    echo ""
    read -p "是否启动 backend 容器? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 正在启动 backend 容器..."
        $DOCKER_COMPOSE up -d backend
        echo "⏳ 等待容器完全启动..."
        sleep 10
    else
        echo "❌ 已取消操作"
        exit 1
    fi
fi

echo ""
echo "🔧 正在重置管理员密码..."
echo ""

# 尝试使用 npm script 重置
if $DOCKER_COMPOSE exec -T backend npm run reset-admin 2>/dev/null; then
    echo ""
    echo "✅ 密码重置成功！"
else
    # 如果 npm script 失败，使用 Prisma 直接重置
    echo "⚠️  使用备用方案重置密码..."
    
    # admin123 的 bcrypt 哈希 (12轮)
    HASHED_PASSWORD='$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIR.yvGuUS'
    
    $DOCKER_COMPOSE exec -T backend npx prisma db execute \
        --stdin <<EOF
UPDATE "User" 
SET 
    password = '${HASHED_PASSWORD}',
    "updatedAt" = NOW()
WHERE username = 'admin';
EOF
    
    echo ""
    echo "✅ 密码重置成功！"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔑 默认登录凭据："
echo ""
echo "   用户名: admin"
echo "   密码:   admin123"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  安全提醒："
echo "   • 请立即登录系统"
echo "   • 进入【系统管理】→【用户管理】"
echo "   • 修改 admin 账户密码"
echo "   • 设置强密码（建议 12+ 字符）"
echo ""
echo "📍 访问地址："
echo "   开发环境: http://localhost:3000"
echo "   生产环境: 使用你的域名或 IP"
echo ""
