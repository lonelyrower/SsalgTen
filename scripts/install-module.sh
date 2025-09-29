#!/bin/bash

# SsalgTen Install Module - 从 deploy-production.sh 提取的安装功能
# 这个模块将被集成到 ssalgten.sh 中作为 install 命令

# =============================================================================
# 🛠️ 系统安装模块 (来自 deploy-production.sh)
# =============================================================================

# 全局变量
INSTALL_MODE=""
DOMAIN=""
SSL_EMAIL=""
DB_PASSWORD=""
JWT_SECRET=""
API_SECRET=""
AGENT_KEY=""

# 收集部署信息
collect_installation_info() {
    log_header "📋 收集安装信息"

    # 域名配置
    while true; do
        read -p "请输入域名 (如 monitor.example.com): " DOMAIN
        if [[ -n "$DOMAIN" ]]; then
            break
        fi
        log_error "域名不能为空"
    done

    # SSL邮箱
    read -p "SSL证书邮箱 [默认: admin@$DOMAIN]: " SSL_EMAIL
    SSL_EMAIL=${SSL_EMAIL:-admin@$DOMAIN}

    # 数据库密码
    while true; do
        read -s -p "数据库密码 (至少8位): " DB_PASSWORD
        echo
        if [[ ${#DB_PASSWORD} -ge 8 ]]; then
            break
        fi
        log_error "密码至少需要8位字符"
    done

    # 生成安全密钥
    JWT_SECRET=$(openssl rand -hex 32)
    API_SECRET=$(openssl rand -hex 24)
    AGENT_KEY=$(openssl rand -hex 16)

    log_success "✅ 安装信息收集完成"
}

# 安装系统依赖
install_system_dependencies() {
    log_header "📦 安装系统依赖"

    # 检测操作系统
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        OS_ID="$ID"
        OS_VERSION="$VERSION_ID"
    else
        die "不支持的操作系统"
    fi

    log_info "检测到系统: $OS_ID $OS_VERSION"

    # 更新包管理器
    case "$OS_ID" in
        "ubuntu"|"debian")
            run_as_root apt-get update
            run_as_root apt-get install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
            ;;
        "centos"|"rhel"|"fedora")
            run_as_root yum update -y
            run_as_root yum install -y curl wget git unzip
            ;;
        *)
            log_warning "未知系统，尝试通用安装..."
            ;;
    esac

    log_success "✅ 系统依赖安装完成"
}

# 安装Docker
install_docker() {
    log_header "🐳 安装Docker"

    # 检查是否已安装
    if command -v docker >/dev/null 2>&1; then
        log_info "Docker已安装，版本: $(docker --version)"
        return 0
    fi

    log_info "开始安装Docker..."

    case "$OS_ID" in
        "ubuntu"|"debian")
            # 添加Docker官方GPG密钥
            curl -fsSL https://download.docker.com/linux/$OS_ID/gpg | run_as_root gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

            # 添加Docker仓库
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS_ID $(lsb_release -cs) stable" | run_as_root tee /etc/apt/sources.list.d/docker.list > /dev/null

            # 安装Docker
            run_as_root apt-get update
            run_as_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        "centos"|"rhel")
            # 安装Docker仓库
            run_as_root yum install -y yum-utils
            run_as_root yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

            # 安装Docker
            run_as_root yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        *)
            log_error "不支持的系统，请手动安装Docker"
            return 1
            ;;
    esac

    # 启动并启用Docker
    run_as_root systemctl start docker
    run_as_root systemctl enable docker

    # 将当前用户添加到docker组
    if [[ $EUID -ne 0 ]]; then
        run_as_root usermod -aG docker $USER
        log_warning "请注销并重新登录以使Docker组权限生效"
    fi

    log_success "✅ Docker安装完成"
}

