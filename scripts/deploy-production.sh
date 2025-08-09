#!/bin/bash

# SsalgTen 生产环境一键部署脚本
# 用于在VPS上完整部署SsalgTen主服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量
SCRIPT_VERSION="1.0.0"
APP_DIR="/opt/ssalgten"
DOMAIN=""
SSL_EMAIL=""
DB_PASSWORD=""
JWT_SECRET=""
API_SECRET=""
AGENT_KEY=""

# 通用sudo函数
run_as_root() {
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        # 直接执行命令
        "$@"
    else
        # 使用sudo执行
        sudo "$@"
    fi
}

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
    echo "    SsalgTen 生产环境部署脚本"
    echo "========================================"
    echo -e "${NC}"
    echo "版本: $SCRIPT_VERSION"
    echo "功能: 一键部署SsalgTen完整系统"
    echo ""
}

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ ! -f /etc/os-release ]]; then
        log_error "不支持的操作系统"
        exit 1
    fi
    
    source /etc/os-release
    log_success "操作系统: $PRETTY_NAME"
    
    # 检查权限（主检查已在main函数中完成）
    if [[ "$RUNNING_AS_ROOT" != "true" ]]; then
        # 非root用户需要检查sudo权限
        if ! sudo -v >/dev/null 2>&1; then
            log_error "需要sudo权限来安装系统依赖"
            exit 1
        fi
    fi
    
    # 检查系统资源
    local mem_total=$(free -g | awk 'NR==2{print $2}')
    if [[ $mem_total -lt 4 ]]; then
        log_warning "内存少于4GB，建议升级服务器配置"
    else
        log_success "内存: ${mem_total}GB"
    fi
    
    local disk_available=$(df -h . | awk 'NR==2{print $4}')
    log_success "可用磁盘空间: $disk_available"
    
    # 检查网络连接
    if ! ping -c 1 github.com >/dev/null 2>&1; then
        log_error "无法连接到GitHub，请检查网络"
        exit 1
    fi
    
    log_success "系统检查通过"
}

