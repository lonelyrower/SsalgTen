#!/usr/bin/env bash

# SsalgTen Production Update Script
# - 安全的零停机更新
# - 自动数据备份和回滚
# - 健康检查和验证
# - 详细的错误处理

set -Eeuo pipefail

# Docker Compose 命令兼容性检查
if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DC="docker compose"
else
    echo "错误: 未找到 docker-compose 或 docker compose 命令"
    exit 1
fi

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/.update/backups"
LOGS_DIR="${PROJECT_DIR}/.update/logs"
UPDATE_ID="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${LOGS_DIR}/update_${UPDATE_ID}.log"

# 创建必要的目录
mkdir -p "$BACKUP_DIR" "$LOGS_DIR"

# 日志函数
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "SUCCESS" "$@"; }

# 错误处理
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "更新过程出现错误 (退出码: $exit_code)"
        if [ -n "${BACKUP_CREATED:-}" ]; then
            log_warn "可以使用以下命令回滚："
            log_warn "  ./scripts/rollback.sh $UPDATE_ID"
        fi
    fi
}

trap cleanup EXIT

cd "$PROJECT_DIR"

# 处理脚本格式问题
if [ -f "./scripts/backup-db.sh" ]; then
    # 修复备份脚本格式
    if command -v dos2unix >/dev/null 2>&1; then
        dos2unix ./scripts/backup-db.sh 2>/dev/null || true
    else
        sed -i 's/\r$//' ./scripts/backup-db.sh 2>/dev/null || true
    fi
    chmod +x ./scripts/backup-db.sh
fi

log_info "🚀 开始生产环境更新 (ID: $UPDATE_ID)"
log_info "📍 项目目录: $PROJECT_DIR"

# 检查Docker是否运行
if ! docker info >/dev/null 2>&1; then
    log_error "Docker 服务未运行或无法访问"
    exit 1
fi

# 检查是否有正在运行的容器
log_info "🔍 检查当前运行状态..."
RUNNING_CONTAINERS=$($DC ps --services --filter "status=running" | wc -l)
log_info "当前运行的容器数: $RUNNING_CONTAINERS"

# 1. 创建数据备份
log_info "💾 开始创建数据备份..."
BACKUP_PATH="${BACKUP_DIR}/backup_${UPDATE_ID}"
mkdir -p "$BACKUP_PATH"

# 备份数据库 - 使用专用备份脚本
log_info "备份数据库..."
if [ -f "./scripts/backup-db.sh" ]; then
    # 使用自动化模式备份到指定目录
    if BACKUP_AUTO=true bash ./scripts/backup-db.sh "$UPDATE_ID" "$BACKUP_PATH"; then
        log_success "数据库备份完成"
        # 将备份文件移动到正确位置（如果需要）
        if [ -f "$BACKUP_PATH/ssalgten-${UPDATE_ID}.sql" ]; then
            mv "$BACKUP_PATH/ssalgten-${UPDATE_ID}.sql" "${BACKUP_PATH}/database.sql" 2>/dev/null || true
        fi
    else
        log_warn "数据库备份失败或数据库容器未运行，跳过数据库备份"
    fi
else
    # 回退到直接备份方法
    log_warn "备份脚本不存在，使用直接方法"
    if $DC ps -q database >/dev/null 2>&1 && [ -n "$($DC ps -q database)" ]; then
        $DC exec -T database pg_dump -U ssalgten -d ssalgten --clean --if-exists > "${BACKUP_PATH}/database.sql" 2>/dev/null || {
            log_warn "数据库备份失败，继续更新"
        }
    else
        log_warn "未检测到数据库容器，跳过数据库备份"
    fi
fi

# 备份配置文件
log_info "备份配置文件..."
cp -r .env "${BACKUP_PATH}/" 2>/dev/null || log_warn ".env文件备份失败"
cp -r docker-compose.yml "${BACKUP_PATH}/" 2>/dev/null || log_warn "docker-compose.yml备份失败"

# 备份持久化数据卷（如果存在）
log_info "备份Docker卷数据..."
{
    docker run --rm -v ssalgten-postgres-data:/data -v "$BACKUP_PATH":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data . 2>/dev/null
    docker run --rm -v ssalgten-backend-data:/data -v "$BACKUP_PATH":/backup alpine tar czf /backup/backend_data.tar.gz -C /data . 2>/dev/null
} || log_warn "部分数据卷备份失败，但可以继续"

