#!/bin/bash

# SsalgTen Agent 一键安装脚本
# 用于在新VPS上快速部署代理节点
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash
#   
# 常用参数:
#   --master-url URL         主服务器地址
#   --api-key KEY           API密钥
#   --auto-config           自动配置模式（跳过交互）
#   --force-root            允许root用户运行（跳过安全提醒）
#   --node-name NAME        节点名称
#   --node-country COUNTRY  国家
#   --node-city CITY        城市

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Docker Compose 兼容性函数
docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    elif docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        log_error "未找到 docker-compose 或 docker compose 命令"
        log_info "请安装 Docker Compose 或确保 Docker 版本支持 compose 插件"
        exit 1
    fi
}

# 版本信息
SCRIPT_VERSION="1.1.0"
SCRIPT_URL="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh"
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

# 检查脚本更新
check_script_update() {
    log_info "检查脚本更新..."
    
    # 获取远程版本号
    REMOTE_VERSION=$(curl -s "$SCRIPT_URL" | grep '^SCRIPT_VERSION=' | cut -d'"' -f2 2>/dev/null)
    
    if [[ -n "$REMOTE_VERSION" && "$REMOTE_VERSION" != "$SCRIPT_VERSION" ]]; then
        log_warning "发现新版本: $REMOTE_VERSION (当前: $SCRIPT_VERSION)"
        echo ""
        echo -e "${YELLOW}建议更新到最新版本以获得最佳体验${NC}"
        echo ""
        read -p "是否立即更新脚本？ (y/n): " update_choice
        if [[ "$update_choice" == "y" || "$update_choice" == "Y" ]]; then
            update_script
            return 0
        else
            log_warning "继续使用当前版本，可能遇到已知问题"
            echo ""
            read -p "确认继续？ (y/n): " confirm_continue
            if [[ "$confirm_continue" != "y" && "$confirm_continue" != "Y" ]]; then
                log_info "已取消安装"
                exit 0
            fi
        fi
    else
        log_success "脚本已是最新版本"
    fi
}

# 更新脚本
update_script() {
    log_info "下载最新脚本..."
    
    # 备份当前脚本
    cp "$0" "$0.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 下载新脚本
    if curl -fsSL "$SCRIPT_URL" -o "$0.new"; then
        chmod +x "$0.new"
        mv "$0.new" "$0"
        log_success "脚本更新完成！重新启动..."
        echo ""
        exec "$0" "$@"
    else
        log_error "脚本更新失败"
        exit 1
    fi
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
    echo "更新: 支持自动版本检查和更新"
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

# 解析命令行参数
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --master-url)
                MASTER_URL="$2"
                shift 2
                ;;
            --api-key)
                AGENT_API_KEY="$2"
                shift 2
                ;;
            --auto-config)
                AUTO_CONFIG=true
                shift
                ;;
            --force-root)
                FORCE_ROOT=true
                shift
                ;;
            --node-name)
                NODE_NAME="$2"
                shift 2
                ;;
            --node-country)
                NODE_COUNTRY="$2"
                shift 2
                ;;
            --node-city)
                NODE_CITY="$2"
                shift 2
                ;;
            --node-provider)
                NODE_PROVIDER="$2"
                shift 2
                ;;
            --agent-port)
                AGENT_PORT="$2"
                shift 2
                ;;
            *)
                log_warning "未知参数: $1"
                shift
                ;;
        esac
    done
}