# 收集部署信息
collect_deployment_info() {
    log_info "收集部署配置信息..."
    
    echo ""
    echo "请选择部署方式："
    echo "1. 完整部署 (域名 + SSL证书 + HTTPS)"
    echo "2. 简单部署 (仅HTTP，使用服务器IP)"
    echo ""
    
    while true; do
        read -p "请选择 (1/2): " DEPLOY_MODE
        case $DEPLOY_MODE in
            1)
                log_info "选择完整部署模式"
                ENABLE_SSL=true
                break
                ;;
            2)
                log_info "选择简单部署模式"
                ENABLE_SSL=false
                break
                ;;
            *)
                log_error "请输入 1 或 2"
                ;;
        esac
    done
    
    if [[ "$ENABLE_SSL" == "true" ]]; then
        echo ""
        echo "完整部署需要以下信息："
        
        # 域名配置
        while true; do
            read -p "您的域名 (如: example.com): " DOMAIN
            if [[ -n "$DOMAIN" && "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                break
            else
                log_error "请输入有效的域名"
            fi
        done
        
        # SSL邮箱
        while true; do
            read -p "SSL证书邮箱: " SSL_EMAIL
            if [[ -n "$SSL_EMAIL" && "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                break
            else
                log_error "请输入有效的邮箱地址"
            fi
        done
    else
        echo ""
        log_info "简单部署模式，将使用HTTP访问"
        
        # 获取服务器公网IP
        SERVER_IP=$(curl -s http://ipinfo.io/ip 2>/dev/null || curl -s http://icanhazip.com 2>/dev/null || echo "未知")
        DOMAIN="$SERVER_IP"
        SSL_EMAIL=""
        
        log_info "检测到服务器IP: $SERVER_IP"
        log_info "将使用 http://$SERVER_IP 访问服务"
        
        echo ""
        read -p "确认使用此IP地址？ (y/n): " confirm_ip
        if [[ "$confirm_ip" != "y" && "$confirm_ip" != "Y" ]]; then
            read -p "请手动输入服务器IP地址: " DOMAIN
        fi
    fi
    
    echo ""
    echo "安全配置 (留空将自动生成):"
    
    # 数据库密码
    read -p "数据库密码 (留空自动生成): " DB_PASSWORD
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
        echo "  自动生成数据库密码: ${DB_PASSWORD:0:8}..."
    fi
    
    # JWT密钥
    read -p "JWT密钥 (留空自动生成): " JWT_SECRET
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '=' | tr '+/' '-_')
        echo "  自动生成JWT密钥"
    fi
    
    # API密钥
    read -p "API密钥 (留空自动生成): " API_SECRET
    if [[ -z "$API_SECRET" ]]; then
        API_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
        echo "  自动生成API密钥"
    fi
    
    # Agent密钥
    read -p "Agent密钥 (留空自动生成): " AGENT_KEY
    if [[ -z "$AGENT_KEY" ]]; then
        AGENT_KEY=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
        echo "  自动生成Agent密钥"
    fi
    
    # IPInfo Token (可选)
    echo ""
    read -p "IPInfo Token (可选，提升ASN查询精度): " IPINFO_TOKEN
    
    echo ""
    log_info "部署配置信息:"
    echo "  - 域名: $DOMAIN"
    echo "  - SSL邮箱: $SSL_EMAIL"
    echo "  - 应用目录: $APP_DIR"
    echo "  - IPInfo Token: ${IPINFO_TOKEN:-"未设置"}"
    echo ""
    
    read -p "确认配置信息正确？ (y/n): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "请重新运行脚本"
        exit 0
    fi
}

# 安装系统依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 更新系统
    run_as_root apt update
    run_as_root apt upgrade -y
    
    # 安装基础工具
    run_as_root apt install -y curl wget git vim ufw htop unzip jq
    
    # 配置防火墙
    run_as_root ufw --force reset
    run_as_root ufw allow ssh
    run_as_root ufw allow 80
    run_as_root ufw allow 443
    run_as_root ufw --force enable
    
    log_success "系统依赖安装完成"
}

# 安装Docker
install_docker() {
    log_info "安装Docker..."
    
    if command -v docker >/dev/null 2>&1; then
        log_success "Docker已安装: $(docker --version)"
        return 0
    fi
    
    # 卸载旧版本
    run_as_root apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # 安装依赖
    run_as_root apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # 添加Docker GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_as_root gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | run_as_root tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker
    run_as_root apt update
    run_as_root apt install -y docker-ce docker-ce-cli containerd.io
    
    # 安装Docker Compose
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    run_as_root curl -L "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    run_as_root chmod +x /usr/local/bin/docker-compose
    
    # 添加用户到docker组
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        # root运行时，确保ssalgten用户可以使用docker
        usermod -aG docker ssalgten
        log_info "已将ssalgten用户添加到docker组"
    else
        run_as_root usermod -aG docker $USER
    fi
    
    # 启动Docker服务
    run_as_root systemctl start docker
    run_as_root systemctl enable docker
    
    log_success "Docker安装完成"
}

# 安装Nginx
install_nginx() {
    log_info "安装Nginx..."
    
    run_as_root apt install -y nginx
    run_as_root systemctl start nginx
    run_as_root systemctl enable nginx
    
    # 删除默认站点
    run_as_root rm -f /etc/nginx/sites-enabled/default
    
    log_success "Nginx安装完成"
}

# 创建应用目录
create_application_directory() {
    log_info "创建应用目录..."
    
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        # 创建ssalgten用户用于运行应用
        if ! id "ssalgten" &>/dev/null; then
            log_info "创建专用应用用户 ssalgten..."
            useradd -r -s /bin/bash -d $APP_DIR ssalgten
        fi
        
        mkdir -p $APP_DIR
        chown -R ssalgten:ssalgten $APP_DIR
        
        # 确保root可以访问目录进行管理
        chmod 755 $APP_DIR
        
        log_info "应用将以 ssalgten 用户身份运行"
    else
        run_as_root mkdir -p $APP_DIR
        run_as_root chown $USER:$USER $APP_DIR
    fi
    
    cd $APP_DIR
    log_success "应用目录创建: $APP_DIR"
}

# 下载源码
download_source_code() {
    log_info "下载源码..."
    
    # 克隆项目
    git clone https://github.com/lonelyrower/SsalgTen.git .
    
    log_success "源码下载完成"
}

# 创建环境配置
create_environment_config() {
    log_info "创建环境配置..."
    
    # 创建主环境配置
    cat > .env << EOF
# SsalgTen 生产环境配置
NODE_ENV=production
DOMAIN=$DOMAIN

# 数据库配置
POSTGRES_USER=ssalgten
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=ssalgten
EOF
    
    # 创建后端环境配置
    cat > backend/.env << EOF
# 生产环境标识
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置
DATABASE_URL="postgresql://ssalgten:$DB_PASSWORD@postgres:5432/ssalgten?schema=public"

# JWT安全配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# API安全配置
API_KEY_SECRET=$API_SECRET
CORS_ORIGIN=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)

# 日志配置
LOG_LEVEL=info
ENABLE_MORGAN=true

# IP信息服务
IPINFO_TOKEN=$IPINFO_TOKEN

# 代理配置
DEFAULT_AGENT_API_KEY=$AGENT_KEY
AGENT_HEARTBEAT_INTERVAL=30000
EOF
    
    # 创建前端环境配置
    cat > frontend/.env << EOF
# API配置
VITE_API_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN/api"; else echo "http://$DOMAIN/api"; fi)

# 生产环境设置
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false

# 地图配置
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
EOF
    
    # 创建Agent环境配置模板
    cat > agent/.env.template << EOF
# 代理配置模板
AGENT_ID=your-unique-agent-id
MASTER_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)
AGENT_API_KEY=$AGENT_KEY

# 节点信息
NODE_NAME="Your Node Name"
NODE_COUNTRY="Your Country"
NODE_CITY="Your City"
NODE_PROVIDER="Your Provider"
NODE_LATITUDE=0.0
NODE_LONGITUDE=0.0
PORT=3002
EOF
    
    log_success "环境配置创建完成"
}

