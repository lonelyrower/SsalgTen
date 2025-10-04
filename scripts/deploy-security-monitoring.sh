#!/bin/bash
# SsalgTen 安全监控快速部署脚本

set -e

echo "======================================"
echo "  SsalgTen 安全监控部署向导"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: 请在SsalgTen项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1/6: 安装Agent依赖${NC}"
echo "--------------------------------"
cd agent
if [ ! -d "node_modules" ] || [ ! -f "node_modules/nodemailer/package.json" ]; then
    echo "安装nodemailer..."
    npm install nodemailer @types/nodemailer
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 依赖已存在${NC}"
fi
cd ..
echo ""

echo -e "${BLUE}Step 2/6: 配置安全监控${NC}"
echo "--------------------------------"

# 检查.env文件
if [ ! -f "agent/.env" ]; then
    echo "创建agent/.env配置文件..."
    cp agent/.env.example agent/.env 2>/dev/null || touch agent/.env
fi

# 读取用户输入配置
echo ""
echo "请配置安全监控参数（直接回车使用默认值）:"
echo ""

# SSH监控
read -p "启用SSH暴力破解监控? (Y/n): " SSH_ENABLED
SSH_ENABLED=${SSH_ENABLED:-Y}
if [[ $SSH_ENABLED =~ ^[Yy]$ ]]; then
    echo "SSH_MONITOR_ENABLED=true" >> agent/.env
    echo "SSH_MONITOR_WINDOW_MIN=10" >> agent/.env
    echo "SSH_MONITOR_THRESHOLD=5" >> agent/.env
    echo -e "${GREEN}✓ SSH监控已启用${NC}"
else
    echo "SSH_MONITOR_ENABLED=false" >> agent/.env
fi

# 进程监控
read -p "启用进程监控（挖矿检测）? (Y/n): " PROC_ENABLED
PROC_ENABLED=${PROC_ENABLED:-Y}
if [[ $PROC_ENABLED =~ ^[Yy]$ ]]; then
    echo "PROCESS_MONITOR_ENABLED=true" >> agent/.env
    echo "PROCESS_CPU_THRESHOLD=80" >> agent/.env
    echo "PROCESS_MEM_THRESHOLD=70" >> agent/.env
    echo "SUSPICIOUS_PATHS=/tmp,/dev/shm,/var/tmp" >> agent/.env
    echo "WHITELIST_PROCESSES=node,systemd,docker,nginx,postgres" >> agent/.env
    echo -e "${GREEN}✓ 进程监控已启用${NC}"
else
    echo "PROCESS_MONITOR_ENABLED=false" >> agent/.env
fi

# 网络监控
read -p "启用网络流量监控（DDoS检测）? (Y/n): " NET_ENABLED
NET_ENABLED=${NET_ENABLED:-Y}
if [[ $NET_ENABLED =~ ^[Yy]$ ]]; then
    echo "NETWORK_MONITOR_ENABLED=true" >> agent/.env
    echo "PRIMARY_INTERFACE=eth0" >> agent/.env
    echo "TRAFFIC_THRESHOLD_MBPS=100" >> agent/.env
    echo "CONNECTION_THRESHOLD=1000" >> agent/.env
    echo "SYN_FLOOD_THRESHOLD=100" >> agent/.env
    echo -e "${GREEN}✓ 网络监控已启用${NC}"
else
    echo "NETWORK_MONITOR_ENABLED=false" >> agent/.env
fi

# 文件监控
read -p "启用文件完整性监控? (Y/n): " FILE_ENABLED
FILE_ENABLED=${FILE_ENABLED:-Y}
if [[ $FILE_ENABLED =~ ^[Yy]$ ]]; then
    echo "FILE_MONITOR_ENABLED=true" >> agent/.env
    echo "MONITOR_PATHS=/etc/passwd,/etc/shadow,/etc/ssh/sshd_config,/etc/crontab" >> agent/.env
    echo -e "${GREEN}✓ 文件监控已启用${NC}"
else
    echo "FILE_MONITOR_ENABLED=false" >> agent/.env
fi

# 邮件告警
echo ""
read -p "启用邮件告警? (y/N): " EMAIL_ENABLED
if [[ $EMAIL_ENABLED =~ ^[Yy]$ ]]; then
    echo ""
    echo "请输入SMTP配置:"
    read -p "SMTP服务器 (smtp.gmail.com): " SMTP_HOST
    SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
    
    read -p "SMTP端口 (587): " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    
    read -p "SMTP用户名: " SMTP_USER
    
    read -sp "SMTP密码（Gmail需使用应用专用密码）: " SMTP_PASS
    echo ""
    
    read -p "收件人邮箱（多个用逗号分隔）: " SMTP_TO
    
    echo "EMAIL_ALERTS_ENABLED=true" >> agent/.env
    echo "SMTP_HOST=$SMTP_HOST" >> agent/.env
    echo "SMTP_PORT=$SMTP_PORT" >> agent/.env
    echo "SMTP_USER=$SMTP_USER" >> agent/.env
    echo "SMTP_PASS=$SMTP_PASS" >> agent/.env
    echo "SMTP_TO=$SMTP_TO" >> agent/.env
    echo "SMTP_FROM=SsalgTen Agent <noreply@ssalgten.com>" >> agent/.env
    echo -e "${GREEN}✓ 邮件告警已配置${NC}"
