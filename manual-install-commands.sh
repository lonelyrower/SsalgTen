#!/bin/bash

echo "=== SsalgTen Agent 手动安装指令 ==="
echo ""
echo "后端运行在标准端口 http://localhost:3001"
echo "请按以下步骤手动安装Agent:"
echo ""

echo "1. 拉取Agent镜像:"
echo "docker pull ghcr.io/lonelyrower/ssalgten-agent:latest"
echo ""

echo "2. 停止并删除旧容器（如果存在）:"
echo "docker stop ssalgten-agent 2>/dev/null || true"
echo "docker rm ssalgten-agent 2>/dev/null || true"
echo ""

echo "3. 运行新的Agent容器:"
cat << 'EOF'
docker run -d \
  --name ssalgten-agent \
  --restart unless-stopped \
  -e MASTER_URL="http://host.docker.internal:3001" \
  -e MASTER_API_KEY="default-agent-api-key-change-this-in-production" \
  -e NODE_NAME="My-Agent-Node" \
  -e NODE_COUNTRY="US" \
  -e NODE_CITY="Unknown" \
  -e NODE_PROVIDER="Unknown" \
  -e NODE_LATITUDE="0" \
  -e NODE_LONGITUDE="0" \
  --add-host host.docker.internal:host-gateway \
  ghcr.io/lonelyrower/ssalgten-agent:latest
EOF
echo ""

echo "4. 查看Agent运行状态:"
echo "docker logs -f ssalgten-agent"
echo ""

echo "如果一切正常，你应该看到:"
echo "  [INFO] Agent registered successfully"
echo "  [INFO] Heartbeat started"
echo ""

echo "然后你的节点就会出现在前端界面中了！"