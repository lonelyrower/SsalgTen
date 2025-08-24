#!/bin/bash

echo "=== SsalgTen Agent 多场景部署指南 ==="
echo ""
echo "🏗️  请根据你的部署场景选择正确的配置："
echo ""

echo "📋 场景1：同机部署（在主服务器VPS上安装Agent）"
echo "─────────────────────────────────────────────"
echo "适用于：在运行SsalgTen主服务的VPS上也安装Agent进行自监控"
echo ""
echo "1. 拉取Agent镜像:"
echo "docker pull ghcr.io/lonelyrower/ssalgten-agent:latest"
echo ""
echo "2. 停止并删除旧容器（如果存在）:"
echo "docker stop ssalgten-agent 2>/dev/null || true"
echo "docker rm ssalgten-agent 2>/dev/null || true"
echo ""
echo "3. 同机安装命令（使用 host.docker.internal）:"
cat << 'EOF'
docker run -d \
  --name ssalgten-agent \
  --restart unless-stopped \
  -e MASTER_URL="http://host.docker.internal:3001" \
  -e MASTER_API_KEY="default-agent-api-key-change-this-in-production" \
  -e NODE_NAME="Master-Server-Agent" \
  -e NODE_COUNTRY="US" \
  -e NODE_CITY="MainServer" \
  -e NODE_PROVIDER="Main-Host" \
  -e NODE_LATITUDE="0" \
  -e NODE_LONGITUDE="0" \
  --add-host host.docker.internal:host-gateway \
  ghcr.io/lonelyrower/ssalgten-agent:latest
EOF
echo ""
echo ""

echo "📋 场景2：跨机部署（在其他VPS上安装Agent）"
echo "─────────────────────────────────────────────"
echo "适用于：在独立的VPS上安装Agent，连接到远程主服务器"
echo ""
echo "1. 拉取Agent镜像:"
echo "docker pull ghcr.io/lonelyrower/ssalgten-agent:latest"
echo ""
echo "2. 停止并删除旧容器（如果存在）:"
echo "docker stop ssalgten-agent 2>/dev/null || true"
echo "docker rm ssalgten-agent 2>/dev/null || true"
echo ""
echo "3. 跨机安装命令（替换YOUR_MASTER_SERVER_IP为实际IP）:"
cat << 'EOF'
# ⚠️  请将 YOUR_MASTER_SERVER_IP 替换为你的主服务器IP地址
docker run -d \
  --name ssalgten-agent \
  --restart unless-stopped \
  -e MASTER_URL="http://YOUR_MASTER_SERVER_IP:3001" \
  -e MASTER_API_KEY="default-agent-api-key-change-this-in-production" \
  -e NODE_NAME="Remote-Agent" \
  -e NODE_COUNTRY="US" \
  -e NODE_CITY="RemoteCity" \
  -e NODE_PROVIDER="Remote-Host" \
  -e NODE_LATITUDE="0" \
  -e NODE_LONGITUDE="0" \
  ghcr.io/lonelyrower/ssalgten-agent:latest
EOF
echo ""
echo ""

echo "🔧 示例：修复当前Malaysia VPS的Agent配置"
echo "─────────────────────────────────────────────"
echo "如果你的主服务器IP是 160.187.211.115："
echo ""
cat << 'EOF'
# 方法1：修改现有配置
cd /opt/ssalgten-agent
sed -i 's|MASTER_URL=.*|MASTER_URL=http://160.187.211.115:3001|' .env
docker_compose restart

# 方法2：重新安装
docker stop ssalgten-agent && docker rm ssalgten-agent
docker run -d \
  --name ssalgten-agent \
  --restart unless-stopped \
  -e MASTER_URL="http://160.187.211.115:3001" \
  -e MASTER_API_KEY="default-agent-api-key-change-this-in-production" \
  -e NODE_NAME="Malaysia-Agent" \
  -e NODE_COUNTRY="MY" \
  -e NODE_CITY="JohorBahru" \
  -e NODE_PROVIDER="Advin Services" \
  -e NODE_LATITUDE="1.4927" \
  -e NODE_LONGITUDE="103.7414" \
  ghcr.io/lonelyrower/ssalgten-agent:latest
EOF
echo ""
echo ""

echo "4. 查看Agent运行状态:"
echo "docker logs -f ssalgten-agent"
echo ""

echo "✅ 成功标志:"
echo "  [INFO] Agent registered successfully"
echo "  [INFO] Heartbeat started"
echo ""

echo "🌐 端口说明:"
echo "  - 主服务器后端: YOUR_MASTER_IP:3001"
echo "  - 主服务器前端: YOUR_MASTER_IP:3000"
echo "  - Agent本地服务: localhost:3002 (仅本机访问)"
echo ""

echo "🎯 关键点:"
echo "  - 同机部署: 使用 host.docker.internal:3001"
echo "  - 跨机部署: 使用主服务器的实际IP:3001"
echo "  - 确保主服务器防火墙开放3001端口"