else
    echo "EMAIL_ALERTS_ENABLED=false" >> agent/.env
    echo -e "${YELLOW}⚠ 邮件告警未启用${NC}"
fi

echo ""

echo -e "${BLUE}Step 3/6: 更新Docker Compose配置${NC}"
echo "--------------------------------"

# 检查docker-compose.yml是否需要更新
if ! grep -q "SSH_MONITOR_ENABLED" docker-compose.yml 2>/dev/null; then
    echo -e "${YELLOW}⚠ 需要手动更新docker-compose.yml${NC}"
    echo ""
    echo "请在docker-compose.yml的agent服务中添加以下配置:"
    echo ""
    echo "  agent:"
    echo "    environment:"
    echo "      # 安全监控"
    echo "      - SSH_MONITOR_ENABLED=\${SSH_MONITOR_ENABLED:-true}"
    echo "      - PROCESS_MONITOR_ENABLED=\${PROCESS_MONITOR_ENABLED:-true}"
    echo "      - NETWORK_MONITOR_ENABLED=\${NETWORK_MONITOR_ENABLED:-true}"
    echo "      - FILE_MONITOR_ENABLED=\${FILE_MONITOR_ENABLED:-true}"
    echo "      - EMAIL_ALERTS_ENABLED=\${EMAIL_ALERTS_ENABLED:-false}"
    echo "      - SMTP_HOST=\${SMTP_HOST}"
    echo "      - SMTP_PORT=\${SMTP_PORT}"
    echo "      - SMTP_USER=\${SMTP_USER}"
    echo "      - SMTP_PASS=\${SMTP_PASS}"
    echo "      - SMTP_TO=\${SMTP_TO}"
    echo "    volumes:"
    echo "      - /var/log:/host/var/log:ro"
    echo "      - /etc/passwd:/host/etc/passwd:ro"
    echo "      - /etc/shadow:/host/etc/shadow:ro"
    echo "      - /etc/ssh:/host/etc/ssh:ro"
    echo ""
    read -p "按回车继续..." dummy
else
    echo -e "${GREEN}✓ Docker Compose配置已包含安全监控参数${NC}"
fi

echo ""

echo -e "${BLUE}Step 4/6: 构建Docker镜像${NC}"
echo "--------------------------------"
echo "正在构建Agent和Backend镜像..."
docker-compose build agent backend
echo -e "${GREEN}✓ 镜像构建完成${NC}"
echo ""

echo -e "${BLUE}Step 5/6: 启动服务${NC}"
echo "--------------------------------"
echo "停止现有服务..."
docker-compose down

echo "启动新服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 5

# 检查服务状态
if docker ps | grep -q ssalgten-agent-1; then
    echo -e "${GREEN}✓ Agent服务已启动${NC}"
else
    echo -e "${RED}✗ Agent服务启动失败${NC}"
    docker logs ssalgten-agent-1 --tail=50
    exit 1
fi

if docker ps | grep -q ssalgten-backend-1; then
    echo -e "${GREEN}✓ Backend服务已启动${NC}"
else
    echo -e "${RED}✗ Backend服务启动失败${NC}"
    docker logs ssalgten-backend-1 --tail=50
    exit 1
fi

echo ""

echo -e "${BLUE}Step 6/6: 验证部署${NC}"
echo "--------------------------------"

# 检查Agent健康状态
echo "检查Agent健康状态..."
sleep 3
HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "")
if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✓ Agent健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠ Agent健康检查失败，请查看日志${NC}"
fi

# 检查安全服务初始化
echo "检查安全服务初始化..."
if docker logs ssalgten-agent-1 --tail=50 | grep -q "Initializing security monitoring services"; then
    echo -e "${GREEN}✓ 安全服务已初始化${NC}"
else
    echo -e "${YELLOW}⚠ 安全服务初始化日志未找到${NC}"
fi

# 显示启用的模块
echo ""
echo "已启用的安全模块:"
docker logs ssalgten-agent-1 --tail=20 | grep -E "(SSH Monitor|Process Monitor|Network Monitor|File Monitor|Email Alerts)" || echo "无日志"

echo ""
echo "======================================"
echo -e "${GREEN}  部署完成！${NC}"
echo "======================================"
echo ""
echo "接下来的步骤:"
echo ""
echo "1. 查看实时日志:"
echo "   docker-compose logs -f agent backend"
echo ""
echo "2. 访问前端界面:"
echo "   http://localhost:3000"
echo "   - 首页: 查看'安全事件'卡片"
echo "   - 威胁监控: 查看实时威胁数据"
echo ""
echo "3. 运行测试脚本:"
echo "   bash scripts/test-security-monitoring.sh"
echo ""
echo "4. 查看文档:"
echo "   - SECURITY_UPGRADE_GUIDE.md - 完整升级指南"
echo "   - SECURITY_MONITORING_IMPLEMENTATION.md - 实施细节"
echo ""
echo "5. 等待真实威胁触发:"
echo "   - SSH暴力破解: 监控/var/log/auth.log"
echo "   - 挖矿程序: 检测高CPU进程"
echo "   - DDoS攻击: 监控网络连接数"
echo "   - 文件篡改: 监控关键系统文件"
echo ""

if [[ $EMAIL_ENABLED =~ ^[Yy]$ ]]; then
    echo "6. 邮件告警已启用:"
    echo "   收件人: $SMTP_TO"
    echo "   Critical级别威胁将自动发送邮件"
    echo ""
fi

echo "如有问题，请查看日志或文档排查。"
echo ""
