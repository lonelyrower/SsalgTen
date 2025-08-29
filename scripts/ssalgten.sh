#!/usr/bin/env bash

# SsalgTen 系统管理工具
# 一键式管理：启动、停止、更新、备份等完整功能
# 支持交互式菜单和命令行子命令，可远程运行
#
# 安装方式: curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
# 或直接运行: curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash

set -euo pipefail
IFS=$'\n\t'

# 检测是否通过 curl|bash 运行 (用于自动安装)
detect_curl_bash_mode() {
    # 检测多种curl|bash运行模式的标志
    if [[ "${BASH_SOURCE[0]}" == "/dev/fd/"* ]] || 
       [[ "${BASH_SOURCE[0]}" == "/proc/self/fd/"* ]] ||
       [[ ! -f "${BASH_SOURCE[0]}" ]] ||
       [[ "${CURL_BASH_MODE:-}" == "true" ]]; then
        return 0  # 是curl|bash模式
    fi
    return 1  # 不是curl|bash模式
}

# curl|bash 安装处理器
handle_curl_bash_install() {
    echo "🚀 SsalgTen 管理脚本 - 远程安装模式"
    echo
    
    # 解析参数看是否要安装
    local should_install=false
    for arg in "$@"; do
        if [[ "$arg" == "--install" ]]; then
            should_install=true
            break
        fi
    done
    
    if [[ "$should_install" == "true" ]]; then
        # 自动安装模式
        log_info "检测到安装请求，开始安装..."
        self_update --install "$@"
        return $?
    else
        # 显示安装选项
        echo "选择操作:"
        echo "  1) 安装到系统 (推荐)"
        echo "  2) 临时运行 (不安装)"
        echo "  3) 退出"
        echo
        
        local choice
        read -p "请选择 [1-3]: " choice
        
        case "$choice" in
            1)
                log_info "开始安装..."
                self_update --install
                return $?
                ;;
            2)
                log_info "以临时模式继续..."
                # 继续正常执行脚本
                return 1  # 表示不退出，继续执行
                ;;
            3|*)
                log_info "安装已取消"
                exit 0
                ;;
        esac
    fi
}

# 版本信息
readonly SCRIPT_VERSION="2.0.0"
readonly SCRIPT_NAME="SsalgTen Manager"

# 全局变量
APP_DIR=""
COMPOSE_FILE=""
FORCE_MODE=false
NON_INTERACTIVE=false
VERBOSE=false

# 颜色定义（可通过环境变量禁用）
if [[ "${LOG_NO_COLOR:-}" == "true" ]] || [[ ! -t 1 ]]; then
    RED="" GREEN="" YELLOW="" BLUE="" CYAN="" PURPLE="" NC=""
else
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'  
    readonly YELLOW='\033[1;33m'
    readonly BLUE='\033[0;34m'
    readonly CYAN='\033[0;36m'
    readonly PURPLE='\033[0;35m'
    readonly NC='\033[0m'
fi

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_header() { echo -e "${CYAN}$*${NC}"; }

# 错误处理函数
die() { 
    log_error "$*"
    exit 1
}

cleanup_on_interrupt() {
    echo
    log_warning "操作被中断"
    exit 130
}

# 信号处理
trap cleanup_on_interrupt INT TERM

# 显示帮助信息
show_help() {
    cat << EOF
${CYAN}$SCRIPT_NAME v$SCRIPT_VERSION${NC}
🚀 一键式管理工具，让SsalgTen部署和维护变得简单

${PURPLE}使用方式:${NC}
  $(basename "$0") [选项] [子命令] [参数]

${PURPLE}全局选项:${NC}
  --dir PATH          指定应用目录 (默认自动检测)
  --compose-file FILE 指定compose文件路径 (支持优先级检测)
  --force, -y         强制模式，跳过确认提示
  --non-interactive   非交互模式 (适合CI/CD)
  --verbose, -v       详细输出 (显示调试信息)
  --help, -h          显示此帮助信息
  --version           显示版本信息

${PURPLE}系统管理命令:${NC}
  ${GREEN}start${NC}               🚀 启动系统服务 (带健康检查)
  ${GREEN}stop${NC}                🛑 停止系统服务 (带端口清理)
  ${GREEN}restart${NC}             🔄 重启系统服务 (stop + start)
  ${GREEN}status${NC}              📊 显示系统运行状态
  ${GREEN}update${NC}              ⚡ 更新系统代码并重启 (带备份)

${PURPLE}监控和调试命令:${NC}
  ${YELLOW}logs${NC} [OPTIONS] [SERVICE]  📋 查看服务日志
    -f, --follow        跟踪日志输出
    -n, --tail N        显示最后N行 (默认100)
    --since TIME        指定开始时间
    --timestamps        显示时间戳
    --help              logs命令详细帮助

  ${YELLOW}ps${NC}                  🐳 显示容器运行状态
  ${YELLOW}exec${NC} <service> <cmd> 💻 在容器中执行命令 (多重兜底)
  ${YELLOW}port-check${NC}          🔍 检查端口占用情况 (多工具支持)
  ${YELLOW}diagnose${NC}            🔧 生成系统诊断报告

${PURPLE}维护管理命令:${NC}  
  ${BLUE}backup${NC}              🗂️ 备份系统数据和配置
  ${BLUE}clean${NC} [LEVEL]       🧹 清理系统资源 (分级清理)
    --basic             仅清理项目相关 (推荐)
    --moderate          清理构建缓存
    --aggressive        系统级清理 (谨慎使用)
    --volumes           清理数据卷 (危险!)

  ${BLUE}self-update${NC} [OPTIONS] 🔄 更新脚本
    --install           安装到系统PATH
    --path PATH         自定义安装路径

${PURPLE}快捷使用示例:${NC}
  ${CYAN}# 基础操作${NC}
  $(basename "$0")                  # 交互式菜单 (新手推荐)
  $(basename "$0") start            # 一键启动系统
  $(basename "$0") status           # 快速查看状态
  
  ${CYAN}# 监控调试${NC}  
  $(basename "$0") logs backend -f  # 实时跟踪backend日志
  $(basename "$0") logs --tail 50   # 查看所有服务最近50行
  $(basename "$0") exec backend sh  # 进入backend容器shell
  
  ${CYAN}# 维护管理${NC}
  $(basename "$0") clean --basic    # 安全清理项目文件
  $(basename "$0") backup           # 备份重要数据
  $(basename "$0") update           # 更新到最新版本

${PURPLE}安装和更新:${NC}
  ${GREEN}# 一键安装 (推荐)${NC}
  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
  
  ${GREEN}# 或者临时运行${NC}  
  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash

${PURPLE}环境变量:${NC}
  LOG_NO_COLOR=true          禁用彩色输出 (CI友好)
  COMPOSE_PROJECT_NAME=name  设置项目名称 (默认ssalgten)
  FRONTEND_PORT_OVERRIDE=PORT 覆盖前端端口检测
  BACKEND_PORT_OVERRIDE=PORT  覆盖后端端口检测

${PURPLE}配置文件优先级:${NC}
  1. docker-compose.yml (标准部署)
  2. docker-compose.production.yml (生产环境)  
  3. docker-compose.https.yml (HTTPS部署)

💡 ${YELLOW}小贴士: 使用 '$(basename "$0") <命令> --help' 查看具体命令的详细帮助${NC}
EOF
}

# 检查命令是否存在
ensure_cmd() {
    local cmd="$1"
    local install_hint="${2:-}"
    
    if ! command -v "$cmd" &> /dev/null; then
        log_error "缺少必要的命令: $cmd"
        [[ -n "$install_hint" ]] && log_info "安装建议: $install_hint"
        return 1
    fi
}

# Docker Compose 兼容性检查和包装函数
docker_compose() {
    local base_args=()
    [[ -n "$COMPOSE_FILE" ]] && base_args+=(-f "$COMPOSE_FILE")
    local proj=(--project-name "${COMPOSE_PROJECT_NAME:-ssalgten}")
    
    if docker compose version &> /dev/null; then
        docker compose "${base_args[@]}" "${proj[@]}" "$@"
    elif command -v docker-compose &> /dev/null && docker-compose version &> /dev/null; then
        docker-compose "${base_args[@]}" "${proj[@]}" "$@"
    else
        die "未找到可用的 Docker Compose。请安装 Docker Compose v2 或 docker-compose v1"
    fi
}

# 检查Docker环境
check_docker_ready() {
    ensure_cmd docker "curl -fsSL https://get.docker.com | sh"
    
    if ! docker info &> /dev/null; then
        die "Docker daemon 未运行或无访问权限。请启动 Docker 服务或检查权限设置"
    fi
    
    # 测试 Docker Compose
    if ! docker_compose version &> /dev/null; then
        die "Docker Compose 不可用"
    fi
}

