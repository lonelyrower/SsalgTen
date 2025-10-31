#!/bin/bash

# SsalgTen GHCR Deployment Script
# 用于从GitHub Container Registry部署SsalgTen的脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印彩色消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境文件
check_env_file() {
    if [ ! -f ".env.ghcr" ]; then
        print_warning ".env.ghcr file not found!"
        if [ -f ".env.ghcr.example" ]; then
            print_info "Copying .env.ghcr.example to .env.ghcr"
            cp .env.ghcr.example .env.ghcr
            print_warning "Please edit .env.ghcr with your configuration before continuing!"
            exit 1
        else
            print_error "No environment configuration found!"
            exit 1
        fi
    fi
}

# 拉取最新镜像
pull_images() {
    local tag=${1:-latest}
    print_info "Pulling images with tag: $tag"

    local images=("backend" "frontend" "updater" "agent")
    for component in "${images[@]}"; do
        print_info "Pulling ghcr.io/lonelyrower/ssalgten/${component}:${tag}"
        docker pull "ghcr.io/lonelyrower/ssalgten/${component}:${tag}" || {
            print_error "Failed to pull ${component} image"
            exit 1
        }
    done

    print_success "All images pulled successfully!"
}

# 启动服务
start_services() {
    print_info "Starting SsalgTen services..."

    # 设置环境变量
    export $(cat .env.ghcr | xargs)

    # 启动服务
    docker-compose -f docker-compose.ghcr.yml up -d

    print_success "Services started successfully!"
    print_info "Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    print_info "Backend API: http://localhost:${BACKEND_PORT:-3001}"
}

# 停止服务
stop_services() {
    print_info "Stopping SsalgTen services..."
    docker-compose -f docker-compose.ghcr.yml down
    print_success "Services stopped successfully!"
}

# 查看日志
view_logs() {
    local service=${1:-}
    if [ -z "$service" ]; then
        docker-compose -f docker-compose.ghcr.yml logs -f
    else
        docker-compose -f docker-compose.ghcr.yml logs -f "$service"
    fi
}

# 更新到最新版本
update() {
    local tag=${1:-latest}
    print_info "Updating to version: $tag"

    # 更新环境变量中的标签
    sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env.ghcr

    # 拉取新镜像
    pull_images "$tag"

    # 重启服务
    print_info "Restarting services with new images..."
    stop_services
    start_services

    print_success "Update completed!"
}

# 查看状态
status() {
    print_info "Service status:"
    docker-compose -f docker-compose.ghcr.yml ps
}

# 健康检查
health_check() {
    print_info "Running health checks..."

    # 检查后端健康状态
    local backend_port=${BACKEND_PORT:-3001}
    if curl -f "http://localhost:${backend_port}/api/health" >/dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        return 1
    fi

    # 检查前端
    local frontend_port=${FRONTEND_PORT:-3000}
    if curl -f "http://localhost:${frontend_port}/health" >/dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_error "Frontend health check failed"
        return 1
    fi

    print_success "All services are healthy!"
}

# 显示帮助信息
show_help() {
    cat << EOF
SsalgTen GHCR Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    pull [TAG]      拉取指定标签的镜像 (默认: latest)
    start           启动所有服务
    stop            停止所有服务
    restart         重启所有服务
    logs [SERVICE]  查看日志 (可选指定服务名)
    status          查看服务状态
    update [TAG]    更新到指定版本 (默认: latest)
    health          运行健康检查
    help            显示此帮助信息

Examples:
    $0 pull v1.0.0          # 拉取v1.0.0版本的镜像
    $0 start                # 启动所有服务
    $0 logs backend         # 查看backend服务日志
    $0 update main          # 更新到main分支的最新版本

Environment:
    配置文件: .env.ghcr (从 .env.ghcr.example 复制并修改)

EOF
}

# 主函数
main() {
    local command=${1:-help}

    case $command in
        "pull")
            check_env_file
            pull_images "${2:-latest}"
            ;;
        "start")
            check_env_file
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            check_env_file
            stop_services
            start_services
            ;;
        "logs")
            view_logs "$2"
            ;;
        "status")
            status
            ;;
        "update")
            check_env_file
            update "${2:-latest}"
            ;;
        "health")
            # 加载环境变量进行健康检查
            if [ -f ".env.ghcr" ]; then
                export $(cat .env.ghcr | xargs)
            fi
            health_check
            ;;
        "help"|"-h"|"--help"|*)
            show_help
            ;;
    esac
}

# 如果直接运行脚本，则调用主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi