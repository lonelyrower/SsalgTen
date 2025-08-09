#!/bin/bash

# SsalgTen Production Deployment Script
# =====================================

set -e  # Exit on any error

echo "🚀 Starting SsalgTen Production Deployment..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要条件
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# 检查Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# 检查.env文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from production template...${NC}"
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo -e "${YELLOW}📝 Please edit .env file with your production settings before continuing!${NC}"
        echo -e "${YELLOW}   Critical: Change JWT_SECRET, API_KEY_SECRET, DB_PASSWORD, REDIS_PASSWORD${NC}"
        read -p "Press Enter after editing .env file..."
    else
        echo -e "${RED}❌ .env.production template not found!${NC}"
        exit 1
    fi
fi

# 自动检测公网IP
echo -e "${BLUE}🌐 Detecting public IP address...${NC}"
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || curl -s ipecho.net/plain)
if [ -z "$PUBLIC_IP" ]; then
    echo -e "${RED}❌ Unable to detect public IP. Please set DOMAIN manually in .env file${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Detected public IP: $PUBLIC_IP${NC}"

# 验证关键配置
echo -e "${BLUE}🔍 Validating configuration...${NC}"
source .env

# 自动更新域名配置
if grep -q "DOMAIN=your-domain.com" .env; then
    echo -e "${YELLOW}📝 Auto-configuring domain with public IP...${NC}"
    sed -i "s/DOMAIN=your-domain.com/DOMAIN=$PUBLIC_IP/g" .env
    sed -i "s#CORS_ORIGIN=http://your-domain.com#CORS_ORIGIN=http://$PUBLIC_IP#g" .env  
    sed -i "s#VITE_API_BASE_URL=http://your-domain.com:3001/api#VITE_API_BASE_URL=http://$PUBLIC_IP:3001/api#g" .env
    source .env
fi

if [[ "$JWT_SECRET" == "your-super-secret-jwt-key"* ]]; then
    echo -e "${RED}❌ Please change JWT_SECRET in .env file!${NC}"
    exit 1
fi

if [[ "$API_KEY_SECRET" == "your-api-key-secret"* ]]; then
    echo -e "${RED}❌ Please change API_KEY_SECRET in .env file!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration validation passed${NC}"

# 创建必要目录
echo -e "${BLUE}📁 Creating data directories...${NC}"
sudo mkdir -p /var/lib/ssalgten/postgres
sudo mkdir -p /var/lib/ssalgten/redis  
sudo mkdir -p /var/lib/ssalgten/logs
sudo chown -R $USER:$USER /var/lib/ssalgten/

# 停止现有服务
echo -e "${BLUE}🛑 Stopping existing services...${NC}"
docker-compose down --remove-orphans || true

# 拉取/构建镜像
echo -e "${BLUE}🏗️  Building images...${NC}"
docker-compose build --no-cache

# 启动服务
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 30

# 健康检查
echo -e "${BLUE}🏥 Performing health checks...${NC}"

# 检查后端
if curl -f -s "http://localhost:${BACKEND_PORT:-3001}/api/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend service is healthy${NC}"
else
    echo -e "${RED}❌ Backend service health check failed${NC}"
    docker-compose logs backend
    exit 1
fi

# 检查前端
if curl -f -s "http://localhost:${FRONTEND_PORT:-80}/" > /dev/null; then
    echo -e "${GREEN}✅ Frontend service is healthy${NC}"
else
    echo -e "${RED}❌ Frontend service health check failed${NC}"
    docker-compose logs frontend
    exit 1
fi

# 显示服务状态
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

# 显示访问信息
echo -e "${GREEN}"
echo "🎉 Deployment completed successfully!"
echo "========================================="
echo "🌐 Web Interface: http://$(curl -s ifconfig.me):${FRONTEND_PORT:-80}"
echo "🔗 API Server: http://$(curl -s ifconfig.me):${BACKEND_PORT:-3001}/api"
echo "📊 Health Check: http://$(curl -s ifconfig.me):${BACKEND_PORT:-3001}/api/health"
echo ""
echo "🔑 Default Admin Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   ⚠️  CHANGE DEFAULT CREDENTIALS IMMEDIATELY!"
echo ""
echo "📋 Management Commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Update:       git pull && docker-compose build && docker-compose up -d"
echo -e "${NC}"

# 显示防火墙提示
echo -e "${YELLOW}🔥 Firewall Configuration Reminder:${NC}"
echo "   Make sure these ports are open:"
echo "   - Port ${FRONTEND_PORT:-80} (HTTP Web Interface)"
echo "   - Port ${BACKEND_PORT:-3001} (API Server)"
echo ""
echo "   Ubuntu/Debian: sudo ufw allow ${FRONTEND_PORT:-80} && sudo ufw allow ${BACKEND_PORT:-3001}"
echo "   CentOS/RHEL: sudo firewall-cmd --add-port=${FRONTEND_PORT:-80}/tcp --permanent && sudo firewall-cmd --add-port=${BACKEND_PORT:-3001}/tcp --permanent && sudo firewall-cmd --reload"

echo -e "${GREEN}🚀 SsalgTen is now running in production mode!${NC}"