# 从终端读取输入（兼容管道输入）
read_from_tty() {
    local prompt="$1"
    local default="${2:-}"
    local response=""
    
    # 非交互模式或强制模式，使用默认值
    if [[ "$NON_INTERACTIVE" == "true" ]] || [[ "$FORCE_MODE" == "true" ]]; then
        echo "$default"
        return 0
    fi
    
    # 尝试从 /dev/tty 读取
    if [[ -r /dev/tty ]]; then
        echo -n "$prompt" > /dev/tty
        read -r response < /dev/tty
    else
        # 回退到标准输入
        echo -n "$prompt"
        read -r response
    fi
    
    # 如果为空，使用默认值
    echo "${response:-$default}"
}

# 确认对话框
confirm() {
    local question="$1"
    local default="${2:-N}"
    
    if [[ "$FORCE_MODE" == "true" ]]; then
        return 0
    fi
    
    local prompt="$question [y/N]: "
    [[ "$default" == "Y" ]] && prompt="$question [Y/n]: "
    
    local answer
    answer=$(read_from_tty "$prompt" "$default")
    
    case "${answer,,}" in
        y|yes) return 0 ;;
        *) return 1 ;;
    esac
}

# 自动检测应用目录
detect_app_dir() {
    # 1. 命令行参数或环境变量
    if [[ -n "$APP_DIR" ]]; then
        [[ -d "$APP_DIR" ]] || die "指定的应用目录不存在: $APP_DIR"
        return 0
    fi
    
    # 2. 脚本在仓库内运行
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local project_dir="$(dirname "$script_dir")"
    
    if [[ -f "$project_dir/docker-compose.yml" ]] || [[ -f "$project_dir/package.json" ]]; then
        APP_DIR="$project_dir"
        return 0
    fi
    
    # 3. 默认路径
    APP_DIR="/opt/ssalgten"
    if [[ ! -d "$APP_DIR" ]]; then
        die "找不到项目目录。请使用 --dir=PATH 指定应用目录，或确保脚本在项目根目录下运行"
    fi
}

# 检测 Compose 文件
detect_compose_file() {
    if [[ -n "$COMPOSE_FILE" ]]; then
        [[ -f "$COMPOSE_FILE" ]] || die "指定的Compose文件不存在: $COMPOSE_FILE"
        return 0
    fi
    
    cd "$APP_DIR"
    
    # 按优先级查找
    local compose_files=(
        "docker-compose.yml"
        "docker-compose.production.yml"
        "docker-compose.https.yml"
    )
    
    for file in "${compose_files[@]}"; do
        if [[ -f "$file" ]]; then
            COMPOSE_FILE="$APP_DIR/$file"
            export COMPOSE_FILE
            export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ssalgten}"
            return 0
        fi
    done
    
    die "未找到 Docker Compose 文件。请确保在正确的项目目录下运行"
}

# 增强健康检查
health_check() {
    local service="$1"
    local url="$2"
    local max_attempts="${3:-12}"  # 可配置尝试次数，默认12次
    local delay="${4:-3}"          # 可配置延迟间隔，默认3秒
    local timeout="${5:-10}"       # 可配置超时时间，默认10秒
    
    log_info "检查 $service 健康状态... (超时: ${timeout}s, 重试: ${max_attempts}次)"
    
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "第 $attempt 次健康检查: $url"
        fi
        
        # 使用 curl 带超时和静默检查
        if timeout "$timeout" curl -sf --connect-timeout 5 --max-time "$timeout" "$url" &> /dev/null; then
            log_success "✅ $service 健康检查通过 (第 $attempt 次尝试)"
            return 0
        fi
        
        # 检查容器是否正在运行
        local container_status
        container_status=$(docker_compose ps --services --filter "status=running" 2>/dev/null | grep -c "^${service}$" || echo "0")
        
        if [[ "$container_status" -eq 0 ]]; then
            log_error "❌ $service 容器未运行"
            if [[ "$VERBOSE" == "true" ]]; then
                log_info "显示 $service 容器状态:"
                docker_compose ps "$service" 2>/dev/null || true
            fi
            return 1
        fi
        
        if [[ $attempt -lt $max_attempts ]]; then
            if [[ "$VERBOSE" == "true" ]]; then
                log_warning "第 $attempt 次检查失败，${delay}s 后重试..."
            else
                printf "."  # 简洁进度指示
            fi
            sleep "$delay"
        fi
        
        ((attempt++))
    done
    
    echo  # 换行，结束进度指示
    log_warning "⚠️ $service 健康检查失败 (尝试 $max_attempts 次)"
    
    # 详细诊断信息
    if [[ "$VERBOSE" == "true" ]] || [[ "${FORCE_VERBOSE:-false}" == "true" ]]; then
        log_info "显示 $service 诊断信息:"
        echo "  容器状态:"
        docker_compose ps "$service" 2>/dev/null || echo "    无法获取容器状态"
        echo "  最近日志 (20行):"
        docker_compose logs --tail=20 "$service" 2>/dev/null || echo "    无法获取日志"
        echo "  网络检查:"
        curl -v --connect-timeout 3 --max-time 5 "$url" 2>&1 | head -10 || echo "    网络连接失败"
    else
        log_info "使用 --verbose 查看详细诊断信息，或运行 'logs $service' 查看日志"
    fi
    
    return 1
}

# 获取服务端口映射
get_port() {
    local service="$1"
    local container_port="$2"
    docker_compose port "$service" "$container_port" 2>/dev/null | sed -n 's/.*://p' | tail -1
}

# 探测动态端口
detect_ports() {
    # 尝试从运行中的服务获取端口，否则使用默认值
    FRONTEND_PORT="${FRONTEND_PORT_OVERRIDE:-$(get_port frontend 80)}"
    BACKEND_PORT="${BACKEND_PORT_OVERRIDE:-$(get_port backend 3001)}"
    AGENT_PORT="${AGENT_PORT_OVERRIDE:-$(get_port agent 3002)}"
    
    # 如果动态获取失败，使用默认值
    [[ -z "$FRONTEND_PORT" ]] && FRONTEND_PORT="${FRONTEND_PORT_OVERRIDE:-3000}"
    [[ -z "$BACKEND_PORT" ]] && BACKEND_PORT="${BACKEND_PORT_OVERRIDE:-3001}"
    [[ -z "$AGENT_PORT" ]] && AGENT_PORT="${AGENT_PORT_OVERRIDE:-3002}"
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检测到端口配置: Frontend($FRONTEND_PORT), Backend($BACKEND_PORT), Agent($AGENT_PORT)"
    fi
}

# 检查单个端口是否被占用 (用于脚本内部)
check_port_occupied() {
    local port="$1"
    
    # 优先使用 ss (更快、更现代)
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | awk -v port=":$port" '$4 ~ port' | grep -q .
        return $?
    fi
    
    # 回退到 lsof
    if command -v lsof &> /dev/null; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q .
        return $?
    fi
    
    # 最后回退到 netstat
    if command -v netstat &> /dev/null; then
        netstat -tln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    
    # 如果都没有，假设端口未占用
    return 1
}

# 获取占用端口的进程ID (用于清理)
get_port_pid() {
    local port="$1"
    
    # 优先使用 ss
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | awk -v port=":$port" '$4 ~ port' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
        return 0
    fi
    
    # 回退到 lsof
    if command -v lsof &> /dev/null; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1
        return 0
    fi
    
    # 最后回退到 netstat + ps (复杂但可用)
    if command -v netstat &> /dev/null && command -v ps &> /dev/null; then
        local line
        line=$(netstat -tlnp 2>/dev/null | grep ":$port " | head -1)
        if [[ -n "$line" ]]; then
            echo "$line" | awk '{print $7}' | cut -d'/' -f1
        fi
        return 0
    fi
    
    return 1
}