BACKUP_CREATED="true"
log_success "数据备份完成: $BACKUP_PATH"

# 2. 拉取最新代码
log_info "📥 拉取最新代码..."
git fetch origin 2>&1 | tee -a "$LOG_FILE" || {
    log_error "Git拉取失败"
    exit 1
}

# 检查是否有更新
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    log_info "✅ 代码已经是最新版本，无需更新"
    exit 0
fi

log_info "发现新版本:"
log_info "  当前: ${CURRENT_COMMIT:0:7}"
log_info "  最新: ${LATEST_COMMIT:0:7}"

# 显示更改
log_info "📝 本次更新包含的更改:"
git log --oneline "${CURRENT_COMMIT}..${LATEST_COMMIT}" | head -10 | tee -a "$LOG_FILE"

# 更新到最新版本
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE" || {
    log_error "Git重置失败"
    exit 1
}

# 3. 健康检查函数
check_service_health() {
    local service="$1"
    local max_attempts=30
    local attempt=1
    
    log_info "检查 $service 服务健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if $DC ps "$service" | grep -q "healthy\|Up"; then
            log_success "$service 服务健康"
            return 0
        fi
        
        log_info "等待 $service 服务启动... ($attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_error "$service 服务健康检查失败"
    return 1
}

# 4. 滚动更新
log_info "🔄 开始滚动更新..."

# 更新后端服务
log_info "更新后端服务..."
$DC build backend 2>&1 | tee -a "$LOG_FILE" || {
    log_error "后端构建失败"
    exit 1
}

$DC up -d backend 2>&1 | tee -a "$LOG_FILE" || {
    log_error "后端启动失败"
    exit 1
}

check_service_health "backend" || exit 1

# 更新前端服务
log_info "更新前端服务..."
$DC build frontend 2>&1 | tee -a "$LOG_FILE" || {
    log_error "前端构建失败"
    exit 1
}

$DC up -d frontend 2>&1 | tee -a "$LOG_FILE" || {
    log_error "前端启动失败"
    exit 1
}

check_service_health "frontend" || exit 1

# 更新代理服务（如果存在）
if $DC ps agent-nyc >/dev/null 2>&1; then
    log_info "更新代理服务..."
    $DC build agent-nyc 2>&1 | tee -a "$LOG_FILE" || log_warn "代理构建失败"
    $DC up -d agent-nyc 2>&1 | tee -a "$LOG_FILE" || log_warn "代理启动失败"
fi

# 5. 最终健康检查
log_info "🏥 执行最终健康检查..."

# 检查API健康
log_info "检查API健康状态..."
sleep 10  # 等待服务完全启动

API_URL="http://localhost:${BACKEND_PORT:-3001}/api/health"
if curl -f -s "$API_URL" >/dev/null; then
    log_success "API健康检查通过"
else
    log_error "API健康检查失败"
    exit 1
fi

# 检查前端健康（检查主页）
FRONTEND_URL="http://localhost:${FRONTEND_PORT:-80}/"
if curl -f -s "$FRONTEND_URL" | grep -i "SsalgTen\|root" >/dev/null; then
    log_success "前端健康检查通过"
else
    log_error "前端健康检查失败"
    exit 1
fi

# 6. 清理旧镜像
log_info "🧹 清理旧的Docker镜像..."
docker image prune -f 2>&1 | tee -a "$LOG_FILE" || log_warn "镜像清理失败"

# 7. 更新版本信息
NEW_VERSION=$(git rev-parse --short HEAD)
log_info "更新版本信息: $NEW_VERSION"

# 更新.env文件中的版本
if [[ -f .env ]]; then
    if grep -q "APP_VERSION=" .env; then
        sed -i "s/APP_VERSION=.*/APP_VERSION=$NEW_VERSION/" .env
    else
        echo "APP_VERSION=$NEW_VERSION" >> .env
    fi
fi

log_success "✅ 生产环境更新完成!"
log_info "📊 更新摘要:"
log_info "  更新ID: $UPDATE_ID"
log_info "  新版本: $NEW_VERSION"
log_info "  备份路径: $BACKUP_PATH"
log_info "  日志文件: $LOG_FILE"

# 显示运行状态
log_info "📈 当前服务状态:"
$DC ps 2>&1 | tee -a "$LOG_FILE"

log_info "🎉 系统更新成功完成，服务正常运行！"
