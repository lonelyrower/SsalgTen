#!/bin/bash

# 数据库迁移脚本 - 添加nameCustomized字段
# 用于修复Agent重连时覆盖用户自定义节点名称的问题

set -e

echo "🔄 应用数据库迁移: 添加nameCustomized字段..."

# 进入backend目录
cd "$(dirname "$0")/../backend"

# 应用Prisma迁移
npx prisma migrate deploy

# 生成Prisma客户端
npx prisma generate

echo "✅ 数据库迁移完成!"
echo ""
echo "📝 迁移内容:"
echo "   - 添加了 nameCustomized 字段到 nodes 表"
echo "   - 现有节点的非默认名称将被标记为用户自定义"
echo "   - Agent重连时将不再覆盖用户自定义的节点名称"