# 检查端口占用
port_check() {
    log_header "🔍 端口占用检查"
    
    # 动态获取端口列表
    detect_ports
    local ports=(80 443 "$FRONTEND_PORT" "$BACKEND_PORT" "$AGENT_PORT" 5432)
    local tool_found=false
    
    # 去重端口列表
    local unique_ports
    readarray -t unique_ports < <(printf '%s\n' "${ports[@]}" | sort -n | uniq)
    
    # 优先使用 ss
    if command -v ss &> /dev/null; then
        tool_found=true
        echo "使用 ss 检查端口占用:"
        for port in "${unique_ports[@]}"; do
            local result
            result=$(ss -tlnp | awk -v port=":$port" '$4 ~ port {print $0}' 2>/dev/null)
            if [[ -n "$result" ]]; then
                echo "端口 $port: 被占用"
                echo "$result"
            else
                echo "端口 $port: 空闲"
            fi
        done
    # 回退到 lsof  
    elif command -v lsof &> /dev/null; then
        tool_found=true
        echo "使用 lsof 检查端口占用:"
        for port in "${unique_ports[@]}"; do
            # 修复 lsof 语法，分别检查 TCP 和 UDP
            local tcp_result udp_result
            tcp_result=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)
            udp_result=$(lsof -nP -iUDP:"$port" 2>/dev/null)
            
            if [[ -n "$tcp_result" ]] || [[ -n "$udp_result" ]]; then
                echo "端口 $port: 被占用"
                [[ -n "$tcp_result" ]] && echo "$tcp_result" | head -5
                [[ -n "$udp_result" ]] && echo "$udp_result" | head -5
            else
                echo "端口 $port: 空闲"
            fi
        done
    # 最后的兜底方案：使用 netstat
    elif command -v netstat &> /dev/null; then
        tool_found=true
        echo "使用 netstat 检查端口占用:"
        for port in "${unique_ports[@]}"; do
            local result
            result=$(netstat -tlnp 2>/dev/null | grep ":$port " || netstat -tln 2>/dev/null | grep ":$port ")
            if [[ -n "$result" ]]; then
                echo "端口 $port: 被占用"
                echo "$result"
            else
                echo "端口 $port: 空闲"
            fi
        done
    fi
    
    if [[ "$tool_found" == "false" ]]; then
        log_warning "未找到端口检查工具 (ss/lsof/netstat)"
        log_info "手动检查: curl -f http://localhost:PORT 测试端口连通性"
    fi
}

# 系统状态
system_status() {
    log_header "📊 系统状态"
    
    check_docker_ready
    cd "$APP_DIR"
    # 动态检测端口，避免硬编码
    detect_ports
    
    echo
    echo "=== Docker 容器状态 ==="
    docker_compose ps
    
    echo
    echo "=== 服务健康检查 ==="
    local backend_healthy=false
    local frontend_healthy=false
    
    if curl -sf "http://localhost:${BACKEND_PORT:-3001}/api/health" &> /dev/null; then
        echo -e "Backend API: ${GREEN}✓ 正常${NC}"
        backend_healthy=true
    else
        echo -e "Backend API: ${RED}✗ 异常${NC}"
    fi
    
    if curl -sf "http://localhost:${FRONTEND_PORT:-3000}/" &> /dev/null; then
        echo -e "Frontend: ${GREEN}✓ 正常${NC}"
        frontend_healthy=true
    else
        echo -e "Frontend: ${RED}✗ 异常${NC}"
    fi
    
    echo
    echo "=== 系统资源 ==="
    echo "磁盘使用: $(df -h "$APP_DIR" | tail -1 | awk '{print $5 " (" $3 "/" $2 ")"}')"
    echo "系统负载: $(uptime | sed 's/.*load average: //')"
    
    echo
    if [[ "$backend_healthy" == "true" && "$frontend_healthy" == "true" ]]; then
        log_success "系统运行正常"
        echo -e "${GREEN}Frontend: http://localhost:${FRONTEND_PORT:-3000}${NC}"
        echo -e "${GREEN}Backend API: http://localhost:${BACKEND_PORT:-3001}${NC}"
    else
        log_warning "部分服务异常，请检查日志"
    fi
}

# 启动系统
start_system() {
    log_header "🚀 启动系统"
    
    check_docker_ready
    cd "$APP_DIR"
    
    log_info "启动所有服务..."
    if docker_compose up -d --remove-orphans; then
        log_info "等待服务启动..."
        sleep 10
        
        # 动态检测端口
        detect_ports
        
        # 健康检查 (backend: 更多重试, frontend: 更快检查)
        local healthy=true
        FORCE_VERBOSE=true health_check "backend" "http://localhost:${BACKEND_PORT}/api/health" 15 2 8 || healthy=false
        health_check "frontend" "http://localhost:${FRONTEND_PORT}/" 8 2 5 || healthy=false
        
        if [[ "$healthy" == "true" ]]; then
            log_success "🎉 系统启动成功!"
            echo -e "${GREEN}访问地址: http://localhost:${FRONTEND_PORT}${NC}"
        else
            log_warning "系统已启动，但部分服务可能异常"
            log_info "使用 'logs' 命令查看详细日志"
        fi
    else
        die "系统启动失败"
    fi
}

# 停止系统
stop_system() {
    log_header "🛑 停止系统"
    
    check_docker_ready
    cd "$APP_DIR"
    
    log_info "优雅停止所有服务..."
    if docker_compose down --remove-orphans; then
        log_info "检查端口释放..."
        
        # 动态获取端口列表
        detect_ports
        local ports_to_check=("$FRONTEND_PORT" "$BACKEND_PORT" "$AGENT_PORT" 5432)
        local occupied_ports=()
        local port_processes=()
        
        # 使用新的端口检查函数
        for port in "${ports_to_check[@]}"; do
            if check_port_occupied "$port"; then
                occupied_ports+=("$port")
                local pid
                pid=$(get_port_pid "$port")
                [[ -n "$pid" ]] && port_processes+=("$port:$pid") || port_processes+=("$port:unknown")
            fi
        done
        
        if [[ ${#occupied_ports[@]} -gt 0 ]]; then
            log_warning "发现未释放的端口: ${occupied_ports[*]}"
            
            # 显示详细的进程信息
            if [[ "$VERBOSE" == "true" ]]; then
                echo "占用详情:"
                for info in "${port_processes[@]}"; do
                    local port="${info%:*}"
                    local pid="${info#*:}"
                    echo "  端口 $port: 进程 $pid"
                    if [[ "$pid" != "unknown" ]] && command -v ps &> /dev/null; then
                        ps -p "$pid" -o pid,ppid,cmd 2>/dev/null | tail -n +2 | sed 's/^/    /' || true
                    fi
                done
                echo
            fi
            
            if confirm "是否强制终止占用这些端口的进程?" "N"; then
                local killed_count=0
                for info in "${port_processes[@]}"; do
                    local port="${info%:*}"
                    local pid="${info#*:}"
                    
                    if [[ "$pid" != "unknown" ]]; then
                        if kill -9 "$pid" 2>/dev/null; then
                            log_info "已终止端口 $port 的进程 $pid"
                            ((killed_count++))
                        else
                            log_warning "无法终止端口 $port 的进程 $pid (可能无权限或已退出)"
                        fi
                    else
                        log_warning "端口 $port 的进程ID未知，跳过"
                    fi
                done
                
                if [[ $killed_count -gt 0 ]]; then
                    log_success "已清理 $killed_count 个残留进程"
                    sleep 1  # 等待进程完全退出
                fi
            fi
        else
            log_info "✅ 所有端口已正确释放"
        fi
        
        log_success "✅ 系统已停止"
    else
        die "系统停止失败"
    fi
}

# 重启系统  
restart_system() {
    log_header "🔄 重启系统"
    
    log_info "正在停止系统..."
    cd "$APP_DIR"
    docker_compose down --remove-orphans &> /dev/null
    sleep 3
    
    log_info "正在启动系统..."
    start_system
}

# 查看日志
# 增强的日志查看器
view_logs() {
    local service=""
    local follow=false
    local tail_lines="100"
    local since=""
    local until=""
    local timestamps=false
    local no_color=false
    local details=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--follow)
                follow=true
                shift
                ;;
            -n|--tail)
                tail_lines="$2"
                shift 2
                ;;
            --since)
                since="$2"
                shift 2
                ;;
            --until)
                until="$2"
                shift 2
                ;;
            -t|--timestamps)
                timestamps=true
                shift
                ;;
            --no-color)
                no_color=true
                shift
                ;;
            --details)
                details=true
                shift
                ;;
            --help)
                echo "使用方法: logs [OPTIONS] [SERVICE]"
                echo
                echo "选项:"
                echo "  -f, --follow       跟踪日志输出"
                echo "  -n, --tail N       显示最后N行 (默认: 100)"
                echo "  --since TIME       显示指定时间后的日志 (如: 2021-01-01T00:00:00)"
                echo "  --until TIME       显示指定时间前的日志"
                echo "  -t, --timestamps   显示时间戳"
                echo "  --no-color         禁用颜色输出"
                echo "  --details          显示详细信息"
                echo "  --help             显示帮助"
                echo
                echo "示例:"
                echo "  logs backend -f              # 跟踪backend服务日志"
                echo "  logs --tail 50               # 显示所有服务最后50行"
                echo "  logs --since '1h'            # 显示1小时内的日志"
                echo "  logs frontend --details      # 详细模式显示frontend日志"
                return 0
                ;;
            *)
                if [[ -z "$service" ]] && [[ "$1" != -* ]]; then
                    service="$1"
                fi
                shift
                ;;
        esac
    done
    
    check_docker_ready
    cd "$APP_DIR"
    
    # 验证服务名称
    if [[ -n "$service" ]]; then
        if ! docker_compose config --services 2>/dev/null | grep -q "^${service}$"; then
            log_error "服务 '$service' 未在 compose 文件中定义"
            echo "可用服务:"
            docker_compose config --services 2>/dev/null | sed 's/^/  - /' || echo "  (无法获取服务列表)"
            return 1
        fi
        log_header "📋 $service 服务日志"
    else
        log_header "📋 系统日志 (所有服务)"
    fi
    
    # 显示当前参数配置
    if [[ "$details" == "true" ]]; then
        echo "日志参数:"
        [[ -n "$service" ]] && echo "  服务: $service" || echo "  服务: 全部"
        echo "  跟踪: $([[ "$follow" == "true" ]] && echo "是" || echo "否")"
        echo "  行数: $tail_lines"
        [[ -n "$since" ]] && echo "  开始时间: $since"
        [[ -n "$until" ]] && echo "  结束时间: $until"
        echo "  时间戳: $([[ "$timestamps" == "true" ]] && echo "是" || echo "否")"
        echo
    fi
    
    # 构建docker-compose logs命令
    local cmd_args=(logs)
    
    # 添加参数
    [[ "$follow" == "true" ]] && cmd_args+=(--follow)
    [[ "$timestamps" == "true" ]] && cmd_args+=(--timestamps)
    [[ "$no_color" == "true" ]] && cmd_args+=(--no-color)
    [[ -n "$tail_lines" ]] && cmd_args+=(--tail="$tail_lines")
    [[ -n "$since" ]] && cmd_args+=(--since="$since")
    [[ -n "$until" ]] && cmd_args+=(--until="$until")
    
    # 添加服务名
    [[ -n "$service" ]] && cmd_args+=("$service")
    
    # 显示即将执行的命令 (详细模式)
    if [[ "$details" == "true" ]]; then
        log_info "执行命令: docker-compose ${cmd_args[*]}"
        echo
    fi
    
    # 添加友好的快捷键提示
    if [[ "$follow" == "true" ]]; then
        echo "💡 提示: 按 Ctrl+C 停止跟踪日志"
        echo
    fi
    
    # 执行日志命令，捕获可能的错误
    if ! docker_compose "${cmd_args[@]}" 2>/dev/null; then
        local exit_code=$?
        
        # 常见错误处理
        case $exit_code in
            1)
                log_warning "日志命令执行出错"
                ;;
            125)
                log_error "Docker Compose 命令错误"
                if [[ "$details" == "true" ]]; then
                    echo "可能的原因:"
                    echo "  - 服务未运行"
                    echo "  - 时间格式不正确"
                    echo "  - 参数不支持"
                fi
                ;;
            *)
                log_error "未知错误 (退出码: $exit_code)"
                ;;
        esac
        
        # 提供兜底方案
        if [[ -n "$service" ]]; then
            echo
            log_info "尝试基础日志查看..."
            if docker_compose logs --tail=20 "$service" 2>/dev/null; then
                return 0
            else
                log_error "无法获取 $service 日志，请检查服务状态"
                docker_compose ps "$service" 2>/dev/null || true
            fi
        fi
        
        return $exit_code
    fi
}

