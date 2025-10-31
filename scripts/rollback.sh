#!/usr/bin/env bash

# SsalgTen Production Rollback Script
# - 快速回滚到上一个工作版本
# - 恢复数据库和配置
# - 验证回滚成功

set -Eeuo pipefail

# Docker Compose 命令兼容性检查
if command -v $DC >/dev/null 2>&1; then
    DC="$DC"
elif docker compose version >/dev/null 2>&1; then
    DC="docker compose"
else
    echo "错误: 未找到 $DC 或 docker compose 命令"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/.update/backups"
LOGS_DIR="${PROJECT_DIR}/.update/logs"

# 日志函数
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "SUCCESS" "$@"; }

# 使用方法
usage() {
    echo "使用方法: $0 <backup_id>"
    echo ""
    echo "回滚系统到指定的备份版本"
    echo ""
    echo "示例:"
    echo "  $0 20231201_143022"
    echo ""
    echo "可用的备份:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -1 "$BACKUP_DIR" | grep "^backup_" | sed 's/backup_/  /' || echo "  (无备份)"
    else
        echo "  (无备份目录)"
    fi
    exit 1
}

# 检查参数
if [ $# -eq 0 ]; then
    usage
fi

BACKUP_ID="$1"
BACKUP_PATH="${BACKUP_DIR}/backup_${BACKUP_ID}"

if [ ! -d "$BACKUP_PATH" ]; then
    log_error "备份不存在: $BACKUP_PATH"
    usage
fi

cd "$PROJECT_DIR"

log_info "🔄 开始回滚到备份: $BACKUP_ID"
log_info "📍 备份路径: $BACKUP_PATH"

# 确认回滚
read -p "⚠️  确定要回滚到 $BACKUP_ID 吗？这将覆盖当前系统状态 [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "回滚已取消"
    exit 0
fi

# 检查Docker
if ! docker info >/dev/null 2>&1; then
    log_error "Docker 服务未运行或无法访问"
    exit 1
fi

log_info "🛑 停止所有服务..."
$DC down || {
    log_warn "部分服务停止失败，继续执行..."
}

# 1. 恢复配置文件
log_info "📄 恢复配置文件..."
if [ -f "${BACKUP_PATH}/.env" ]; then
    cp "${BACKUP_PATH}/.env" .env
    log_success "恢复 .env 配置"
else
    log_warn ".env 备份文件不存在"
fi

if [ -f "${BACKUP_PATH}/$DC.yml" ]; then
    cp "${BACKUP_PATH}/$DC.yml" $DC.yml
    log_success "恢复 $DC.yml 配置"
else
    log_warn "$DC.yml 备份文件不存在"
fi

# 2. 恢复Git版本
log_info "📥 查找对应的Git版本..."
# 从备份目录名提取时间戳，尝试找到最接近的commit
BACKUP_TIME="${BACKUP_ID%_*}"  # 提取日期部分
BACKUP_DATE=$(date -d "${BACKUP_TIME:0:4}-${BACKUP_TIME:4:2}-${BACKUP_TIME:6:2}" +%s 2>/dev/null || echo "0")

if [ "$BACKUP_DATE" != "0" ]; then
    # 查找在备份时间之前的最新commit
    ROLLBACK_COMMIT=$(git log --before="@${BACKUP_DATE}" --format="%H" -1)
    if [ -n "$ROLLBACK_COMMIT" ]; then
        log_info "回滚到 Git commit: ${ROLLBACK_COMMIT:0:7}"
        git reset --hard "$ROLLBACK_COMMIT" || {
            log_error "Git回滚失败"
            exit 1
        }
    else
        log_warn "无法确定回滚的Git版本，跳过代码回滚"
    fi
else
    log_warn "无法解析备份时间，跳过Git回滚"
fi

# 3. 启动数据库服务
log_info "🗄️ 启动数据库服务..."
$DC up -d database || {
    log_error "数据库启动失败"
    exit 1
}

# 等待数据库就绪
log_info "等待数据库就绪..."
for i in {1..30}; do
    if $DC exec -T database pg_isready -U ssalgten >/dev/null 2>&1; then
        log_success "数据库已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "数据库启动超时"
        exit 1
    fi
    sleep 2
done

# 4. 恢复数据库
if [ -f "${BACKUP_PATH}/database.sql" ]; then
    log_info "💾 恢复数据库..."
    $DC exec -T database psql -U ssalgten -d ssalgten < "${BACKUP_PATH}/database.sql" || {
        log_error "数据库恢复失败"
        exit 1
    }
    log_success "数据库恢复完成"
else
    log_error "数据库备份文件不存在: ${BACKUP_PATH}/database.sql"
    exit 1
fi

# 5. 恢复数据卷（如果存在）
if [ -f "${BACKUP_PATH}/backend_data.tar.gz" ]; then
    log_info "📁 恢复后端数据卷..."
    docker run --rm -v ssalgten-backend-data:/data -v "$BACKUP_PATH":/backup alpine sh -c "cd /data && tar xzf /backup/backend_data.tar.gz" || {
        log_warn "后端数据卷恢复失败"
    }
fi

# 6. 重建和启动服务
log_info "🔨 重建并启动所有服务..."
$DC build --no-cache || {
    log_error "服务构建失败"
    exit 1
}

$DC up -d || {
    log_error "服务启动失败"
    exit 1
}

# 7. 健康检查
log_info "🏥 执行健康检查..."
sleep 15  # 等待服务完全启动

# 检查后端健康
API_URL="http://localhost:${BACKEND_PORT:-3001}/api/health"
HEALTH_CHECK_ATTEMPTS=0
MAX_HEALTH_ATTEMPTS=12

while [ $HEALTH_CHECK_ATTEMPTS -lt $MAX_HEALTH_ATTEMPTS ]; do
    if curl -f -s "$API_URL" >/dev/null 2>&1; then
        log_success "后端健康检查通过"
        break
    fi
    HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_ATTEMPTS + 1))
    log_info "等待后端服务... ($HEALTH_CHECK_ATTEMPTS/$MAX_HEALTH_ATTEMPTS)"
    sleep 5
done

if [ $HEALTH_CHECK_ATTEMPTS -eq $MAX_HEALTH_ATTEMPTS ]; then
    log_error "后端健康检查失败"
    exit 1
fi

# 检查前端健康
FRONTEND_URL="http://localhost:${FRONTEND_PORT:-80}/health"
if curl -f -s "$FRONTEND_URL" >/dev/null 2>&1; then
    log_success "前端健康检查通过"
else
    log_warn "前端健康检查失败，但系统可能仍然可用"
fi

# 8. 显示状态
log_info "📊 当前服务状态:"
$DC ps

log_success "✅ 回滚完成!"
log_info "📋 回滚摘要:"
log_info "  回滚到备份: $BACKUP_ID"
log_info "  备份路径: $BACKUP_PATH"
if [ -n "${ROLLBACK_COMMIT:-}" ]; then
    log_info "  Git版本: ${ROLLBACK_COMMIT:0:7}"
fi

log_info "🎉 系统已成功回滚并正常运行！"