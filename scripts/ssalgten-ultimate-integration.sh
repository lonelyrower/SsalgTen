#!/usr/bin/env bash

# SsalgTen 终极版一体化脚本 - 渐进式集成模块
# 这个文件包含了需要添加到现有 ssalgten.sh 的新功能模块

# =============================================================================
# 🏗️ 新增模块：部署模式管理
# =============================================================================

# 检测部署模式
detect_deployment_mode() {
    if [[ -f "$APP_DIR/.deployment_mode" ]]; then
        cat "$APP_DIR/.deployment_mode"
    else
        # 向后兼容：检测现有安装类型
        if [[ -f "$APP_DIR/docker-compose.ghcr.yml" ]] && docker_compose -f "$APP_DIR/docker-compose.ghcr.yml" ps >/dev/null 2>&1; then
            echo "image"
        else
            echo "source"
        fi
    fi
}

# 设置部署模式
set_deployment_mode() {
    local mode="$1"
    echo "$mode" > "$APP_DIR/.deployment_mode"
    log_success "部署模式已设置为: $mode"
}

# 检测环境状态
detect_environment_status() {
    # 检测是否已安装
    if [[ ! -d "$APP_DIR" ]] || [[ ! -f "$APP_DIR/docker-compose.yml" && ! -f "$APP_DIR/docker-compose.ghcr.yml" ]]; then
        echo "not_installed"
    elif docker_compose ps >/dev/null 2>&1; then
        echo "running"
    else
        echo "installed"
    fi
}

# =============================================================================
# 🐳 新增模块：镜像模式管理
# =============================================================================