# 安装Nginx
install_nginx() {
    log_header "🌐 安装和配置Nginx"

    # 检查是否已安装
    if command -v nginx >/dev/null 2>&1; then
        log_info "Nginx已安装"
    else
        log_info "安装Nginx..."

        case "$OS_ID" in
            "ubuntu"|"debian")
                run_as_root apt-get install -y nginx
                ;;
            "centos"|"rhel"|"fedora")
                run_as_root yum install -y nginx
                ;;
            *)
                log_error "不支持的系统，请手动安装Nginx"
                return 1
                ;;
        esac
    fi

    # 启动并启用Nginx
    run_as_root systemctl start nginx
    run_as_root systemctl enable nginx

    # 配置防火墙
    if command -v ufw >/dev/null 2>&1; then
        run_as_root ufw allow 'Nginx Full'
    elif command -v firewall-cmd >/dev/null 2>&1; then
        run_as_root firewall-cmd --permanent --add-service=http
        run_as_root firewall-cmd --permanent --add-service=https
        run_as_root firewall-cmd --reload
    fi

    log_success "✅ Nginx安装完成"
}

# 创建应用目录
create_application_directory() {
    log_header "📁 创建应用目录"

    APP_DIR="/opt/ssalgten"

    # 创建目录
    run_as_root mkdir -p "$APP_DIR"

    # 创建ssalgten用户
    if ! id ssalgten >/dev/null 2>&1; then
        run_as_root useradd -r -s /bin/bash -d "$APP_DIR" ssalgten
        log_info "创建用户: ssalgten"
    fi

    # 设置权限
    run_as_root chown ssalgten:ssalgten "$APP_DIR"
    run_as_root chmod 755 "$APP_DIR"

    # 创建子目录
    run_as_root -u ssalgten mkdir -p "$APP_DIR"/{logs,data,backups}

    log_success "✅ 应用目录创建完成: $APP_DIR"
}

# 下载源码和配置文件
download_application_files() {
    log_header "📥 下载应用文件"

    cd "$APP_DIR" || die "无法进入应用目录"

    # 如果是源码模式，克隆仓库
    if [[ "$INSTALL_MODE" == "source" ]]; then
        log_info "克隆源码仓库..."
        if [[ -d ".git" ]]; then
            run_as_root -u ssalgten git pull
        else
            run_as_root -u ssalgten git clone https://github.com/lonelyrower/SsalgTen.git .
        fi
    fi

    # 下载docker-compose配置文件
    if [[ "$INSTALL_MODE" == "image" ]]; then
        log_info "下载镜像配置文件..."
        run_as_root -u ssalgten wget -O docker-compose.ghcr.yml https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/docker-compose.ghcr.yml
    fi

    # 下载管理脚本
    log_info "下载管理脚本..."
    run_as_root -u ssalgten wget -O ssalgten.sh https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh
    run_as_root chmod +x "$APP_DIR/ssalgten.sh"

    # 创建符号链接
    if [[ ! -L /usr/local/bin/ssalgten ]]; then
        run_as_root ln -sf "$APP_DIR/ssalgten.sh" /usr/local/bin/ssalgten
        log_info "创建全局命令链接: ssalgten"
    fi

    log_success "✅ 应用文件下载完成"
}

# 创建环境配置
create_environment_configuration() {
    log_header "⚙️ 创建环境配置"

    case "$INSTALL_MODE" in
        "image")
            create_image_environment_config
            ;;
        "source")
            create_source_environment_config
            ;;
    esac

    log_success "✅ 环境配置创建完成"
}

# 创建源码模式环境配置
create_source_environment_config() {
    cat > "$APP_DIR/.env" << EOF
# SsalgTen 源码模式配置 - 生成于 $(date)
NODE_ENV=production

# 域名和端口配置
DOMAIN=$DOMAIN
FRONTEND_PORT=3000
BACKEND_PORT=3001
DB_PORT=5432

# 数据库配置
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://ssalgten:$DB_PASSWORD@localhost:5432/ssalgten

# JWT配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# API安全配置
API_KEY_SECRET=$API_SECRET
CORS_ORIGIN=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN

# Agent配置
DEFAULT_AGENT_API_KEY=$AGENT_KEY
AGENT_HEARTBEAT_INTERVAL=30000
AGENT_REQUIRE_SIGNATURE=false

# 外部服务
IPINFO_TOKEN=

# 日志配置
LOG_LEVEL=info
ENABLE_MORGAN=true
EOF

    run_as_root chown ssalgten:ssalgten "$APP_DIR/.env"
    run_as_root chmod 640 "$APP_DIR/.env"
}