# 增强的容器命令执行 (带兜底机制)
exec_in_container() {
    local service="$1"
    shift
    local cmd=("$@")
    
    [[ -z "$service" ]] && die "使用: exec <service> <command...>"
    [[ ${#cmd[@]} -eq 0 ]] && cmd=("sh")  # 默认命令
    
    check_docker_ready  
    cd "$APP_DIR"
    
    log_info "在 $service 容器中执行命令: ${cmd[*]}"
    
    # 增强的服务检查和兜底机制
    local container_id=""
    local service_status=""
    
    # 1. 首先检查服务是否在compose文件中定义
    if ! docker_compose config --services 2>/dev/null | grep -q "^${service}$"; then
        log_warning "服务 '$service' 未在 compose 文件中定义"
        echo "可用服务:"
        docker_compose config --services 2>/dev/null | sed 's/^/  - /' || echo "  (无法获取服务列表)"
        return 1
    fi
    
    # 2. 检查服务状态并获取容器ID
    service_status=$(docker_compose ps --format "table" "$service" 2>/dev/null | tail -n +2)
    container_id=$(docker_compose ps -q "$service" 2>/dev/null | head -1)
    
    if [[ -z "$container_id" ]]; then
        log_warning "服务 '$service' 无运行中的容器"
        
        echo "尝试修复选项:"
        echo "  1) 启动服务"
        echo "  2) 查看服务状态"
        echo "  3) 取消操作"
        echo
        
        local choice
        read_from_tty "请选择 [1/2/3]:" choice
        
        case "$choice" in
            1)
                log_info "启动 $service 服务..."
                if docker_compose up -d "$service"; then
                    sleep 3
                    container_id=$(docker_compose ps -q "$service" 2>/dev/null | head -1)
                    if [[ -z "$container_id" ]]; then
                        log_error "$service 启动后仍无法找到容器"
                        return 1
                    fi
                    log_success "$service 已启动"
                else
                    log_error "$service 启动失败"
                    return 1
                fi
                ;;
            2)
                log_info "$service 服务状态:"
                docker_compose ps "$service" 2>/dev/null || echo "  无法获取状态"
                docker_compose logs --tail=10 "$service" 2>/dev/null || echo "  无法获取日志"
                return 1
                ;;
            3|*)
                log_info "操作已取消"
                return 0
                ;;
        esac
    fi
    
    # 3. 多种兜底执行方式
    local exec_flags=(-T)
    local exec_success=false
    
    # 检测交互模式
    if [[ -t 0 ]] && [[ -t 1 ]]; then
        exec_flags=(-it)
    fi
    
    # 方式1: 使用 docker-compose exec
    if ! exec_success; then
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "尝试方式1: docker-compose exec"
        fi
        
        if docker_compose exec "${exec_flags[@]}" "$service" "${cmd[@]}" 2>/dev/null; then
            exec_success=true
        elif [[ "$?" -eq 126 ]]; then
            log_warning "命令 '${cmd[0]}' 在容器中不存在"
        elif [[ "$?" -eq 125 ]]; then
            log_warning "容器运行时错误"
        fi
    fi
    
    # 方式2: 直接使用 docker exec (绕过compose)
    if ! exec_success && [[ -n "$container_id" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "尝试方式2: docker exec (容器ID: ${container_id:0:12})"
        fi
        
        local docker_flags=()
        [[ "${exec_flags[*]}" =~ -i ]] && docker_flags+=(-i)
        [[ "${exec_flags[*]}" =~ -t ]] && docker_flags+=(-t)
        
        if docker exec "${docker_flags[@]}" "$container_id" "${cmd[@]}" 2>/dev/null; then
            exec_success=true
        fi
    fi
    
    # 方式3: 使用常见的shell作为兜底
    if ! exec_success && [[ -n "$container_id" ]] && [[ ${#cmd[@]} -gt 1 ]] || [[ "${cmd[0]}" != "sh" && "${cmd[0]}" != "bash" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "尝试方式3: 使用 sh 兜底执行"
        fi
        
        local shell_cmd
        if [[ ${#cmd[@]} -eq 1 ]]; then
            shell_cmd=("sh" "-c" "${cmd[0]}")
        else
            # 将多个参数合并为单个命令字符串
            shell_cmd=("sh" "-c" "${cmd[*]}")
        fi
        
        if docker exec "${exec_flags[@]}" "$container_id" "${shell_cmd[@]}" 2>/dev/null; then
            exec_success=true
        fi
    fi
    
    # 方式4: 尝试不同的shell (bash, ash, etc.)
    if ! exec_success && [[ -n "$container_id" ]] && [[ "${cmd[0]}" == "sh" ]]; then
        for shell in bash ash; do
            if [[ "$VERBOSE" == "true" ]]; then
                log_info "尝试方式4: $shell shell"
            fi
            
            if docker exec "${exec_flags[@]}" "$container_id" "$shell" 2>/dev/null; then
                exec_success=true
                break
            fi
        done
    fi
    
    # 如果所有方法都失败
    if ! exec_success; then
        log_error "所有执行方式均失败"
        
        if [[ "$VERBOSE" == "true" ]] || [[ "${FORCE_VERBOSE:-false}" == "true" ]]; then
            echo "诊断信息:"
            echo "  容器状态:"
            docker inspect "$container_id" --format="{{.State.Status}}" 2>/dev/null || echo "    无法获取状态"
            echo "  容器镜像:"
            docker inspect "$container_id" --format="{{.Config.Image}}" 2>/dev/null || echo "    无法获取镜像"
            echo "  可用shell:"
            docker exec "$container_id" sh -c "ls -la /bin/*sh 2>/dev/null || echo '无法列出shells'" 2>/dev/null || echo "    无法检查"
        fi
        
        return 1
    fi
    
    return 0
}

# 更新系统
update_system() {
    log_header "⚡ 更新系统"
    
    cd "$APP_DIR"
    
    # 检查 Git 状态
    if ! git rev-parse --git-dir &> /dev/null; then
        die "当前目录不是Git仓库"
    fi
    
    # 检查未提交的更改
    local has_staged_changes=false
    local has_unstaged_changes=false
    local stash_created=false
    local stash_hash=""
    
    if ! git diff --cached --quiet 2>/dev/null; then
        has_staged_changes=true
    fi
    
    if ! git diff --quiet 2>/dev/null; then
        has_unstaged_changes=true
    fi
    
    if [[ "$has_staged_changes" == "true" ]] || [[ "$has_unstaged_changes" == "true" ]]; then
        log_warning "发现未提交的更改:"
        echo "  已暂存的更改:"
        git diff --cached --stat 2>/dev/null | head -10 || echo "    (无)"
        echo "  未暂存的更改:"
        git diff --stat 2>/dev/null | head -10 || echo "    (无)"
        echo
        
        echo "更新选项:"
        echo "  1) 暂存更改并继续更新 (推荐)"
        echo "  2) 放弃所有更改并继续"
        echo "  3) 取消更新"
        echo
        
        local choice
        read_from_tty "请选择 [1/2/3]:" choice
        
        case "$choice" in
            1)
                log_info "暂存本地更改..."
                local stash_msg="Auto-stash before update at $(date +'%Y-%m-%d %H:%M:%S')"
                if git stash push -m "$stash_msg" -u; then
                    stash_created=true
                    stash_hash=$(git rev-parse stash@{0} 2>/dev/null || echo "unknown")
                    log_success "更改已暂存 (stash: ${stash_hash:0:7})"
                    log_info "更新完成后，可使用以下命令恢复更改:"
                    echo "    git stash pop  # 应用最新的stash"
                    echo "    git stash list # 查看所有stash"
                    echo
                else
                    log_error "暂存失败"
                    return 1
                fi
                ;;
            2)
                if confirm "确认放弃所有未提交更改?" "N"; then
                    log_warning "重置工作区..."
                    git reset --hard HEAD
                    git clean -fd
                    log_info "所有本地更改已放弃"
                else
                    log_info "更新已取消"
                    return 0
                fi
                ;;
            3|*)
                log_info "更新已取消"
                return 0
                ;;
        esac
    fi
    
    if ! confirm "确认更新系统? (将停止→更新→重启)" "Y"; then
        log_info "更新已取消"
        return 0
    fi
    
    # 停止服务
    log_info "停止服务..."
    docker_compose down --remove-orphans &> /dev/null || true
    
    # 拉取代码
    log_info "拉取最新代码..."
    if git fetch && git pull --rebase origin main; then
        log_success "代码更新完成"
        local new_version
        new_version=$(git rev-parse --short HEAD)
        log_info "新版本: $new_version"
    else
        log_error "代码更新失败"
        return 1
    fi
    
    # 重新构建并启动
    log_info "重新构建并启动服务..."
    if docker_compose up -d --build --remove-orphans; then
        sleep 15
        
        # 动态检测端口
        detect_ports
        
        # 健康检查 (更新后需要更长时间启动)
        local healthy=true
        FORCE_VERBOSE=true health_check "backend" "http://localhost:${BACKEND_PORT}/api/health" 20 3 10 || healthy=false
        health_check "frontend" "http://localhost:${FRONTEND_PORT}/" 12 3 8 || healthy=false
        
        if [[ "$healthy" == "true" ]]; then
            log_success "🎉 系统更新完成!"
            
            # 处理 stash 恢复
            if [[ "$stash_created" == "true" ]]; then
                echo
                log_info "检测到已暂存的更改 (${stash_hash:0:7})"
                echo "恢复选项:"
                echo "  1) 立即恢复更改 (可能有冲突)"
                echo "  2) 手动恢复 (稍后执行 git stash pop)"
                echo "  3) 放弃暂存的更改"
                echo
                
                local stash_choice
                read_from_tty "请选择 [1/2/3]:" stash_choice
                
                case "$stash_choice" in
                    1)
                        log_info "尝试恢复暂存的更改..."
                        if git stash pop; then
                            log_success "更改已成功恢复"
                        else
                            log_warning "恢复时出现冲突，请手动解决"
                            echo "解决冲突后运行:"
                            echo "  git add <resolved-files>"
                            echo "  git reset --soft HEAD~1  # 如需撤销merge"
                        fi
                        ;;
                    2)
                        log_info "更改仍在stash中，稍后可运行:"
                        echo "  git stash pop    # 恢复并删除stash"
                        echo "  git stash apply  # 恢复但保留stash"
                        echo "  git stash list   # 查看所有stash"
                        ;;
                    3)
                        if confirm "确认放弃暂存的更改?" "N"; then
                            git stash drop stash@{0} 2>/dev/null
                            log_info "暂存的更改已放弃"
                        else
                            log_info "暂存保留在 stash@{0}"
                        fi
                        ;;
                    *)
                        log_info "暂存的更改保留在 stash@{0}，稍后可手动处理"
                        ;;
                esac
            fi
            
        else
            log_warning "更新完成，但部分服务可能异常"
            
            # 如果有 stash，在更新失败时提醒用户
            if [[ "$stash_created" == "true" ]]; then
                log_info "注意: 你的更改仍暂存在 stash@{0} (${stash_hash:0:7})"
                echo "可使用 'git stash pop' 恢复"
            fi
        fi
    else
        log_error "服务启动失败"
        
        # 如果启动失败且有 stash，询问是否回滚
        if [[ "$stash_created" == "true" ]]; then
            echo
            log_warning "更新可能导致服务异常"
            if confirm "是否恢复之前的更改并回滚?" "N"; then
                log_info "回滚到更新前状态..."
                git reset --hard HEAD~1 2>/dev/null || true
                git stash pop 2>/dev/null || true
                log_info "已尝试回滚，建议重新启动服务"
            else
                log_info "你的更改仍在 stash@{0} (${stash_hash:0:7})"
            fi
        fi
        
        log_info "建议: 运行 'logs' 查看错误日志，或运行 'clean --docker-cache' 清理后重试"
        return 1
    fi
}

# 备份数据
backup_data() {
    log_header "🗂️ 数据备份"
    
    cd "$APP_DIR"
    local backup_dir=".backup/manual_$(date +%Y%m%d_%H%M%S)"
    
    log_info "创建备份目录: $backup_dir"
    mkdir -p "$backup_dir"
    
    # 备份配置文件
    log_info "备份配置文件..."
    for file in .env docker-compose.yml docker-compose.*.yml; do
        [[ -f "$file" ]] && cp "$file" "$backup_dir/" && log_success "✓ 备份 $file"
    done
    
    # 备份数据库
    if docker_compose ps --services --filter "status=running" | grep -q database; then
        log_info "备份数据库..."
        if docker_compose exec -T database pg_dump -U ssalgten -d ssalgten --clean --if-exists > "$backup_dir/database.sql" 2>/dev/null; then
            log_success "✓ 数据库备份完成"
        else
            log_warning "数据库备份失败"
        fi
    else
        log_info "数据库服务未运行，跳过数据库备份"
    fi
    
    log_success "备份完成: $backup_dir"
    ls -la "$backup_dir"
}

# 分级清理系统
clean_system() {
    local clean_level="basic"
    local clean_volumes=false
    local force_clean=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --level)
                clean_level="$2"
                shift 2
                ;;
            --basic)
                clean_level="basic"
                shift
                ;;
            --moderate)
                clean_level="moderate"
                shift
                ;;
            --aggressive)
                clean_level="aggressive"
                shift
                ;;
            --with-volumes|--volumes)
                clean_volumes=true
                shift
                ;;
            --force)
                force_clean=true
                shift
                ;;
            --docker-cache)
                # 向后兼容
                clean_level="moderate"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_header "🧹 分级系统清理"
    
    # 显示清理级别和内容
    echo "清理级别: $clean_level"
    echo
    
    case "$clean_level" in
        basic)
            echo "基础清理 (推荐) - 影响范围: 仅当前项目"
            echo "  ✓ 项目相关的悬挂镜像"
            echo "  ✓ 项目容器日志 (保留最近100行)"
            echo "  ✓ 临时文件和旧的更新日志"
            ;;
        moderate)
            echo "中等清理 - 影响范围: Docker 构建缓存"
            echo "  ✓ 基础清理的所有内容"
            echo "  ✓ Docker 构建缓存"
            echo "  ✓ 未使用的网络"
            echo "  ⚠️ 可能影响其他项目的构建速度"
            ;;
        aggressive)
            echo "激进清理 - 影响范围: 系统范围 Docker 资源"
            echo "  ✓ 中等清理的所有内容"
            echo "  ⚠️ 所有悬挂镜像 (非仅项目相关)"
            echo "  ⚠️ 未使用的镜像"
            echo "  ⚠️ 可能影响其他 Docker 项目"
            ;;
        *)
            log_error "未知清理级别: $clean_level"
            log_info "支持的级别: basic, moderate, aggressive"
            return 1
            ;;
    esac
    
    [[ "$clean_volumes" == "true" ]] && echo "  🔴 数据卷 (会删除所有数据!)"
    echo
    
    # 确认清理操作
    if [[ "$force_clean" != "true" ]]; then
        local default_answer="Y"
        [[ "$clean_level" == "aggressive" ]] || [[ "$clean_volumes" == "true" ]] && default_answer="N"
        
        if ! confirm "确认执行 $clean_level 级别清理?" "$default_answer"; then
            log_info "清理已取消"
            return 0
        fi
    fi
    
    cd "$APP_DIR"
    
    # 获取项目相关的容器和镜像
    local project_name="${COMPOSE_PROJECT_NAME:-ssalgten}"
    local project_images
    local project_containers
    
    if command -v docker_compose &> /dev/null && [[ -f "$COMPOSE_FILE" ]]; then
        project_images=$(docker_compose config --services 2>/dev/null | while read service; do
            docker_compose images -q "$service" 2>/dev/null || true
        done | sort -u | grep -v '^$' || true)
        
        project_containers=$(docker_compose ps -aq 2>/dev/null || true)
    fi
    
    # 基础清理
    log_info "开始基础清理..."
    
    # 清理项目容器日志
    if [[ -n "$project_containers" ]]; then
        log_info "清理项目容器日志..."
        for container in $project_containers; do
            docker logs --tail 100 "$container" > /tmp/keep_logs_$container 2>/dev/null || true
            sudo truncate -s 0 $(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null) 2>/dev/null || true
        done
    fi
    
    # 清理项目相关的悬挂镜像
    log_info "清理项目相关悬挂镜像..."
    if [[ -n "$project_images" ]]; then
        # 只清理项目相关的悬挂镜像
        docker images --filter "dangling=true" -q | while read dangling_img; do
            if echo "$project_images" | grep -q "$dangling_img"; then
                docker rmi "$dangling_img" 2>/dev/null || true
            fi
        done
    else
        # 如果无法获取项目镜像，使用标签过滤
        docker images --filter "dangling=true" --filter "label=com.docker.compose.project=$project_name" -q | xargs -r docker rmi 2>/dev/null || true
    fi
    
    # 清理临时文件和日志
    log_info "清理临时文件..."
    
    # 清理更新日志 (保留最近3天)
    if [[ -d ".update/logs" ]]; then
        find .update/logs -name "*.log" -mtime +3 -delete 2>/dev/null || true
    fi
    
    # 清理旧备份 (保留最近5个)
    if [[ -d ".backup" ]]; then
        find .backup -type d -name "manual_*" | sort -r | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
    fi
    
    # 中等清理
    if [[ "$clean_level" == "moderate" ]] || [[ "$clean_level" == "aggressive" ]]; then
        log_info "执行中等清理..."
        
        # 清理构建缓存
        log_info "清理 Docker 构建缓存..."
        docker builder prune -f --filter "until=24h" 2>/dev/null || true
        
        # 清理未使用的网络
        log_info "清理未使用的网络..."
        docker network prune -f 2>/dev/null || true
    fi
    
    # 激进清理
    if [[ "$clean_level" == "aggressive" ]]; then
        log_warning "执行激进清理..."
        
        # 清理所有悬挂镜像
        log_info "清理所有悬挂镜像..."
        docker image prune -f
        
        # 清理未使用的镜像 (过去24小时内未使用)
        log_info "清理未使用的镜像..."
        docker image prune -a -f --filter "until=24h" 2>/dev/null || true
        
        # 系统级清理
        log_info "执行系统级 Docker 清理..."
        docker system prune -f --filter "until=24h"
    fi
    
    # 数据卷清理 (需要额外确认)
    if [[ "$clean_volumes" == "true" ]]; then
        echo
        log_error "⚠️  危险操作: 数据卷清理"
        
        # 显示将要删除的卷
        log_info "将要删除的数据卷:"
        local volumes_to_delete
        volumes_to_delete=$(docker volume ls -q | grep -E "(${project_name}|postgres|ssalgten)" | head -10)
        
        if [[ -n "$volumes_to_delete" ]]; then
            echo "$volumes_to_delete" | sed 's/^/  - /'
            echo
            
            if [[ "$force_clean" != "true" ]]; then
                log_warning "此操作将永久删除所有数据库数据和持久化存储！"
                if ! confirm "真的要删除这些数据卷吗?" "N"; then
                    log_info "跳过数据卷清理"
                else
                    # 停止服务
                    log_info "停止服务..."
                    docker_compose down --remove-orphans
                    
                    # 删除数据卷
                    log_warning "删除数据卷..."
                    echo "$volumes_to_delete" | xargs -r docker volume rm 2>/dev/null || true
                    log_warning "数据卷已删除"
                fi
            fi
        else
            log_info "未找到项目相关的数据卷"
        fi
    fi
    
    # 显示清理结果
    echo
    log_success "✅ $clean_level 级别清理完成"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "Docker 使用情况:"
        docker system df 2>/dev/null || echo "  无法获取 Docker 使用统计"
    fi
    
    log_info "建议: 定期运行 'clean --basic' 保持项目整洁"
}

