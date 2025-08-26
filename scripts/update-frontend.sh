#!/usr/bin/env bash

# SsalgTen Frontend Update Script
# - 支持自定义端口（项目/节点）并同步到 .env
# - 在重建前检查端口冲突并给出明确提示

set -Eeuo pipefail

echo "🔄 SsalgTen 前端更新脚本启动..."

# 确保在正确目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "📍 项目目录: $PROJECT_DIR"

# ------------------------------------------------------------
# 工具函数
# ------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

ensure_env_kv() {
  # ensure_env_kv KEY VALUE -> 在 .env 中设置/更新 KEY=VALUE（无引号）
  local key="$1"; shift
  local val="$1"; shift || true
  if [ ! -f .env ]; then
    echo "$key=$val" > .env
    return 0
  fi
  if grep -qE "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${val}#" .env
  else
    printf "\n%s=%s\n" "$key" "$val" >> .env
  fi
}

next_free_port() {
  # 从给定起点寻找可用端口；最多尝试 100 次
  local start="$1"
  local try="$start"
  for _ in $(seq 1 100); do
    if ! port_in_use "$try"; then
      echo "$try"
      return 0
    fi
    try=$((try+1))
  done
  # 兜底返回初始端口（由调用方决定是否继续）
  echo "$start"
  return 1
}

port_in_use() {
  local p="$1"
  if have ss; then
    ss -ltnp | awk '{print $4}' | grep -Eq "[:\.]${p}$"
  elif have lsof; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  elif have netstat; then
    netstat -tuln | awk '{print $4}' | grep -Eq "[:\.]${p}$"
  else
    return 1
  fi
}

kill_port_if_any() {
  local p="$1"
  if have lsof && sudo lsof -ti:"$p" >/dev/null 2>&1; then
    echo "⚠️  发现端口 ${p} 被占用，尝试清理..."
    sudo lsof -ti:"$p" | xargs -r sudo kill -9 2>/dev/null || true
    sleep 2
  fi
  if have fuser; then
    sudo fuser -k "${p}/tcp" 2>/dev/null || true
  fi
}

# ------------------------------------------------------------
# 读取并对齐端口配置
# - 支持通过环境变量传入：PROJECT_PORT/NODE_PORT/BACKEND_PORT/FRONTEND_PORT/AGENT_NYC_PORT/DB_PORT
# - 若传入 PROJECT_PORT 则写入 FRONTEND_PORT；传入 NODE_PORT 则写入 AGENT_NYC_PORT
# - 同步计算 VITE_API_BASE_URL（除非你已经显式设置）
# ------------------------------------------------------------
PROJECT_PORT_IN="${PROJECT_PORT:-}"
NODE_PORT_IN="${NODE_PORT:-}"
BACKEND_PORT_IN="${BACKEND_PORT:-}"
FRONTEND_PORT_IN="${FRONTEND_PORT:-}"
AGENT_PORT_IN="${AGENT_NYC_PORT:-}"
DB_PORT_IN="${DB_PORT:-}"

if [ -n "$PROJECT_PORT_IN" ]; then
  echo "🔧 使用 PROJECT_PORT=$PROJECT_PORT_IN -> FRONTEND_PORT"
  ensure_env_kv FRONTEND_PORT "$PROJECT_PORT_IN"
fi
if [ -n "$NODE_PORT_IN" ]; then
  echo "🔧 使用 NODE_PORT=$NODE_PORT_IN -> AGENT_NYC_PORT"
  ensure_env_kv AGENT_NYC_PORT "$NODE_PORT_IN"
fi
if [ -n "$BACKEND_PORT_IN" ]; then
  ensure_env_kv BACKEND_PORT "$BACKEND_PORT_IN"
fi
if [ -n "$FRONTEND_PORT_IN" ]; then
  ensure_env_kv FRONTEND_PORT "$FRONTEND_PORT_IN"
fi
if [ -n "$AGENT_PORT_IN" ]; then
  ensure_env_kv AGENT_NYC_PORT "$AGENT_PORT_IN"
fi
if [ -n "$DB_PORT_IN" ]; then
  ensure_env_kv DB_PORT "$DB_PORT_IN"
fi

# 加载 .env（导出为当前环境，供 docker compose 使用）
set -a
[ -f .env ] && . ./.env
set +a

# 默认端口（若 .env 未定义）
DB_PORT="${DB_PORT:-5432}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"
AGENT_NYC_PORT="${AGENT_NYC_PORT:-3002}"

# 根据后端端口更新 VITE_API_BASE_URL（如果未显式指定）
if ! grep -qE '^VITE_API_BASE_URL=' .env 2>/dev/null; then
  ensure_env_kv VITE_API_BASE_URL "http://localhost:${BACKEND_PORT}/api"
  export VITE_API_BASE_URL="http://localhost:${BACKEND_PORT}/api"
fi

echo "📦 使用端口: DB=${DB_PORT} BACKEND=${BACKEND_PORT} FRONTEND=${FRONTEND_PORT} NODE=${AGENT_NYC_PORT}"