# 创建镜像模式环境配置
create_image_environment_config() {
    cat > "$APP_DIR/.env.image" << EOF
# SsalgTen 镜像模式配置 - 生成于 $(date)
IMAGE_TAG=latest

# 域名和端口配置
DOMAIN=$DOMAIN
FRONTEND_PORT=80
BACKEND_PORT=3001
DB_PORT=5432

# 数据库配置
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://ssalgten:$DB_PASSWORD@postgres:5432/ssalgten

# JWT配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# API安全配置
API_KEY_SECRET=$API_SECRET
CORS_ORIGIN=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN

# Agent配置
DEFAULT_AGENT_API_KEY=$AGENT_KEY
AGENT_API_KEY=$AGENT_KEY
AGENT_NAME=production-agent
AGENT_HEARTBEAT_INTERVAL=30000
AGENT_REQUIRE_SIGNATURE=false

# 外部服务
IPINFO_TOKEN=

# 更新服务配置
UPDATE_INTERVAL=300000

# 前端构建变量
VITE_API_URL=/api
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false

# 日志配置
LOG_LEVEL=info
ENABLE_MORGAN=true
EOF

    run_as_root chown ssalgten:ssalgten "$APP_DIR/.env.image"
    run_as_root chmod 640 "$APP_DIR/.env.image"
}

# 配置Nginx反向代理
configure_nginx() {
    log_header "🌐 配置Nginx反向代理"

    local nginx_config="/etc/nginx/sites-available/ssalgten"

    cat > "/tmp/ssalgten.nginx" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    run_as_root mv "/tmp/ssalgten.nginx" "$nginx_config"

    # 启用站点
    if [[ -d "/etc/nginx/sites-enabled" ]]; then
        run_as_root ln -sf "$nginx_config" "/etc/nginx/sites-enabled/"
    fi

    # 测试配置
    if run_as_root nginx -t; then
        run_as_root systemctl reload nginx
        log_success "✅ Nginx配置完成"
    else
        log_error "❌ Nginx配置测试失败"
        return 1
    fi
}

# 安装SSL证书
install_ssl_certificate() {
    log_header "🔒 安装SSL证书"

    # 安装certbot
    if ! command -v certbot >/dev/null 2>&1; then
        log_info "安装certbot..."

        case "$OS_ID" in
            "ubuntu"|"debian")
                run_as_root apt-get install -y certbot python3-certbot-nginx
                ;;
            "centos"|"rhel"|"fedora")
                run_as_root yum install -y certbot python3-certbot-nginx
                ;;
        esac
    fi

    # 获取SSL证书
    log_info "获取SSL证书..."
    if run_as_root certbot --nginx -d "$DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive; then
        log_success "✅ SSL证书安装成功"

        # 设置自动续期
        if ! crontab -l 2>/dev/null | grep -q certbot; then
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            log_info "设置SSL证书自动续期"
        fi
    else
        log_warning "⚠️ SSL证书安装失败，将使用HTTP"
    fi
}

# 部署应用
deploy_application() {
    log_header "🚀 部署应用"

    cd "$APP_DIR" || die "无法进入应用目录"

    case "$INSTALL_MODE" in
        "image")
            deploy_image_mode
            ;;
        "source")
            deploy_source_mode
            ;;
    esac
}