# 生成诊断报告
generate_diagnostic_report() {
    log_header "📊 生成诊断报告"
    
    local report_file="diagnostic_report_$(date +%Y%m%d_%H%M%S).txt"
    cd "$APP_DIR"
    
    log_info "生成诊断报告: $report_file"
    
    {
        echo "SsalgTen 系统诊断报告"
        echo "生成时间: $(date)"
        echo "脚本版本: $SCRIPT_VERSION"
        echo "========================================"
        echo
        
        echo "系统信息:"
        echo "----------------------------------------"
        uname -a
        echo "当前用户: $(whoami)"
        echo "应用目录: $APP_DIR"
        echo "Compose文件: $COMPOSE_FILE"
        echo
        
        echo "Docker 信息:"
        echo "----------------------------------------"
        docker --version 2>/dev/null || echo "Docker 未安装"
        docker_compose version 2>/dev/null || echo "Docker Compose 未可用"
        echo
        echo "Docker 资源快照: (stats/top)"
        echo "----------------------------------------"
        docker stats --no-stream 2>/dev/null || echo "无法获取资源统计"
        echo
        docker_compose top 2>/dev/null || echo "无法获取容器进程"
        echo
        
        echo "容器状态:"
        echo "----------------------------------------"
        docker_compose ps 2>/dev/null || echo "无法获取容器状态"
        echo
        
        echo "端口占用:"
        echo "----------------------------------------"
        if command -v ss &> /dev/null; then
            ss -tlnp | grep -E ":(80|443|3000|3001|3002|5432)" || echo "相关端口未被占用"
        elif command -v lsof &> /dev/null; then
            lsof -nP -i:80,443,3000,3001,3002,5432 2>/dev/null || echo "相关端口未被占用"
        else
            echo "无端口检查工具"
        fi
        echo
        
        echo "磁盘使用:"
        echo "----------------------------------------"
        df -h "$APP_DIR" 2>/dev/null || df -h
        echo
        
        echo "内存使用:"
        echo "----------------------------------------"
        free -h 2>/dev/null || echo "无法获取内存信息"
        echo
        
        echo "近期日志 (最后50行):"
        echo "----------------------------------------"
        docker_compose logs --tail=50 2>/dev/null || echo "无法获取日志"
        
    } > "$report_file"
    
    log_success "诊断报告已生成: $report_file"
    log_info "文件大小: $(du -h "$report_file" | cut -f1)"
}

