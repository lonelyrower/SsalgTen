#!/bin/bash

# SsalgTen 后端快速修复/重建脚本（低内存友好）
# 用途：在小内存 VPS 上一键构建后端镜像、生成 Prisma 客户端、执行迁移并启动服务
# 默认项目目录：/opt/ssalgten，可通过 APP_DIR 环境变量覆盖

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/ssalgten}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
SWAP_SIZE_MB=${SWAP_SIZE_MB:-0}       # 0 表示自动选择（1~2GB）
BACKEND_PORT=${BACKEND_PORT:-3001}

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC}   $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC}  $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || { err "缺少命令：$1"; exit 1; }; }

# 选择 docker-compose 命令
choose_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo docker compose
  elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    echo docker-compose
  else
    err "未找到可用的 Docker Compose（docker compose 或 docker-compose）"
    exit 1
  fi
}

COMPOSE=$(choose_compose)

# 进入项目目录
if [[ -d "$APP_DIR" && -f "$APP_DIR/$COMPOSE_FILE" ]]; then
  cd "$APP_DIR"
else
  # 允许在当前目录运行
  if [[ -f "$COMPOSE_FILE" ]]; then
    APP_DIR=$(pwd)
  else
    err "未找到 $APP_DIR/$COMPOSE_FILE，也未在当前目录发现 $COMPOSE_FILE"
    exit 1
  fi
fi

# 资源检查与临时 swap
cleanup_swap() {
  if [[ -f /tmp/ssalgten_swapfile ]]; then
    sudo swapoff /tmp/ssalgten_swapfile 2>/dev/null || true
    sudo rm -f /tmp/ssalgten_swapfile 2>/dev/null || true
    log "临时 swap 已清理"
  fi
}
trap cleanup_swap EXIT

log "检查系统资源..."
total_mem=$(free -m | awk 'NR==2{print $2}')
avail_mem=$(free -m | awk 'NR==2{print $7}')
has_swap=$(awk 'NR>1{print $1}' /proc/swaps 2>/dev/null | wc -l)
echo "  内存: ${avail_mem}MB 可用 / ${total_mem}MB 总计"

if [[ "$has_swap" -eq 0 && "$total_mem" -lt 1500 ]]; then
  # 需要临时 swap
  if [[ "$SWAP_SIZE_MB" -le 0 ]]; then
    if [[ "$total_mem" -lt 1000 && "$avail_mem" -lt 800 ]]; then
      SWAP_SIZE_MB=2048
    else
      SWAP_SIZE_MB=1024
    fi
  fi
  warn "低内存环境，创建临时 swap (${SWAP_SIZE_MB}MB)" 
  sudo fallocate -l ${SWAP_SIZE_MB}M /tmp/ssalgten_swapfile 2>/dev/null || sudo dd if=/dev/zero of=/tmp/ssalgten_swapfile bs=1M count=${SWAP_SIZE_MB}
  sudo chmod 600 /tmp/ssalgten_swapfile
  sudo mkswap /tmp/ssalgten_swapfile >/dev/null
  sudo swapon /tmp/ssalgten_swapfile
  ok "临时 swap 已启用"
else
  ok "swap 已存在或内存充足，跳过创建"
fi

# 拉取最新代码（若是 git 仓库）
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "拉取最新代码..."
  git pull || warn "git pull 失败，继续"
fi

# 构建后端镜像（builder 先 prisma generate，再 tsc）
log "单独构建后端镜像...（低内存更稳）"
$COMPOSE -f "$COMPOSE_FILE" build backend
ok "后端镜像构建完成"

# Prisma generate（确保类型存在）
log "生成 Prisma 客户端类型..."
$COMPOSE -f "$COMPOSE_FILE" run --rm backend npx prisma generate
ok "Prisma 客户端已生成"

# 数据库迁移
log "执行数据库迁移..."
$COMPOSE -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy
ok "数据库迁移完成"

# 启动服务
log "启动服务..."
$COMPOSE -f "$COMPOSE_FILE" up -d
ok "容器已启动"

# 健康检查
sleep 2
log "健康检查: http://127.0.0.1:${BACKEND_PORT}/api/health"
if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null; then
  ok "后端健康检查通过"
else
  warn "后端健康检查失败，可稍后重试或查看日志"
fi

echo ""
ok "完成！常用命令："
echo "  查看容器      : $COMPOSE -f $COMPOSE_FILE ps"
echo "  查看后端日志  : $COMPOSE -f $COMPOSE_FILE logs -f backend"
echo "  重建后端      : $COMPOSE -f $COMPOSE_FILE build backend && $COMPOSE -f $COMPOSE_FILE up -d"
