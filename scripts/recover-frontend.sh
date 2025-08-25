#!/bin/bash

# SsalgTen 前端快速修复/重建脚本（低内存友好）
# 用途：在小内存 VPS 上一键构建前端镜像并启动，验证健康检查
# 默认项目目录：/opt/ssalgten，可通过 APP_DIR 覆盖

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/ssalgten}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
SWAP_SIZE_MB=${SWAP_SIZE_MB:-0}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC}   $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC}  $*"; }

choose_compose() {
  if docker compose version >/dev/null 2>&1; then echo docker compose; elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then echo docker-compose; else err "未找到可用的 Docker Compose（docker compose 或 docker-compose）"; exit 1; fi
}
COMPOSE=$(choose_compose)

if [[ -d "$APP_DIR" && -f "$APP_DIR/$COMPOSE_FILE" ]]; then cd "$APP_DIR"; else if [[ -f "$COMPOSE_FILE" ]]; then APP_DIR=$(pwd); else err "未找到 $APP_DIR/$COMPOSE_FILE"; exit 1; fi; fi

cleanup_swap() {
  if [[ -f /tmp/ssalgten_swapfile_frontend ]]; then sudo swapoff /tmp/ssalgten_swapfile_frontend 2>/dev/null || true; sudo rm -f /tmp/ssalgten_swapfile_frontend || true; log "临时 swap 已清理"; fi
}
trap cleanup_swap EXIT

log "检查系统资源..."
total_mem=$(free -m | awk 'NR==2{print $2}')
avail_mem=$(free -m | awk 'NR==2{print $7}')
has_swap=$(awk 'NR>1{print $1}' /proc/swaps 2>/dev/null | wc -l)
echo "  内存: ${avail_mem}MB 可用 / ${total_mem}MB 总计"
if [[ "$has_swap" -eq 0 && "$total_mem" -lt 1500 ]]; then
  if [[ "$SWAP_SIZE_MB" -le 0 ]]; then SWAP_SIZE_MB=$([[ "$total_mem" -lt 1000 && "$avail_mem" -lt 800 ]] && echo 2048 || echo 1024); fi
  warn "低内存环境，创建临时 swap (${SWAP_SIZE_MB}MB)"
  sudo fallocate -l ${SWAP_SIZE_MB}M /tmp/ssalgten_swapfile_frontend 2>/dev/null || sudo dd if=/dev/zero of=/tmp/ssalgten_swapfile_frontend bs=1M count=${SWAP_SIZE_MB}
  sudo chmod 600 /tmp/ssalgten_swapfile_frontend
  sudo mkswap /tmp/ssalgten_swapfile_frontend >/dev/null
  sudo swapon /tmp/ssalgten_swapfile_frontend
  ok "临时 swap 已启用"
else
  ok "swap 已存在或内存充足，跳过创建"
fi

# 更新仓库（若存在）
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then log "拉取最新代码..."; git pull || warn "git pull 失败，继续"; fi

log "单独构建前端镜像...（低内存更稳）"
$COMPOSE -f "$COMPOSE_FILE" build frontend
ok "前端镜像构建完成"

log "启动前端容器..."
$COMPOSE -f "$COMPOSE_FILE" up -d frontend
ok "前端容器已启动"

sleep 2
log "健康检查: http://127.0.0.1:${FRONTEND_PORT}/health"
if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/health" >/dev/null; then ok "前端健康检查通过"; else warn "前端健康检查失败，可稍后重试或查看日志"; fi

echo ""
ok "完成！常用命令："
echo "  查看容器      : $COMPOSE -f $COMPOSE_FILE ps"
echo "  前端日志      : $COMPOSE -f $COMPOSE_FILE logs -f frontend"
echo "  重建前端      : $COMPOSE -f $COMPOSE_FILE build frontend && $COMPOSE -f $COMPOSE_FILE up -d"