# 拉取GHCR镜像
image_pull() {
    local tag=${1:-latest}
    log_info "拉取镜像版本: $tag"

    local components=("backend" "frontend" "updater" "agent")
    local registry="ghcr.io/lonelyrower/ssalgten"
    local failed_components=()

    for component in "${components[@]}"; do
        log_info "拉取 ${component} 镜像..."

        if docker pull "${registry}/${component}:${tag}"; then
            log_success "✅ ${component} 镜像拉取成功"
        else
            log_warning "❌ ${component}:${tag} 拉取失败，尝试 main 标签..."
            if docker pull "${registry}/${component}:main"; then
                docker tag "${registry}/${component}:main" "${registry}/${component}:${tag}"
                log_warning "✅ 使用 main 标签代替"
            else
                failed_components+=("$component")
                log_error "❌ ${component} 镜像拉取完全失败"
            fi
        fi
    done

    if [[ ${#failed_components[@]} -gt 0 ]]; then
        log_error "以下组件镜像拉取失败: ${failed_components[*]}"
        log_info "请检查网络连接或镜像是否存在"
        return 1
    fi

    log_success "🎉 所有镜像拉取完成"
    return 0
}

# 镜像模式启动
image_start() {
    log_info "🐳 启动镜像模式服务..."

    # 确保在正确目录
    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"

    # 检查镜像配置文件
    if [[ ! -f "docker-compose.ghcr.yml" ]]; then
        log_error "镜像配置文件不存在，请先运行安装"
        return 1
    fi

    # 加载镜像环境配置
    if [[ -f ".env.image" ]]; then
        export $(grep -v '^#' .env.image | xargs)
    fi

    # 启动服务
    if docker_compose -f docker-compose.ghcr.yml up -d; then
        log_success "✅ 镜像服务启动成功"
        set_deployment_mode "image"

        # 等待服务启动
        log_info "等待服务完全启动..."
        sleep 10

        # 检查健康状态
        image_health_check
    else
        log_error "❌ 镜像服务启动失败"
        return 1
    fi
}

# 镜像模式停止
image_stop() {
    log_info "🐳 停止镜像模式服务..."

    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"

    if docker_compose -f docker-compose.ghcr.yml down; then
        log_success "✅ 镜像服务已停止"
    else
        log_error "❌ 镜像服务停止失败"
        return 1
    fi
}

# 镜像模式更新
image_update() {
    local tag=${1:-latest}
    log_info "🚀 更新镜像模式到版本: $tag"

    # 1. 拉取新镜像
    if ! image_pull "$tag"; then
        log_error "镜像拉取失败，更新中止"
        return 1
    fi

    # 2. 停止现有服务
    image_stop

    # 3. 更新标签配置
    if [[ -f "$APP_DIR/.env.image" ]]; then
        sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=$tag/" "$APP_DIR/.env.image"
    fi

    # 4. 启动新服务
    if image_start; then
        log_success "🎉 镜像更新完成"
    else
        log_error "❌ 镜像更新失败"
        return 1
    fi
}

# 镜像健康检查
image_health_check() {
    log_info "🔍 检查镜像服务健康状态..."

    local services=("postgres" "backend" "frontend")
    local healthy_count=0

    for service in "${services[@]}"; do
        if docker_compose -f docker-compose.ghcr.yml ps "$service" 2>/dev/null | grep -q "Up"; then
            log_success "✅ $service 服务正常"
            ((healthy_count++))
        else
            log_warning "⚠️ $service 服务异常"
        fi
    done

    if [[ $healthy_count -eq ${#services[@]} ]]; then
        log_success "🎉 所有镜像服务健康"
        return 0
    else
        log_warning "⚠️ $((${#services[@]} - healthy_count)) 个服务状态异常"
        return 1
    fi
}

# =============================================================================
# 🔄 新增模块：模式切换管理
# =============================================================================

# 切换到镜像模式
switch_to_image_mode() {
    log_header "🔄 切换到镜像模式"

    local current_mode=$(detect_deployment_mode)
    if [[ "$current_mode" == "image" ]]; then
        log_info "当前已经是镜像模式"
        return 0
    fi

    # 1. 停止当前服务
    log_info "停止当前服务..."
    stop_system

    # 2. 创建镜像配置
    create_image_config

    # 3. 拉取镜像
    if ! image_pull latest; then
        log_error "镜像拉取失败，切换中止"
        return 1
    fi

    # 4. 启动镜像服务
    if image_start; then
        log_success "🎉 已成功切换到镜像模式"
        log_info "更新命令: ./ssalgten.sh update --image"
    else
        log_error "❌ 切换到镜像模式失败"
        return 1
    fi
}

# 切换到源码模式
switch_to_source_mode() {
    log_header "🔄 切换到源码模式"

    local current_mode=$(detect_deployment_mode)
    if [[ "$current_mode" == "source" ]]; then
        log_info "当前已经是源码模式"
        return 0
    fi

    # 1. 停止镜像服务
    log_info "停止镜像服务..."
    image_stop

    # 2. 启动源码服务
    if start_system; then
        set_deployment_mode "source"
        log_success "🎉 已成功切换到源码模式"
        log_info "更新命令: ./ssalgten.sh update"
    else
        log_error "❌ 切换到源码模式失败"
        return 1
    fi
}

# 显示当前模式
show_current_mode() {
    local mode=$(detect_deployment_mode)
    local status=$(detect_environment_status)

    echo
    log_header "📋 当前部署信息"
    echo -e "  部署模式: ${CYAN}$mode${NC}"
    echo -e "  运行状态: ${CYAN}$status${NC}"
    echo -e "  应用目录: ${CYAN}$APP_DIR${NC}"

    case "$mode" in
        "image")
            echo -e "  镜像更新: ${GREEN}./ssalgten.sh update --image${NC}"
            echo -e "  切换模式: ${YELLOW}./ssalgten.sh switch source${NC}"
            ;;
        "source")
            echo -e "  源码更新: ${GREEN}./ssalgten.sh update${NC}"
            echo -e "  切换模式: ${YELLOW}./ssalgten.sh switch image${NC}"
            ;;
    esac
    echo
}

# =============================================================================
# 🛠️ 新增模块：安装功能
# =============================================================================

# 检查系统要求
check_install_prerequisites() {
    log_info "检查系统安装要求..."

    # 检查操作系统
    if [[ ! -f /etc/os-release ]]; then
        die "不支持的操作系统"
    fi

    # 检查权限
    if [[ $EUID -ne 0 ]] && ! command -v sudo >/dev/null; then
        die "需要root权限或sudo命令"
    fi

    # 检查网络
    if ! ping -c 1 github.com >/dev/null 2>&1; then
        log_warning "网络连接异常，可能影响安装"
    fi

    log_success "✅ 系统要求检查通过"
}

# 询问部署模式
ask_deployment_mode() {
    echo
    log_header "📦 选择部署模式"
    echo
    echo -e "${GREEN}1) 镜像模式 (推荐)${NC}"
    echo "   ✅ 快速部署 (2-4分钟)"
    echo "   ✅ 资源消耗少"
    echo "   ✅ 一致性强"
    echo "   ❌ 代码定制受限"
    echo
    echo -e "${CYAN}2) 源码模式${NC}"
    echo "   ✅ 完全可定制"
    echo "   ✅ 本地调试方便"
    echo "   ❌ 部署较慢 (8-12分钟)"
    echo "   ❌ 资源消耗大"
    echo

    while true; do
        read -p "请选择部署模式 (1-2) [默认: 1]: " choice
        choice=${choice:-1}

        case $choice in
            1|image)
                INSTALL_MODE="image"
                log_success "已选择镜像模式"
                break
                ;;
            2|source)
                INSTALL_MODE="source"
                log_success "已选择源码模式"
                break
                ;;
            *)
                log_error "无效选择，请输入 1 或 2"
                ;;
        esac
    done
}

# 创建镜像配置
create_image_config() {
    log_info "创建镜像模式配置..."

    # 从现有配置迁移或创建新配置
    if [[ -f "$APP_DIR/.env" ]]; then
        # 从源码配置迁移
        source "$APP_DIR/.env"
    fi

    cat > "$APP_DIR/.env.image" << EOF
# SsalgTen 镜像模式配置 - 生成于 $(date)
IMAGE_TAG=latest

# 基础配置
DOMAIN=${DOMAIN:-localhost}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${BACKEND_PORT:-3001}
DB_PORT=${DB_PORT:-5432}

# 数据库配置
DB_PASSWORD=${DB_PASSWORD:-ssalgten_password}
DATABASE_URL=postgresql://ssalgten:${DB_PASSWORD:-ssalgten_password}@postgres:5432/ssalgten

# JWT和API安全配置
JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key-change-this-in-production}
JWT_EXPIRES_IN=7d
API_KEY_SECRET=${API_KEY_SECRET:-your-api-key-secret-change-this}
CORS_ORIGIN=http://${DOMAIN:-localhost}
FRONTEND_URL=http://${DOMAIN:-localhost}

# Agent配置
DEFAULT_AGENT_API_KEY=${DEFAULT_AGENT_API_KEY:-default-agent-key-change-this}
AGENT_API_KEY=${AGENT_API_KEY:-default-agent-key-change-this}
AGENT_NAME=${AGENT_NAME:-local-agent}
AGENT_HEARTBEAT_INTERVAL=30000
AGENT_REQUIRE_SIGNATURE=false

# 外部服务
IPINFO_TOKEN=${IPINFO_TOKEN:-}

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

    log_success "✅ 镜像配置文件创建完成"
}

