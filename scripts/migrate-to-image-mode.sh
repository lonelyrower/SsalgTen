#!/usr/bin/env bash

# SsalgTen 镜像模式迁移脚本
# 将现有的本地构建部署迁移到 GHCR 镜像模式
# 使用方法: ./scripts/migrate-to-image-mode.sh

set -euo pipefail

# 颜色定义
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[1;33m'
readonly BLUE=$'\033[0;34m'
readonly NC=$'\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

die() {
    log_error "$*"
    exit 1
}

# 检查是否在项目根目录
check_project_dir() {
    if [[ ! -f "docker-compose.yml" ]] || [[ ! -f "docker-compose.ghcr.yml" ]]; then
        die "请在 SsalgTen 项目根目录下运行此脚本"
    fi
}

# 检查 Docker 和 Docker Compose
check_prerequisites() {
    log_info "检查前置条件..."

    if ! command -v docker &> /dev/null; then
        die "未找到 Docker，请先安装 Docker"
    fi

    if ! docker compose version &> /dev/null; then
        die "未找到 Docker Compose，请安装 Docker Compose v2"
    fi

    log_success "前置条件检查通过"
}

# 备份当前环境
backup_env() {
    log_info "备份当前环境..."

    local backup_date=$(date +%Y%m%d_%H%M%S)

    # 备份 .env 文件
    if [[ -f .env ]]; then
        cp .env ".env.backup-${backup_date}"
        log_success "已备份 .env 到 .env.backup-${backup_date}"
    fi

    # 提示备份数据库
    log_warning "强烈建议备份数据库！"
    echo "  执行: docker compose exec -T database pg_dump -U ssalgten ssalgten | gzip > backup-${backup_date}.sql.gz"

    read -p "是否继续迁移？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "迁移已取消"
        exit 0
    fi
}

# 检查 GHCR 镜像可用性
check_ghcr_images() {
    log_info "检查 GHCR 镜像可用性..."

    local images=(
        "ghcr.io/lonelyrower/ssalgten/backend:latest"
        "ghcr.io/lonelyrower/ssalgten/frontend:latest"
        "ghcr.io/lonelyrower/ssalgten/agent:latest"
        "ghcr.io/lonelyrower/ssalgten/updater:latest"
    )

    local all_available=true

    for image in "${images[@]}"; do
        log_info "  检查镜像: $image"
        if docker manifest inspect "$image" &> /dev/null; then
            log_success "    ✓ 可用"
        else
            log_error "    ✗ 不可用"
            all_available=false
        fi
    done

    if [[ "$all_available" == "false" ]]; then
        log_warning "部分镜像不可用，可能需要等待 CI/CD 构建完成"
        read -p "是否继续？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
}

# 停止当前服务
stop_current_services() {
    log_info "停止当前服务..."

    if docker compose ps --quiet | grep -q .; then
        docker compose down
        log_success "服务已停止"
    else
        log_info "没有运行中的服务"
    fi
}

# 拉取镜像
pull_images() {
    log_info "拉取 GHCR 镜像..."

    if docker compose -f docker-compose.ghcr.yml pull; then
        log_success "镜像拉取完成"
    else
        die "镜像拉取失败"
    fi
}

# 启动服务
start_services() {
    log_info "启动镜像模式服务..."

    # 先启动数据库
    log_info "  启动数据库..."
    docker compose -f docker-compose.ghcr.yml up -d database

    # 等待数据库就绪
    log_info "  等待数据库就绪..."
    local max_wait=60
    local waited=0

    while [[ $waited -lt $max_wait ]]; do
        if docker compose -f docker-compose.ghcr.yml exec -T database pg_isready -U ssalgten -d ssalgten &> /dev/null; then
            log_success "  数据库已就绪"
            break
        fi
        sleep 2
        waited=$((waited + 2))
    done

    if [[ $waited -ge $max_wait ]]; then
        log_warning "  数据库启动超时，但继续执行..."
    fi

    # 运行数据库迁移
    log_info "  运行数据库迁移..."
    if docker compose -f docker-compose.ghcr.yml run --rm backend npx prisma migrate deploy; then
        log_success "  数据库迁移完成"
    else
        log_warning "  数据库迁移失败，但继续执行..."
    fi

    # 启动所有服务
    log_info "  启动所有服务..."
    docker compose -f docker-compose.ghcr.yml up -d --remove-orphans

    log_success "服务启动完成"
}

# 验证服务状态
verify_services() {
    log_info "验证服务状态..."

    echo ""
    docker compose -f docker-compose.ghcr.yml ps
    echo ""

    # 检查后端健康状态
    log_info "检查后端 API..."
    local max_wait=30
    local waited=0

    while [[ $waited -lt $max_wait ]]; do
        if curl -sf http://localhost:3001/api/health &> /dev/null; then
            log_success "后端 API 正常"
            break
        fi
        sleep 2
        waited=$((waited + 2))
    done

    if [[ $waited -ge $max_wait ]]; then
        log_warning "后端 API 检查超时"
    fi

    # 检查前端
    log_info "检查前端..."
    if curl -sf http://localhost/ &> /dev/null; then
        log_success "前端正常"
    else
        log_warning "前端检查失败"
    fi
}

# 配置环境变量
configure_environment() {
    log_info "配置镜像模式环境..."

    # 检查是否需要添加 COMPOSE_FILE 到 .env
    if [[ -f .env ]] && ! grep -q "^COMPOSE_FILE=" .env; then
        echo "" >> .env
        echo "# Compose file configuration (image mode)" >> .env
        echo "COMPOSE_FILE=docker-compose.ghcr.yml" >> .env
        log_success "已添加 COMPOSE_FILE 配置到 .env"
    fi

    # 提示用户后续操作
    log_info ""
    log_info "后续更新操作："
    echo "  方式 1: ./ssalgten.sh update --image"
    echo "  方式 2: docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d"
    echo ""

    log_info "如需回滚到本地构建模式："
    echo "  docker compose -f docker-compose.ghcr.yml down"
    echo "  docker compose -f docker-compose.yml up -d"
}

# 显示摘要信息
show_summary() {
    echo ""
    echo "========================================="
    log_success "迁移完成！"
    echo "========================================="
    echo ""
    echo "访问方式："
    echo "  - 前端: http://localhost/"
    echo "  - 后端 API: http://localhost:3001/api"
    echo ""
    echo "查看日志："
    echo "  docker compose -f docker-compose.ghcr.yml logs -f"
    echo ""
    echo "查看服务状态："
    echo "  docker compose -f docker-compose.ghcr.yml ps"
    echo ""
    log_info "详细文档: docs/migration-to-image-mode.md"
    echo ""
}

# 主流程
main() {
    log_info "========================================="
    log_info "SsalgTen 镜像模式迁移工具"
    log_info "========================================="
    echo ""

    check_project_dir
    check_prerequisites
    backup_env
    check_ghcr_images
    stop_current_services
    pull_images
    start_services
    verify_services
    configure_environment
    show_summary
}

# 执行主流程
main "$@"
