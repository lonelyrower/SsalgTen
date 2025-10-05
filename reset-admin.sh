#!/bin/bash

# 快速重置 Admin 密码脚本
# 使用方法: ./reset-admin.sh

set -e

echo "🔧 正在重置管理员密码..."
echo ""

# 确定项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
if ! $DOCKER_COMPOSE ps | grep -q backend.*Up; then
    echo "⚠️  警告: backend 容器未运行"
    echo "正在启动 backend 容器..."
    $DOCKER_COMPOSE up -d backend
    sleep 5
fi

# 在容器中执行密码重置
echo "正在重置密码..."
$DOCKER_COMPOSE exec -T backend npm run reset-admin

echo ""
echo "✅ 密码重置完成！"
echo ""
echo "🔑 请使用以下凭据登录:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "⚠️  请在首次登录后立即更改密码！"