# =============================================================================
# 🧠 新增模块：智能路由系统
# =============================================================================

# 智能启动
smart_start() {
    local mode_override="$1"
    local current_mode=$(detect_deployment_mode)

    # 如果指定了模式覆盖，使用指定模式
    if [[ -n "$mode_override" ]]; then
        current_mode="$mode_override"
    fi

    log_info "启动服务 (模式: $current_mode)"

    case "$current_mode" in
        "image")
            image_start
            ;;
        "source")
            start_system
            ;;
        *)
            log_error "未知的部署模式: $current_mode"
            return 1
            ;;
    esac
}

# 智能停止
smart_stop() {
    local current_mode=$(detect_deployment_mode)

    log_info "停止服务 (模式: $current_mode)"

    case "$current_mode" in
        "image")
            image_stop
            ;;
        "source")
            stop_system
            ;;
        *)
            log_error "未知的部署模式: $current_mode"
            return 1
            ;;
    esac
}

# 智能更新
smart_update() {
    local mode_override="$1"
    local tag="$2"
    local current_mode=$(detect_deployment_mode)

    # 如果指定了模式覆盖，使用指定模式
    if [[ -n "$mode_override" ]]; then
        current_mode="$mode_override"
    fi

    log_info "更新服务 (模式: $current_mode)"

    case "$current_mode" in
        "image")
            image_update "${tag:-latest}"
            ;;
        "source")
            update_system
            ;;
        *)
            log_error "未知的部署模式: $current_mode"
            return 1
            ;;
    esac
}

