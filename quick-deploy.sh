#!/bin/bash
# SsalgTen Quick Deploy - 一键部署脚本

echo "🚀 SsalgTen Quick Deploy"
echo "======================="

# 设置默认环境变量（如果没有.env文件）
if [ ! -f ".env" ]; then
    echo "📝 Creating default .env configuration..."
    cat > .env << 'EOF'
# SsalgTen Quick Deploy Configuration
NODE_ENV=production
FRONTEND_PORT=80
BACKEND_PORT=3001
DB_PORT=5432
REDIS_PORT=6379

# 安全配置 - 生产环境请务必更改！
DB_PASSWORD=ssalgten_prod_db_2024
REDIS_PASSWORD=ssalgten_prod_redis_2024
JWT_SECRET=ssalgten-production-jwt-secret-key-minimum-32-chars
API_KEY_SECRET=ssalgten-production-api-key-secret-for-agents
DEFAULT_AGENT_API_KEY=default-production-agent-key-change-immediately

# 系统配置
DATABASE_URL=postgresql://ssalgten:ssalgten_prod_db_2024@database:5432/ssalgten
CORS_ORIGIN=http://\$EXTERNAL_IP
LOG_LEVEL=info
ENABLE_MORGAN=false

# 前端配置
VITE_API_BASE_URL=http://\$EXTERNAL_IP:3001/api
VITE_APP_NAME=SsalgTen Network Monitor
VITE_APP_VERSION=1.0.0

# Agent示例配置
AGENT_NYC_ID=agent-production
AGENT_NYC_API_KEY=production-agent-api-key
AGENT_NYC_NAME=Production Node
AGENT_NYC_COUNTRY=United States
AGENT_NYC_CITY=New York
AGENT_NYC_PROVIDER=Production VPS
AGENT_NYC_LATITUDE=40.7128
AGENT_NYC_LONGITUDE=-74.0060
AGENT_NYC_PORT=3002
EOF
    echo "✅ Created .env with default settings"
    echo "⚠️  Remember to change passwords and secrets for production!"
fi

# 停止现有服务
echo "🛑 Stopping existing services..."
docker-compose down 2>/dev/null || true

# 构建并启动
echo "🏗️  Building and starting services..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ Waiting for services (30 seconds)..."
sleep 30

# 检查状态
echo "📊 Checking service status..."
docker-compose ps

# 获取外网IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")

# 更新.env中的CORS配置
if [ -f ".env" ]; then
    sed -i "s|CORS_ORIGIN=http://\\\$EXTERNAL_IP|CORS_ORIGIN=http://$EXTERNAL_IP|g" .env
    sed -i "s|VITE_API_BASE_URL=http://localhost:3001/api|VITE_API_BASE_URL=http://$EXTERNAL_IP:3001/api|g" .env
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "🌐 Web: http://$EXTERNAL_IP"
echo "🔗 API: http://$EXTERNAL_IP:3001/api"
echo "🏥 Health: http://$EXTERNAL_IP:3001/api/health"
echo ""
echo "🔑 Default Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   🚨 CHANGE IMMEDIATELY!"
echo ""
echo "📋 Commands:"
echo "   Logs: docker-compose logs -f"
echo "   Stop: docker-compose down"
echo "   Restart: docker-compose restart"