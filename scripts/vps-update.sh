#!/usr/bin/env bash

# SsalgTen VPS Production Update Script
# 安全的一键VPS生产环境更新脚本

set -Eeuo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 错误处理
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "更新过程出现错误 (退出码: $exit_code)"
        log_error "可以使用以下命令查看详细日志："
        log_error "  docker logs ssalgten-backend"
        log_error "  docker logs ssalgten-frontend"
    fi
}

trap cleanup EXIT

# 默认配置
DEFAULT_PROJECT_DIR="/opt/ssalgten"
PROJECT_DIR="${1:-$DEFAULT_PROJECT_DIR}"
BACKUP_BEFORE_UPDATE="${BACKUP_BEFORE_UPDATE:-true}"

log_info "🚀 开始SsalgTen VPS生产环境更新"
log_info "📍 项目目录: $PROJECT_DIR"

# 1. 基础检查
log_info "🔍 执行基础环境检查..."

# 检查是否为root或有sudo权限
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    log_error "需要root权限或sudo权限才能执行更新"
    log_info "请使用: sudo bash $0"
    exit 1
fi

# 检查Docker是否运行
if ! docker info >/dev/null 2>&1; then
    log_error "Docker 服务未运行，尝试启动..."
    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl start docker
        sleep 5
        if ! docker info >/dev/null 2>&1; then
            log_error "Docker 启动失败，请手动检查"
            exit 1
        fi
    else
        log_error "无法启动Docker服务，请手动启动"
        exit 1
    fi
fi

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "项目目录不存在: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# 检查必要文件
for file in docker-compose.yml .env; do
    if [ ! -f "$file" ]; then
        log_error "缺少必要文件: $file"
        exit 1
    fi
done

# 2. Git安全目录配置和代码更新
log_info "📥 配置Git并更新代码..."

# 设置安全目录
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

# 检查Git状态
if ! git status >/dev/null 2>&1; then
    log_error "Git仓库状态异常，请检查"
    exit 1
fi

# 获取当前版本信息
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_info "当前版本: $CURRENT_COMMIT"

# 拉取最新代码
log_info "拉取最新代码..."
if ! git pull origin main; then
    log_error "代码拉取失败"
    exit 1
fi

# 获取最新版本信息
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_info "最新版本: $NEW_COMMIT"

# 检查是否有更新
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    log_success "✅ 代码已经是最新版本，无需更新"
    exit 0
fi

# 3. 创建备份（可选）
if [ "$BACKUP_BEFORE_UPDATE" = "true" ]; then
    log_info "💾 创建系统备份..."
    BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "./scripts/backup-db.sh" ]; then
        log_info "执行数据库备份..."
        if ! bash ./scripts/backup-db.sh "$BACKUP_ID"; then
            log_warn "数据库备份失败，但继续更新（风险自负）"
        else
            log_success "数据库备份完成: backup_$BACKUP_ID"
        fi
    else
        log_warn "备份脚本不存在，跳过备份"
    fi
fi

# 4. 处理脚本文件格式
log_info "🔧 处理脚本文件格式..."
UPDATE_SCRIPT="./scripts/update-production.sh"

if [ ! -f "$UPDATE_SCRIPT" ]; then
    log_error "生产更新脚本不存在: $UPDATE_SCRIPT"
    exit 1
fi

# 处理Windows行尾符
if command -v dos2unix >/dev/null 2>&1; then
    dos2unix "$UPDATE_SCRIPT" 2>/dev/null || true
else
    sed -i 's/\r$//' "$UPDATE_SCRIPT" 2>/dev/null || true
fi

# 确保脚本可执行
chmod +x "$UPDATE_SCRIPT"

# 5. 执行生产更新
log_info "🚀 开始执行生产环境更新..."
log_info "使用脚本: $UPDATE_SCRIPT"

# 设置环境变量供更新脚本使用
export PROJECT_DIR="$PROJECT_DIR"
export CURRENT_COMMIT="$CURRENT_COMMIT"
export NEW_COMMIT="$NEW_COMMIT"

# 执行更新脚本
if bash "$UPDATE_SCRIPT"; then
    log_success "🎉 系统更新完成！"
    log_info "新版本: $NEW_COMMIT"
else
    UPDATE_EXIT_CODE=$?
    log_error "更新脚本执行失败 (退出码: $UPDATE_EXIT_CODE)"
    
    # 如果有备份，提示回滚
    if [ "$BACKUP_BEFORE_UPDATE" = "true" ] && [ -n "${BACKUP_ID:-}" ]; then
        log_warn "可以使用以下命令回滚到备份："
        log_warn "  bash ./scripts/rollback.sh $BACKUP_ID"
    fi
    
    exit $UPDATE_EXIT_CODE
fi

# 6. 最终状态检查
log_info "🏥 执行最终健康检查..."

# 等待服务稳定
sleep 15

# 检查关键服务状态
SERVICES_OK=true

# 检查后端API
if curl -f -s "http://localhost:3001/api/health" >/dev/null 2>&1; then
    log_success "✅ 后端API健康"
else
    log_error "❌ 后端API不健康"
    SERVICES_OK=false
fi

# 检查前端
if curl -f -s "http://localhost:80/" >/dev/null 2>&1; then
    log_success "✅ 前端服务健康"
else
    log_error "❌ 前端服务不健康"  
    SERVICES_OK=false
fi

# 检查Updater服务
if curl -f -s "http://localhost:8765/health" >/dev/null 2>&1; then
    log_success "✅ 更新服务健康"
else
    log_warn "⚠️ 更新服务不健康（非关键）"
fi

if [ "$SERVICES_OK" = "false" ]; then
    log_error "❌ 部分关键服务不健康，请检查日志"
    log_info "查看日志命令："
    log_info "  docker logs ssalgten-backend"
    log_info "  docker logs ssalgten-frontend"
    exit 1
fi

# 7. 显示最终状态
log_success "✅ VPS系统更新成功完成！"
echo ""
log_info "📊 更新摘要:"
log_info "  旧版本: $CURRENT_COMMIT"
log_info "  新版本: $NEW_COMMIT"
if [ -n "${BACKUP_ID:-}" ]; then
    log_info "  备份ID: $BACKUP_ID"
fi
echo ""
log_info "🌐 服务状态:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ssalgten || echo "无SsalgTen容器运行"
echo ""
log_info "🎯 访问地址:"
log_info "  管理界面: http://your-domain/admin"
log_info "  前端界面: http://your-domain/"
log_info "  API健康: http://your-domain/api/health"

log_success "🚀 更新完成！系统已升级到最新版本。"