# 镜像模式部署
deploy_image_mode() {
    log_info "📦 部署镜像模式..."

    # 设置部署模式标记
    echo "image" > "$APP_DIR/.deployment_mode"

    # 拉取镜像
    export $(grep -v '^#' .env.image | xargs)
    if ! image_pull latest; then
        log_error "镜像拉取失败"
        return 1
    fi

    # 启动服务
    if ! image_start; then
        log_error "镜像服务启动失败"
        return 1
    fi

    log_success "✅ 镜像模式部署完成"
}

# 源码模式部署
deploy_source_mode() {
    log_info "🔧 部署源码模式..."

    # 设置部署模式标记
    echo "source" > "$APP_DIR/.deployment_mode"

    # 安装依赖
    log_info "安装Node.js依赖..."
    run_as_root -u ssalgten npm run install:all

    # 构建应用
    log_info "构建应用..."
    run_as_root -u ssalgten npm run build

    # 启动服务
    export $(grep -v '^#' .env | xargs)
    if ! start_system; then
        log_error "源码服务启动失败"
        return 1
    fi

    log_success "✅ 源码模式部署完成"
}

# 主安装流程
perform_installation() {
    log_header "🎯 开始SsalgTen系统安装"

    # 1. 检查系统要求
    check_install_prerequisites

    # 2. 收集安装信息
    if [[ -z "$INSTALL_MODE" ]]; then
        ask_deployment_mode
    fi
    collect_installation_info

    # 3. 安装系统组件
    install_system_dependencies
    install_docker
    install_nginx

    # 4. 创建应用环境
    create_application_directory
    download_application_files
    create_environment_configuration

    # 5. 配置网络
    configure_nginx
    install_ssl_certificate

    # 6. 部署应用
    deploy_application

    # 7. 验证安装
    verify_installation

    log_success "🎉 SsalgTen安装完成！"
    show_installation_result
}

# 验证安装
verify_installation() {
    log_header "🔍 验证安装"

    # 等待服务启动
    log_info "等待服务完全启动..."
    sleep 30

    # 检查服务状态
    if smart_status >/dev/null 2>&1; then
        log_success "✅ 服务状态正常"
    else
        log_warning "⚠️ 服务状态异常，请检查日志"
    fi

    # 检查网络访问
    if curl -f "http://localhost:3001/api/health" >/dev/null 2>&1; then
        log_success "✅ 后端API正常"
    else
        log_warning "⚠️ 后端API异常"
    fi

    if curl -f "http://localhost:3000" >/dev/null 2>&1; then
        log_success "✅ 前端服务正常"
    else
        log_warning "⚠️ 前端服务异常"
    fi
}

# 显示安装结果
show_installation_result() {
    local mode_text="未知"
    case "$INSTALL_MODE" in
        "image") mode_text="镜像模式 🐳" ;;
        "source") mode_text="源码模式 🔧" ;;
    esac

    echo
    log_success "🎉 SsalgTen 安装完成！"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📋 安装信息:${NC}"
    echo -e "  部署模式: ${CYAN}$mode_text${NC}"
    echo -e "  主服务地址: ${CYAN}https://$DOMAIN${NC}"
    echo -e "  后端API: ${CYAN}https://$DOMAIN/api${NC}"
    echo -e "  应用目录: ${CYAN}$APP_DIR${NC}"
    echo
    echo -e "${YELLOW}🔧 管理命令:${NC}"
    echo -e "  全局命令: ${CYAN}ssalgten status${NC}"
    echo -e "  本地命令: ${CYAN}$APP_DIR/ssalgten.sh status${NC}"
    if [[ "$INSTALL_MODE" == "image" ]]; then
        echo -e "  镜像更新: ${CYAN}ssalgten update --image${NC}"
        echo -e "  切换模式: ${CYAN}ssalgten switch source${NC}"
    else
        echo -e "  源码更新: ${CYAN}ssalgten update${NC}"
        echo -e "  切换模式: ${CYAN}ssalgten switch image${NC}"
    fi
    echo -e "  数据备份: ${CYAN}ssalgten backup${NC}"
    echo -e "  查看帮助: ${CYAN}ssalgten --help${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}