# 停止可能冲突的系统 PostgreSQL 服务（仅当 DB_PORT=5432 时尝试）
if [ "$DB_PORT" = "5432" ]; then
  echo "⏹️  尝试停止系统 postgresql 服务以避免 5432 冲突..."
  sudo systemctl stop postgresql 2>/dev/null || true
  sudo systemctl disable postgresql 2>/dev/null || true
fi

# 清理数据库端口占用（按 DB_PORT）
echo "🔍 检查数据库端口 ${DB_PORT} 占用情况..."
kill_port_if_any "$DB_PORT"

# 强制清理 Docker 网络和容器
echo "🧹 清理 Docker 资源..."
if have docker && docker compose version >/dev/null 2>&1; then
  docker compose down -v --remove-orphans 2>/dev/null || true
elif have docker-compose; then
  docker-compose down -v --remove-orphans 2>/dev/null || true
else
  echo "❌ Docker Compose 未安装或不可用"
  exit 1
fi
docker system prune -f --volumes 2>/dev/null || true

# 构建前检查业务端口占用（前端/后端/节点）
echo "🔎 检查业务端口占用..."

# 前端端口占用 -> 自动选择下一个可用端口并写回 .env
if port_in_use "$FRONTEND_PORT"; then
  local_start=$FRONTEND_PORT
  # 若是 80 常见被 Nginx 占用，则从 3000 起找
  if [ "$FRONTEND_PORT" = "80" ]; then local_start=3000; fi
  free=$(next_free_port "$local_start")
  if [ "$free" != "$FRONTEND_PORT" ]; then
    echo "ℹ️  FRONTEND_PORT=$FRONTEND_PORT 被占用，改为 $free（已写入 .env）"
    FRONTEND_PORT="$free"
    ensure_env_kv FRONTEND_PORT "$FRONTEND_PORT"
  fi
fi

# 后端端口占用 -> 自动选择下一个可用端口并写回 .env，同时更新 VITE_API_BASE_URL
if port_in_use "$BACKEND_PORT"; then
  free=$(next_free_port "$BACKEND_PORT")
  if [ "$free" != "$BACKEND_PORT" ]; then
    echo "ℹ️  BACKEND_PORT=$BACKEND_PORT 被占用，改为 $free（已写入 .env）"
    BACKEND_PORT="$free"
    ensure_env_kv BACKEND_PORT "$BACKEND_PORT"
    ensure_env_kv VITE_API_BASE_URL "http://localhost:${BACKEND_PORT}/api"
    export VITE_API_BASE_URL="http://localhost:${BACKEND_PORT}/api"
  fi
fi

# 节点端口占用 -> 默认跳过 docker 内置 agent，避免与本机/外部节点冲突
SKIP_AGENT_NYC=false
if port_in_use "$AGENT_NYC_PORT"; then
  echo "ℹ️  检测到节点端口 $AGENT_NYC_PORT 已被占用，跳过 docker 内置节点(Agent)。"
  SKIP_AGENT_NYC=true
fi

# 拉取最新代码（通常在 git pull 之后调用，此处容错）
echo "📥 拉取最新代码..."
git pull --ff-only origin main || true

echo "🔨 重新构建前端容器..."
if have docker && docker compose version >/dev/null 2>&1; then
  docker compose build --no-cache frontend
else
  docker-compose build --no-cache frontend
fi

# 启动所有服务（如跳过 agent，则只启动 database/redis/backend/frontend）
echo "🚀 启动服务..."
if have docker && docker compose version >/dev/null 2>&1; then
  if [ "$SKIP_AGENT_NYC" = true ]; then
    docker compose up -d database redis backend frontend
  else
    docker compose up -d
  fi
else
  if [ "$SKIP_AGENT_NYC" = true ]; then
    docker-compose up -d database redis backend frontend
  else
    docker-compose up -d
  fi
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "✅ 检查服务状态..."
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E 'ssalgten' || echo "未找到 SsalgTen 容器"

# 动态健康检查
echo "----------------------------------------"
echo "🌐 检查前端服务..."
if curl -sf "http://localhost:${FRONTEND_PORT}/health" >/dev/null 2>&1 || curl -sf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
  echo "✅ 前端服务正常运行: http://localhost:${FRONTEND_PORT}"
else
  echo "❌ 前端服务可能未正常启动"
fi

echo "🔧 检查后端 API..."
if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  echo "✅ 后端 API 正常运行: http://localhost:${BACKEND_PORT}/api/health"
else
  echo "❌ 后端 API 可能未正常启动"
fi

echo "🛰️  检查节点(Agent)..."
if curl -sf "http://localhost:${AGENT_NYC_PORT}/api/health" >/dev/null 2>&1; then
  echo "✅ 节点正常运行: http://localhost:${AGENT_NYC_PORT}/api/health"
else
  echo "ℹ️  节点健康检查未通过（如果未启用该容器可忽略）"
fi

echo "----------------------------------------"
echo "🎉 更新完成！"
echo ""
echo "访问地址:"
echo "  前端:  http://localhost:${FRONTEND_PORT}"
echo "  后端:  http://localhost:${BACKEND_PORT}/api/health"
echo "  节点:  http://localhost:${AGENT_NYC_PORT}/api/health"
echo ""
echo "如有问题，请检查日志:"
echo "  docker logs ssalgten-frontend"
echo "  docker logs ssalgten-backend"
echo "  docker logs ssalgten-database"
