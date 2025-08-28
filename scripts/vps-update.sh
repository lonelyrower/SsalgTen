#!/usr/bin/env bash

# SsalgTen VPS One-Click Update Script
# Robust git update that tolerates local changes and avoids merge prompts.

set -Eeuo pipefail

REPO_URL="https://github.com/lonelyrower/SsalgTen.git"
PROJECT_DIR="${PROJECT_DIR:-/opt/ssalgten}"

# Flags
FORCE_RESET=0       # discard local changes with git reset --hard && git clean -fd
AUTO_STASH=1        # stash local changes automatically before updating

usage() {
  cat <<EOF
Usage: vps-update.sh [options]

Options:
  --force-reset    Discard all local changes (git reset --hard && git clean -fd)
  --no-autostash   Do not attempt to stash local changes automatically
  --dir <path>     Project directory (default: /opt/ssalgten or env PROJECT_DIR)
  -h, --help       Show this help

Environment:
  PROJECT_DIR=/opt/ssalgten   Override project directory
EOF
}

log()   { echo -e "[INFO] $*"; }
warn()  { echo -e "[WARN] $*"; }
error() { echo -e "[ERROR] $*"; }

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-reset) FORCE_RESET=1; shift ;;
    --no-autostash) AUTO_STASH=0; shift ;;
    --dir) PROJECT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) warn "Unknown option: $1"; usage; exit 1 ;;
  esac
done

log "🚀 开始SsalgTen VPS生产环境更新"
log "📍 项目目录: $PROJECT_DIR"

command -v git >/dev/null 2>&1 || { error "缺少 git，请先安装: apt-get update && apt-get install -y git"; exit 1; }
command -v docker >/dev/null 2>&1 || warn "未检测到 docker（脚本后续会调用 docker compose 更新服务）"

mkdir -p "$PROJECT_DIR"

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  log "📥 未发现git仓库，正在克隆..."
  git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Avoid safe.directory issues under sudo/root
git config --global --add safe.directory "$PROJECT_DIR" >/dev/null 2>&1 || true

log "🔍 执行基础环境检查..."
git remote -v || { error "不是有效的git仓库，或远程不可用"; exit 1; }

# Show current commit before update
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log "当前版本: ${OLD_COMMIT}"

# Check working tree status
is_dirty() {
  # unstaged or staged changes
  if ! git diff --quiet || ! git diff --staged --quiet; then
    return 0
  fi
  # untracked files
  if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    return 0
  fi
  return 1
}

if is_dirty; then
  if [[ $FORCE_RESET -eq 1 ]]; then
    warn "检测到本地变更，按 --force-reset 丢弃本地改动"
    git reset --hard HEAD
    git clean -fd
  elif [[ $AUTO_STASH -eq 1 ]]; then
    warn "检测到本地变更，自动暂存（stash）后更新"
    git stash push -u -m "vps-update autostash $(date +%F_%T)" || true
  else
    error "工作区有本地改动。
如需丢弃本地改动并更新，请加参数: --force-reset
如需自动暂存本地改动后更新，请移除 --no-autostash"
    exit 1
  fi
fi

log "📥 配置Git并更新代码..."
git fetch origin --prune

# Reset to remote main to avoid merge prompts
git checkout -B main || true
git reset --hard origin/main

NEW_COMMIT=$(git rev-parse --short HEAD)
log "更新到版本: ${NEW_COMMIT} (原 ${OLD_COMMIT})"

# Ensure scripts are executable
chmod +x scripts/update-production.sh || true

log "🛠️ 执行生产更新脚本..."
if scripts/update-production.sh; then
  log "🎉 更新流程完成"
else
  error "更新脚本执行失败"
  exit 1
fi

