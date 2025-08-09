#!/bin/bash

# SsalgTen Agent 一键安装脚本
# 用于在新VPS上快速部署代理节点

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 版本信息
SCRIPT_VERSION="1.0.0"
AGENT_VERSION="latest"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示欢迎信息
show_welcome() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen Agent 一键安装脚本"
    echo "========================================"
    echo -e "${NC}"
    echo "版本: $SCRIPT_VERSION"
    echo "功能: 自动部署SsalgTen监控代理节点"
    echo ""
}

# 检查系统要求
check_system() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ ! -f /etc/os-release ]]; then
        log_error "不支持的操作系统"
        exit 1
    fi
    
    source /etc/os-release
    log_success "操作系统: $PRETTY_NAME"
    
    # 检查系统架构
    ARCH=$(uname -m)
    log_success "系统架构: $ARCH"
    
    # 检查内存
    MEM_TOTAL=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    if [[ $MEM_TOTAL -lt 1 ]]; then
        log_warning "内存不足1GB，可能影响性能"
    else
        log_success "内存: ${MEM_TOTAL}GB"
    fi
    
    # 检查磁盘空间
    DISK_AVAILABLE=$(df -h . | awk 'NR==2{print $4}')
    log_success "可用磁盘空间: $DISK_AVAILABLE"
    
    # 检查网络连接
    if ping -c 1 google.com >/dev/null 2>&1; then
        log_success "网络连接正常"
    else
        log_error "无法连接到互联网"
        exit 1
    fi
}

