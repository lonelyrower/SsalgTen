#!/bin/bash

echo "=================================="
echo "  SsalgTen 服务诊断脚本"
echo "=================================="
echo ""

# 1. 检查 Docker 容器状态
echo "📋 1. Docker 容器状态"
echo "-----------------------------------"
docker ps -a --filter "name=ssalgten" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 2. 检查端口占用
echo "📋 2. 端口占用检查"
echo "-----------------------------------"
echo "检查端口 3000 (前端):"
netstat -ano | grep :3000 || echo "  端口 3000 未被占用"
echo ""
echo "检查端口 3001 (后端):"
netstat -ano | grep :3001 || echo "  端口 3001 未被占用"
echo ""

# 3. 检查后端健康状态
echo "📋 3. 后端 API 健康检查"
echo "-----------------------------------"
echo "测试 localhost:3001/api/health:"
curl -s http://localhost:3001/api/health || echo "  ❌ 无法连接到后端 API"
echo ""
echo ""

# 4. 检查 Socket.IO 端点
echo "📋 4. Socket.IO 端点检查"
echo "-----------------------------------"
echo "测试 localhost:3001/socket.io:"
curl -s "http://localhost:3001/socket.io/?EIO=4&transport=polling" | head -c 100
echo ""
echo ""

# 5. 查看最近的后端日志
echo "📋 5. 后端最近日志 (最后20行)"
echo "-----------------------------------"
docker logs --tail 20 ssalgten-backend 2>&1 || echo "  ❌ 无法获取后端日志"
echo ""

# 6. 查看前端日志
echo "📋 6. 前端最近日志 (最后10行)"
echo "-----------------------------------"
docker logs --tail 10 ssalgten-frontend 2>&1 || echo "  ❌ 无法获取前端日志"
echo ""

# 7. 检查 Docker 网络
echo "📋 7. Docker 网络配置"
echo "-----------------------------------"
docker network ls | grep ssalgten
echo ""

# 8. 显示诊断建议
echo "=================================="
echo "  📊 诊断建议"
echo "=================================="
echo ""

# 检查容器是否运行
BACKEND_RUNNING=$(docker ps --filter "name=ssalgten-backend" --filter "status=running" -q)
FRONTEND_RUNNING=$(docker ps --filter "name=ssalgten-frontend" --filter "status=running" -q)

if [ -z "$BACKEND_RUNNING" ]; then
    echo "❌ 后端容器未运行"
    echo "   解决方案: docker-compose up -d backend"
    echo ""
fi

if [ -z "$FRONTEND_RUNNING" ]; then
    echo "❌ 前端容器未运行"
    echo "   解决方案: docker-compose up -d frontend"
    echo ""
fi

if [ -n "$BACKEND_RUNNING" ] && [ -n "$FRONTEND_RUNNING" ]; then
    echo "✅ 所有容器正在运行"
    echo ""
    echo "如果仍有连接问题，请检查："
    echo "  1. 浏览器控制台错误信息"
    echo "  2. 后端日志: docker logs -f ssalgten-backend"
    echo "  3. 网络配置: docker network inspect ssalgten_default"
    echo ""
fi

echo "=================================="
echo "  完成诊断"
echo "=================================="