# 脚本自更新
# 自更新和安装功能
self_update() {
    local install_mode=false
    local target_path=""
    local script_url="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --install)
                install_mode=true
                shift
                ;;
            --path)
                target_path="$2"
                shift 2
                ;;
            --url)
                script_url="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ "$install_mode" == "true" ]]; then
        log_header "📦 安装 SsalgTen 管理脚本"
        
        # 确定安装路径
        if [[ -z "$target_path" ]]; then
            # 自动选择安装路径
            if [[ -w "/usr/local/bin" ]]; then
                target_path="/usr/local/bin/ssalgten"
            elif [[ -w "$HOME/.local/bin" ]]; then
                target_path="$HOME/.local/bin/ssalgten"
                mkdir -p "$HOME/.local/bin"
            elif [[ -w "$HOME/bin" ]]; then
                target_path="$HOME/bin/ssalgten"
                mkdir -p "$HOME/bin"
            else
                target_path="$HOME/ssalgten.sh"
            fi
        fi
        
        log_info "安装目标: $target_path"
        
        # 检查现有安装
        if [[ -f "$target_path" ]]; then
            log_warning "发现现有安装: $target_path"
            if ! confirm "是否覆盖现有安装?" "N"; then
                log_info "安装已取消"
                return 0
            fi
        fi
    else
        log_header "🔄 脚本自更新"
        target_path="${BASH_SOURCE[0]}"
        
        if ! confirm "确认更新脚本到最新版本?" "Y"; then
            log_info "自更新已取消"
            return 0
        fi
    fi
    
    # 下载最新版本
    local temp_script="/tmp/ssalgten_$(date +%s).sh"
    log_info "下载最新版本..."
    log_info "源地址: $script_url"
    
    # 增强的下载逻辑
    local download_success=false
    local download_tool=""
    
    # 尝试 curl
    if command -v curl &> /dev/null; then
        if curl -fsSL --connect-timeout 10 --max-time 60 "$script_url" -o "$temp_script"; then
            download_success=true
            download_tool="curl"
        fi
    fi
    
    # 回退到 wget
    if [[ "$download_success" == "false" ]] && command -v wget &> /dev/null; then
        if wget --timeout=60 --tries=3 -q "$script_url" -O "$temp_script"; then
            download_success=true
            download_tool="wget"
        fi
    fi
    
    if [[ "$download_success" == "false" ]]; then
        log_error "下载失败 - 请检查网络连接"
        [[ -f "$temp_script" ]] && rm -f "$temp_script"
        return 1
    fi
    
    log_info "使用 $download_tool 下载完成"
    
    # 增强的文件验证
    if [[ ! -s "$temp_script" ]]; then
        log_error "下载的文件为空"
        rm -f "$temp_script"
        return 1
    fi
    
    # 验证文件格式
    if ! head -1 "$temp_script" | grep -q "#!/.*bash"; then
        log_error "下载的文件不是有效的bash脚本"
        rm -f "$temp_script"
        return 1
    fi
    
    # 验证脚本内容（检查关键函数）
    local key_functions=("main" "start_system" "stop_system")
    local missing_functions=()
    
    for func in "${key_functions[@]}"; do
        if ! grep -q "^${func}()" "$temp_script"; then
            missing_functions+=("$func")
        fi
    done
    
    if [[ ${#missing_functions[@]} -gt 0 ]]; then
        log_error "下载的脚本不完整，缺少函数: ${missing_functions[*]}"
        rm -f "$temp_script"
        return 1
    fi
    
    # 获取新版本信息
    local new_version
    new_version=$(grep "^SCRIPT_VERSION=" "$temp_script" | cut -d'"' -f2 2>/dev/null || echo "unknown")
    log_info "新版本: $new_version"
    
    # 备份现有文件（如果存在）
    if [[ -f "$target_path" ]] && [[ "$install_mode" == "false" ]]; then
        local backup_path="${target_path}.bak.$(date +%Y%m%d_%H%M%S)"
        log_info "备份当前版本到: $backup_path"
        cp "$target_path" "$backup_path"
    fi
    
    # 设置权限并安装
    chmod +x "$temp_script"
    
    log_info "安装新版本到: $target_path"
    if cp "$temp_script" "$target_path"; then
        rm -f "$temp_script"
        
        # 验证安装
        if [[ -x "$target_path" ]]; then
            if [[ "$install_mode" == "true" ]]; then
                log_success "✅ 脚本已成功安装到: $target_path"
                
                # PATH 建议
                if [[ "$target_path" =~ ^/usr/local/bin ]] || [[ "$target_path" =~ \.local/bin ]] || [[ "$target_path" =~ /bin/ssalgten$ ]]; then
                    echo "现在可以在任何位置运行: ssalgten"
                    
                    # 检查PATH
                    case "$target_path" in
                        */.local/bin/*)
                            if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                                echo "💡 提示: 将以下行添加到 ~/.bashrc 或 ~/.zshrc:"
                                echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
                            fi
                            ;;
                        */bin/ssalgten)
                            if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
                                echo "💡 提示: 将以下行添加到 ~/.bashrc 或 ~/.zshrc:"
                                echo "export PATH=\"\$HOME/bin:\$PATH\""
                            fi
                            ;;
                    esac
                else
                    echo "可以运行: $target_path"
                fi
                
                # 显示快速开始信息
                echo
                echo "🚀 快速开始:"
                echo "  ssalgten start    # 启动系统"
                echo "  ssalgten status   # 查看状态"
                echo "  ssalgten logs     # 查看日志"
                echo "  ssalgten --help   # 查看帮助"
                
            else
                log_success "✅ 脚本已更新到最新版本 ($new_version)"
                log_info "重新运行以使用新版本"
            fi
        else
            log_error "安装后的文件不可执行"
            return 1
        fi
    else
        log_error "安装失败 - 可能是权限问题"
        rm -f "$temp_script"
        return 1
    fi
}

# 交互式菜单
show_interactive_menu() {
    local status
    status=$(get_system_status)
    local status_color
    
    case "$status" in
        "running") status_color="${GREEN}● 运行中${NC}" ;;
        "partial") status_color="${YELLOW}◐ 部分运行${NC}" ;;
        "stopped") status_color="${RED}○ 已停止${NC}" ;;
        *) status_color="${RED}✗ $status${NC}" ;;
    esac
    
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
   _____ _____ ____  _      _____ _______ ______ _   _ 
  / ___// __  / __ \| |    / ____|__   __|  ____| \ | |
  \`--. \`' / /' / \ | |   | |  __   | |  | |__  |  \| |
   `--. \ / /  | |  | |   | | |_ |  | |  |  __| | . ` |
  /\__/ ./ /___| |__| |___| |__| |  | |  | |____| |\  |
  \____/ \_____/____/\_____\_____|  |_|  |______|_| \_|
                                                       
                 SsalgTen 管理控制台 v${SCRIPT_VERSION}
EOF
    echo -e "${NC}"
    echo -e "${CYAN}================================================================${NC}"
    echo -e "${CYAN}系统状态:${NC} $status_color"
    echo -e "${CYAN}应用目录:${NC} $APP_DIR"
    echo ""
    echo -e "${YELLOW}📋 主要操作:${NC}"
    echo -e "  ${GREEN}1.${NC} 🚀 启动系统        ${GREEN}2.${NC} 🛑 停止系统"
    echo -e "  ${BLUE}3.${NC} 🔄 重启系统        ${PURPLE}4.${NC} ⚡ 更新系统"
    echo ""
    echo -e "${YELLOW}📊 监控管理:${NC}"  
    echo -e "  ${CYAN}5.${NC} 📊 系统状态        ${CYAN}6.${NC} 📋 查看日志"
    echo -e "  ${CYAN}7.${NC} 🔍 容器信息        ${CYAN}8.${NC} 🔍 端口检查"
    echo ""
    echo -e "${YELLOW}🛠️  维护工具:${NC}"
    echo -e "  ${YELLOW}9.${NC} 🗂️  数据备份        ${YELLOW}10.${NC} 🧹 系统清理"
    echo -e "  ${YELLOW}11.${NC} 📊 诊断报告       ${YELLOW}12.${NC} 🔄 脚本更新"
    echo ""
    echo -e "  ${GREEN}0.${NC} 🚪 退出程序"
    echo ""
    echo -e "${CYAN}================================================================${NC}"
    
    # 显示当天小贴士 (基于日期随机)
    local tip_of_day
    local day_num=$(($(date +%j) % 7))  # 基于一年中的第几天，取模7
    case $day_num in
        0) tip_of_day="💡 小贴士: 使用 'logs backend -f' 可以实时跟踪后端日志" ;;
        1) tip_of_day="💡 小贴士: 'clean --basic' 是日常维护的安全清理选择" ;;
        2) tip_of_day="💡 小贴士: 使用 'sh' 命令可以快速进入backend容器shell" ;;
        3) tip_of_day="💡 小贴士: 'status' 命令可以快速查看系统整体运行情况" ;;
        4) tip_of_day="💡 小贴士: 定期运行 'backup' 来保护您的重要数据" ;;
        5) tip_of_day="💡 小贴士: 'port-check' 可以诊断端口冲突问题" ;;
        6) tip_of_day="💡 小贴士: 使用 '--verbose' 选项可以看到更详细的操作信息" ;;
    esac
    echo -e "${BLUE}$tip_of_day${NC}"
    echo
    
    local choice
    choice=$(read_from_tty "请选择操作 [0-12]: " "0")
    
    case "$choice" in
        1) start_system ;;
        2) stop_system ;;
        3) restart_system ;;
        4) update_system ;;
        5) system_status ;;
        6) view_logs ;;
        7) docker_compose ps ;;
        8) port_check ;;
        9) backup_data ;;
        10) clean_system ;;
        11) generate_diagnostic_report ;;
        12) self_update ;;
        0) log_success "感谢使用 SsalgTen 管理工具!"; exit 0 ;;
        *) log_error "无效选择: $choice"; sleep 1 ;;
    esac
    
    if [[ "$choice" != "0" ]]; then
        echo
        read_from_tty "按回车键继续..." ""
    fi
}

# 获取系统状态（用于菜单显示）
get_system_status() {
    if ! check_docker_ready &> /dev/null; then
        echo "docker-unavailable"
        return 1
    fi
    
    cd "$APP_DIR" 2>/dev/null || { echo "dir-not-found"; return 1; }
    
    local running_services
    local total_services
    
    running_services=$(docker_compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    total_services=$(docker_compose config --services 2>/dev/null | wc -l)
    
    if [[ "$running_services" -eq "$total_services" ]] && [[ "$total_services" -gt 0 ]]; then
        echo "running"
    elif [[ "$running_services" -gt 0 ]]; then
        echo "partial"
    else
        echo "stopped"
    fi
}

# 参数解析
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dir)
                APP_DIR="$2"
                shift 2
                ;;
            --compose-file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            --force|-y)
                FORCE_MODE=true
                shift
                ;;
            --non-interactive)
                NON_INTERACTIVE=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            --version)
                echo "$SCRIPT_NAME v$SCRIPT_VERSION"
                exit 0
                ;;
            # 主要命令
            start|stop|restart|status|logs|ps|exec|update|backup|clean|port-check|diagnose|self-update)
                COMMAND="$1"
                shift
                COMMAND_ARGS=("$@")
                break
                ;;
            # 命令别名
            st|run) COMMAND="start"; shift; COMMAND_ARGS=("$@"); break ;;
            stp) COMMAND="stop"; shift; COMMAND_ARGS=("$@"); break ;;
            rs|reboot) COMMAND="restart"; shift; COMMAND_ARGS=("$@"); break ;;
            stat|info) COMMAND="status"; shift; COMMAND_ARGS=("$@"); break ;;
            log|tail) COMMAND="logs"; shift; COMMAND_ARGS=("$@"); break ;;
            sh|shell|bash) 
                COMMAND="exec"
                shift
                # 如果没有指定服务，默认backend
                if [[ $# -eq 0 ]] || [[ "$1" =~ ^- ]]; then
                    COMMAND_ARGS=("backend" "sh")
                else
                    COMMAND_ARGS=("$1" "sh")
                    shift
                fi
                COMMAND_ARGS+=("$@")
                break
                ;;
            up|upgrade) COMMAND="update"; shift; COMMAND_ARGS=("$@"); break ;;
            bak|save) COMMAND="backup"; shift; COMMAND_ARGS=("$@"); break ;;
            clear|cleanup) COMMAND="clean"; shift; COMMAND_ARGS=("$@"); break ;;
            ports|port) COMMAND="port-check"; shift; COMMAND_ARGS=("$@"); break ;;
            doctor|check) COMMAND="diagnose"; shift; COMMAND_ARGS=("$@"); break ;;
            upgrade-script|update-script) COMMAND="self-update"; shift; COMMAND_ARGS=("$@"); break ;;
            # 特殊快捷命令
            help|--help|-h) show_help; exit 0 ;;
            version|--version|-V) echo "$SCRIPT_NAME v$SCRIPT_VERSION"; exit 0 ;;
            # 错误处理
            -*) 
                log_error "未知选项: $1"
                echo "💡 使用 '--help' 查看可用选项"
                exit 1
                ;;
            *)
                # 智能命令建议
                local unknown_cmd="$1"
                log_error "未知命令: '$unknown_cmd'"
                
                # 常见错误和建议
                case "$unknown_cmd" in
                    *start*|*启动*) echo "💡 您是否想要: start (启动系统)" ;;
                    *stop*|*停止*) echo "💡 您是否想要: stop (停止系统)" ;;
                    *log*|*日志*) echo "💡 您是否想要: logs (查看日志)" ;;
                    *status*|*状态*) echo "💡 您是否想要: status (系统状态)" ;;
                    *update*|*更新*) echo "💡 您是否想要: update (更新系统)" ;;
                    *clean*|*清理*) echo "💡 您是否想要: clean (清理资源)" ;;
                    *help*) show_help; exit 0 ;;
                    *) echo "💡 使用 '--help' 查看所有可用命令" ;;
                esac
                
                echo
                echo "🔥 热门命令:"
                echo "  $(basename "$0") start     # 启动系统"  
                echo "  $(basename "$0") status    # 查看状态"
                echo "  $(basename "$0") logs      # 查看日志"
                echo "  $(basename "$0") --help    # 查看帮助"
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    # 首先检查是否为curl|bash模式
    if detect_curl_bash_mode; then
        # 在curl|bash模式下，需要重新定义日志函数（因为可能还没加载）
        if ! declare -f log_info &>/dev/null; then
            log_info() { echo -e "\\033[0;34m[INFO]\\033[0m $*"; }
            log_success() { echo -e "\\033[0;32m[SUCCESS]\\033[0m $*"; }
            log_warning() { echo -e "\\033[1;33m[WARNING]\\033[0m $*"; }
            log_error() { echo -e "\\033[0;31m[ERROR]\\033[0m $*" >&2; }
        fi
        
        # 处理curl|bash安装
        if handle_curl_bash_install "$@"; then
            exit 0  # 安装成功，退出
        fi
        # 如果返回1，说明用户选择临时运行，继续执行
    fi
    
    # 检查运行环境
    if [[ ! -t 0 ]]; then
        NON_INTERACTIVE=true
    fi
    
    # 解析命令行参数
    parse_arguments "$@"
    
    # 初始化环境
    detect_app_dir
    detect_compose_file
    
    [[ "$VERBOSE" == "true" ]] && log_info "应用目录: $APP_DIR, Compose文件: $COMPOSE_FILE"
    
    # 执行命令或显示菜单
    if [[ -n "${COMMAND:-}" ]]; then
        case "$COMMAND" in
            start) start_system ;;
            stop) stop_system ;;
            restart) restart_system ;;
            status) system_status ;;
            logs) 
                # 将所有参数传递给 view_logs，让它自己解析
                view_logs "${COMMAND_ARGS[@]}"
                ;;
            ps) check_docker_ready; cd "$APP_DIR"; docker_compose ps ;;
            exec)
                [[ ${#COMMAND_ARGS[@]} -lt 2 ]] && die "用法: exec <service> <command...>"
                exec_in_container "${COMMAND_ARGS[@]}"
                ;;
            update) update_system ;;
            backup) backup_data ;;
            clean) clean_system "${COMMAND_ARGS[@]}" ;;
            port-check) port_check ;;
            diagnose) generate_diagnostic_report ;;
            self-update) self_update "${COMMAND_ARGS[@]}" ;;
            *) die "未知命令: $COMMAND" ;;
        esac
    else
        # 交互式菜单
        if [[ "$NON_INTERACTIVE" == "true" ]]; then
            log_error "非交互模式下需要指定子命令"
            show_help
            exit 1
        fi
        
        while true; do
            show_interactive_menu
        done
    fi
}

# 运行主函数
main "$@"
