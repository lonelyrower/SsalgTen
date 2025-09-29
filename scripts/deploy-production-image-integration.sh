#!/bin/bash

# SsalgTen deploy-production.sh 镜像集成示例代码
# 这是对现有 deploy-production.sh 的关键修改示例

# 在现有的 collect_deployment_info() 函数后添加部署模式选择
choose_deployment_mode() {
    log_info "📦 选择应用部署模式"
    echo
    echo -e "${YELLOW}可选部署模式：${NC}"
    echo -e "${GREEN}1) 镜像模式 (推荐)${NC}"
    echo "   ✅ 快速部署 (2-3分钟)"
    echo "   ✅ 资源消耗少 (无需编译)"
    echo "   ✅ 一致性强 (预构建镜像)"
    echo "   ✅ 支持多平台 (AMD64/ARM64)"
    echo "   ❌ 代码定制需要重新构建镜像"
    echo
    echo -e "${CYAN}2) 源码模式${NC}"
    echo "   ✅ 完全可定制"
    echo "   ✅ 本地调试方便"
    echo "   ❌ 部署较慢 (5-10分钟)"
    echo "   ❌ 资源消耗大 (需要编译)"
    echo

    while true; do
        read -p "请选择部署模式 (1-2) [默认: 1]: " deploy_mode
        deploy_mode=${deploy_mode:-1}

        case $deploy_mode in
            1)
                DEPLOYMENT_MODE="image"
                log_success "已选择镜像模式"
                break
                ;;
            2)
                DEPLOYMENT_MODE="source"
                log_success "已选择源码模式"
                break
                ;;
            *)
                log_error "无效选择，请输入 1 或 2"
                ;;
        esac
    done
}

# 创建镜像模式配置文件
create_image_environment_config() {
    log_info "创建镜像模式配置文件..."

    cat > "$APP_DIR/.env.image" << EOF
# SsalgTen 镜像模式配置 - 自动生成于 $(date)
DEPLOYMENT_MODE=image
IMAGE_TAG=latest

# 基础配置
DOMAIN=$DOMAIN
FRONTEND_PORT=80
BACKEND_PORT=3001
DB_PORT=5432

# 数据库配置
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://ssalgten:$DB_PASSWORD@postgres:5432/ssalgten

# JWT和API安全配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
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

    # 设置文件权限
    run_as_root chown ssalgten:ssalgten "$APP_DIR/.env.image"
    run_as_root chmod 640 "$APP_DIR/.env.image"

    log_success "镜像配置文件创建完成"
}

# 拉取GHCR镜像
pull_ghcr_images() {
    log_info "📥 拉取 GitHub Container Registry 镜像..."

    local components=("backend" "frontend" "updater" "agent")
    local registry="ghcr.io/lonelyrower/ssalgten"
    local tag="${IMAGE_TAG:-latest}"

    for component in "${components[@]}"; do
        log_info "拉取 ${component} 镜像..."

        if docker pull "${registry}/${component}:${tag}"; then
            log_success "✅ ${component} 镜像拉取成功"
        else
            log_error "❌ ${component} 镜像拉取失败"
            log_warning "请检查网络连接或镜像是否存在"

            # 尝试拉取 main 标签作为备选
            if [[ "$tag" != "main" ]]; then
                log_info "尝试拉取 main 标签..."
                if docker pull "${registry}/${component}:main"; then
                    log_warning "使用 main 标签代替"
                    # 给镜像添加目标标签
                    docker tag "${registry}/${component}:main" "${registry}/${component}:${tag}"
                else
                    log_error "镜像拉取失败，请检查网络或手动拉取"
                    return 1
                fi
            else
                return 1
            fi
        fi
    done

    log_success "🎉 所有镜像拉取完成"
}

# 启动镜像模式服务
start_image_services() {
    log_info "🚀 启动镜像模式服务..."

    cd "$APP_DIR" || {
        log_error "无法进入应用目录: $APP_DIR"
        return 1
    }

    # 确保使用镜像配置
    export $(grep -v '^#' .env.image | xargs)

    # 启动服务
    if docker_compose -f docker-compose.ghcr.yml up -d; then
        log_success "✅ 镜像服务启动成功"
    else
        log_error "❌ 镜像服务启动失败"
        log_info "查看详细日志: docker_compose -f docker-compose.ghcr.yml logs"
        return 1
    fi

    # 等待服务启动
    log_info "等待服务完全启动..."
    sleep 30

    # 检查服务状态
    check_image_services_health
}