# 创建Nginx配置
create_nginx_config() {
    log_info "创建Nginx配置..."
    
    if [[ "$ENABLE_SSL" == "true" ]]; then
        # HTTPS模式配置
        run_as_root tee /etc/nginx/sites-available/ssalgten > /dev/null << EOF
# SsalgTen Nginx 配置 (HTTPS模式)
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # 重定向到HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL配置 (将由Certbot自动配置)
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            proxy_pass http://localhost:3000;
            proxy_set_header Host \$host;
            proxy_cache_valid 200 1d;
            add_header Cache-Control "public, max-age=86400";
        }
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查端点
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    else
        # HTTP模式配置
        run_as_root tee /etc/nginx/sites-available/ssalgten > /dev/null << EOF
# SsalgTen Nginx 配置 (HTTP模式)
server {
    listen 80;
    server_name $DOMAIN;
    
    # 基础安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            proxy_pass http://localhost:3000;
            proxy_set_header Host \$host;
            proxy_cache_valid 200 1d;
            add_header Cache-Control "public, max-age=86400";
        }
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查端点
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    fi
    
    # 启用站点
    run_as_root ln -sf /etc/nginx/sites-available/ssalgten /etc/nginx/sites-enabled/
    
    # 测试配置
    run_as_root nginx -t
    
    if [[ "$ENABLE_SSL" == "true" ]]; then
        log_success "Nginx HTTPS配置创建完成"
    else
        log_success "Nginx HTTP配置创建完成"
    fi
}

# 安装SSL证书
install_ssl_certificate() {
    if [[ "$ENABLE_SSL" == "true" ]]; then
        log_info "安装SSL证书..."
        
        # 安装Certbot
        run_as_root apt install -y certbot python3-certbot-nginx
        
        # 获取SSL证书
        run_as_root certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive
        
        # 设置自动续期
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | run_as_root crontab -
        
        log_success "SSL证书安装完成"
    else
        log_info "跳过SSL证书安装 (HTTP模式)"
    fi
}

# 构建和启动服务
build_and_start_services() {
    log_info "构建和启动服务..."
    
    # 使用生产专用docker-compose文件
    local compose_file="docker-compose.production.yml"
    
    # 构建Docker镜像
    docker-compose -f $compose_file build --no-cache
    
    # 启动数据库
    docker-compose -f $compose_file up -d postgres
    log_info "等待数据库启动..."
    sleep 15
    
    # 运行数据库迁移
    docker-compose -f $compose_file run --rm backend npm run db:migrate
    
    # 启动所有服务
    docker-compose -f $compose_file up -d
    
    log_info "等待服务启动..."
    sleep 30
    
    log_success "服务构建和启动完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "验证尝试 $attempt/$max_attempts..."
        
        # 检查容器状态
        if ! docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
            log_warning "容器未全部启动，等待10秒..."
            sleep 10
            attempt=$((attempt + 1))
            continue
        fi
        
        # 检查本地API健康
        if ! curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            log_warning "API健康检查失败，等待10秒..."
            sleep 10
            attempt=$((attempt + 1))
            continue
        fi
        
        # 检查外部访问
        local protocol=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https"; else echo "http"; fi)
        if ! curl -f "$protocol://$DOMAIN/api/health" >/dev/null 2>&1; then
            log_warning "外部访问失败($protocol)，等待10秒..."
            sleep 10
            attempt=$((attempt + 1))
            continue
        fi
        
        log_success "部署验证通过"
        return 0
    done
    
    log_error "部署验证失败"
    return 1
}