# 收集节点信息
collect_node_info() {
    log_info "收集节点信息..."
    
    # 检查必需参数
    if [[ -z "$MASTER_URL" || -z "$AGENT_API_KEY" ]]; then
        if [[ "$AUTO_CONFIG" == "true" ]]; then
            log_error "自动配置模式需要提供 --master-url 和 --api-key 参数"
            echo ""
            echo "使用方法:"
            echo "  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\"
            echo "    --auto-config \\"
            echo "    --master-url https://your-domain.com \\"
            echo "    --api-key your-api-key"
            exit 1
        fi
        
        echo ""
        echo "请提供以下信息来配置您的监控节点："
        echo ""
        
        # 主服务器地址
        if [[ -z "$MASTER_URL" ]]; then
            while true; do
                read -p "主服务器地址 (如: https://your-domain.com): " MASTER_URL
                if [[ -n "$MASTER_URL" && "$MASTER_URL" =~ ^https?:// ]]; then
                    break
                else
                    log_error "请输入有效的URL地址"
                fi
            done
        fi
        
        # API密钥
        if [[ -z "$AGENT_API_KEY" ]]; then
            while true; do
                read -p "Agent API密钥: " AGENT_API_KEY
                if [[ -n "$AGENT_API_KEY" && ${#AGENT_API_KEY} -ge 16 ]]; then
                    break
                else
                    log_error "API密钥长度至少16个字符"
                fi
            done
        fi
    fi
    
    # 设置默认值（适用于自动配置和交互式配置）
    if [[ "$AUTO_CONFIG" == "true" ]]; then
        log_info "使用自动配置模式..."
        
        # 设置默认值
        NODE_NAME=${NODE_NAME:-"Agent-$(hostname)-$(date +%s)"}
        NODE_COUNTRY=${NODE_COUNTRY:-"Unknown"}
        NODE_CITY=${NODE_CITY:-"Unknown"}
        NODE_PROVIDER=${NODE_PROVIDER:-"Unknown"}
        AGENT_PORT=${AGENT_PORT:-"3002"}
        NODE_LATITUDE=${NODE_LATITUDE:-"0.0"}
        NODE_LONGITUDE=${NODE_LONGITUDE:-"0.0"}
        
        log_success "已使用自动配置模式"
    else
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
    fi
    
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
        log_success "Docker Compose已安装: $(docker_compose --version)"
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
    git clone https://github.com/lonelyrower/SsalgTen.git .
    
    # 复制Agent相关文件
    cp -r agent/* $APP_DIR/
    
    # 复制 Dockerfile (简化版本，因为文件已经在正确位置)
    # cp Dockerfile.agent $APP_DIR/Dockerfile  # 我们将创建一个简化的Dockerfile
    
    # 清理临时目录
    rm -rf $TEMP_DIR
    
    cd $APP_DIR
    log_success "Agent代码下载完成"
}

# 创建Agent专用的docker_compose文件
create_docker_compose() {
    log_info "创建Docker Compose配置..."
    
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  agent:
    build:
      context: .
      dockerfile: Dockerfile
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
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${AGENT_PORT}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

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

# 创建Dockerfile（适用于Agent）
create_dockerfile() {
    log_info "创建Agent Dockerfile..."
    
    cat > Dockerfile << 'EOF'
# SsalgTen Agent Dockerfile
FROM node:18-alpine

# Install system dependencies for network tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    iputils \
    traceroute \
    mtr \
    bind-tools \
    iperf3 \
    python3 \
    py3-pip

# Install speedtest-cli using --break-system-packages (safe in container)
RUN pip3 install --break-system-packages speedtest-cli

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S -u 1001 ssalgten

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Create necessary directories
RUN mkdir -p /app/logs && chown ssalgten:nodejs /app/logs

# Switch to app user
USER ssalgten

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3002) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
EOF

    log_success "Agent Dockerfile创建完成"
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
    docker_compose build
    
    # 启动服务
    docker_compose up -d
    
    # 等待服务启动
    sleep 10
    
    log_success "Agent服务启动完成"
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 检查容器状态
    if docker_compose ps | grep -q "Up"; then
        log_success "Docker容器运行正常"
    else
        log_error "Docker容器启动失败"
        docker_compose logs
        return 1
    fi
    
    # 等待服务启动
    log_info "等待Agent服务启动..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:$AGENT_PORT/health >/dev/null 2>&1; then
            log_success "Agent健康检查通过"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
        
        if [ $attempt -eq $max_attempts ]; then
            log_warning "Agent健康检查超时，请检查日志"
            docker_compose logs agent
        fi
    done
    
    # 检查主服务器连接
    log_info "测试主服务器连接..."
    if curl -f "$MASTER_URL/api/health" >/dev/null 2>&1; then
        log_success "主服务器连接正常"
    else
        log_warning "无法连接到主服务器: $MASTER_URL"
        log_warning "请确保:"
        echo "  1. 主服务器正在运行"
        echo "  2. 网络连接正常"
        echo "  3. 防火墙设置正确"
        echo "  4. URL地址正确"
    fi
    
    # 检查Agent信息
    log_info "获取Agent信息..."
    if agent_info=$(curl -s http://localhost:$AGENT_PORT/info); then
        echo "$agent_info" | jq . 2>/dev/null || echo "$agent_info"
    else
        log_warning "无法获取Agent信息"
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
    echo "  - 查看状态: cd $APP_DIR && docker_compose ps"
    echo "  - 查看日志: cd $APP_DIR && docker_compose logs -f"
    echo "  - 重启服务: cd $APP_DIR && docker_compose restart"
    echo "  - 停止服务: cd $APP_DIR && docker_compose down"
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
    echo "3. 如有问题，查看日志: docker_compose logs -f"
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
        docker_compose up -d
        ;;
    stop)
        echo "停止Agent服务..."
        docker_compose down
        ;;
    restart)
        echo "重启Agent服务..."
        docker_compose restart
        ;;
    status)
        echo "查看服务状态..."
        docker_compose ps
        ;;
    logs)
        echo "查看服务日志..."
        docker_compose logs -f
        ;;
    update)
        echo "更新Agent..."
        docker_compose pull
        docker_compose up -d --build
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
    # 处理特殊命令行参数
    case "${1:-}" in
        --update)
            log_info "强制更新脚本..."
            update_script
            return
            ;;
        --no-update-check)
            log_info "跳过更新检查"
            show_welcome
            # 解析剩余参数
            shift
            parse_arguments "$@"
            ;;
        *)
            show_welcome
            check_script_update
            # 解析所有参数
            parse_arguments "$@"
            ;;
    esac
    
    # 检查用户权限
    if [[ $EUID -eq 0 ]]; then
        # 如果用户指定了--force-root或--auto-config，跳过提醒
        if [[ "${FORCE_ROOT:-false}" == "true" || "${AUTO_CONFIG:-false}" == "true" ]]; then
            log_info "使用root用户运行（已通过参数确认）"
            export RUNNING_AS_ROOT=true
        else
            log_warning "⚠️ 检测到root用户运行"
            echo ""
            echo -e "${YELLOW}安全提醒：${NC}"
            echo "- 使用root用户运行Agent存在安全风险"
            echo "- 建议创建专用用户： useradd -m -s /bin/bash agentuser"
            echo "- 然后切换用户运行： su - agentuser"
            echo ""
            echo -e "${CYAN}快速选项：${NC}"
            echo "- 回车继续使用root用户"
            echo "- 输入 'n' 取消安装"
            echo ""
            read -p "继续使用root用户？ [Y/n]: " confirm_root
            confirm_root="${confirm_root:-y}"
            if [[ "$confirm_root" =~ ^[Nn] ]]; then
                log_info "已取消安装"
                echo ""
                echo -e "${GREEN}推荐操作步骤：${NC}"
                echo "1. useradd -m -s /bin/bash agentuser"
                echo "2. usermod -aG sudo agentuser"
                echo "3. su - agentuser"
                echo "4. 重新运行安装脚本"
                exit 0
            fi
            
            # 使用root用户时的特殊处理
            export RUNNING_AS_ROOT=true
            log_info "继续使用root用户部署Agent"
        fi
    else
        # 检查sudo权限
        if ! sudo -v >/dev/null 2>&1; then
            log_error "需要sudo权限来安装系统依赖"
            exit 1
        fi
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