# 智能状态
smart_status() {
    local current_mode=$(detect_deployment_mode)
    local env_status=$(detect_environment_status)

    # 先显示基本系统状态
    system_status

    echo
    log_header "📋 部署模式信息"
    echo -e "  当前模式: ${CYAN}$current_mode${NC}"
    echo -e "  环境状态: ${CYAN}$env_status${NC}"

    case "$current_mode" in
        "image")
            echo -e "  配置文件: ${CYAN}$APP_DIR/.env.image${NC}"
            echo -e "  Compose文件: ${CYAN}$APP_DIR/docker-compose.ghcr.yml${NC}"
            ;;
        "source")
            echo -e "  配置文件: ${CYAN}$APP_DIR/.env${NC}"
            echo -e "  Compose文件: ${CYAN}$APP_DIR/docker-compose.yml${NC}"
            ;;
    esac
    echo
}

# =============================================================================
# 🔧 新增功能：增强的帮助系统
# =============================================================================

show_enhanced_help() {
    cat << EOF
🚀 SsalgTen 终极版一体化管理工具 v${SCRIPT_VERSION}

完整的网络监控系统部署和管理解决方案

📋 主要功能分类:

${PURPLE}🛠️ 系统安装:${NC}
  install                 完整系统安装（交互式选择模式）
  install --image         镜像模式安装（推荐，快速）
  install --source        源码模式安装（可定制）

${PURPLE}🔧 服务管理:${NC}
  start                   智能启动（自动检测模式）
  start --image           强制镜像模式启动
  start --source          强制源码模式启动
  stop                    停止服务
  restart                 重启服务
  status                  查看状态（含模式信息）

${PURPLE}📦 更新管理:${NC}
  update                  智能更新（根据当前模式）
  update --image [TAG]    镜像模式更新
  update --source         源码模式更新

${PURPLE}🔄 模式管理:${NC}
  switch image            切换到镜像模式
  switch source           切换到源码模式
  mode                    查看当前部署模式

${PURPLE}💾 数据管理:${NC}
  backup                  数据备份
  restore                 数据恢复（需要备份文件）

${PURPLE}📊 监控管理:${NC}
  monitor                 系统监控
  logs [service]          查看日志
  health                  健康检查
  diagnose                生成诊断报告

${PURPLE}🛠️ 系统管理:${NC}
  self-update             脚本自更新
  uninstall               完全卸载
  clean                   清理系统
  --help, -h              显示此帮助

${YELLOW}📖 使用示例:${NC}

  ${CYAN}# 全新安装（推荐镜像模式）${NC}
  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- install --image

  ${CYAN}# 日常管理${NC}
  ./ssalgten.sh status              # 查看状态
  ./ssalgten.sh update              # 智能更新
  ./ssalgten.sh backup              # 数据备份

  ${CYAN}# 模式切换${NC}
  ./ssalgten.sh switch image        # 切换到镜像模式（更快）
  ./ssalgten.sh switch source       # 切换到源码模式（可定制）

${YELLOW}💡 部署模式对比:${NC}

  📦 镜像模式：快速(2-4min)、低资源、高一致性
  🔧 源码模式：可定制、本地调试、较慢(8-12min)

${YELLOW}🌐 远程安装:${NC}
  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash

EOF
}

# =============================================================================
# ✨ 这些模块将被集成到现有 ssalgten.sh 的相应位置
# =============================================================================