# 创建管理脚本
create_management_scripts() {
    log_info "创建管理脚本..."
    
    # 创建服务管理脚本
    cat > manage.sh << 'EOF'
#!/bin/bash
# SsalgTen 服务管理脚本

case "$1" in
    start)
        echo "启动SsalgTen服务..."
        docker-compose -f docker-compose.production.yml up -d
        ;;
    stop)
        echo "停止SsalgTen服务..."
        docker-compose -f docker-compose.production.yml down
        ;;
    restart)
        echo "重启SsalgTen服务..."
        docker-compose -f docker-compose.production.yml restart
        ;;
    status)
        echo "查看服务状态..."
        docker-compose -f docker-compose.production.yml ps
        ;;
    logs)
        echo "查看服务日志..."
        docker-compose -f docker-compose.production.yml logs -f ${2:-""}
        ;;
    update)
        echo "更新服务..."
        git pull
        docker-compose -f docker-compose.production.yml build --no-cache
        docker-compose -f docker-compose.production.yml up -d
        ;;
    backup)
        echo "备份数据库..."
        docker-compose -f docker-compose.production.yml exec postgres pg_dump -U ssalgten ssalgten > backup_$(date +%Y%m%d_%H%M%S).sql
        echo "备份完成"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|update|backup}"
        exit 1
        ;;
esac
EOF
    
    chmod +x manage.sh
    
    # 创建监控脚本
    cat > monitor.sh << 'EOF'
#!/bin/bash
# SsalgTen 监控脚本

echo "SsalgTen 系统状态 - $(date)"
echo "==============================="

# 容器状态
echo "容器状态:"
docker-compose -f docker-compose.production.yml ps

echo ""

# 系统资源
echo "系统资源:"
echo "内存使用: $(free -h | awk 'NR==2{printf "%.1f%%", $3/$2 * 100.0}')"
echo "磁盘使用: $(df -h . | awk 'NR==2{print $5}')"
echo "负载平均: $(uptime | awk -F'load average:' '{print $2}')"

echo ""

# 服务检查
echo "服务检查:"
if curl -f https://DOMAIN/api/health >/dev/null 2>&1; then
    echo "✓ API服务正常"
else
    echo "✗ API服务异常"
fi

if curl -f https://DOMAIN >/dev/null 2>&1; then
    echo "✓ 前端服务正常"
else
    echo "✗ 前端服务异常"
fi
EOF
    
    # 替换域名占位符
    sed -i "s/DOMAIN/$DOMAIN/g" monitor.sh
    chmod +x monitor.sh
    
    log_success "管理脚本创建完成"
}

# 保存部署信息
save_deployment_info() {
    log_info "保存部署信息..."
    
    cat > DEPLOYMENT_INFO.txt << EOF
SsalgTen 部署信息
=====================================
部署时间: $(date)
域名: $DOMAIN
应用目录: $APP_DIR

安全信息:
- 数据库密码: $DB_PASSWORD
- JWT密钥: $JWT_SECRET
- API密钥: $API_SECRET
- Agent密钥: $AGENT_KEY

管理命令:
- 服务管理: ./manage.sh [start|stop|restart|status|logs|update|backup]
- 系统监控: ./monitor.sh
- 节点管理: ./scripts/node-manager.sh
- 生产测试: ./scripts/production-test.sh --url $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)

访问地址:
- 前端界面: $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)
- API接口: $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN/api"; else echo "http://$DOMAIN/api"; fi)
- 健康检查: $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN/api/health"; else echo "http://$DOMAIN/api/health"; fi)

