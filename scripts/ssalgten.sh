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
    local has_command=false
    
    for arg in "$@"; do
        if [[ "$arg" == "--install" ]]; then
            should_install=true
            break
        elif [[ "$arg" =~ ^(start|stop|restart|status|logs|ps|exec|update|backup|clean|port-check|diagnose|self-update|deploy|uninstall|fix-agent-names)$ ]]; then
            has_command=true
            break
        fi
    done
    
    if [[ "$should_install" == "true" ]]; then
        # 自动安装模式
        log_info "检测到安装请求，开始安装..."
        self_update --install "$@"
        return $?
    elif [[ "$has_command" == "true" ]]; then
        # 有具体命令，继续执行
        log_info "检测到命令参数，继续执行..."
        return 1  # 让主流程继续处理命令
    else
        # 在 curl|bash 模式下无命令时，直接进入交互模式
        return 1  # 继续进入交互模式
    fi
}

detect_default_image_namespace() {
    local git_url
    git_url=$(git remote get-url origin 2>/dev/null || true)
    if [[ -n "$git_url" ]]; then
        local parsed
        parsed=$(echo "$git_url" | sed -E 's#(git@|https://|http://)?github.com[:/]+##; s#\.git$##')
        if [[ "$parsed" == */* ]]; then
            echo "$parsed"
            return
        fi
    fi
    echo "${DEFAULT_IMAGE_NAMESPACE:-lonelyrower/ssalgten}"
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
LAST_RESULT_MSG=""

DEFAULT_IMAGE_REGISTRY="ghcr.io"
DEFAULT_IMAGE_NAMESPACE=""
DEFAULT_IMAGE_TAG="latest"

DEFAULT_APP_DIR="${DEFAULT_APP_DIR:-/opt/ssalgten}"

# 部署相关变量
DOMAIN=""
SSL_EMAIL=""
DB_PASSWORD=""
JWT_SECRET=""
API_SECRET=""
AGENT_KEY=""
ENABLE_SSL=false
SSL_MODE="none"
RUNNING_AS_ROOT=false

# 颜色定义（可通过环境变量禁用）
if [[ "${LOG_NO_COLOR:-}" == "true" ]] || [[ ! -t 1 ]]; then
    RED="" GREEN="" YELLOW="" BLUE="" CYAN="" PURPLE="" NC=""
else
    readonly RED=$'\033[0;31m'
    readonly GREEN=$'\033[0;32m'  
    readonly YELLOW=$'\033[1;33m'
    readonly BLUE=$'\033[0;34m'
    readonly CYAN=$'\033[0;36m'
    readonly PURPLE=$'\033[0;35m'
    readonly NC=$'\033[0m'
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

# 通用sudo函数
run_as_root() {
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

# 改进的输入函数 - 支持默认值和回车确认
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="${3:-}"
    local response
    
    if [[ -n "$default" ]]; then
        read -p "$prompt [默认: $default]: " response
        response="${response:-$default}"
    else
        read -p "$prompt: " response
    fi
    
    if [[ -n "$var_name" ]]; then
        eval "$var_name=\"$response\""
    else
        echo "$response"
    fi
}

# 端口输入函数 - 带验证
prompt_port() {
    local prompt="$1"
    local default="$2"
    local port
    
    while true; do
        read -p "$prompt [默认: $default]: " port
        port="${port:-$default}"
        
        if [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 1 ]] && [[ "$port" -le 65535 ]]; then
            echo "$port"
            break
        else
            echo "错误: 请输入有效的端口号 (1-65535)"
        fi
    done
}

# Yes/No 提示函数
prompt_yes_no() {
    local prompt="$1"
    local default="${2:-}"
    local response
    
    while true; do
        if [[ -n "$default" ]]; then
            read -p "$prompt [默认: $default]: " response
            response="${response:-$default}"
        else
            read -p "$prompt (y/n): " response
        fi
        
        case "${response,,}" in
            y|yes|是|确认) echo "y"; return 0 ;;
            n|no|否|取消) echo "n"; return 1 ;;
            *) echo "请输入 y(是) 或 n(否)" ;;
        esac
    done
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

${PURPLE}系统生命周期命令:${NC}
  ${GREEN}deploy${NC}              🔧 一键部署生产环境 (完整向导)
  ${GREEN}start${NC}               🚀 启动系统服务 (带健康检查)
  ${GREEN}stop${NC}                🛑 停止系统服务 (带端口清理)
  ${GREEN}restart${NC}             🔄 重启系统服务 (stop + start)
  ${GREEN}status${NC}              📊 显示系统运行状态
  ${GREEN}update${NC}              ⚡ 更新系统代码并重启 (带子菜单选择)
  ${RED}uninstall${NC} [--force]   🗑️ 完全卸载系统 (谨慎使用)

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

${PURPLE}修复工具命令:${NC}
  ${CYAN}fix-agent-names${NC}     🔧 修复Agent节点名称覆盖问题

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

# 强制刷新输出缓冲区（解决SSH终端输出截断问题）
flush_output() {
    sync
    # 强制刷新标准输出和标准错误
    exec 1>&1 2>&2
    sleep 2
}

# Docker Compose 兼容性检查和包装函数
docker_compose() {
    local base_args=""
    [ -n "$COMPOSE_FILE" ] && base_args="$base_args -f $COMPOSE_FILE"
    # 自动合并本地覆盖文件（例如禁用/调整端口映射），避免 up 时忽略 override
    local override_file="$APP_DIR/docker-compose.override.yml"
    if [ -f "$override_file" ]; then
        base_args="$base_args -f $override_file"
    fi
    local proj="--project-name ${COMPOSE_PROJECT_NAME:-ssalgten}"
    
    if docker compose version >/dev/null 2>&1; then
        docker compose $base_args $proj "$@"
    elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
        docker-compose $base_args $proj "$@"
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
        # 读入失败不可终止整个脚本（set -e 安全处理）
        set +e
        read -r response < /dev/tty
        local rc=$?
        set -e
        if [[ $rc -ne 0 ]]; then
            # 无法读取输入时回退到默认值
            response="$default"
        fi
    else
        # 回退到标准输入
        echo -n "$prompt"
        set +e
        read -r response
        local rc=$?
        set -e
        if [[ $rc -ne 0 ]]; then
            response="$default"
        fi
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
    if [[ -n "$APP_DIR" ]]; then
        mkdir -p "$APP_DIR" 2>/dev/null || die "无法创建应用目录: $APP_DIR"
        return 0
    fi

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local project_dir="$(dirname "$script_dir")"

    if [[ -f "$project_dir/docker-compose.yml" ]] || [[ -f "$project_dir/package.json" ]]; then
        APP_DIR="$project_dir"
        return 0
    fi

    local default_dir="${DEFAULT_APP_DIR:-/opt/ssalgten}"
    if [[ ! -d "$default_dir" ]]; then
        log_warning "检测到默认应用目录不存在，正在创建: $default_dir"
        if ! mkdir -p "$default_dir"; then
            die "无法创建默认应用目录: $default_dir"
        fi
    fi

    APP_DIR="$default_dir"
    export APP_DIR
}


# 检测 Compose 文件
detect_compose_file() {
    if [[ -n "$COMPOSE_FILE" ]]; then
        if [[ -f "$COMPOSE_FILE" ]]; then
            return 0
        fi
        log_warning "指定的 Compose 文件不存在: $COMPOSE_FILE"
    fi

    cd "$APP_DIR" 2>/dev/null || true

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

    COMPOSE_FILE="$APP_DIR/docker-compose.yml"
}


# 增强健康检查
health_check() {
    local service="$1"
    local url="$2"
    local max_attempts="${3:-12}"  # 可配置尝试次数，默认12次
    local delay="${4:-3}"          # 可配置延迟间隔，默认3秒
    local timeout="${5:-10}"       # 可配置超时时间，默认10秒
    
    log_info "检查 $service 健康状态... (超时: ${timeout}s, 重试: ${max_attempts}次, 最大等待: $((max_attempts * delay))s)"
    
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
            if [[ "$VERBOSE" == "true" ]] || [[ "${FORCE_VERBOSE:-false}" == "true" ]]; then
                log_warning "第 $attempt 次检查失败，${delay}s 后重试... (剩余 $((max_attempts - attempt)) 次)"
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
    local port_output

    if ! port_output=$(docker_compose port "$service" "$container_port" 2>/dev/null); then
        return 0
    fi

    # docker compose port may return multiple lines; take the last mapping
    port_output=${port_output##*$'\n'}
    port_output=${port_output##*:}

    [[ -n "$port_output" ]] && printf '%s\n' "$port_output"
}

# 探测动态端口
detect_ports() {
    # 优先从 docker-compose 服务列表中检测可用端口，缺失时使用默认值
    local services_list=""
    local agent_service="${AGENT_SERVICE_NAME:-agent}"
    local fallback_agent=""

    services_list=$(docker_compose ps --services 2>/dev/null || true)

    if [[ -n "$services_list" ]]; then
        if ! grep -qx "$agent_service" <<<"$services_list"; then
            while IFS= read -r svc; do
                case "$svc" in
                    "$agent_service")
                        fallback_agent="$svc"
                        break
                        ;;
                    agent|agent-*|agent_*|ssalgten-agent|ssalgten-agent-*|ssalgten-agent_*)
                        fallback_agent="$svc"
                        break
                        ;;
                esac
            done <<<"$services_list"

            if [[ -n "$fallback_agent" ]]; then
                agent_service="$fallback_agent"
            else
                agent_service=""
            fi
        fi
    fi

    FRONTEND_PORT="${FRONTEND_PORT_OVERRIDE:-$(get_port frontend 80)}"
    BACKEND_PORT="${BACKEND_PORT_OVERRIDE:-$(get_port backend 3001)}"

    if [[ -n "$agent_service" ]]; then
        AGENT_PORT="${AGENT_PORT_OVERRIDE:-$(get_port "$agent_service" 3002)}"
    else
        AGENT_PORT="${AGENT_PORT_OVERRIDE:-}"
    fi

    [[ -z "$FRONTEND_PORT" ]] && FRONTEND_PORT="${FRONTEND_PORT_OVERRIDE:-3000}"
    [[ -z "$BACKEND_PORT" ]] && BACKEND_PORT="${BACKEND_PORT_OVERRIDE:-3001}"
    [[ -z "$AGENT_PORT" ]] && AGENT_PORT="${AGENT_PORT_OVERRIDE:-3002}"

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检测到端口映射: Frontend($FRONTEND_PORT), Backend($BACKEND_PORT), Agent($AGENT_PORT)"
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
    if ! docker_compose up -d --remove-orphans; then
        log_warning "整体启动失败，尝试仅启动核心服务 (database/redis/backend/frontend/updater)..."
        local core_services=(database redis backend frontend updater)
        for s in "${core_services[@]}"; do
            docker_compose up -d --build --no-deps "$s" 2>/dev/null || true
        done
        # 尝试启动 agent（忽略失败）
        docker_compose up -d --no-deps agent-nyc 2>/dev/null || log_warning "agent-nyc 启动失败，已忽略（可能端口冲突）"
    fi

    log_info "等待服务启动..."
    sleep 10
    
    # 动态检测端口
    detect_ports
    
    # 健康检查 (backend: 更多重试, frontend: 更快检查)
    local healthy=true
    FORCE_VERBOSE=true health_check "backend" "http://localhost:${BACKEND_PORT}/api/health" 15 2 8 || healthy=false
    health_check "frontend" "http://localhost:${FRONTEND_PORT}/" 8 2 5 || healthy=false
    
    if [[ "$healthy" == "true" ]]; then
        log_success "🎉 核心服务启动成功!（忽略非核心服务失败）"
        echo -e "${GREEN}访问地址: http://localhost:${FRONTEND_PORT}${NC}"
    else
        log_error "核心服务启动失败，请查看日志"
        return 1
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
update_system_from_images() {
    check_docker_ready || return 1
    detect_app_dir
    detect_compose_file

    local registry=${1:-$DEFAULT_IMAGE_REGISTRY}
    local namespace=${2:-}
    local tag=${3:-$DEFAULT_IMAGE_TAG}
    local compose_override=${4:-}

    if [[ -z "$namespace" ]]; then
        namespace=$(detect_default_image_namespace)
    fi

    local compose_file
    if [[ -n "$compose_override" ]]; then
        compose_file="$compose_override"
    elif [[ -f "$APP_DIR/docker-compose.ghcr.yml" ]]; then
        compose_file="$APP_DIR/docker-compose.ghcr.yml"
    else
        compose_file="$COMPOSE_FILE"
    fi

    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"

    log_header "🚀 使用镜像更新 SsalgTen"
    log_info "镜像仓库: $registry/$namespace"
    log_info "镜像标签: $tag"

    export IMAGE_REGISTRY=$registry
    export IMAGE_NAMESPACE=$namespace
    export IMAGE_TAG=$tag

    docker_compose -f "$compose_file" pull
    docker_compose -f "$compose_file" up -d postgres
    log_info "等待数据库启动..."
    sleep 5
    if ! docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy; then
        log_warning "数据库迁移执行失败，请手动检查"
    fi
    docker_compose -f "$compose_file" up -d --remove-orphans
    log_success "镜像更新完成"
}

# Agent节点名称覆盖问题修复
fix_agent_name_override() {
    log_header "🔧 修复Agent节点名称覆盖问题"
    echo ""
    
    log_info "此修复将解决Agent重连时覆盖用户自定义节点名称的问题"
    echo ""
    echo "修复内容："
    echo "- 为所有现有的自定义节点名称添加保护标记"
    echo "- 确保Agent重连时不会覆盖用户修改的名称"
    echo "- 自动识别并保护已经自定义的节点名称"
    echo ""
    
    if ! prompt_yes_no "是否继续执行修复" "y"; then
        log_info "修复已取消"
        return 0
    fi
    
    cd "$APP_DIR"
    
    # 确保数据库服务在运行
    log_info "检查数据库服务状态..."
    if ! docker_compose ps postgres | grep -q "Up"; then
        log_info "启动数据库服务..."
        docker_compose up -d postgres
        sleep 10
    fi
    
    # 等待数据库就绪
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker_compose exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
            log_success "数据库已准备就绪"
            break
        fi
        attempt=$((attempt + 1))
        echo "等待数据库启动... ($attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "数据库启动超时，无法执行修复"
        return 1
    fi
    
    # 应用数据库修复
    log_info "应用节点名称保护修复..."
    
    # 检查是否已经应用过修复
    if docker_compose exec postgres psql -U ssalgten -d ssalgten -c "\d nodes" | grep -q "nameCustomized"; then
        log_warning "检测到修复已经应用过，跳过数据库结构修改"
    else
        log_info "添加nameCustomized字段..."
        docker_compose exec postgres psql -U ssalgten -d ssalgten -c "
        ALTER TABLE nodes ADD COLUMN nameCustomized BOOLEAN NOT NULL DEFAULT false;
        " 2>/dev/null || {
            log_error "添加字段失败"
            return 1
        }
        log_success "字段添加完成"
    fi
    
    # 标记已存在的自定义名称
    log_info "识别并保护现有的自定义节点名称..."
    local update_result
    update_result=$(docker_compose exec postgres psql -U ssalgten -d ssalgten -c "
    UPDATE nodes 
    SET nameCustomized = true 
    WHERE nameCustomized = false 
      AND (
        name !~ '^Node-[a-zA-Z0-9]{8}\$'
        OR name ~ '[^\x00-\x7F]'
        OR name ~ '[^a-zA-Z0-9\-_\.]'
        OR length(name) > 20
        OR name ~* '(server|node|vps|host|machine|agent|monitor|test|prod|dev|asia|europe|america|tokyo|london|sydney|singapore|hongkong|beijing|shanghai|guangzhou|shenzhen|mumbai|delhi|seoul|osaka|taiwan|macau)'
      );
    " 2>/dev/null)
    
    if echo "$update_result" | grep -q "UPDATE"; then
        local protected_count=$(echo "$update_result" | grep "UPDATE" | awk '{print $2}')
        log_success "已保护 $protected_count 个自定义节点名称"
    else
        log_success "所有节点名称保护状态已更新"
    fi
    
    # 重启后端服务以加载修复
    log_info "重启后端服务以加载修复..."
    docker_compose restart backend
    sleep 10
    
    # 验证修复
    log_info "验证修复结果..."
    local total_nodes protected_nodes
    total_nodes=$(docker_compose exec postgres psql -U ssalgten -d ssalgten -tAc "SELECT COUNT(*) FROM nodes;" 2>/dev/null)
    protected_nodes=$(docker_compose exec postgres psql -U ssalgten -d ssalgten -tAc "SELECT COUNT(*) FROM nodes WHERE nameCustomized = true;" 2>/dev/null)
    
    echo ""
    log_success "🎉 Agent节点名称覆盖问题修复完成！"
    echo ""
    echo "修复统计："
    echo "- 总节点数: $total_nodes"
    echo "- 受保护的自定义名称: $protected_nodes"
    echo "- 默认名称节点: $((total_nodes - protected_nodes))"
    echo ""
    echo "现在您的自定义节点名称将不会被Agent重连时覆盖！"
}

# 运行数据库迁移
run_database_migrations() {
    log_info "检查并运行数据库迁移..."
    
    # 确保数据库服务在运行
    if ! docker_compose ps postgres | grep -q "Up"; then
        log_info "启动数据库服务..."
        docker_compose up -d postgres
        sleep 10
    fi
    
    # 等待数据库就绪
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker_compose exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
            log_success "数据库已准备就绪"
            break
        fi
        attempt=$((attempt + 1))
        echo "等待数据库启动... ($attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "数据库启动超时，跳过迁移步骤"
        return 1
    fi
    
    # 运行Prisma迁移
    log_info "应用数据库迁移..."
    if docker_compose exec backend npx prisma migrate deploy 2>/dev/null; then
        log_success "数据库迁移完成"
    else
        log_warning "数据库迁移失败，但不影响主要功能"
    fi
    
    # 生成Prisma客户端
    log_info "更新数据库客户端..."
    if docker_compose exec backend npx prisma generate 2>/dev/null; then
        log_success "数据库客户端更新完成"
    else
        log_warning "数据库客户端更新失败，重启后端服务可能解决此问题"
    fi
}

update_system() {
    local use_image=true
    local image_registry=""
    local image_namespace=""
    local image_tag=""
    local compose_override=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --image|--from-image|--ghcr)
                use_image=true
                shift
                ;;
            --source)
                use_image=false
                shift
                ;;
            --registry)
                image_registry=$2
                shift 2
                ;;
            --namespace|--repo)
                image_namespace=$2
                shift 2
                ;;
            --tag)
                image_tag=$2
                shift 2
                ;;
            --compose-file)
                compose_override=$2
                shift 2
                ;;
            --help)
                echo "用法: update [--image|--source] [--registry ghcr.io] [--namespace owner/repo] [--tag latest]"
                return 0
                ;;
            *)
                break
                ;;
        esac
    done

    if [[ "$use_image" == "true" ]]; then
        update_system_from_images "${image_registry:-$DEFAULT_IMAGE_REGISTRY}" "$image_namespace" "${image_tag:-$DEFAULT_IMAGE_TAG}" "$compose_override"
        return
    fi

    log_header "⚡ 更新系统"
    
    cd "$APP_DIR"
    
    # 如果不是 Git 仓库，走归档包更新流程
    if ! git rev-parse --git-dir &> /dev/null; then
        log_warning "当前目录不是Git仓库，切换为归档包更新模式"
        update_system_from_archive
        return $?
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
    # 强制刷新输出缓冲区，确保SSH终端显示完整输出
    flush_output
    if ! docker_compose up -d --build --remove-orphans; then
        # 强制刷新输出并等待
        flush_output
        echo "⚠️ Docker服务构建遇到问题，尝试分步启动"
        log_warning "整体启动失败，尝试仅启动核心服务 (database/redis/backend/frontend/updater)..."
        local core_services=(database redis backend frontend updater)
        for s in "${core_services[@]}"; do
            docker_compose up -d --build --no-deps "$s" 2>/dev/null || true
        done
        # 尝试启动 agent（忽略失败）
        docker_compose up -d --no-deps agent-nyc 2>/dev/null || log_warning "agent-nyc 启动失败，已忽略（可能端口冲突）"
    else
        # 强制刷新输出并等待，确保Docker输出完全显示
        flush_output
        echo "✅ Docker服务构建和启动完成"
    fi

    sleep 15
    
    # 运行数据库迁移（包含Agent名称覆盖问题的修复）
    run_database_migrations
    
    # 动态检测端口
    detect_ports
    flush_output
    
    # 健康检查 (更新后需要更长时间启动)
    echo
    log_info "正在进行健康检查..."
    echo "  这可能需要几分钟时间，请耐心等待..."
    echo
    flush_output
    
    local healthy=true
    FORCE_VERBOSE=true health_check "backend" "http://localhost:${BACKEND_PORT}/api/health" 20 3 10 || healthy=false
    health_check "frontend" "http://localhost:${FRONTEND_PORT}/" 12 3 8 || healthy=false
    flush_output
    
    echo
    log_info "健康检查完成，正在显示最终结果..."
    flush_output
    
    if [[ "$healthy" == "true" ]]; then
        log_success "🎉 系统更新完成!（忽略非核心服务失败）"
        LAST_RESULT_MSG="更新完成 ✅"
        flush_output
        
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
        
        # 统一的完成提示
        echo
        log_header "✅ 更新结束"
        flush_output
        log_success "🎉 更新流程已顺利完成，欢迎继续使用 SsalgTen!"
        flush_output
        local frontend_hint="http://localhost:${FRONTEND_PORT}/"
        if [[ "${FRONTEND_PORT}" == "80" ]]; then frontend_hint="http://localhost/"; fi
        local backend_hint="http://localhost:${BACKEND_PORT}/api/health"
        echo "  • 前端:   ${frontend_hint} (或使用你的域名)"
        echo "  • 后端:   ${backend_hint}"
        echo "  • 状态:   ssalgten status"
        echo "  • 日志:   ssalgten logs backend -n 200"
        echo "  • 提示:   浏览器强制刷新 (Ctrl/Cmd + Shift + R)"
        flush_output
        
    else
        log_warning "更新完成，但核心健康检查未通过，请查看日志"
        LAST_RESULT_MSG="更新完成但健康检查未通过 ⚠️"
        flush_output
        # 即使健康检查失败也输出完成提示，便于用户下一步操作
        echo
        log_header "⚠️ 更新结束（存在问题）"
        flush_output
        local frontend_hint="http://localhost:${FRONTEND_PORT}/"
        if [[ "${FRONTEND_PORT}" == "80" ]]; then frontend_hint="http://localhost/"; fi
        local backend_hint="http://localhost:${BACKEND_PORT}/api/health"
        echo "  • 前端:   ${frontend_hint} (或使用你的域名)"
        echo "  • 后端:   ${backend_hint}"
        echo "  • 状态:   ssalgten status"
        echo "  • 日志:   ssalgten logs backend -n 200"
        echo "  • 提示:   若问题持续，请提交日志信息"
        flush_output
        return 1
    fi
}

# 非Git环境：通过GitHub归档包更新
update_system_from_archive() {
    log_info "使用归档包进行更新..."

    # 工具检测
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        die "缺少下载工具（curl 或 wget），无法进行更新"
    fi

    # 创建备份
    local backup_dir=".backup/update_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    log_info "备份关键文件到: $backup_dir"
    for f in .env docker-compose.yml docker-compose.*.yml Dockerfile.* Dockerfile; do
        [[ -e "$f" ]] && cp -a "$f" "$backup_dir/" 2>/dev/null || true
    done

    # 停止服务
    log_info "停止服务..."
    docker_compose down --remove-orphans >/dev/null 2>&1 || true

    # 下载归档
    local tmp_dir="/tmp/ssalgten_update_$$"
    local archive_tar="$tmp_dir/main.tar.gz"
    mkdir -p "$tmp_dir"
    local url_tar="https://github.com/lonelyrower/SsalgTen/archive/refs/heads/main.tar.gz"
    log_info "下载归档包: $url_tar"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url_tar" -o "$archive_tar" || die "下载归档包失败"
    else
        wget -q "$url_tar" -O "$archive_tar" || die "下载归档包失败"
    fi

    # 解压
    tar -xzf "$archive_tar" -C "$tmp_dir" || die "解压归档包失败"
    local src_dir
    src_dir="$(find "$tmp_dir" -maxdepth 1 -type d -name 'SsalgTen-*' | head -1)"
    [[ -d "$src_dir" ]] || die "未找到解压目录"

    # 覆盖更新（保留 .env 与数据卷）
    log_info "同步最新代码到 $APP_DIR"
    # 同步这些目录/文件：backend frontend agent scripts docker-compose*.yml Dockerfile*
    for item in backend frontend agent scripts docker-compose.yml docker-compose.https.yml docker-compose.production.yml Dockerfile*; do
        if [[ -e "$src_dir/$item" ]]; then
            if [[ -d "$src_dir/$item" ]]; then
                rm -rf "$APP_DIR/$item" 2>/dev/null || true
                cp -a "$src_dir/$item" "$APP_DIR/" || die "复制 $item 失败"
            else
                cp -a "$src_dir/$item" "$APP_DIR/" || die "复制 $item 失败"
            fi
        fi
    done

    # 重新启动服务
    log_info "重新构建并启动服务..."
    # 强制刷新输出缓冲区，确保SSH终端显示完整输出
    flush_output
    if docker_compose up -d --build --remove-orphans; then
        # 强制刷新输出并等待，确保Docker输出完全显示
        flush_output
        echo "✅ Docker服务构建和启动完成"
        # 动态检测端口并健康检查
        detect_ports
        flush_output
        
        # 等待服务启动
        sleep 15
        
        echo
        log_info "正在进行快速健康检查（归档包模式）..."
        flush_output
        
        local healthy=true
        # 快速健康检查，减少等待时间
        health_check "backend" "http://localhost:${BACKEND_PORT}/api/health" 6 3 5 || healthy=false
        health_check "frontend" "http://localhost:${FRONTEND_PORT}/" 4 3 5 || healthy=false
        flush_output
        
        if [[ "$healthy" == "true" ]]; then
            log_success "🎉 系统更新完成! (归档包模式)"
            LAST_RESULT_MSG="更新完成 ✅"
        else
            log_warning "更新完成，但部分服务可能异常"
            LAST_RESULT_MSG="更新完成但健康检查未通过 ⚠️"
        fi
        flush_output
        
        # 统一的完成提示
        echo
        log_header "✅ 更新结束"
        flush_output
        log_success "🎉 更新流程已顺利完成，欢迎继续使用 SsalgTen!"
        flush_output
        local frontend_hint="http://localhost:${FRONTEND_PORT}/"
        if [[ "${FRONTEND_PORT}" == "80" ]]; then frontend_hint="http://localhost/"; fi
        local backend_hint="http://localhost:${BACKEND_PORT}/api/health"
        echo "  • 前端:   ${frontend_hint} (或使用你的域名)"
        echo "  • 后端:   ${backend_hint}"
        echo "  • 状态:   ssalgten status"
        echo "  • 日志:   ssalgten logs backend -n 200"
        echo "  • 提示:   浏览器强制刷新 (Ctrl/Cmd + Shift + R)"
        flush_output
    else
        log_error "服务启动失败，尝试回滚关键文件"
        # 回滚关键文件
        for f in $(ls -1 "$backup_dir" 2>/dev/null); do
            cp -a "$backup_dir/$f" "$APP_DIR/" 2>/dev/null || true
        done
        docker_compose up -d --remove-orphans || true
        rm -rf "$tmp_dir"
        return 1
    fi

    # 清理临时文件
    rm -rf "$tmp_dir"
    return 0
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
random_string() {
    local len=${1:-32}
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len" 2>/dev/null || date +%s%N | sha1sum | cut -c1-"$len"
}

ensure_env_kv() {
    local key="$1"; local val="$2"; local file="${3:-.env}"
    if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
        sed -i "s#^${key}=.*#${key}=${val//#/\#}#" "$file"
    else
        echo "${key}=${val}" >> "$file"
    fi
}

ensure_env_basics_image() {
    [[ -f .env ]] || touch .env
    local dbpass jwt api
    dbpass=$(grep -E '^DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2-)
    jwt=$(grep -E '^JWT_SECRET=' .env 2>/dev/null | cut -d= -f2-)
    api=$(grep -E '^API_KEY_SECRET=' .env 2>/dev/null | cut -d= -f2-)
    [[ -n "$dbpass" ]] || dbpass=$(random_string 32)
    [[ -n "$jwt" ]] || jwt=$(random_string 64)
    [[ -n "$api" ]] || api=$(random_string 32)
    ensure_env_kv IMAGE_REGISTRY "${IMAGE_REGISTRY:-$DEFAULT_IMAGE_REGISTRY}" .env
    ensure_env_kv IMAGE_NAMESPACE "${IMAGE_NAMESPACE:-$(detect_default_image_namespace)}" .env
    ensure_env_kv IMAGE_TAG "${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}" .env
    ensure_env_kv DB_PASSWORD "$dbpass" .env
    ensure_env_kv JWT_SECRET "$jwt" .env
    ensure_env_kv API_KEY_SECRET "$api" .env
}

ensure_env_basics_source() {
    [[ -f .env ]] || touch .env
    local dbpass jwt api
    dbpass=$(grep -E '^DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2-)
    jwt=$(grep -E '^JWT_SECRET=' .env 2>/dev/null | cut -d= -f2-)
    api=$(grep -E '^API_KEY_SECRET=' .env 2>/dev/null | cut -d= -f2-)
    [[ -n "$dbpass" ]] || dbpass=$(random_string 32)
    [[ -n "$jwt" ]] || jwt=$(random_string 64)
    [[ -n "$api" ]] || api=$(random_string 32)
    ensure_env_kv DB_PASSWORD "$dbpass" .env
    ensure_env_kv JWT_SECRET "$jwt" .env
    ensure_env_kv API_KEY_SECRET "$api" .env
}

# ============== 新的部署相关函数 ==============

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if ! command -v apt-get >/dev/null 2>&1 && ! command -v yum >/dev/null 2>&1; then
        log_warning "未检测到支持的包管理器 (apt-get/yum)"
    fi
    
    # 检查内存
    local mem_gb=$(free -g | awk 'NR==2{print $2}' 2>/dev/null || echo "0")
    if [[ $mem_gb -lt 1 ]]; then
        log_warning "系统内存少于1GB，可能影响性能"
    fi
    
    # 检查磁盘空间
    local disk_gb=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//' 2>/dev/null || echo "0")
    if [[ $disk_gb -lt 5 ]]; then
        log_warning "可用磁盘空间少于5GB，可能不足"
    fi
    
    # 检查Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_info "Docker 未安装，将自动安装"
        install_docker
    else
        log_success "Docker 已安装: $(docker --version)"
    fi
    
    # 检查Docker Compose
    if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
        log_info "Docker Compose 未安装，将自动安装"
        install_docker_compose
    else
        log_success "Docker Compose 已安装"
    fi
}

# 安装Docker
install_docker() {
    log_info "安装 Docker..."
    
    if command -v apt-get >/dev/null 2>&1; then
        # Ubuntu/Debian
        run_as_root apt-get update
        run_as_root apt-get install -y ca-certificates curl gnupg lsb-release
        
        # 添加Docker官方GPG密钥
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_as_root gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # 添加Docker仓库
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | run_as_root tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        run_as_root apt-get update
        run_as_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
    elif command -v yum >/dev/null 2>&1; then
        # CentOS/RHEL
        run_as_root yum install -y yum-utils
        run_as_root yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        run_as_root yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        run_as_root systemctl start docker
        run_as_root systemctl enable docker
    else
        log_error "不支持的操作系统，请手动安装Docker"
        exit 1
    fi
    
    # 添加用户到docker组
    if [[ "$RUNNING_AS_ROOT" != "true" ]]; then
        run_as_root usermod -aG docker "$USER"
        log_warning "请重新登录以使Docker权限生效，或运行: newgrp docker"
    fi
    
    log_success "Docker 安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose 插件已可用"
        return 0
    fi
    
    log_info "安装 Docker Compose..."
    
    # 尝试安装compose插件
    if command -v apt-get >/dev/null 2>&1; then
        run_as_root apt-get update
        run_as_root apt-get install -y docker-compose-plugin
    elif command -v yum >/dev/null 2>&1; then
        run_as_root yum install -y docker-compose-plugin
    else
        # 下载二进制文件
        local compose_version="2.21.0"
        run_as_root curl -L "https://github.com/docker/compose/releases/download/v$compose_version/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        run_as_root chmod +x /usr/local/bin/docker-compose
    fi
    
    log_success "Docker Compose 安装完成"
}

# 清理Docker源（仅适用于APT系统）
cleanup_docker_sources() {
    # 只在APT系统上清理Docker源
    if ! command -v apt >/dev/null 2>&1; then
        log_info "非APT系统，跳过Docker源清理"
        return 0
    fi
    
    log_info "彻底清理Docker源残留配置..."
    
    # 停止可能运行的apt进程
    run_as_root pkill -f apt || true
    sleep 3
    
    # 删除所有Docker相关源文件
    run_as_root rm -f /etc/apt/sources.list.d/docker*.list
    run_as_root rm -f /etc/apt/sources.list.d/*docker*.list
    run_as_root rm -f /usr/share/keyrings/docker*.gpg
    run_as_root rm -f /usr/share/keyrings/*docker*.gpg
    
    # 从主源文件中删除docker.com条目
    if run_as_root grep -q "docker\.com" /etc/apt/sources.list 2>/dev/null; then
        run_as_root cp /etc/apt/sources.list /etc/apt/sources.list.backup
        run_as_root sed -i '/docker\.com/d' /etc/apt/sources.list
    fi
    
    # 清理包管理器缓存
    run_as_root apt clean
    run_as_root apt autoclean
    run_as_root rm -rf /var/lib/apt/lists/*
    
    log_success "Docker源清理完成"
}

# 安装系统依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 检测包管理器
    if command -v apt >/dev/null 2>&1; then
        log_info "检测到APT包管理器 (Debian/Ubuntu)"
        
        # 先彻底清理Docker源
        cleanup_docker_sources
        
        # 更新系统
        run_as_root apt update
        run_as_root apt upgrade -y
        
        # 安装基础工具
        run_as_root apt install -y curl wget git vim ufw htop unzip jq
        
        # 配置防火墙
        run_as_root ufw --force reset
        run_as_root ufw allow ssh
        run_as_root ufw allow ${HTTP_PORT:-80}
        run_as_root ufw allow ${HTTPS_PORT:-443}
        run_as_root ufw --force enable
        
    elif command -v yum >/dev/null 2>&1; then
        log_info "检测到YUM包管理器 (CentOS/RHEL 7)"
        
        # 更新系统
        run_as_root yum update -y
        
        # 安装EPEL源
        run_as_root yum install -y epel-release
        
        # 安装基础工具
        run_as_root yum install -y curl wget git vim htop unzip jq firewalld
        
        # 配置防火墙
        run_as_root systemctl enable firewalld
        run_as_root systemctl start firewalld
        run_as_root firewall-cmd --add-service=ssh --permanent
        run_as_root firewall-cmd --add-port=${HTTP_PORT:-80}/tcp --permanent
        run_as_root firewall-cmd --add-port=${HTTPS_PORT:-443}/tcp --permanent
        run_as_root firewall-cmd --reload
        
    elif command -v dnf >/dev/null 2>&1; then
        log_info "检测到DNF包管理器 (CentOS/RHEL 8+/Fedora)"
        
        # 更新系统
        run_as_root dnf update -y
        
        # 安装基础工具
        run_as_root dnf install -y curl wget git vim htop unzip jq firewalld
        
        # 配置防火墙
        run_as_root systemctl enable firewalld
        run_as_root systemctl start firewalld
        run_as_root firewall-cmd --add-service=ssh --permanent
        run_as_root firewall-cmd --add-port=${HTTP_PORT:-80}/tcp --permanent
        run_as_root firewall-cmd --add-port=${HTTPS_PORT:-443}/tcp --permanent
        run_as_root firewall-cmd --reload
        
    else
        log_error "不支持的操作系统，未找到 apt/yum/dnf 包管理器"
        exit 1
    fi
    
    log_success "系统依赖安装完成"
}

# 安装Nginx
install_nginx() {
    log_info "安装Nginx..."
    
    if command -v apt >/dev/null 2>&1; then
        run_as_root apt install -y nginx
        # 清理可能残留的站点配置
        run_as_root rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
        run_as_root rm -f /etc/nginx/sites-enabled/ssalgten 2>/dev/null || true
        run_as_root rm -f /etc/nginx/conf.d/ssalgten.conf 2>/dev/null || true

        # 检查nginx配置是否正确
        if ! run_as_root nginx -t >/dev/null 2>&1; then
            log_warning "Nginx配置检查失败，尝试修复..."
            run_as_root apt install --reinstall -y nginx-common
        fi
        
    elif command -v yum >/dev/null 2>&1; then
        run_as_root yum install -y nginx
        run_as_root rm -f /etc/nginx/conf.d/ssalgten.conf 2>/dev/null || true
        
    elif command -v dnf >/dev/null 2>&1; then
        run_as_root dnf install -y nginx
        run_as_root rm -f /etc/nginx/conf.d/ssalgten.conf 2>/dev/null || true
        
    else
        log_error "无法安装Nginx，未找到支持的包管理器"
        exit 1
    fi
    
    # 停止nginx（以防正在运行）
    run_as_root systemctl stop nginx 2>/dev/null || true
    
    log_success "Nginx 安装完成"
}

# 创建应用目录
create_application_directory() {
    log_info "创建应用目录..."
    
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        # 创建ssalgten用户用于运行应用
        if ! id "ssalgten" &>/dev/null; then
            log_info "创建专用应用用户 ssalgten..."
            useradd -r -s /bin/bash -d $APP_DIR ssalgten
            
            # 添加到docker组（如果docker已安装）
            if command -v docker >/dev/null 2>&1; then
                usermod -aG docker ssalgten
                log_info "已将ssalgten用户添加到docker组"
            fi
        fi
        
        mkdir -p $APP_DIR
        chown -R ssalgten:ssalgten $APP_DIR
        
        # 确保root可以访问目录进行管理
        chmod 755 $APP_DIR
        
        log_info "应用将以 ssalgten 用户身份运行"
    else
        run_as_root mkdir -p $APP_DIR
        run_as_root chown $USER:$USER $APP_DIR
    fi
    
    log_success "应用目录创建: $APP_DIR"
}

# 收集部署信息
collect_deployment_info() {
    log_header "🔧 部署配置向导"
    echo ""
    
    echo "请选择部署类型："
    echo "1. 完整部署 (域名 + Let's Encrypt SSL + HTTPS)"
    echo "2. Cloudflare部署 (域名 + Cloudflare SSL + HTTPS)"  
    echo "3. 简单部署 (仅IP访问，无SSL)"
    echo ""
    
    local deploy_type
    while true; do
        read -p "请选择 [1-3]: " deploy_type
        case "$deploy_type" in
            1)
                ENABLE_SSL=true
                SSL_MODE="letsencrypt"
                break
                ;;
            2)
                ENABLE_SSL=true
                SSL_MODE="cloudflare"
                break
                ;;
            3)
                ENABLE_SSL=false
                SSL_MODE="none"
                break
                ;;
            *) echo "请输入有效选项 (1-3)" ;;
        esac
    done
    
    # 收集域名信息
    if [[ "$ENABLE_SSL" == "true" ]]; then
        echo ""
        log_info "配置域名信息"
        
        while [[ -z "$DOMAIN" ]]; do
            DOMAIN=$(prompt_input "您的域名 (如: example.com)")
            if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$ ]]; then
                log_error "域名格式不正确，请重新输入"
                DOMAIN=""
            fi
        done
        
        if [[ "$SSL_MODE" == "letsencrypt" ]]; then
            while [[ -z "$SSL_EMAIL" ]]; do
                SSL_EMAIL=$(prompt_input "SSL证书邮箱地址")
                if [[ ! "$SSL_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
                    log_error "邮箱格式不正确，请重新输入"
                    SSL_EMAIL=""
                fi
            done
        fi
    else
        echo ""
        log_info "配置服务器信息"
        
        # 尝试自动检测IP
        local detected_ip=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null || echo "")
        if [[ -n "$detected_ip" ]]; then
            DOMAIN=$(prompt_input "服务器IP地址" "$detected_ip")
        else
            DOMAIN=$(prompt_input "请手动输入服务器IP地址")
        fi
    fi
    
    # 端口配置
    echo ""
    log_info "端口配置 (回车使用默认值):"
    
    HTTP_PORT=$(prompt_port "HTTP端口" "80")
    HTTPS_PORT=$(prompt_port "HTTPS端口" "443")
    FRONTEND_PORT=$(prompt_port "前端服务端口" "3000")
    BACKEND_PORT=$(prompt_port "后端API端口" "3001")
    DB_PORT=$(prompt_port "数据库端口" "5432")
    REDIS_PORT=$(prompt_port "Redis端口" "6379")
    
    # 生成安全密钥
    echo ""
    log_info "生成安全配置..."
    
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    API_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    AGENT_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # 可选服务配置
    echo ""
    log_info "可选服务配置 (可直接回车跳过):"
    IPINFO_TOKEN=$(prompt_input "IPInfo Token (可选，提升ASN查询精度)" "")
    
    log_success "配置收集完成"
}

# 生产环境部署主函数
deploy_production() {
    log_header "🚀 SsalgTen 生产环境部署"
    echo ""
    
    # 检查用户权限
    if [[ $EUID -eq 0 ]]; then
        RUNNING_AS_ROOT=true
        log_warning "⚠️ 检测到root用户运行"
        echo ""
        echo -e "${YELLOW}安全建议：${NC}"
        echo "- 为了系统安全，建议使用专用用户运行应用程序"
        echo "- 推荐创建专用用户： useradd -m -s /bin/bash ssalgten"
        echo "- 然后切换用户运行： su - ssalgten"
        echo ""
        
        if ! prompt_yes_no "是否仍要继续使用root用户部署" "n"; then
            log_info "已选择创建专用用户，这是更安全的选择！"
            echo ""
            echo -e "${GREEN}请执行以下命令创建专用用户：${NC}"
            echo "  useradd -m -s /bin/bash ssalgten"
            echo "  usermod -aG sudo ssalgten"
            echo "  passwd ssalgten"
            echo "  su - ssalgten"
            echo ""
            echo "然后重新运行此脚本即可。"
            return 0
        fi
        
        log_warning "继续使用root用户部署，将进行安全加固配置"
    fi
    
    # 执行部署步骤
    check_system_requirements
    collect_deployment_info
    install_system_dependencies
    install_docker
    install_nginx
    create_application_directory
    
    cd "$APP_DIR"
    
    # 下载项目源码
    download_source_code
    
    # 配置环境变量
    create_environment_config
    
    # 配置Nginx
    create_nginx_config
    
    # 安装SSL证书
    install_ssl_certificate
    
    # 构建和启动服务
    build_and_start_services
    
    # 验证部署
    verify_deployment
    
    # 创建管理脚本
    create_management_scripts
    
    # 保存部署信息
    save_deployment_info
    
    # 显示部署结果
    show_deployment_result
}

# 下载源码（完整项目）
download_source_code() {
    log_info "下载源码..."
    
    # 检查目录是否为空，如果不为空则清理
    if [[ "$(ls -A .)" ]]; then
        log_warning "目录不为空，清理现有文件..."
        rm -rf * .git 2>/dev/null || true
        rm -rf .[^.]* 2>/dev/null || true
    fi
    
    # 尝试多种下载方式
    local download_success=false
    local methods=(
        "git clone https://github.com/lonelyrower/SsalgTen.git ."
        "git clone https://github.com.cnpmjs.org/lonelyrower/SsalgTen.git ."
        "git clone https://hub.fastgit.xyz/lonelyrower/SsalgTen.git ."
    )
    
    # 尝试Git克隆
    for method in "${methods[@]}"; do
        log_info "尝试: $method"
        if eval "$method" 2>/dev/null; then
            download_success=true
            log_success "Git克隆成功"
            break
        else
            log_warning "Git克隆失败，尝试下一种方法..."
        fi
    done
    
    # 如果Git克隆都失败，使用wget下载ZIP包
    if [[ "$download_success" == false ]]; then
        log_warning "Git克隆失败，使用wget下载ZIP包..."
        
        local zip_urls=(
            "https://github.com/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
            "https://github.com.cnpmjs.org/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
            "https://hub.fastgit.xyz/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
        )
        
        for zip_url in "${zip_urls[@]}"; do
            log_info "尝试下载: $zip_url"
            if wget -q "$zip_url" -O main.zip 2>/dev/null; then
                if unzip -q main.zip 2>/dev/null; then
                    mv SsalgTen-main/* . 2>/dev/null
                    mv SsalgTen-main/.* . 2>/dev/null || true
                    rmdir SsalgTen-main 2>/dev/null
                    rm -f main.zip
                    download_success=true
                    log_success "ZIP包下载成功"
                    break
                fi
            fi
        done
    fi
    
    # 最后检查是否下载成功
    if [[ "$download_success" == false ]]; then
        log_error "所有下载方法都失败了"
        log_error "请检查网络连接或手动下载源码"
        echo ""
        echo "手动下载方法："
        echo "1. 访问 https://github.com/lonelyrower/SsalgTen"
        echo "2. 下载ZIP文件并解压到 $APP_DIR"
        echo "3. 重新运行此脚本"
        exit 1
    fi
    
    log_success "源码下载完成"
}

# 创建环境配置
create_environment_config() {
    log_info "创建环境配置..."
    
    # 创建主环境配置
    cat > .env << EOF
# SsalgTen 生产环境配置
NODE_ENV=production
DOMAIN=$DOMAIN

# 端口配置
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
DB_PORT=$DB_PORT
REDIS_PORT=$REDIS_PORT

# 前端配置（使用相对路径，便于IP与域名间切换）
VITE_API_URL=/api

# CORS/前端来源（由部署脚本显式填充，确保与部署模式一致）
CORS_ORIGIN=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"; else echo "http://$DOMAIN,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"; fi)
FRONTEND_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)

# 数据库配置
POSTGRES_USER=ssalgten
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=ssalgten
DB_PASSWORD=$DB_PASSWORD
EOF
    
    # 创建后端环境配置（供容器内或手动运行参考；Docker Compose 将优先读取根目录 .env）
    cat > backend/.env << EOF
# 生产环境标识
NODE_ENV=production
PORT=$BACKEND_PORT
HOST=0.0.0.0

# 数据库配置 (Docker内部通信使用默认端口5432)
DATABASE_URL="postgresql://ssalgten:$DB_PASSWORD@postgres:5432/ssalgten?schema=public"

# JWT安全配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# API安全配置
API_KEY_SECRET=$API_SECRET
# 注意：运行 docker compose 时将读取根目录 .env 的 CORS_ORIGIN/FRONTEND_URL
# 这里仍写入一份，便于容器内/手动运行参考
CORS_ORIGIN=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"; else echo "http://$DOMAIN,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"; fi)
FRONTEND_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)

# 日志配置
LOG_LEVEL=info
ENABLE_MORGAN=true

# IP信息服务
IPINFO_TOKEN=$IPINFO_TOKEN

# 代理配置
DEFAULT_AGENT_API_KEY=$AGENT_KEY
AGENT_HEARTBEAT_INTERVAL=30000
EOF
    
    # 创建前端环境配置
    cat > frontend/.env << EOF
# API配置 - 使用相对路径，交由前置或容器内Nginx反代
VITE_API_URL=/api
VITE_APP_NAME=SsalgTen Network Monitor
VITE_APP_VERSION=1.0.0
VITE_ENABLE_DEBUG=false
VITE_MAP_PROVIDER=openstreetmap
VITE_MAP_API_KEY=
EOF

    # 确保前端配置在Docker构建时可用
    cp frontend/.env frontend/.env.production
    
    # 创建Agent环境配置模板
    cat > agent/.env.template << EOF
# 代理配置模板
AGENT_ID=your-unique-agent-id
MASTER_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN"; fi)
AGENT_API_KEY=$AGENT_KEY

# 节点信息
NODE_NAME="Your Node Name"
NODE_COUNTRY="Your Country"
NODE_CITY="Your City"
NODE_PROVIDER="Your Provider"
NODE_LATITUDE=0.0
NODE_LONGITUDE=0.0
PORT=3002
EOF
    
    log_success "环境配置创建完成"
}

# 创建Nginx配置
create_nginx_config() {
    log_info "创建Nginx配置..."
    
    # 如果没有启用SSL，跳过Nginx配置（使用Docker内置nginx）
    if [[ "$ENABLE_SSL" != "true" ]]; then
        log_info "未启用SSL，跳过Nginx配置（使用Docker内置代理）"
        return 0
    fi
    
    # 检测Nginx配置目录结构
    if [[ -d "/etc/nginx/sites-available" ]]; then
        NGINX_CONFIG_FILE="/etc/nginx/sites-available/ssalgten"
        NGINX_ENABLE_CMD="run_as_root ln -sf /etc/nginx/sites-available/ssalgten /etc/nginx/sites-enabled/"
    else
        NGINX_CONFIG_FILE="/etc/nginx/conf.d/ssalgten.conf"
        NGINX_ENABLE_CMD="# 配置已自动启用"
        run_as_root mkdir -p /etc/nginx/conf.d
    fi
    
    # 创建基础Nginx配置
    run_as_root tee $NGINX_CONFIG_FILE > /dev/null << EOF
# SsalgTen Nginx 配置
server {
    listen ${HTTP_PORT:-80};
    server_name $DOMAIN www.$DOMAIN;

    # 基础安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # 通用优化
    client_max_body_size 20m;
    gzip on;
    gzip_proxied any;
    gzip_types application/json application/javascript text/css text/plain application/xml;

    # ACME 挑战
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # 前端代理
    location / {
        proxy_pass http://localhost:${FRONTEND_PORT:-3000};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:${BACKEND_PORT:-3001};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
    
    # 启用配置
    eval $NGINX_ENABLE_CMD
    
    # 测试配置
    if ! run_as_root nginx -t; then
        log_error "Nginx配置测试失败"
        exit 1
    fi
    
    log_success "Nginx配置创建完成"
}

# 安装SSL证书
install_ssl_certificate() {
    if [[ "$ENABLE_SSL" != "true" ]]; then
        log_info "未启用SSL，跳过证书安装"
        return 0
    fi
    
    log_info "安装SSL证书..."
    
    if [[ "$SSL_MODE" == "letsencrypt" ]]; then
        # 安装Certbot
        if command -v apt >/dev/null 2>&1; then
            run_as_root apt install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            run_as_root yum install -y certbot python3-certbot-nginx
        elif command -v dnf >/dev/null 2>&1; then
            run_as_root dnf install -y certbot python3-certbot-nginx
        fi
        
        # 申请证书
        run_as_root certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive
        
        # 设置自动续期
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | run_as_root crontab -
        
    else
        log_info "Cloudflare SSL模式，证书由Cloudflare自动管理"
    fi
    
    log_success "SSL证书配置完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    # 等待服务启动
    sleep 10
    
    # 检查Docker容器状态
    if ! docker_compose ps | grep -q "Up"; then
        log_warning "部分服务可能未正常启动"
    fi
    
    # 检查服务连通性
    local frontend_url="http://localhost:${FRONTEND_PORT:-3000}"
    local backend_url="http://localhost:${BACKEND_PORT:-3001}/api/health"
    
    if curl -sf "$frontend_url" >/dev/null 2>&1; then
        log_success "前端服务验证通过"
    else
        log_warning "前端服务验证失败"
    fi
    
    if curl -sf "$backend_url" >/dev/null 2>&1; then
        log_success "后端服务验证通过"
    else
        log_warning "后端服务验证失败"
    fi
    
    log_success "部署验证完成"
}

# 创建管理脚本
create_management_scripts() {
    log_info "创建管理脚本..."
    
    # 在系统路径创建ssalgten命令
    run_as_root tee /usr/local/bin/ssalgten > /dev/null << 'EOF'
#!/bin/bash
exec /opt/ssalgten/scripts/ssalgten.sh "$@"
EOF
    run_as_root chmod +x /usr/local/bin/ssalgten
    
    log_success "管理脚本创建完成"
}

# 保存部署信息
save_deployment_info() {
    log_info "保存部署信息..."
    
    cat > deployment-info.txt << EOF
SsalgTen 部署信息
部署时间: $(date)
域名: $DOMAIN
SSL启用: $ENABLE_SSL
前端端口: $FRONTEND_PORT
后端端口: $BACKEND_PORT

访问地址:
- 前端: $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN:$FRONTEND_PORT"; fi)
- 后端API: $(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN/api"; else echo "http://$DOMAIN:$BACKEND_PORT/api"; fi)

管理命令:
- 系统状态: ssalgten status
- 查看日志: ssalgten logs
- 重启服务: ssalgten restart
EOF
    
    log_success "部署信息已保存到 deployment-info.txt"
}

# 配置compose文件
configure_compose_file() {
    log_info "配置Docker Compose..."
    
    if [[ "$ENABLE_SSL" == "true" ]]; then
        COMPOSE_FILE="$APP_DIR/docker-compose.https.yml"
        log_info "使用HTTPS配置: docker-compose.https.yml"
    else
        COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
        log_info "使用生产配置: docker-compose.production.yml"
    fi
    
    export COMPOSE_FILE
    export COMPOSE_PROJECT_NAME="ssalgten"
}

# 部署服务
# 检查构建资源
check_build_resources() {
    log_info "检查构建所需资源..."
    
    # 检查内存
    local total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    
    # 检查磁盘空间
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local disk_available=$(df -h / | awk 'NR==2{print $4}')
    
    echo "系统资源状态:"
    echo "  内存: ${available_mem}MB 可用 / ${total_mem}MB 总计"
    echo "  磁盘: ${disk_available} 可用 (${disk_usage}% 已使用)"
    
    # 资源警告
    local warnings=0
    if [[ $total_mem -lt 1000 ]]; then
        log_warning "内存不足 (${total_mem}MB < 1000MB)，构建可能失败"
        echo "  建议: 创建swap文件或升级VPS配置"
        warnings=$((warnings + 1))
    fi
    
    if [[ $disk_usage -gt 85 ]]; then
        log_warning "磁盘空间不足 (${disk_usage}% > 85%)，构建可能失败"
        echo "  建议: 清理Docker缓存或扩展存储"
        warnings=$((warnings + 1))
    fi
    
    if [[ $warnings -gt 0 ]]; then
        echo ""
        read -p "检测到资源不足，是否继续构建？建议先运行修复脚本 [Y/N]: " continue_build
        if [[ "$continue_build" != "y" && "$continue_build" != "Y" ]]; then
            log_info "构建已取消，请先解决资源问题"
            log_info "运行修复脚本: bash scripts/fix-docker-build.sh"
            exit 1
        else
            log_warning "继续构建，但将启用资源优化模式"
            # 设置优化模式标志
            export RESOURCE_CONSTRAINED=true
            # 自动运行资源优化
            log_info "自动启用资源优化..."
            # 若系统未启用swap则按内存情况创建临时swap
            local has_swap=$(cat /proc/swaps 2>/dev/null | awk 'NR>1{print $1}' | wc -l)
            if [[ $has_swap -eq 0 ]]; then
                # 动态确定swap大小：默认1G，若总内存<1000且可用<800则用2G
                local swap_size_mb=${SWAP_SIZE_MB:-0}
                if [[ $swap_size_mb -le 0 ]]; then
                    if [[ $total_mem -lt 1000 && $available_mem -lt 800 ]]; then
                        swap_size_mb=2048
                    else
                        swap_size_mb=1024
                    fi
                fi
                log_info "创建临时swap文件 (${swap_size_mb}MB)..."
                run_as_root fallocate -l ${swap_size_mb}M /tmp/swapfile 2>/dev/null || run_as_root dd if=/dev/zero of=/tmp/swapfile bs=1M count=${swap_size_mb}
                run_as_root chmod 600 /tmp/swapfile
                run_as_root mkswap /tmp/swapfile
                run_as_root swapon /tmp/swapfile
                log_success "临时swap文件已创建"
            else
                log_info "检测到系统已启用swap，跳过创建"
            fi
        fi
    else
        log_success "资源检查通过"
    fi
}

build_and_start_services() {
    log_info "构建和启动服务..."
    
    # 使用生产专用docker_compose文件
    local compose_file="docker-compose.production.yml"
    
    # 检查系统资源
    check_build_resources
    
    # 构建Docker镜像（带错误处理和资源优化）
    log_info "开始构建Docker镜像..."
    
    # 根据资源情况选择构建策略
    if [[ "${RESOURCE_CONSTRAINED:-false}" == "true" ]]; then
        log_info "使用资源优化构建模式..."
        # 清理Docker缓存
        docker system prune -f >/dev/null 2>&1 || true
        
        # 分别构建服务以减少内存压力
        log_info "分别构建后端服务..."
        if ! timeout 1800 bash -c "$(declare -f docker_compose); docker_compose -f $compose_file build backend"; then
            log_error "后端构建失败或超时"
            exit 1
        fi
        
        # 清理中间缓存
        docker system prune -f >/dev/null 2>&1 || true
        
        log_info "分别构建前端服务..."
        if ! timeout 1800 bash -c "$(declare -f docker_compose); docker_compose -f $compose_file build frontend"; then
            log_error "前端构建失败或超时"
            exit 1
        fi
        
        log_success "资源优化构建完成"
    elif ! timeout 1200 bash -c "$(declare -f docker_compose); docker_compose -f $compose_file build --no-cache"; then
        log_error "Docker构建失败！"
        echo ""
        log_info "可能的解决方案："
        echo "1. 运行修复脚本: bash scripts/fix-docker-build.sh"
        echo "2. 手动清理Docker缓存: docker system prune -af"
        echo "3. 检查系统资源是否足够"
        echo "4. 分别构建服务: bash scripts/fix-docker-build.sh --separate-build"
        echo ""
        read -p "是否自动运行修复脚本？[Y/N]: " auto_fix
        if [[ "$auto_fix" != "n" && "$auto_fix" != "N" ]]; then
            if [[ -f "scripts/fix-docker-build.sh" ]]; then
                log_info "运行Docker构建修复脚本..."
                bash scripts/fix-docker-build.sh --separate-build
            else
                log_error "修复脚本不存在，请手动处理"
                exit 1
            fi
        else
            exit 1
        fi
    fi
    
    # 启动数据库
    docker_compose -f $compose_file up -d postgres
    log_info "等待数据库启动..."
    
    # 等待数据库健康检查通过
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker_compose -f $compose_file exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
            log_success "数据库已启动完成"
            break
        fi
        attempt=$((attempt + 1))
        echo "等待数据库启动... ($attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "数据库启动超时"
        exit 1
    fi
    
        # ==== 新增：数据库密码一致性检测与修复 ====
        log_info "检测数据库密码是否与当前配置一致..."
        # 使用当前期望密码尝试连接
        if docker_compose -f $compose_file exec -T postgres bash -c "PGPASSWORD=\"$DB_PASSWORD\" psql -U ssalgten -d ssalgten -c 'SELECT 1;'" > /dev/null 2>&1; then
                log_success "数据库凭据匹配 .env 配置"
        else
                # 尝试使用常见默认密码
                if docker_compose -f $compose_file exec -T postgres bash -c "PGPASSWORD=ssalgten_password psql -U ssalgten -d ssalgten -c 'SELECT 1;'" > /dev/null 2>&1; then
                        log_warning "检测到数据库实际密码与当前 .env 中 DB_PASSWORD 不一致 (容器仍使用旧密码)"
                        echo ""
                        echo "请选择处理方式："
                        echo "  1) 将数据库用户密码修改为当前新的 DB_PASSWORD (保留数据)"
                        echo "  2) 删除数据库卷并使用新密码重新初始化 (会清空数据)"
                        echo "  3) 使用旧密码继续，更新 .env 为旧密码 (不修改数据库)"
                        echo "  0) 取消部署"
                        echo ""
                        read -p "请输入选项 [1/2/3/0] (默认1): " fix_choice
                        fix_choice=${fix_choice:-1}
                        case "$fix_choice" in
                            1)
                                log_info "应用 ALTER USER 将数据库密码同步为新值..."
                                if docker_compose -f $compose_file exec -T postgres bash -c "PGPASSWORD=ssalgten_password psql -U ssalgten -d ssalgten -c \"ALTER USER ssalgten WITH PASSWORD '$DB_PASSWORD';\""; then
                                    log_success "数据库密码已更新"
                                else
                                    log_error "数据库密码更新失败，终止部署"
                                    exit 1
                                fi
                                ;;
                            2)
                                log_warning "即将删除数据卷 ssalgten-postgres-data 并重新初始化 (不可恢复)"
                                confirm_drop=$(prompt_yes_no "确认删除数据卷" "N")
                                if [[ "$confirm_drop" != "y" ]]; then
                                    log_info "已取消删除，终止部署以避免不一致"
                                    exit 1
                                fi
                                log_info "停止并移除容器..."
                                docker_compose -f $compose_file down
                                log_info "删除数据卷..."
                                docker volume rm ssalgten-postgres-data || true
                                log_info "使用新密码重新启动数据库..."
                                docker_compose -f $compose_file up -d postgres
                                # 重新等待健康
                                attempt=0
                                while [ $attempt -lt $max_attempts ]; do
                                    if docker_compose -f $compose_file exec postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
                                        log_success "数据库已重新初始化"
                                        break
                                    fi
                                    attempt=$((attempt + 1))
                                    echo "等待数据库重新初始化... ($attempt/$max_attempts)"
                                    sleep 2
                                done
                                if [ $attempt -eq $max_attempts ]; then
                                    log_error "数据库重新初始化超时"
                                    exit 1
                                fi
                                ;;
                            3)
                                log_info "使用旧密码继续部署，将回写 .env 中的 DB_PASSWORD 为旧值"
                                # 回写 .env (顶层) 与 backend/.env (如果已生成)
                                if grep -q '^DB_PASSWORD=' .env; then
                                    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=ssalgten_password/" .env
                                fi
                                if [[ -f backend/.env ]] && grep -q '^POSTGRES_PASSWORD=' backend/.env; then
                                    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=ssalgten_password/" backend/.env
                                fi
                                export DB_PASSWORD="ssalgten_password"
                                ;;
                            0)
                                log_info "用户取消部署"
                                exit 1
                                ;;
                            *)
                                log_warning "无效选项，默认执行 1) 更新数据库密码"
                                if docker_compose -f $compose_file exec -T postgres bash -c "PGPASSWORD=ssalgten_password psql -U ssalgten -d ssalgten -c \"ALTER USER ssalgten WITH PASSWORD '$DB_PASSWORD';\""; then
                                    log_success "数据库密码已更新"
                                else
                                    log_error "数据库密码更新失败，终止部署"
                                    exit 1
                                fi
                                ;;
                        esac
                else
                        log_error "无法使用当前密码或默认密码连接数据库，请手动检查"
                        log_info "可尝试: docker compose -f $compose_file exec postgres bash"
                        exit 1
                fi
        fi

    # 运行数据库初始化 (非交互式)
    log_info "初始化数据库..."
    
    # 显示数据库连接信息用于调试
    echo "数据库连接调试信息："
    echo "数据库用户: ssalgten"
    echo "数据库名: ssalgten"
    echo "数据库密码长度: ${#DB_PASSWORD} 字符"
    
    # 运行数据库迁移
    log_info "运行数据库迁移..."
    docker_compose -f $compose_file run --rm backend npx prisma migrate deploy
    
    # 运行数据库种子脚本创建管理员用户
    log_info "创建管理员用户和初始数据..."
    docker_compose -f $compose_file run --rm backend npm run db:seed
    
    # 启动所有服务
    docker_compose -f $compose_file up -d
    
    log_info "等待服务启动..."
    sleep 30
    
    log_success "服务构建和启动完成"
}

# 显示部署结果
show_deployment_result() {
    echo ""
    log_header "🎉 部署完成！"
    echo ""
    
    local access_url
    if [[ "$ENABLE_SSL" == "true" ]]; then
        access_url="https://$DOMAIN"
    else
        access_url="http://$DOMAIN:3000"
    fi
    
    echo -e "${GREEN}✅ SsalgTen 已成功部署${NC}"
    echo ""
    echo -e "${CYAN}访问地址:${NC} $access_url"
    echo -e "${CYAN}管理后台:${NC} $access_url/admin"
    echo -e "${CYAN}API接口:${NC} $access_url/api"
    echo ""
    echo -e "${YELLOW}默认管理员账户:${NC}"
    echo "  用户名: admin"
    echo "  密码: admin123"
    echo "  ${RED}⚠️ 请立即登录后台修改默认密码！${NC}"
    echo ""
    echo -e "${CYAN}应用目录:${NC} $APP_DIR"
    echo -e "${CYAN}配置文件:${NC} $APP_DIR/.env"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "  查看状态: $0 status"
    echo "  查看日志: $0 logs"
    echo "  重启服务: $0 restart"
    echo "  停止服务: $0 stop"
    echo ""
}

# 卸载系统
uninstall_system() {
    log_header "🗑️ 卸载 SsalgTen 系统"
    echo ""
    
    log_warning "此操作将完全删除 SsalgTen 系统和所有数据！"
    echo ""
    echo "将要删除的内容包括："
    echo "- 应用程序文件"
    echo "- Docker容器和镜像"
    echo "- 数据库数据"
    echo "- 配置文件"
    echo "- 备份文件"
    echo ""
    
    if [[ "$FORCE_MODE" != "true" ]]; then
        echo -e "${RED}⚠️ 此操作不可恢复！${NC}"
        echo ""
        if ! prompt_yes_no "确认要卸载吗" "n"; then
            log_info "卸载已取消"
            return 0
        fi
        
        echo ""
        log_warning "最后确认：请输入 'DELETE' 来确认卸载"
        read -p "确认输入: " confirm
        if [[ "$confirm" != "DELETE" ]]; then
            log_info "卸载已取消"
            return 0
        fi
    fi
    
    echo ""
    log_info "开始卸载过程..."
    
    # 停止并删除容器
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR"
        
        log_info "停止Docker容器..."
        docker_compose down --remove-orphans --volumes 2>/dev/null || true
        
        log_info "删除Docker镜像..."
        docker images | grep -E "(ssalgten|ghcr.io.*ssalgten)" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    fi
    
    # 删除应用目录
    log_info "删除应用目录..."
    if [[ -d "$APP_DIR" ]]; then
        run_as_root rm -rf "$APP_DIR"
        log_success "应用目录已删除: $APP_DIR"
    fi
    
    # 清理Docker资源
    log_info "清理Docker资源..."
    docker system prune -f >/dev/null 2>&1 || true
    
    # 删除脚本（如果是安装的版本）
    if [[ -f "/usr/local/bin/ssalgten" ]]; then
        log_info "删除管理脚本..."
        run_as_root rm -f /usr/local/bin/ssalgten
    fi
    
    echo ""
    log_success "🎉 SsalgTen 卸载完成！"
    echo ""
    log_info "感谢您使用 SsalgTen！"
}

# 增强的更新系统函数（带子菜单）
enhanced_update_system() {
    log_header "⚡ 系统更新"
    echo ""
    
    echo "请选择更新模式："
    echo "1. 智能更新 (自动选择最佳方式)"
    echo "2. 镜像快速更新 (仅更新Docker镜像)"
    echo "3. 完整更新 (包含代码、配置、数据库)"
    echo "4. 返回主菜单"
    echo ""
    
    local update_choice
    while true; do
        read -p "请选择 [1-4]: " update_choice
        case "$update_choice" in
            1)
                log_info "执行智能更新..."
                update_system
                break
                ;;
            2)
                log_info "执行镜像快速更新..."
                update_system --image
                break
                ;;
            3)
                log_info "执行完整更新..."
                update_system --full
                break
                ;;
            4)
                log_info "返回主菜单"
                return 0
                ;;
            *) echo "请输入有效选项 (1-4)" ;;
        esac
    done
}

run_deploy_production() {
    local deploy_script
    local temp_script=""
    local script_dir=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    deploy_script="$script_dir/deploy-production.sh"

    if [[ ! -f $deploy_script ]]; then
        temp_script=$(mktemp)
        log_info "下载 deploy-production.sh..."
        if ! curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh -o "$temp_script"; then
            log_error "无法下载 deploy-production.sh"
            rm -f "$temp_script"
            return 1
        fi
        deploy_script="$temp_script"
    fi

    bash "$deploy_script" "$@"
    local rc=$?
    [[ -n $temp_script ]] && rm -f "$temp_script"
    return $rc
}

deploy_flow() {
    local mode="image"
    local registry=""
    local namespace=""
    local tag=""
    local compose_override=""
    local quick_mode=false
    local pass_args=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                mode="$2"
                quick_mode=true
                shift 2
                ;;
            --image|--from-image|--ghcr)
                mode="image"
                quick_mode=true
                shift
                ;;
            --source)
                mode="source"
                quick_mode=true
                shift
                ;;
            --registry)
                registry="$2"
                quick_mode=true
                shift 2
                ;;
            --namespace|--repo)
                namespace="$2"
                quick_mode=true
                shift 2
                ;;
            --tag)
                tag="$2"
                quick_mode=true
                shift 2
                ;;
            --compose-file)
                compose_override="$2"
                quick_mode=true
                shift 2
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --legacy|--full)
                quick_mode=false
                shift
                ;;
            --help)
                cat <<'EOF'
使用方式: ssalgten deploy [选项]
  --image / --source            使用镜像或源码模式 (快捷部署)
  --registry REGISTRY           指定镜像仓库 (快捷部署)
  --namespace OWNER/REPO        指定镜像命名空间 (快捷部署)
  --tag TAG                     指定镜像标签 (快捷部署)
  --compose-file FILE           指定 compose 文件 (快捷部署)
  --quick                       强制使用快捷部署
  --legacy / --full             调用完整部署流程 (deploy-production.sh)
  --help                        显示本说明

不带任何选项时，将调用完整部署流程，适合在新服务器上执行。
EOF
                return 0
                ;;
            *)
                pass_args+=("$1")
                shift
                ;;
        esac
    done

    if [[ "$quick_mode" == "false" ]]; then
        run_deploy_production "${pass_args[@]}"
        return $?
    fi

    check_docker_ready || return 1
    detect_app_dir
    detect_compose_file
    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"

    if [[ "$mode" == "image" ]]; then
        IMAGE_REGISTRY="${registry:-${IMAGE_REGISTRY:-$DEFAULT_IMAGE_REGISTRY}}"
        IMAGE_NAMESPACE="${namespace:-${IMAGE_NAMESPACE:-$(detect_default_image_namespace)}}"
        IMAGE_TAG="${tag:-${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}}"
        export IMAGE_REGISTRY IMAGE_NAMESPACE IMAGE_TAG
        ensure_env_basics_image
        local compose_file
        if [[ -n "$compose_override" ]]; then
            compose_file="$compose_override"
        elif [[ -f docker-compose.ghcr.yml ]]; then
            compose_file=docker-compose.ghcr.yml
        else
            compose_file=$COMPOSE_FILE
        fi
        log_header "🚀 首次部署（镜像模式）"
        log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE (标签: $IMAGE_TAG)"
        docker_compose -f "$compose_file" pull
        docker_compose -f "$compose_file" up -d postgres
        log_info "等待数据库..."
        sleep 5
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        docker_compose -f "$compose_file" up -d --remove-orphans
        log_success "部署完成"
        echo "模式: 镜像 | 访问: http://localhost:${FRONTEND_PORT:-3000}"
    else
        ensure_env_basics_source
        local compose_file
        if [[ -n "$compose_override" ]]; then
            compose_file="$compose_override"
        elif [[ -f docker-compose.production.yml ]]; then
            compose_file=docker-compose.production.yml
        else
            compose_file=$COMPOSE_FILE
        fi
        log_header "🚀 首次部署（源码模式）"
        docker_compose -f "$compose_file" build
        docker_compose -f "$compose_file" up -d postgres
        log_info "等待数据库..."
        sleep 5
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        docker_compose -f "$compose_file" up -d --remove-orphans
        log_success "部署完成"
        echo "模式: 源码 | 访问: http://localhost:${FRONTEND_PORT:-3000}"
    fi
}

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
        "not-installed") status_color="${YELLOW}◇ 未安装${NC}" ;;
        *) status_color="${RED}✗ $status${NC}" ;;
    esac
    
    # 避免在上一轮操作后立刻清屏导致结果信息被"秒清"
    if [[ "${SKIP_CLEAR_ONCE:-false}" != "true" ]]; then
        clear
    else
        SKIP_CLEAR_ONCE=false
    fi

    # 若存在上一次操作结果，优先展示
    if [[ -n "$LAST_RESULT_MSG" ]]; then
        echo -e "${YELLOW}上次操作结果:${NC} $LAST_RESULT_MSG"
        echo
        LAST_RESULT_MSG=""
    fi
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
    echo -e "${YELLOW}🏗️ 系统管理:${NC}"
    echo -e "  ${PURPLE}1.${NC}  🚀 一键部署        ${PURPLE}2.${NC}  ⚡ 系统更新"
    echo -e "  ${PURPLE}3.${NC}  🔄 脚本更新        ${RED}4.${NC}  🗑️ 卸载系统"
    echo ""
    echo -e "${YELLOW}📋 日常操作:${NC}"
    echo -e "  ${GREEN}5.${NC}  ▶️  启动系统        ${GREEN}6.${NC}  ⏹️  停止系统"
    echo -e "  ${BLUE}7.${NC}  🔄 重启系统        ${CYAN}8.${NC}  📊 系统状态"
    echo ""
    echo -e "${YELLOW}🔍 监控诊断:${NC}"  
    echo -e "  ${CYAN}9.${NC}  📝 查看日志        ${CYAN}10.${NC} 🔍 容器信息"
    echo -e "  ${CYAN}11.${NC} 🔍 端口检查       ${CYAN}12.${NC} 📊 诊断报告"
    echo ""
    echo -e "${YELLOW}🛠️ 维护工具:${NC}"
    echo -e "  ${YELLOW}13.${NC} 💾 数据备份       ${YELLOW}14.${NC} 🧹 系统清理"
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
    choice=$(read_from_tty "请选择操作 [0-14]: " "0")
    
    case "$choice" in
        1) deploy_production ;;
        2) enhanced_update_system ;;
        3) self_update ;;
        4) uninstall_system ;;
        5) start_system ;;
        6) stop_system ;;
        7) restart_system ;;
        8) system_status ;;
        9) view_logs ;;
        10) docker_compose ps ;;
        11) port_check ;;
        12) generate_diagnostic_report ;;
        13) backup_data ;;
        14) clean_system ;;
        0) log_success "感谢使用 SsalgTen 管理工具!"; exit 0 ;;
        *) log_error "无效选择: $choice"; sleep 1 ;;
    esac
    
    if [[ "$choice" != "0" ]]; then
        echo
        # 在 curl|bash 环境下也尽量停留，避免信息被清掉
        read_from_tty "按回车键继续..." ""
        # 下一次进入菜单时跳过 clear，一次性保留上一轮输出
        SKIP_CLEAR_ONCE=true
    fi
}

# 获取系统状态（用于菜单显示）
get_system_status() {
    # curl|bash 模式下或应用目录不存在时，返回安全状态
    if [[ "${IN_CURL_BASH:-false}" == "true" ]] || [[ ! -d "$APP_DIR" ]]; then
        echo "not-installed"
        return 0
    fi
    
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
            start|stop|restart|status|logs|ps|exec|update|backup|clean|port-check|diagnose|self-update|deploy|uninstall|fix-agent-names)
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
            install) COMMAND="deploy"; shift; COMMAND_ARGS=("$@"); break ;;
            remove|delete) COMMAND="uninstall"; shift; COMMAND_ARGS=("$@"); break ;;
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
    local IN_CURL_BASH=false
    # 首先检查是否为curl|bash模式
    if detect_curl_bash_mode; then
        IN_CURL_BASH=true
        if [[ -r /dev/tty ]]; then
            exec </dev/tty
        fi
        # 处理curl|bash安装
        if handle_curl_bash_install "$@"; then
            exit 0  # 安装成功或显示帮助后退出
        fi
        # 如果返回1，说明用户选择临时运行，继续执行
    fi

    # 检查运行环境：若 stdin 非 TTY 但 /dev/tty 可读，则仍可交互
    if [[ ! -t 0 ]]; then
        if [[ -r /dev/tty ]]; then
            NON_INTERACTIVE=false
        else
            NON_INTERACTIVE=true
        fi
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
            update) update_system "${COMMAND_ARGS[@]}" ;;
            backup) backup_data ;;
            clean) clean_system "${COMMAND_ARGS[@]}" ;;
            port-check) port_check ;;
            diagnose) generate_diagnostic_report ;;
            self-update) self_update "${COMMAND_ARGS[@]}" ;;
            deploy) 
                # 新的统一部署命令
                if [[ ${#COMMAND_ARGS[@]} -eq 0 ]]; then
                    deploy_production
                else
                    deploy_flow "${COMMAND_ARGS[@]}"
                fi
                ;;
            uninstall) 
                # 支持强制模式
                if [[ "${COMMAND_ARGS[0]}" == "--force" ]] || [[ "${COMMAND_ARGS[0]}" == "-f" ]]; then
                    FORCE_MODE=true
                fi
                uninstall_system 
                ;;
            fix-agent-names) fix_agent_name_override ;;
            *) die "未知命令: $COMMAND" ;;
        esac
    else
        # 交互式菜单逻辑
        if [[ "$IN_CURL_BASH" == "true" ]]; then
            # 在curl|bash下优先尝试使用 /dev/tty 交互
            if [[ -r /dev/tty ]]; then
                log_info "进入交互菜单模式..."
                exec </dev/tty
                # 设置全局变量供 get_system_status 使用
                export IN_CURL_BASH=true
                while true; do
                    show_interactive_menu
                done
            else
                # 无法交互时给出明确指引
                log_error "当前环境不支持交互输入。请使用以下任一方式："
                echo "  1) 临时保存后运行: curl -fsSL .../ssalgten.sh -o /tmp/ss && bash /tmp/ss"
                echo "  2) 指定子命令运行: curl -fsSL .../ssalgten.sh | bash -s -- status"
                echo "  3) 安装后运行: curl -fsSL .../ssalgten.sh | bash -s -- --install && ssalgten"
                exit 1
            fi
        else
            # 常规环境：仅在交互模式下显示菜单
            if [[ "$NON_INTERACTIVE" == "true" ]]; then
                log_error "非交互模式下需要指定子命令"
                show_help
                exit 1
            fi
            while true; do
                show_interactive_menu
            done
        fi
    fi
}

# 运行主函数
main "$@"
