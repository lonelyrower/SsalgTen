#!/bin/bash

# SsalgTen 修复验证脚本
# 用于验证所有修复是否生效

echo "========================================"
echo "  SsalgTen 修复验证脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. 检查数据库迁移
echo "1️⃣  检查数据库迁移..."
if docker compose logs backend 2>/dev/null | grep -q "Database migrations completed"; then
    check_pass "数据库迁移已执行"
else
    check_warn "未找到迁移日志，可能需要重启后端"
fi
echo ""

# 2. 检查系统配置初始化
echo "2️⃣  检查系统配置初始化..."
if docker compose logs backend 2>/dev/null | grep -q "System configuration initialized"; then
    check_pass "系统配置已初始化"
    
    # 检查是否有配置项创建
    if docker compose logs backend 2>/dev/null | grep -q "created"; then
        created=$(docker compose logs backend 2>/dev/null | grep "System config" | grep -oP '\d+ created' | head -1)
        check_pass "配置项创建: $created"
    fi
else
    check_fail "系统配置未初始化"
fi
echo ""

# 3. 检查访问统计表
echo "3️⃣  检查访问统计功能..."
if docker compose exec -T backend npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM visitor_logs LIMIT 1;" 2>/dev/null; then
    check_pass "visitor_logs 表存在"
else
    check_fail "visitor_logs 表不存在，需要运行迁移"
fi
echo ""

# 4. 检查系统设置表
echo "4️⃣  检查系统设置..."
if docker compose exec -T backend npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM settings WHERE category='map';" 2>/dev/null | grep -q "1\|2"; then
    check_pass "map 配置已创建"
else
    check_warn "map 配置可能缺失"
fi
echo ""

# 5. 检查前端服务
echo "5️⃣  检查前端服务..."
if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    check_pass "前端服务正常"
else
    check_fail "前端服务无响应"
fi
echo ""

# 6. 检查后端服务
echo "6️⃣  检查后端服务..."
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    check_pass "后端服务正常"
else
    check_fail "后端服务无响应"
fi
echo ""

# 7. 测试访问统计
echo "7️⃣  测试访问统计记录..."
echo "   发送测试请求..."
curl -s http://localhost:3000 >/dev/null 2>&1
sleep 2
if docker compose exec -T backend npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM visitor_logs;" 2>/dev/null | grep -qE "[1-9]"; then
    count=$(docker compose exec -T backend npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM visitor_logs;" 2>/dev/null | grep -oE "[0-9]+")
    check_pass "访问统计正在记录（当前记录数: $count）"
else
    check_warn "访问统计可能未记录，请检查后端日志"
fi
echo ""

# 8. 总结
echo "========================================"
echo "  验证完成"
echo "========================================"
echo ""
echo "📋 后续操作建议："
echo ""
echo "1. 访问后台查看系统设置："
echo "   http://your-ip:3000/admin"
echo "   导航到：系统设置 -> 筛选分类 'map'"
echo ""
echo "2. 访问后台查看访问统计："
echo "   http://your-ip:3000/admin"
echo "   查看：访问统计卡片"
echo ""
echo "3. 测试 3D 地球（清除浏览器缓存）："
echo "   http://your-ip:3000"
echo "   切换到 3D 地球视图"
echo "   检查控制台是否有错误"
echo ""
echo "4. 如有问题，查看详细日志："
echo "   docker compose logs backend | tail -100"
echo "   docker compose logs frontend | tail -50"
echo ""