# 检查镜像服务健康状态
check_image_services_health() {
    log_info "🔍 检查服务健康状态..."

    local services=("postgres" "backend" "frontend")
    local all_healthy=true

    for service in "${services[@]}"; do
        log_info "检查 $service 服务..."

        if docker_compose -f docker-compose.ghcr.yml ps "$service" | grep -q "Up (healthy)"; then
            log_success "✅ $service 服务正常"
        else
            log_error "❌ $service 服务异常"
            all_healthy=false
        fi
    done

    if [[ "$all_healthy" == "true" ]]; then
        log_success "🎉 所有服务健康状态正常"
        return 0
    else
        log_error "⚠️ 部分服务状态异常，请检查日志"
        return 1
    fi
}

# 镜像模式的完整部署流程
deploy_image_mode() {
    log_header "📦 镜像模式部署开始"

    # 1. 创建配置文件
    create_image_environment_config || {
        log_error "配置文件创建失败"
        return 1
    }

    # 2. 拉取镜像
    pull_ghcr_images || {
        log_error "镜像拉取失败"
        return 1
    }

    # 3. 启动服务
    start_image_services || {
        log_error "服务启动失败"
        return 1
    }

    # 4. 创建部署模式标记
    echo "image" > "$APP_DIR/.deployment_mode"
    run_as_root chown ssalgten:ssalgten "$APP_DIR/.deployment_mode"

    # 5. 创建管理脚本链接（确保ssalgten.sh知道当前模式）
    create_management_scripts

    log_success "🎉 镜像模式部署完成"
}

# 修改主部署流程
main_deployment_flow() {
    # ... 现有的系统检查、依赖安装等步骤 ...

    # 在原有的 collect_deployment_info() 调用后添加
    collect_deployment_info
    choose_deployment_mode  # 新增：选择部署模式

    # ... SSL证书、Nginx配置等系统级设置 ...

    # 根据选择的模式进行部署
    case "$DEPLOYMENT_MODE" in
        "image")
            deploy_image_mode
            ;;
        "source")
            # 现有的源码部署流程
            download_source_code
            create_environment_config
            check_build_resources
            build_and_start_services
            echo "source" > "$APP_DIR/.deployment_mode"
            ;;
        *)
            log_error "未知的部署模式: $DEPLOYMENT_MODE"
            exit 1
            ;;
    esac

    # 验证部署结果
    verify_deployment

    # 显示部署完成信息
    show_deployment_result
}

# 更新部署结果显示，包含模式信息
show_deployment_result() {
    local mode_text="未知"
    case "$DEPLOYMENT_MODE" in
        "image") mode_text="镜像模式 🐳" ;;
        "source") mode_text="源码模式 🔧" ;;
    esac

    echo
    log_success "🎉 SsalgTen 部署完成！"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📋 部署信息:${NC}"
    echo -e "  部署模式: ${CYAN}$mode_text${NC}"
    echo -e "  主服务地址: ${CYAN}https://$DOMAIN${NC}"
    echo -e "  后端API: ${CYAN}https://$DOMAIN/api${NC}"
    echo -e "  应用目录: ${CYAN}$APP_DIR${NC}"
    echo
    echo -e "${YELLOW}🔧 管理命令:${NC}"
    echo -e "  查看状态: ${CYAN}$APP_DIR/ssalgten.sh status${NC}"
    echo -e "  服务管理: ${CYAN}$APP_DIR/ssalgten.sh start|stop|restart${NC}"
    if [[ "$DEPLOYMENT_MODE" == "image" ]]; then
        echo -e "  镜像更新: ${CYAN}$APP_DIR/ssalgten.sh update --image${NC}"
        echo -e "  切换模式: ${CYAN}$APP_DIR/ssalgten.sh switch source${NC}"
    else
        echo -e "  源码更新: ${CYAN}$APP_DIR/ssalgten.sh update${NC}"
        echo -e "  切换模式: ${CYAN}$APP_DIR/ssalgten.sh switch image${NC}"
    fi
    echo -e "  数据备份: ${CYAN}$APP_DIR/ssalgten.sh backup${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 在main()函数中调用新的部署流程
main() {
    # ... 现有的初始化代码 ...

    main_deployment_flow

    # ... 清理工作 ...
}