重要文件:
- 环境配置: $APP_DIR/.env, backend/.env, frontend/.env
- Nginx配置: /etc/nginx/sites-available/ssalgten
- SSL证书: /etc/letsencrypt/live/$DOMAIN/
- 日志目录: $APP_DIR/logs/

Agent节点安装:
1. 在新VPS上运行: curl -sSL https://$DOMAIN/install-agent.sh | bash
2. 或手动下载: wget https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh

注意事项:
- 请妥善保管此文件中的密钥信息
- 定期备份数据库和配置文件
- 监控系统资源使用情况
- 及时更新系统和应用程序
EOF
    
    # 设置文件权限
    chmod 600 DEPLOYMENT_INFO.txt
    
    log_success "部署信息已保存到 DEPLOYMENT_INFO.txt"
}

# 显示部署结果
show_deployment_result() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  🎉 SsalgTen 部署完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    local protocol=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https"; else echo "http"; fi)
    echo "🌐 访问地址:"
    echo "  - 前端界面: $protocol://$DOMAIN"
    echo "  - API接口: $protocol://$DOMAIN/api"
    echo "  - 健康检查: $protocol://$DOMAIN/api/health"
    echo ""
    echo "🔧 管理命令:"
    echo "  - 服务管理: ./manage.sh [start|stop|restart|status|logs|update|backup]"
    echo "  - 系统监控: ./monitor.sh"
    echo "  - 节点管理: ./scripts/node-manager.sh"
    echo "  - 生产测试: ./scripts/production-test.sh --url $protocol://$DOMAIN --verbose"
    echo ""
    echo "📱 Agent节点安装:"
    echo "  在其他VPS上运行: ./scripts/install-agent.sh"
    echo "  主服务器地址: $protocol://$DOMAIN"
    echo "  Agent密钥: $AGENT_KEY"
    echo ""
    echo "📋 重要信息:"
    echo "  - 部署信息已保存到: $APP_DIR/DEPLOYMENT_INFO.txt"
    echo "  - 请妥善保管密钥信息"
    echo "  - 建议立即运行生产测试验证功能"
    echo ""
    if [[ "$ENABLE_SSL" == "true" ]]; then
        echo -e "${GREEN}✅ 完整部署模式${NC} - HTTPS + SSL证书已配置"
    else
        echo -e "${YELLOW}📋 简单部署模式${NC} - 仅HTTP访问"
        echo -e "${YELLOW}💡 如需HTTPS，可稍后配置域名和SSL证书${NC}"
    fi
    echo ""
    echo -e "${YELLOW}下一步建议:${NC}"
    echo "1. 运行生产测试: ./scripts/production-test.sh --url $protocol://$DOMAIN --verbose"
    echo "2. 添加监控告警系统"
    echo "3. 设置定期备份任务"
    echo "4. 部署Agent节点扩展网络"
    echo ""
}

# 主部署流程
main() {
    show_welcome
    
    # 检查用户权限
    if [[ $EUID -eq 0 ]]; then
        log_warning "⚠️ 检测到root用户运行"
        echo ""
        echo -e "${YELLOW}安全提醒：${NC}"
        echo "- 使用root用户运行应用程序存在安全风险"
        echo "- 建议创建专用用户： useradd -m -s /bin/bash ssalgten"
        echo "- 然后切换用户运行： su - ssalgten"
        echo ""
        read -p "继续使用root用户？ (yes/no): " confirm_root
        if [[ "$confirm_root" != "yes" ]]; then
            log_info "已取消部署，请创建专用用户后重试"
            echo ""
            echo "创建用户命令："
            echo "  useradd -m -s /bin/bash ssalgten"
            echo "  usermod -aG sudo ssalgten"
            echo "  passwd ssalgten"
            echo "  su - ssalgten"
            exit 0
        fi
        
        # 使用root用户时的特殊处理
        export RUNNING_AS_ROOT=true
        log_warning "继续使用root用户部署，将进行安全加固配置"
    fi
    
    log_info "开始SsalgTen生产环境部署..."
    
    check_system_requirements
    collect_deployment_info
    install_system_dependencies
    install_docker
    install_nginx
    create_application_directory
    download_source_code
    create_environment_config
    create_nginx_config
    install_ssl_certificate
    build_and_start_services
    verify_deployment
    create_management_scripts
    save_deployment_info
    show_deployment_result
    
    log_success "🎉 SsalgTen部署完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误"; exit 1' ERR

# 运行主函数
main "$@"