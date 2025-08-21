#!/bin/bash

# SsalgTen 前后端一键修复/重建脚本（低内存友好）
# 顺序：后端 → 前端，均采用分步构建与健康检查

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/ssalgten}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC}   $*"; }
err() { echo -e "${RED}[ERR]${NC}  $*"; }

cd "$APP_DIR" 2>/dev/null || { err "未找到 $APP_DIR"; exit 1; }

download() {
  local url="$1" dst="$2"
  curl -fsSL "$url" -o "$dst"
  chmod +x "$dst"
}

log "拉取最新脚本..."
download https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/recover-backend.sh ./recover-backend.sh
download https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/recover-frontend.sh ./recover-frontend.sh

log "后端修复/重建..."
APP_DIR="$APP_DIR" COMPOSE_FILE="$COMPOSE_FILE" BACKEND_PORT="$BACKEND_PORT" bash ./recover-backend.sh || err "后端修复失败"

log "前端修复/重建..."
APP_DIR="$APP_DIR" COMPOSE_FILE="$COMPOSE_FILE" FRONTEND_PORT="$FRONTEND_PORT" bash ./recover-frontend.sh || err "前端修复失败"

ok "全部完成"
echo "后端健康: http://127.0.0.1:${BACKEND_PORT}/api/health"
echo "前端健康: http://127.0.0.1:${FRONTEND_PORT}/health"