# 收集节点信息
collect_node_info() {
    log_info "收集节点信息..."
    
    echo ""
    echo "请提供以下信息来配置您的监控节点："
    echo ""
    
    # 主服务器地址
    while true; do
        read -p "主服务器地址 (如: https://your-domain.com): " MASTER_URL
        if [[ -n "$MASTER_URL" && "$MASTER_URL" =~ ^https?:// ]]; then
            break
        else
            log_error "请输入有效的URL地址"
        fi
    done
    
    # API密钥
    while true; do
        read -p "Agent API密钥: " AGENT_API_KEY
        if [[ -n "$AGENT_API_KEY" && ${#AGENT_API_KEY} -ge 16 ]]; then
            break
        else
            log_error "API密钥长度至少16个字符"
        fi
    done
    
    # 节点名称
    read -p "节点名称 (如: Tokyo-VPS-01): " NODE_NAME
    NODE_NAME=${NODE_NAME:-"Agent-$(hostname)"}
    
    # 地理位置信息
    read -p "国家/地区 (如: Japan): " NODE_COUNTRY
    NODE_COUNTRY=${NODE_COUNTRY:-"Unknown"}
    
    read -p "城市 (如: Tokyo): " NODE_CITY
    NODE_CITY=${NODE_CITY:-"Unknown"}
    
    read -p "服务商 (如: Vultr, DigitalOcean): " NODE_PROVIDER
    NODE_PROVIDER=${NODE_PROVIDER:-"Unknown"}
    
    # 坐标（可选）
    echo ""
    echo "GPS坐标 (可选，用于地图显示):"
    read -p "纬度 (如: 35.6762): " NODE_LATITUDE
    read -p "经度 (如: 139.6503): " NODE_LONGITUDE
    NODE_LATITUDE=${NODE_LATITUDE:-"0.0"}
    NODE_LONGITUDE=${NODE_LONGITUDE:-"0.0"}
    
    # 端口设置
    read -p "Agent端口 (默认3002): " AGENT_PORT
    AGENT_PORT=${AGENT_PORT:-"3002"}
    
    # 生成唯一Agent ID
    AGENT_ID="agent_$(hostname)_$(date +%s)_$(shuf -i 1000-9999 -n 1)"
    
    echo ""
    log_info "节点配置信息:"
    echo "  - 节点ID: $AGENT_ID"
    echo "  - 节点名称: $NODE_NAME"
    echo "  - 位置: $NODE_CITY, $NODE_COUNTRY"
    echo "  - 坐标: $NODE_LATITUDE, $NODE_LONGITUDE"
    echo "  - 服务商: $NODE_PROVIDER"
    echo "  - 端口: $AGENT_PORT"
    echo ""
    
    read -p "确认配置信息正确？ (y/n): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "请重新运行脚本"
        exit 0
    fi
}

# 安装Docker
install_docker() {
    log_info "检查Docker安装状态..."
    
    if command -v docker >/dev/null 2>&1; then
        log_success "Docker已安装: $(docker --version)"
        return 0
    fi
    
    log_info "安装Docker..."
    
    # 安装依赖
    case "$ID" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y curl wget gnupg lsb-release
            ;;
        centos|rhel|fedora)
            sudo yum install -y curl wget
            ;;
        *)
            log_error "不支持的操作系统: $ID"
            exit 1
            ;;
    esac
    
    # 使用官方安装脚本
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # 添加当前用户到docker组
    sudo usermod -aG docker $USER
    
    # 启动Docker服务
    sudo systemctl start docker
    sudo systemctl enable docker
    
    log_success "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    log_info "检查Docker Compose安装状态..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        log_success "Docker Compose已安装: $(docker-compose --version)"
        return 0
    fi
    
    log_info "安装Docker Compose..."
    
    # 获取最新版本
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    
    # 下载并安装
    sudo curl -L "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker Compose安装完成"
}

# 创建应用目录
create_app_directory() {
    log_info "创建应用目录..."
    
    APP_DIR="/opt/ssalgten-agent"
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    cd $APP_DIR
    
    log_success "应用目录创建: $APP_DIR"
}

# 下载Agent代码
download_agent_code() {
    log_info "下载Agent代码..."
    
    # 创建临时目录
    TEMP_DIR="/tmp/ssalgten-agent-install"
    rm -rf $TEMP_DIR
    mkdir -p $TEMP_DIR
    
    # 下载主项目
    cd $TEMP_DIR
    git clone https://github.com/yourusername/SsalgTen.git .
    
    # 复制Agent相关文件
    cp -r agent/* $APP_DIR/
    
    # 复制必要的配置文件
    cp docker-compose.agent.yml $APP_DIR/docker-compose.yml
    
    # 清理临时目录
    rm -rf $TEMP_DIR
    
    cd $APP_DIR
    log_success "Agent代码下载完成"
}

# 创建Agent专用的docker-compose文件
create_docker_compose() {
    log_info "创建Docker Compose配置..."
    
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  agent:
    build: .
    container_name: ssalgten-agent
    restart: unless-stopped
    ports:
      - "${AGENT_PORT}:${AGENT_PORT}"
    environment:
      - NODE_ENV=production
      - AGENT_ID=${AGENT_ID}
      - MASTER_URL=${MASTER_URL}
      - AGENT_API_KEY=${AGENT_API_KEY}
      - NODE_NAME=${NODE_NAME}
      - NODE_COUNTRY=${NODE_COUNTRY}
      - NODE_CITY=${NODE_CITY}
      - NODE_PROVIDER=${NODE_PROVIDER}
      - NODE_LATITUDE=${NODE_LATITUDE}
      - NODE_LONGITUDE=${NODE_LONGITUDE}
      - PORT=${AGENT_PORT}
    volumes:
      - ./logs:/app/logs
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /etc:/host/etc:ro
    networks:
      - agent-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${AGENT_PORT}/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  agent-network:
    driver: bridge
EOF

    log_success "Docker Compose配置创建完成"
}

# 创建环境配置文件
create_env_config() {
    log_info "创建环境配置文件..."
    
    cat > .env << EOF
# SsalgTen Agent 配置文件
# 自动生成于 $(date)

# Agent基本信息
AGENT_ID=${AGENT_ID}
NODE_NAME=${NODE_NAME}

# 服务器连接
MASTER_URL=${MASTER_URL}
AGENT_API_KEY=${AGENT_API_KEY}

# 地理位置信息
NODE_COUNTRY=${NODE_COUNTRY}
NODE_CITY=${NODE_CITY}
NODE_PROVIDER=${NODE_PROVIDER}
NODE_LATITUDE=${NODE_LATITUDE}
NODE_LONGITUDE=${NODE_LONGITUDE}

# 服务配置
PORT=${AGENT_PORT}
NODE_ENV=production

# 监控配置
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
ENABLE_DEBUG=false

# 系统配置
TZ=Asia/Shanghai
EOF

    log_success "环境配置文件创建完成"
}

# 创建Dockerfile
create_dockerfile() {
    log_info "创建Dockerfile..."
    
    cat > Dockerfile << 'EOF'
FROM node:18-alpine

# 安装系统依赖
RUN apk add --no-cache curl wget procps

# 创建应用目录
WORKDIR /app

# 复制package.json文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# 启动应用
CMD ["npm", "start"]
EOF

    log_success "Dockerfile创建完成"
}

# 创建系统服务
create_system_service() {
    log_info "创建系统服务..."
    
    sudo tee /etc/systemd/system/ssalgten-agent.service > /dev/null << EOF
[Unit]
Description=SsalgTen Agent Service
After=docker.service
Requires=docker.service

[Service]
Type=forking
Restart=always
RestartSec=10
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    # 重载systemd并启用服务
    sudo systemctl daemon-reload
    sudo systemctl enable ssalgten-agent.service
    
    log_success "系统服务创建完成"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian的ufw
        sudo ufw allow $AGENT_PORT/tcp
        log_success "UFW防火墙规则添加完成"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # CentOS/RHEL的firewalld
        sudo firewall-cmd --permanent --add-port=$AGENT_PORT/tcp
        sudo firewall-cmd --reload
        log_success "Firewalld防火墙规则添加完成"
    else
        log_warning "未检测到防火墙管理工具，请手动开放端口 $AGENT_PORT"
    fi
}

# 启动Agent服务
start_agent_service() {
    log_info "启动Agent服务..."
    
    # 构建镜像
    docker-compose build
    
    # 启动服务
    docker-compose up -d
    
    # 等待服务启动
    sleep 10
    
    log_success "Agent服务启动完成"
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 检查容器状态
    if docker-compose ps | grep -q "Up"; then
        log_success "Docker容器运行正常"
    else
        log_error "Docker容器启动失败"
        docker-compose logs
        return 1
    fi
    
    # 检查健康状态
    sleep 5
    if curl -f http://localhost:$AGENT_PORT/health >/dev/null 2>&1; then
        log_success "Agent健康检查通过"
    else
        log_warning "Agent健康检查失败，请检查日志"
    fi
    
    # 检查主服务器连接
    if curl -f $MASTER_URL/api/health >/dev/null 2>&1; then
        log_success "主服务器连接正常"
    else
        log_warning "无法连接到主服务器，请检查网络和配置"
    fi
}

# 显示安装结果
show_installation_result() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  🎉 Agent安装完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo "📋 安装信息:"
    echo "  - Agent ID: $AGENT_ID"
    echo "  - 节点名称: $NODE_NAME"
    echo "  - 安装目录: $APP_DIR"
    echo "  - 服务端口: $AGENT_PORT"
    echo "  - 主服务器: $MASTER_URL"
    echo ""
    echo "🔧 管理命令:"
    echo "  - 查看状态: cd $APP_DIR && docker-compose ps"
    echo "  - 查看日志: cd $APP_DIR && docker-compose logs -f"
    echo "  - 重启服务: cd $APP_DIR && docker-compose restart"
    echo "  - 停止服务: cd $APP_DIR && docker-compose down"
    echo "  - 系统服务: sudo systemctl status ssalgten-agent"
    echo ""
    echo "🌐 访问地址:"
    echo "  - 本地健康检查: http://localhost:$AGENT_PORT/health"
    echo "  - 主服务器控制台: $MASTER_URL"
    echo ""
    echo "📁 重要文件:"
    echo "  - 配置文件: $APP_DIR/.env"
    echo "  - 日志目录: $APP_DIR/logs"
    echo "  - 服务文件: /etc/systemd/system/ssalgten-agent.service"
    echo ""
    
    # 获取公网IP
    PUBLIC_IP=$(curl -s http://ipinfo.io/ip || echo "无法获取")
    echo "📡 节点信息:"
    echo "  - 公网IP: $PUBLIC_IP"
    echo "  - 位置: $NODE_CITY, $NODE_COUNTRY"
    echo "  - 服务商: $NODE_PROVIDER"
    echo ""
    
    echo -e "${YELLOW}⚠️ 下一步:${NC}"
    echo "1. 检查防火墙是否开放端口 $AGENT_PORT"
    echo "2. 在主服务器控制台查看节点是否上线"
    echo "3. 如有问题，查看日志: docker-compose logs -f"
    echo ""
}

# 创建管理脚本
create_management_script() {
    log_info "创建管理脚本..."
    
    cat > manage-agent.sh << 'EOF'
#!/bin/bash

# SsalgTen Agent 管理脚本

case "$1" in
    start)
        echo "启动Agent服务..."
        docker-compose up -d
        ;;
    stop)
        echo "停止Agent服务..."
        docker-compose down
        ;;
    restart)
        echo "重启Agent服务..."
        docker-compose restart
        ;;
    status)
        echo "查看服务状态..."
        docker-compose ps
        ;;
    logs)
        echo "查看服务日志..."
        docker-compose logs -f
        ;;
    update)
        echo "更新Agent..."
        docker-compose pull
        docker-compose up -d --build
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|update}"
        exit 1
        ;;
esac
EOF
    
    chmod +x manage-agent.sh
    log_success "管理脚本创建完成: $APP_DIR/manage-agent.sh"
}

# 主安装流程
main() {
    show_welcome
    
    # 检查是否为root用户运行
    if [[ $EUID -eq 0 ]]; then
        log_error "请不要使用root用户运行此脚本"
        log_info "建议使用普通用户，脚本会在需要时请求sudo权限"
        exit 1
    fi
    
    # 检查sudo权限
    if ! sudo -v >/dev/null 2>&1; then
        log_error "需要sudo权限来安装系统依赖"
        exit 1
    fi
    
    log_info "开始SsalgTen Agent安装流程..."
    
    check_system
    collect_node_info
    install_docker
    install_docker_compose
    create_app_directory
    download_agent_code
    create_docker_compose
    create_env_config
    create_dockerfile
    configure_firewall
    start_agent_service
    create_system_service
    verify_installation
    create_management_script
    show_installation_result
    
    log_success "🎉 SsalgTen Agent安装完成！"
}

# 错误处理
trap 'log_error "安装过程中发生错误，请检查日志并重试"; exit 1' ERR

# 运行主函数
main "$@"