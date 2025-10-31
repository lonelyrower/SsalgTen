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
    # 添加超时保护，避免git命令卡住
    local git_url
    
    # 检查是否在git仓库中，快速失败
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "${DEFAULT_IMAGE_NAMESPACE:-lonelyrower/ssalgten}"
        return
    fi
    
    # 尝试获取git remote URL，使用timeout（如果可用）
    if command -v timeout >/dev/null 2>&1; then
        git_url=$(timeout 3 git remote get-url origin 2>/dev/null || true)
    else
        # 没有timeout命令时，直接执行（但设置较短的超时）
        git_url=$(git remote get-url origin 2>/dev/null || true)
    fi
    
    if [[ -n "$git_url" ]]; then
        local parsed
        parsed=$(echo "$git_url" | sed -E 's#(git@|https://|http://)?github.com[:/]+##; s#\.git$##' | tr '[:upper:]' '[:lower:]')
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

# 端口相关默认值（避免 set -u 下未定义变量导致报错）
FRONTEND_PORT=""
BACKEND_PORT=""
AGENT_PORT=""

# Nginx配置路径缓存（供SSL流程复用）
NGINX_HTTP_CONFIG_FILE=""
NGINX_SSL_CONFIG_FILE=""
NGINX_HTTP_ENABLE_CMD=""
NGINX_SSL_ENABLE_CMD=""

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
    local default="${2:-}"
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
    local default="${2:-}"
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

# 获取服务器IP地址
get_server_ip() {
    # 优先使用已配置的DOMAIN
    if [[ -n "$DOMAIN" ]] && [[ "$DOMAIN" != "localhost" ]]; then
        echo "$DOMAIN"
        return
    fi
    
    # 尝试从.env文件读取
    if [[ -f .env ]]; then
        local env_domain=$(grep -E "^DOMAIN=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [[ -n "$env_domain" ]] && [[ "$env_domain" != "localhost" ]]; then
            echo "$env_domain"
            return
        fi
    fi
    
    # 自动检测公网IP
    local detected_ip=$(curl -s -4 --max-time 3 ifconfig.me 2>/dev/null || curl -s -4 --max-time 3 icanhazip.com 2>/dev/null || echo "")
    if [[ -n "$detected_ip" ]]; then
        echo "$detected_ip"
        return
    fi
    
    # 回退到localhost
    echo "localhost"
}

# Yes/No 提示函数
prompt_yes_no() {
    local prompt="$1"
    local default="${2:-}"
    local response
    
    while true; do
        if [[ -n "$default" ]]; then
            # 根据默认值高亮显示
            if [[ "${default,,}" == "y" ]]; then
                read -p "$prompt [Y/N] (默认: Y): " response
            else
                read -p "$prompt [Y/N] (默认: N): " response
            fi
            response="${response:-$default}"
        else
            read -p "$prompt [Y/N]: " response
        fi
        
        case "${response,,}" in
            y|yes|是|确认) echo "y"; return 0 ;;
            n|no|否|取消) echo "n"; return 1 ;;
            *) echo "请输入 Y (是) 或 N (否)" ;;
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
  ${GREEN}deploy${NC}              🔧 一键部署 (智能选择镜像/源码模式)
    --image           🚀 快速镜像部署 (推荐，1-3分钟)
    --source          🔨 源码完整部署 (高级，10-30分钟)
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
    local compose_args=()
    local user_specified_file=false
    local override_file="$APP_DIR/docker-compose.override.yml"

    # 检测调用方是否显式指定了 compose 文件，若已指定则保持调用方自定义的组合
    for arg in "$@"; do
        case "$arg" in
            -f|--file|--file=*)
                user_specified_file=true
                break
                ;;
        esac
    done

    # 未显式传入 -f/--file 时，自动追加默认 compose 与 override 文件
    if [[ "$user_specified_file" == false ]]; then
        if [ -n "$COMPOSE_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
            compose_args+=(-f "$COMPOSE_FILE")
        fi

        if [ -f "$override_file" ]; then
            compose_args+=(-f "$override_file")
        fi
    fi

    # 指定项目名称，避免 compose 自动使用当前目录名
    compose_args+=(--project-name "${COMPOSE_PROJECT_NAME:-ssalgten}")

    # 兼容 docker compose (V2) 与 docker-compose (V1)
    if docker compose version >/dev/null 2>&1; then
        docker compose "${compose_args[@]}" "$@"
    elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
        docker-compose "${compose_args[@]}" "$@"
    else
        die "未找到可用的 Docker Compose，请安装 Docker Compose v2 或 docker-compose v1"
    fi
}

# 检查Docker环境
check_docker_ready() {
    # 检测 WSL2 环境
    if grep -qi microsoft /proc/version 2>/dev/null || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        log_warning "检测到 WSL2 环境"
        
        # 检查 Docker Desktop 是否在 Windows 上运行
        if ! docker version &> /dev/null; then
            echo
            log_error "Docker Desktop WSL2 集成未配置或未启动"
            echo
            echo "请按以下步骤解决："
            echo "1. 确保 Windows 上的 Docker Desktop 已启动"
            echo "2. 打开 Docker Desktop → Settings → Resources → WSL Integration"
            echo "3. 启用当前 WSL2 发行版的集成（如 Ubuntu）"
            echo "4. 点击 'Apply & Restart'"
            echo "5. 重新运行此脚本"
            echo
            echo "更多信息: https://docs.docker.com/desktop/wsl/"
            exit 1
        fi
        
        # 检查 docker compose 命令
        if ! docker compose version &> /dev/null; then
            log_error "Docker Compose 在 WSL2 中不可用"
            echo
            echo "请确保："
            echo "1. Docker Desktop 版本 >= 3.0 (内置 Compose V2)"
            echo "2. 在 Docker Desktop 设置中启用了 'Use Docker Compose V2'"
            echo "3. WSL2 集成已正确配置"
            exit 1
        fi
        
        log_success "Docker Desktop WSL2 集成已就绪"
        return 0
    fi
    
    # 非 WSL2 环境 - 生产环境自动安装逻辑
    
    # 检查 Docker 命令
    if ! command -v docker &> /dev/null; then
        log_warning "Docker 未安装，正在自动安装..."
        if ! install_docker; then
            die "Docker 自动安装失败"
        fi
    fi
    
    # 检查 Docker daemon
    if ! docker info &> /dev/null; then
        log_warning "Docker daemon 未运行，尝试启动..."
        
        # 尝试启动 Docker 服务
        if command -v systemctl &> /dev/null; then
            run_as_root systemctl start docker
            run_as_root systemctl enable docker
        elif command -v service &> /dev/null; then
            run_as_root service docker start
        fi
        
        # 等待服务启动
        sleep 3
        
        # 再次检查
        if ! docker info &> /dev/null; then
            # 检查权限问题
            if [[ ! -w /var/run/docker.sock ]]; then
                log_info "添加当前用户到 docker 组..."
                run_as_root usermod -aG docker "$USER" || true
                
                # 临时修改 socket 权限
                run_as_root chmod 666 /var/run/docker.sock 2>/dev/null || true
                
                # 再次尝试
                if ! docker info &> /dev/null; then
                    log_error "Docker daemon 仍无法访问"
                    echo
                    echo "已尝试自动修复，但仍存在问题。可能需要："
                    echo "1. 重新登录以使 docker 组权限生效"
                    echo "2. 或手动运行: newgrp docker"
                    die "Docker daemon 无法访问"
                fi
            else
                die "Docker daemon 未运行且无法启动"
            fi
        fi
    fi
    
    log_success "Docker 运行正常"
    
    # 测试 Docker Compose（尝试两种方式）
    local compose_available=false
    
    if docker compose version &> /dev/null; then
        compose_available=true
        log_success "检测到 Docker Compose V2 (docker compose)"
    elif command -v docker-compose &> /dev/null && docker-compose version &> /dev/null; then
        compose_available=true
        log_success "检测到 Docker Compose V1 (docker-compose)"
    fi
    
    if [[ "$compose_available" != "true" ]]; then
        log_warning "Docker Compose 未安装，正在自动安装..."
        if ! install_docker_compose; then
            die "Docker Compose 自动安装失败"
        fi
        
        # 验证安装
        if docker compose version &> /dev/null; then
            log_success "Docker Compose V2 安装成功"
        elif command -v docker-compose &> /dev/null && docker-compose version &> /dev/null; then
            log_success "Docker Compose V1 安装成功"
        else
            die "Docker Compose 安装验证失败"
        fi
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
    
    local prompt="$question [Y/N] (默认: N): "
    [[ "$default" == "Y" ]] && prompt="$question [Y/N] (默认: Y): "
    
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
    
    # 检测应用目录和 Compose 文件
    detect_app_dir
    detect_compose_file
    
    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"
    
    # 验证 Compose 文件存在
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "未找到 Compose 配置文件: $COMPOSE_FILE"
        log_info "请先部署应用或指定正确的应用目录"
        return 1
    fi
    
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

    log_info "强制拉取最新镜像（忽略本地缓存）..."
    docker_compose -f "$compose_file" pull --ignore-buildable
    docker_compose -f "$compose_file" up -d database
    log_info "等待数据库启动..."
    sleep 5
    if ! docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy; then
        log_warning "数据库迁移执行失败，请手动检查"
    fi
    docker_compose -f "$compose_file" up -d --remove-orphans
    log_success "镜像更新完成"

    # 提示清除浏览器缓存
    echo ""
    log_info "📢 重要提示：前端已更新，请清除浏览器缓存以查看最新内容"
    echo "   方式1: 硬刷新 (Ctrl+Shift+R 或 Cmd+Shift+R)"
    echo "   方式2: 清除浏览器缓存后刷新"
    echo "   方式3: 打开浏览器开发者工具 > Application > Clear storage"
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
    if ! docker_compose ps database | grep -q "Up"; then
        log_info "启动数据库服务..."
        docker_compose up -d database
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
    if ! docker_compose ps database | grep -q "Up"; then
        log_info "启动数据库服务..."
        docker_compose up -d database
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
    
    # 先启动数据库
    log_info "启动数据库服务..."
    docker_compose up -d database
    log_info "等待数据库就绪..."
    sleep 5

    # 运行数据库迁移
    log_info "运行数据库迁移..."
    if ! docker_compose run --rm backend npx prisma migrate deploy; then
        log_warning "数据库迁移执行失败，请手动检查"
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

    # 先启动数据库
    log_info "启动数据库服务..."
    docker_compose up -d database
    log_info "等待数据库就绪..."
    sleep 5

    # 运行数据库迁移
    log_info "运行数据库迁移..."
    if ! docker_compose run --rm backend npx prisma migrate deploy; then
        log_warning "数据库迁移执行失败，请手动检查"
    fi

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
    local result=""
    
    # 方法1: 使用 /dev/urandom (最常见且安全)
    if [[ -r /dev/urandom ]] && result=$(tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c "$len" 2>/dev/null) && [[ -n "$result" ]]; then
        echo "$result"
        return 0
    fi
    
    # 方法2: 使用 openssl (广泛可用)
    if command -v openssl >/dev/null 2>&1 && result=$(openssl rand -base64 "$((len * 2))" 2>/dev/null | tr -dc 'A-Za-z0-9' 2>/dev/null | head -c "$len" 2>/dev/null) && [[ -n "$result" ]]; then
        echo "$result"
        return 0
    fi
    
    # 方法3: 使用 sha256sum
    if command -v sha256sum >/dev/null 2>&1 && result=$(echo "$(date +%s%N)$(whoami)$(hostname)$$" 2>/dev/null | sha256sum 2>/dev/null | cut -c1-"$len" 2>/dev/null) && [[ -n "$result" ]]; then
        echo "$result"
        return 0
    fi
    
    # 方法4: 使用 md5sum
    if command -v md5sum >/dev/null 2>&1 && result=$(echo "$(date +%s)$(whoami)$(hostname)$$" 2>/dev/null | md5sum 2>/dev/null | cut -c1-"$len" 2>/dev/null) && [[ -n "$result" ]]; then
        echo "$result"
        return 0
    fi
    
    # 方法5: 最后的fallback（总是成功）
    result="fallback$(date +%s)$$"
    echo "${result:0:$len}"
    return 0
}

ensure_env_kv() {
    local key="$1"; local val="$2"; local file="${3:-.env}"
    
    # 确保文件存在，如果创建失败则报错
    if [[ ! -f "$file" ]]; then
        if ! touch "$file" 2>/dev/null; then
            log_warning "无法创建文件 $file，尝试使用sudo..."
            if ! run_as_root touch "$file" 2>/dev/null; then
                log_error "无法创建环境配置文件: $file"
                return 1
            fi
        fi
    fi
    
    # 检查文件是否可写（只在非root用户且文件不可写时修复）
    if [[ ! -w "$file" ]]; then
        if [[ "$EUID" -ne 0 ]] && [[ "$RUNNING_AS_ROOT" != "true" ]]; then
            log_warning "文件 $file 不可写，尝试修复权限..."
            run_as_root chmod 666 "$file" 2>/dev/null || true
        else
            log_error "文件 $file 不可写且无法修复权限"
            return 1
        fi
    fi
    
    # 转义特殊字符
    local escaped_val="${val//\\/\\\\}"  # 转义反斜杠
    escaped_val="${escaped_val//\//\\/}" # 转义斜杠
    escaped_val="${escaped_val//&/\\&}"  # 转义&符号
    
    # 检查键是否已存在
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # 使用临时文件来更新，避免sed -i的兼容性问题
        local tmpfile="${file}.tmp.$$"
        if ! grep -v "^${key}=" "$file" > "$tmpfile" 2>/dev/null; then
            log_error "无法读取文件 $file"
            rm -f "$tmpfile" 2>/dev/null || true
            return 1
        fi
        if ! echo "${key}=${val}" >> "$tmpfile" 2>/dev/null; then
            log_error "无法写入临时文件 $tmpfile"
            rm -f "$tmpfile" 2>/dev/null || true
            return 1
        fi
        if ! mv "$tmpfile" "$file" 2>/dev/null; then
            log_warning "无法移动文件，尝试使用sudo..."
            if ! run_as_root mv "$tmpfile" "$file" 2>/dev/null; then
                log_error "无法更新文件 $file"
                rm -f "$tmpfile" 2>/dev/null || true
                return 1
            fi
        fi
    else
        # 直接追加
        if ! echo "${key}=${val}" >> "$file" 2>/dev/null; then
            log_warning "无法写入文件，尝试使用sudo..."
            if ! echo "${key}=${val}" | run_as_root tee -a "$file" >/dev/null 2>&1; then
                log_error "无法追加到文件 $file"
                return 1
            fi
        fi
    fi
    
    return 0
}

ensure_env_basics_image() {
    log_info "确保环境变量文件存在..."
    if [[ ! -f .env ]]; then
        if ! touch .env 2>/dev/null; then
            log_warning "无法创建 .env 文件，尝试使用 sudo..."
            run_as_root touch .env || die "无法创建 .env 文件"
        fi
    fi
    
    # 确保文件可写（只在非root用户且文件不可写时修复）
    if [[ ! -w .env ]]; then
        if [[ "$EUID" -ne 0 ]] && [[ "$RUNNING_AS_ROOT" != "true" ]]; then
            log_warning ".env 文件不可写，修复权限..."
            run_as_root chmod 666 .env 2>/dev/null || true
        else
            # root用户下文件应该始终可写，如果不可写说明有问题
            run_as_root chmod 666 .env || die ".env 文件不可写且无法修复"
        fi
    fi
    
    log_info "读取现有配置..."
    local dbpass jwt api
    dbpass=$(grep -E '^DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2- || true)
    jwt=$(grep -E '^JWT_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
    api=$(grep -E '^API_KEY_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
    
    log_info "生成缺失的密钥..."
    if [[ -z "$dbpass" ]]; then
        log_info "生成 DB_PASSWORD..."
        dbpass=$(random_string 32)
        [[ -n "$dbpass" ]] || die "无法生成 DB_PASSWORD"
    fi
    if [[ -z "$jwt" ]]; then
        log_info "生成 JWT_SECRET..."
        jwt=$(random_string 64)
        [[ -n "$jwt" ]] || die "无法生成 JWT_SECRET"
    fi
    if [[ -z "$api" ]]; then
        log_info "生成 API_KEY_SECRET..."
        api=$(random_string 32)
        [[ -n "$api" ]] || die "无法生成 API_KEY_SECRET"
    fi
    
    log_info "写入镜像配置..."
    ensure_env_kv IMAGE_REGISTRY "${IMAGE_REGISTRY:-$DEFAULT_IMAGE_REGISTRY}" .env || die "无法写入 IMAGE_REGISTRY"
    
    log_info "检测镜像命名空间..."
    local namespace
    namespace="${IMAGE_NAMESPACE:-$(detect_default_image_namespace)}"
    log_info "使用命名空间: $namespace"
    ensure_env_kv IMAGE_NAMESPACE "$namespace" .env || die "无法写入 IMAGE_NAMESPACE"
    
    ensure_env_kv IMAGE_TAG "${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}" .env || die "无法写入 IMAGE_TAG"
    
    log_info "写入密钥配置..."
    ensure_env_kv DB_PASSWORD "$dbpass" .env || die "无法写入 DB_PASSWORD"
    ensure_env_kv JWT_SECRET "$jwt" .env || die "无法写入 JWT_SECRET"
    ensure_env_kv API_KEY_SECRET "$api" .env || die "无法写入 API_KEY_SECRET"
    
    log_success "环境变量配置完成"
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

# 强力清理端口占用（杀死 docker-proxy 进程）
force_cleanup_port() {
    local port=$1
    log_info "强力清理端口 $port..."
    
    # 1. 查找并杀死 docker-proxy 进程
    local pids
    pids=$(sudo lsof -ti:$port 2>/dev/null)
    if [[ -n "$pids" ]]; then
        log_warning "发现占用端口 $port 的进程: $pids"
        echo "$pids" | while read -r pid; do
            local process_name
            process_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            log_info "进程 $pid ($process_name) 占用端口 $port"
            
            # 如果是 docker-proxy，直接杀死
            if [[ "$process_name" == "docker-proxy" ]]; then
                log_warning "杀死 docker-proxy 进程 $pid"
                sudo kill -9 "$pid" 2>/dev/null || true
            else
                log_warning "发现非 Docker 进程占用: $process_name (PID: $pid)"
            fi
        done
        sleep 1
    fi
    
    # 2. 使用 fuser 杀死（备用方法）
    if command -v fuser &>/dev/null; then
        sudo fuser -k ${port}/tcp 2>/dev/null || true
        sleep 1
    fi
    
    # 3. 验证端口已释放
    if sudo lsof -i:$port 2>/dev/null | grep -q LISTEN; then
        log_error "端口 $port 仍然被占用！"
        sudo lsof -i:$port
        return 1
    else
        log_success "端口 $port 已释放"
        return 0
    fi
}

# 完全清理 Docker 资源和端口
force_cleanup_docker_resources() {
    log_info "完全清理 Docker 资源..."
    
    # 1. 停止并删除所有 SsalgTen 容器
    log_info "删除 SsalgTen 容器..."
    docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
                 ssalgten-backend ssalgten-frontend ssalgten-updater 2>/dev/null || true
    
    # 2. 删除网络
    log_info "删除 Docker 网络..."
    docker network rm ssalgten-network 2>/dev/null || true
    
    # 3. 等待 Docker 清理资源
    sleep 2
    
    # 4. 强力清理关键端口的 docker-proxy 进程
    log_info "检查并清理端口占用..."
    local critical_ports=(5432 6379 3000 3001)
    local ports_cleaned=0
    
    for port in "${critical_ports[@]}"; do
        if sudo lsof -i:$port 2>/dev/null | grep -q LISTEN; then
            log_warning "端口 $port 仍被占用，尝试清理..."
            if force_cleanup_port "$port"; then
                ((ports_cleaned++))
            fi
        fi
    done
    
    if [[ $ports_cleaned -gt 0 ]]; then
        log_success "清理了 $ports_cleaned 个端口"
        sleep 2  # 等待系统完全释放资源
    fi
    
    # 5. 最终验证
    log_info "验证关键端口状态..."
    local still_occupied=()
    for port in "${critical_ports[@]}"; do
        if sudo lsof -i:$port 2>/dev/null | grep -q LISTEN; then
            still_occupied+=("$port")
        fi
    done
    
    if [[ ${#still_occupied[@]} -gt 0 ]]; then
        log_error "以下端口仍然被占用: ${still_occupied[*]}"
        log_warning "请手动检查并停止占用这些端口的进程"
        return 1
    else
        log_success "所有关键端口已释放"
        return 0
    fi
}

# 检查系统要求
check_port_conflicts() {
    log_info "检查端口占用..."

    # 根据部署类型智能检查端口
    # 如果还未收集部署信息，使用完整端口列表
    local ports_to_check=()

    if [[ -n "$FRONTEND_PORT" && -n "$BACKEND_PORT" ]]; then
        # 已配置，使用实际配置的端口
        ports_to_check=("$FRONTEND_PORT" "$BACKEND_PORT" 5432 6379)
        [[ "$ENABLE_SSL" == "true" ]] && ports_to_check+=(443)
    else
        # 未配置，检查所有可能的端口
        ports_to_check=(80 443 3000 3001 5432 6379)
    fi

    local conflicted_ports=()

    for port in "${ports_to_check[@]}"; do
        if check_port_occupied "$port"; then
            conflicted_ports+=($port)
            log_warning "端口 $port 已被占用"
        fi
    done

    # 特殊处理 PostgreSQL 端口 5432
    if [[ " ${conflicted_ports[*]} " == *" 5432 "* ]]; then
        log_warning "端口 5432 (PostgreSQL) 已被占用"
        echo ""
        echo "${YELLOW}解决方案：${NC}"
        echo "1. 停止占用端口的 PostgreSQL 服务"
        echo "2. 修改 .env 文件中的 DB_PORT（推荐使用 5433）"
        echo ""
        echo "检测占用进程："
        lsof -i :5432 2>/dev/null || ss -tulpn | grep :5432 2>/dev/null || echo "  无法检测进程信息"
        echo ""
        
        if prompt_yes_no "是否自动停止系统 PostgreSQL 服务" "N"; then
            log_info "尝试停止 PostgreSQL 服务..."
            run_as_root systemctl stop postgresql 2>/dev/null || \
            run_as_root service postgresql stop 2>/dev/null || \
            log_warning "无法自动停止服务，请手动停止"
            sleep 2
            # 再次检查
            if netstat -tuln 2>/dev/null | grep -q ":5432 " || ss -tuln 2>/dev/null | grep -q ":5432 "; then
                log_error "端口 5432 仍然被占用"
                return 1
            else
                log_success "端口 5432 已释放"
            fi
        else
            log_error "端口 5432 冲突未解决，部署可能失败"
            if ! prompt_yes_no "是否仍要继续部署" "N"; then
                log_info "部署已取消"
                exit 0
            fi
        fi
    fi

    # 智能处理端口80冲突
    if [[ " ${conflicted_ports[*]} " == *" 80 "* ]]; then
        log_warning "端口80已被占用"
        echo ""
        echo "检测占用进程："
        lsof -i :80 2>/dev/null || ss -tulpn | grep :80 2>/dev/null || echo "  无法检测进程信息"
        echo ""

        # 根据部署类型给出不同建议
        if [[ "$SSL_MODE" == "cloudflare" ]]; then
            echo -e "${RED}⚠️  Cloudflare部署必须使用80端口！${NC}"
            echo ""
            echo "解决方案："
            echo "1. 停止占用端口80的服务（推荐）"
            echo "2. 取消部署，稍后处理"
            echo ""

            if prompt_yes_no "是否尝试自动停止占用80端口的服务" "Y"; then
                log_info "尝试停止Nginx/Apache服务..."
                run_as_root systemctl stop nginx 2>/dev/null || \
                run_as_root systemctl stop apache2 2>/dev/null || \
                run_as_root service nginx stop 2>/dev/null || \
                run_as_root service apache2 stop 2>/dev/null || \
                log_warning "无法自动停止服务，请手动停止"
                sleep 2

                # 再次检查
                if check_port_occupied 80; then
                    log_error "端口 80 仍然被占用，无法继续Cloudflare部署"
                    echo ""
                    echo "请手动停止占用服务后重新运行部署脚本"
                    exit 1
                else
                    log_success "端口 80 已释放"
                fi
            else
                log_info "部署已取消"
                exit 0
            fi
        elif [[ "$ENABLE_SSL" == "true" ]]; then
            echo -e "${YELLOW}HTTPS部署推荐使用80端口${NC}"
            echo ""
            echo "解决方案："
            echo "1. 停止占用端口80的服务（推荐）"
            echo "2. 使用其他端口（需要手动配置反向代理）"
            echo "3. 继续部署（可能失败）"
            echo ""

            if ! prompt_yes_no "是否继续部署" "N"; then
                log_info "部署已取消"
                exit 0
            fi
        else
            echo -e "${YELLOW}端口80被占用，但不影响非SSL部署${NC}"
            echo ""
            echo "提示：您已配置使用端口 $FRONTEND_PORT"
            echo ""
            if ! prompt_yes_no "是否继续部署" "Y"; then
                log_info "部署已取消"
                exit 0
            fi
        fi
    fi

    if [[ ${#conflicted_ports[@]} -eq 0 ]]; then
        log_success "所有必需端口都可用"
    fi
}

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

    # 检查端口冲突
    check_port_conflicts

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
        # Ubuntu/Debian - 自动检测正确的发行版
        run_as_root apt-get update
        run_as_root apt-get install -y ca-certificates curl gnupg lsb-release
        
        # 检测操作系统类型
        local os_type
        if [[ -f /etc/os-release ]]; then
            # shellcheck disable=SC1091
            source /etc/os-release
            os_type="${ID}"  # ubuntu 或 debian
        else
            # 降级方案：通过lsb_release检测
            if lsb_release -i 2>/dev/null | grep -qi ubuntu; then
                os_type="ubuntu"
            elif lsb_release -i 2>/dev/null | grep -qi debian; then
                os_type="debian"
            else
                os_type="ubuntu"  # 默认使用ubuntu
            fi
        fi
        
        log_info "检测到系统类型: ${os_type}"
        
        # 添加Docker官方GPG密钥（使用正确的URL）
        curl -fsSL "https://download.docker.com/linux/${os_type}/gpg" | run_as_root gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # 添加Docker仓库（使用正确的URL）
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/${os_type} $(lsb_release -cs) stable" | run_as_root tee /etc/apt/sources.list.d/docker.list > /dev/null
        
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
            if [[ ! "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
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

    # 智能端口配置：根据部署类型推荐端口
    # - Cloudflare/HTTPS：系统会启用Nginx监听80/443，前端容器建议使用3000端口避免冲突
    # - 简单部署：同样推荐3000端口，可直接通过IP:3000访问
    local frontend_default_port
    local port_hint

    if [[ "$SSL_MODE" == "cloudflare" ]]; then
        frontend_default_port="3000"
        port_hint="(Cloudflare部署：Nginx将占用80端口，推荐前端使用3000端口)"
    elif [[ "$ENABLE_SSL" == "true" ]]; then
        frontend_default_port="3000"
        port_hint="(HTTPS部署：Nginx将占用80/443端口，推荐前端使用3000端口)"
    else
        frontend_default_port="3000"
        port_hint="(本地部署推荐使用3000端口，避免与系统nginx冲突)"
    fi

    echo ""
    echo -e "${YELLOW}${port_hint}${NC}"
    FRONTEND_PORT=$(prompt_port "前端服务端口" "$frontend_default_port")
    BACKEND_PORT=$(prompt_port "后端API端口" "3001")
    DB_PORT=$(prompt_port "数据库端口" "5432")
    REDIS_PORT=$(prompt_port "Redis端口" "6379")

    if [[ "$FRONTEND_PORT" == "$HTTP_PORT" ]]; then
        local fallback_port=""
        local candidate_ports=("3000" "3001" "8080" "3100")
        for candidate in "${candidate_ports[@]}"; do
            if [[ "$candidate" != "$HTTP_PORT" ]]; then
                fallback_port="$candidate"
                break
            fi
        done
        if [[ -z "$fallback_port" ]]; then
            fallback_port=$((HTTP_PORT + 1))
        fi
        log_warning "前端端口 $FRONTEND_PORT 与 HTTP端口 $HTTP_PORT 相同，将与Nginx冲突，自动调整为 $fallback_port"
        FRONTEND_PORT="$fallback_port"
    fi
    
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

    # 共同的系统环境准备
    check_system_requirements
    collect_deployment_info
    install_system_dependencies
    install_docker
    install_nginx
    create_application_directory

    cd "$APP_DIR"

    # 显示构建模式选择菜单
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}请选择构建模式：${NC}"
    echo ""
    echo -e "${GREEN}1. 🚀 镜像快速构建 (推荐)${NC}"
    echo "   ✓ 直接拉取预构建的Docker镜像"
    echo "   ✓ 构建时间：1-3分钟"
    echo "   ✓ 内存需求：最低512MB"
    echo "   ✓ 自动更新：支持极速更新"
    echo "   ✓ 适合：99%的部署场景"
    echo ""
    echo -e "${YELLOW}2. 🔧 源码本地构建 (高级)${NC}"
    echo "   • 从GitHub下载源码并本地构建"
    echo "   • 构建时间：10-30分钟"
    echo "   • 内存需求：至少2GB"
    echo "   • 适合：需要自定义修改源码的场景"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    local build_mode
    build_mode=$(read_from_tty "请选择 [1/2] (默认: 1): " "1")
    build_mode=${build_mode:-1}

    echo ""

    if [[ "$build_mode" == "1" ]]; then
        log_success "✓ 已选择：镜像快速构建模式"
        echo ""
        log_info "将使用以下镜像源："
        echo "  • 镜像仓库：ghcr.io"
        echo "  • 镜像空间：lonelyrower/ssalgten"
        echo "  • 镜像标签：latest"
        echo ""

        # 使用镜像模式部署
        deploy_with_image_mode
    else
        log_info "已选择：源码本地构建模式"
        echo ""

        # 使用源码模式部署
        deploy_with_source_mode
    fi

    # 验证部署
    verify_deployment

    # 创建管理脚本
    create_management_scripts

    # 保存部署信息
    save_deployment_info

    # 显示部署结果
    show_deployment_result
    
    # 部署完成，直接退出
    exit 0
}

# 镜像模式部署
deploy_with_image_mode() {
    # 下载必要的 compose 文件
    download_compose_files_for_image_mode
    
    # 配置环境变量
    create_environment_config

    # 配置Nginx
    create_nginx_config

    # 安装SSL证书
    install_ssl_certificate

    # 拉取镜像并启动服务
    log_info "拉取Docker镜像并启动服务..."
    deploy_flow --image
}

# 下载镜像模式所需的 compose 文件
download_compose_files_for_image_mode() {
    log_info "下载 Docker Compose 配置文件..."
    
    local base_url="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main"
    local files=(
        "docker-compose.ghcr.yml"
        "docker-compose.yml"
        ".env.example"
    )
    
    local download_success=false
    
    # 尝试使用 curl 或 wget 下载
    for file in "${files[@]}"; do
        local downloaded=false
        
        # 尝试使用 curl
        if command -v curl &> /dev/null; then
            if curl -fsSL "$base_url/$file" -o "$file" 2>/dev/null; then
                downloaded=true
                log_success "✓ 已下载: $file"
            fi
        fi
        
        # 如果 curl 失败，尝试 wget
        if [[ "$downloaded" == false ]] && command -v wget &> /dev/null; then
            if wget -q "$base_url/$file" -O "$file" 2>/dev/null; then
                downloaded=true
                log_success "✓ 已下载: $file"
            fi
        fi
        
        # 如果是必需文件但下载失败，尝试创建最小配置
        if [[ "$downloaded" == false ]]; then
            if [[ "$file" == "docker-compose.ghcr.yml" ]] || [[ "$file" == "docker-compose.yml" ]]; then
                log_warning "⚠ 无法下载 $file，创建最小配置..."
                create_minimal_compose_file "$file"
            else
                log_warning "⚠ 跳过可选文件: $file"
            fi
        fi
    done
    
    # 确保至少有一个 compose 文件
    if [[ -f "docker-compose.ghcr.yml" ]] || [[ -f "docker-compose.yml" ]]; then
        log_success "Docker Compose 配置文件准备完成"
    else
        log_error "无法获取 Docker Compose 配置文件"
        die "请检查网络连接或手动下载配置文件"
    fi
}

# 创建最小 compose 配置（应急方案）
create_minimal_compose_file() {
    local filename="$1"
    
    log_info "创建最小 compose 配置: $filename"
    
    cat > "$filename" << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-ssalgten}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-ssalgten}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ssalgten"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-lonelyrower/ssalgten}/backend:${IMAGE_TAG:-latest}
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ssalgten:${DB_PASSWORD}@postgres:5432/ssalgten?schema=public
      JWT_SECRET: ${JWT_SECRET}
      API_KEY_SECRET: ${API_KEY_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "${BACKEND_PORT:-3001}:3001"

  frontend:
    image: ${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-lonelyrower/ssalgten}/frontend:${IMAGE_TAG:-latest}
    environment:
      VITE_API_URL: /api
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      - backend

volumes:
  postgres-data:
EOF
    
    log_success "已创建最小 compose 配置: $filename"
}

# 源码模式部署
deploy_with_source_mode() {
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
    # 如果backend目录存在才创建backend/.env（镜像模式下可能不存在）
    if [[ -d "backend" ]]; then
        cat > backend/.env << EOF
# 生产环境标识
NODE_ENV=production
PORT=$BACKEND_PORT
HOST=0.0.0.0

# 外部访问URL（用于生成节点安装脚本）
PUBLIC_URL=$(if [[ "$ENABLE_SSL" == "true" ]]; then echo "https://$DOMAIN"; else echo "http://$DOMAIN:$BACKEND_PORT"; fi)

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
    fi

    # 创建前端环境配置（如果frontend目录存在）
    if [[ -d "frontend" ]]; then
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
    fi

    # 创建Agent环境配置模板（如果agent目录存在）
    if [[ -d "agent" ]]; then
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
    fi

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
        NGINX_SSL_CONFIG_FILE="/etc/nginx/sites-available/ssalgten-ssl"
        NGINX_SSL_ENABLE_CMD="run_as_root ln -sf /etc/nginx/sites-available/ssalgten-ssl /etc/nginx/sites-enabled/"
    else
        NGINX_CONFIG_FILE="/etc/nginx/conf.d/ssalgten.conf"
        NGINX_ENABLE_CMD="# 配置已自动启用"
        run_as_root mkdir -p /etc/nginx/conf.d
        NGINX_SSL_CONFIG_FILE="/etc/nginx/conf.d/ssalgten-ssl.conf"
        NGINX_SSL_ENABLE_CMD="# SSL配置已自动启用"
    fi

    NGINX_HTTP_CONFIG_FILE="$NGINX_CONFIG_FILE"
    NGINX_HTTP_ENABLE_CMD="$NGINX_ENABLE_CMD"
    
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
    gzip_types application/json application/javascript text/css text/plain application/xml application/xml+rss application/atom+xml image/svg+xml;

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

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            proxy_pass http://localhost:${FRONTEND_PORT:-3000};
            proxy_set_header Host \$host;
            proxy_cache_valid 200 1d;
            add_header Cache-Control "public, max-age=86400";
        }
    }

    # API代理
    location /api {
        proxy_pass http://localhost:${BACKEND_PORT:-3001};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # 代理策略
        proxy_buffering off;
        proxy_cache off;

        # 超时配置（较长以支持长时间请求/流式输出）
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Socket.IO专用代理
    location /socket.io/ {
        proxy_pass http://localhost:${BACKEND_PORT:-3001};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket升级支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Socket.IO特定配置
        proxy_buffering off;
        proxy_cache off;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查端点
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
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

    # 确保Nginx服务已启用并运行
    if command -v systemctl >/dev/null 2>&1; then
        run_as_root systemctl enable nginx >/dev/null 2>&1 || true
        if ! run_as_root systemctl restart nginx; then
            log_warning "Nginx重启失败，尝试启动服务..."
            if ! run_as_root systemctl start nginx; then
                log_error "无法启动Nginx，请手动检查 systemctl status nginx"
                exit 1
            fi
        fi
    else
        if ! run_as_root service nginx restart 2>/dev/null; then
            log_warning "service nginx restart 失败，尝试使用 start"
            if ! run_as_root service nginx start 2>/dev/null; then
                log_error "无法启动Nginx，请手动运行 'service nginx status' 或 'nginx -g \"daemon on; master_process on;\"'"
                exit 1
            fi
        fi
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

        # 部署续期后自动reload Nginx的hook
        run_as_root mkdir -p /etc/letsencrypt/renewal-hooks/deploy
        run_as_root bash -c 'cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<EOF
#!/bin/sh
systemctl reload nginx || true
EOF'
        run_as_root chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

        # 设置自动续期：优先使用 systemd timer，无法使用时回退到 cron
        if command -v systemctl >/dev/null 2>&1; then
            log_info "配置 systemd timer 自动续期..."
            run_as_root systemctl enable --now certbot.timer || true
            # 显示定时器状态用于可观测
            run_as_root systemctl status certbot.timer --no-pager || true
        else
            log_info "配置 cron 自动续期..."
            echo "0 3,15 * * * /usr/bin/certbot renew --quiet" | run_as_root crontab -
        fi

        # 进行一次续期演练（不真正申请）以验证环境
        log_info "执行证书续期演练..."
        run_as_root certbot renew --dry-run || true

        # 输出健康检查与观测指引
        echo ""
        log_info "证书续期健康检查（可选）:"
        echo "  • 查看定时器状态: systemctl status certbot.timer"
        echo "  • 查看最近日志:  journalctl -u certbot.timer -n 50 --no-pager"
        echo "  • 列出下一次执行: systemctl list-timers --all | grep certbot"
        echo "  • 手动演练续期:   certbot renew --dry-run"
        echo ""
        # 简要输出当前状态便于确认
        run_as_root systemctl list-timers --all | grep certbot || true
        run_as_root journalctl -u certbot.timer -n 5 --no-pager || true

        # 证书安装完成后，测试并重新加载Nginx配置
        run_as_root nginx -t
        run_as_root systemctl reload nginx

    else
        log_info "Cloudflare SSL模式，生成自签名证书供源站使用"

        if ! command -v openssl >/dev/null 2>&1; then
            log_info "安装 openssl..."
            if command -v apt >/dev/null 2>&1; then
                run_as_root apt install -y openssl
            elif command -v yum >/dev/null 2>&1; then
                run_as_root yum install -y openssl
            elif command -v dnf >/dev/null 2>&1; then
                run_as_root dnf install -y openssl
            else
                log_warning "无法自动安装 openssl，请确认系统已安装该工具"
            fi
        fi

        local cert_dir="/etc/ssl/ssalgten"
        local ssl_cert="$cert_dir/fullchain.pem"
        local ssl_key="$cert_dir/privkey.pem"
        local https_listen_port="${HTTPS_PORT:-443}"
        local server_names="$DOMAIN"
        local include_www=false

        if [[ -n "$DOMAIN" ]] && getent ahosts "www.$DOMAIN" >/dev/null 2>&1; then
            server_names="$server_names www.$DOMAIN"
            include_www=true
        fi
        [[ -z "$server_names" ]] && server_names="_"

        local san_values="DNS:${DOMAIN:-ssalgten.local}"
        if [[ "$include_www" == "true" && -n "$DOMAIN" ]]; then
            san_values="$san_values,DNS:www.$DOMAIN"
        fi

        run_as_root mkdir -p "$cert_dir"

        if ! run_as_root openssl req -x509 -nodes -days 365 \
            -newkey rsa:2048 \
            -keyout "$ssl_key" \
            -out "$ssl_cert" \
            -subj "/CN=${DOMAIN:-ssalgten.local}" \
            -addext "subjectAltName=$san_values"; then
            log_warning "当前 openssl 不支持 -addext 选项，回退到基础自签名证书生成"
            run_as_root openssl req -x509 -nodes -days 365 \
                -newkey rsa:2048 \
                -keyout "$ssl_key" \
                -out "$ssl_cert" \
                -subj "/CN=${DOMAIN:-ssalgten.local}"
        fi
        run_as_root chmod 600 "$ssl_key" "$ssl_cert" 2>/dev/null || true

        if [[ -z "$NGINX_SSL_CONFIG_FILE" ]]; then
            log_error "未能确定Nginx SSL配置路径，请重新运行部署脚本"
            exit 1
        fi

        run_as_root mkdir -p "$(dirname "$NGINX_SSL_CONFIG_FILE")"
        run_as_root tee "$NGINX_SSL_CONFIG_FILE" > /dev/null << EOF
# SsalgTen Nginx HTTPS 配置 (Cloudflare)
server {
    listen $https_listen_port ssl http2;
    server_name $server_names;

    ssl_certificate     $ssl_cert;
    ssl_certificate_key $ssl_key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    client_max_body_size 20m;
    gzip on;
    gzip_proxied any;
    gzip_types application/json application/javascript text/css text/plain application/xml application/xml+rss application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://localhost:${FRONTEND_PORT:-3000};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            proxy_pass http://localhost:${FRONTEND_PORT:-3000};
            proxy_set_header Host \$host;
            proxy_cache_valid 200 1d;
            add_header Cache-Control "public, max-age=86400";
        }
    }

    location /api {
        proxy_pass http://localhost:${BACKEND_PORT:-3001};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://localhost:${BACKEND_PORT:-3001}/socket.io/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

        if [[ -n "$NGINX_SSL_ENABLE_CMD" && "$NGINX_SSL_ENABLE_CMD" != "#"* ]]; then
            eval "$NGINX_SSL_ENABLE_CMD"
        fi

        run_as_root nginx -t
        run_as_root systemctl reload nginx

        log_success "Cloudflare SSL模式配置完成"
        echo ""
        log_info "Cloudflare配置提醒："
        echo "  • 确保Cloudflare DNS记录开启代理（橙色云朵）"
        echo "  • SSL/TLS模式建议使用 Full 或 Full (strict)"
        echo "  • 若证书即将过期，可重新运行部署脚本刷新自签名证书"
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
        read -p "检测到资源不足，是否继续构建？建议先运行修复脚本 [Y/N] (默认: N): " continue_build
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
        # 只清理悬空资源，不影响其他项目
        log_info "清理悬空镜像..."
        docker image prune -f >/dev/null 2>&1 || true
        
        # 分别构建服务以减少内存压力
        log_info "分别构建后端服务..."
        if ! timeout 1800 bash -c "$(declare -f docker_compose); docker_compose -f $compose_file build backend"; then
            log_error "后端构建失败或超时"
            exit 1
        fi
        
        # 再次清理悬空镜像
        docker image prune -f >/dev/null 2>&1 || true
        
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
        read -p "是否自动运行修复脚本？[Y/N] (默认: Y): " auto_fix
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
    docker_compose -f $compose_file up -d database
    log_info "等待数据库启动..."
    
    # 等待数据库健康检查通过 (增加等待时间适配低内存VPS)
    local max_attempts=60  # 从30增加到60次
    local attempt=0
    local check_interval=3  # 从2秒增加到3秒
    
    log_info "[INFO] 数据库启动可能需要1-3分钟，请耐心等待..."
    log_info "[INFO] 低内存VPS (1G-2G) 可能需要更长时间，这是正常现象"
    
    while [ $attempt -lt $max_attempts ]; do
        # 检查容器是否还在运行
        if ! docker_compose -f $compose_file ps database | grep -q "Up"; then
            log_error "数据库容器已停止，检查日志..."
            echo ""
            echo "=== 数据库日志 ==="
            docker_compose -f $compose_file logs --tail=50 database
            echo ""
            log_error "数据库容器启动失败，请检查上方日志"
            exit 1
        fi
        
        # 尝试连接数据库
        if docker_compose -f $compose_file exec -T postgres pg_isready -U ssalgten -d ssalgten > /dev/null 2>&1; then
            log_success "数据库已启动完成"
            break
        fi
        
        attempt=$((attempt + 1))
        local elapsed=$((attempt * check_interval))
        echo "等待数据库启动... ($attempt/$max_attempts) - 已等待 ${elapsed}秒"
        sleep $check_interval
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "数据库启动超时 (等待了 $((max_attempts * check_interval))秒)"
        echo ""
        echo "=== 数据库日志 ==="
        docker_compose -f $compose_file logs --tail=100 database
        echo ""
        log_error "可能的原因:"
        echo "  1. 内存不足 (建议至少2G内存)"
        echo "  2. 磁盘空间不足"
        echo "  3. Docker资源限制"
        echo ""
        log_info "建议: 检查系统资源后重试，或使用镜像安装方式"
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
                                docker_compose -f $compose_file up -d database
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
        # 使用 get_server_ip 获取实际IP
        access_url="http://$(get_server_ip):${FRONTEND_PORT:-3000}"
    fi
    
    echo -e "${GREEN}✅ SsalgTen 已成功部署${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}📍 访问地址${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  🌐 前端页面: ${GREEN}$access_url${NC}"
    echo -e "  🔧 管理后台: ${GREEN}$access_url/admin${NC}"
    echo -e "  📡 API接口:  ${GREEN}$access_url/api${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}🔑 默认登录账户${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  👤 管理员账户:"
    echo -e "     用户名: ${GREEN}admin${NC}"
    echo -e "     密码:   ${GREEN}admin123${NC}"
    echo ""
    echo -e "  ${RED}⚠️  安全提醒: 首次登录后请立即修改默认密码！${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}📂 系统信息${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  应用目录: ${CYAN}$APP_DIR${NC}"
    echo -e "  配置文件: ${CYAN}$APP_DIR/.env${NC}"
    echo -e "  前端端口: ${CYAN}${FRONTEND_PORT:-3000}${NC}"
    echo -e "  后端端口: ${CYAN}${BACKEND_PORT:-3001}${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}💻 常用管理命令${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ssalgten status   - 查看系统状态"
    echo "  ssalgten logs     - 查看运行日志"
    echo "  ssalgten restart  - 重启所有服务"
    echo "  ssalgten stop     - 停止所有服务"
    echo "  ssalgten update   - 更新系统版本"
    echo "  ssalgten backup   - 备份数据库"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}💡 重要提示${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ⏱️  首次部署需等待1-2分钟完成数据库初始化"
    echo "  📊 数据库初始化完成后才能正常登录和使用"
    echo "  🔍 如遇问题请运行: ssalgten logs 查看详细日志"

    # Cloudflare 部署特殊说明
    if [[ "$SSL_MODE" == "cloudflare" ]]; then
        echo ""
        echo -e "${CYAN}☁️  Cloudflare 部署配置说明:${NC}"
        echo "  1. 确保域名DNS已指向本服务器IP: $(get_server_ip)"
        echo "  2. Cloudflare DNS记录需要开启代理(橙色云朵)"
        echo "  3. SSL/TLS模式设置为 'Flexible' 或 'Full'"
        echo "  4. 如遇 '521 Web server is down' 错误:"
        echo "     • 检查服务器防火墙是否开放80/443端口"
        echo "     • 运行 'ssalgten port-check' 检查端口占用"
        echo "     • 运行 'ssalgten status' 检查服务状态"
        echo "     • 确认本机未安装其他web服务器占用80端口"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
        
        # 简单直接的清理
        log_info "清理残留容器..."
        docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
                     ssalgten-backend ssalgten-frontend ssalgten-updater 2>/dev/null || true
        
        log_info "清理网络和数据卷..."
        docker network rm ssalgten-network 2>/dev/null || true
        docker volume rm ssalgten-postgres-data ssalgten-redis-data 2>/dev/null || true
        
        log_info "删除Docker镜像..."
        docker images | grep -E "(ssalgten|ghcr.io.*ssalgten)" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    fi

    # 清理Nginx配置（如果曾启用 HTTPS/Cloudflare 部署）
    log_info "清理Nginx配置..."
    local nginx_config_found=false
    for cfg in /etc/nginx/conf.d/ssalgten.conf /etc/nginx/sites-available/ssalgten /etc/nginx/sites-enabled/ssalgten; do
        if [[ -f "$cfg" ]]; then
            nginx_config_found=true
            break
        fi
    done
    if [[ "$nginx_config_found" == "true" ]]; then
        if command -v systemctl >/dev/null 2>&1; then
            run_as_root systemctl stop nginx 2>/dev/null || true
        else
            run_as_root service nginx stop 2>/dev/null || true
        fi
    fi
    run_as_root rm -f /etc/nginx/conf.d/ssalgten.conf 2>/dev/null || true
    run_as_root rm -f /etc/nginx/conf.d/ssalgten-ssl.conf 2>/dev/null || true
    run_as_root rm -f /etc/nginx/sites-available/ssalgten 2>/dev/null || true
    run_as_root rm -f /etc/nginx/sites-available/ssalgten-ssl 2>/dev/null || true
    run_as_root rm -f /etc/nginx/sites-enabled/ssalgten 2>/dev/null || true
    run_as_root rm -f /etc/nginx/sites-enabled/ssalgten-ssl 2>/dev/null || true
    run_as_root rm -rf /etc/ssl/ssalgten 2>/dev/null || true

    # 删除应用目录
    log_info "删除应用目录..."
    if [[ -d "$APP_DIR" ]]; then
        run_as_root rm -rf "$APP_DIR"
        log_success "应用目录已删除: $APP_DIR"
    fi
    
    # 不使用 docker system prune，避免影响其他项目
    # 只清理 SsalgTen 相关的悬空资源
    log_info "清理 SsalgTen 悬空资源..."
    docker images --filter "dangling=true" --filter "label=org.opencontainers.image.source=*ssalgten*" -q | xargs -r docker rmi 2>/dev/null || true
    
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
    echo ""
    echo -e "${GREEN}1. 🚀 镜像快速更新 (推荐)${NC}"
    echo "   ✓ 从 GHCR 拉取最新预构建镜像"
    echo "   ✓ 更新时间：1-2 分钟"
    echo "   ✓ 适合：生产环境快速更新"
    echo ""
    echo -e "${YELLOW}2. 🔧 源码完整更新${NC}"
    echo "   • Git 拉取最新代码并本地构建"
    echo "   • 更新时间：10-30 分钟"
    echo "   • 适合：需要自定义修改或测试最新代码"
    echo ""
    echo -e "${BLUE}3. 📦 归档包更新${NC}"
    echo "   • 下载源码压缩包并构建（无需 Git）"
    echo "   • 更新时间：10-30 分钟"
    echo "   • 适合：服务器无法访问 Git 或网络受限"
    echo ""
    echo "0. 返回主菜单"
    echo ""

    local update_choice
    while true; do
        read -p "请选择 [0-3]: " update_choice
        case "$update_choice" in
            1)
                log_info "执行镜像快速更新..."
                update_system --image
                break
                ;;
            2)
                log_info "执行源码完整更新..."
                update_system --source
                break
                ;;
            3)
                log_info "执行归档包更新..."
                update_system_from_archive
                break
                ;;
            0)
                log_info "返回主菜单"
                return 0
                ;;
            *) echo "请输入有效选项 (0-3)" ;;
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
    
    log_info "检测应用目录..."
    detect_app_dir
    log_info "应用目录: $APP_DIR"
    
    log_info "检测 Compose 文件..."
    detect_compose_file
    log_info "Compose 文件: $COMPOSE_FILE"
    
    log_info "切换到应用目录: $APP_DIR"
    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"
    
    log_info "当前目录内容:"
    ls -la | head -10

    if [[ "$mode" == "image" ]]; then
        log_info "=== 镜像模式部署开始 ==="
        IMAGE_REGISTRY="${registry:-${IMAGE_REGISTRY:-$DEFAULT_IMAGE_REGISTRY}}"
        IMAGE_NAMESPACE="${namespace:-${IMAGE_NAMESPACE:-$(detect_default_image_namespace)}}"
        IMAGE_TAG="${tag:-${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}}"
        export IMAGE_REGISTRY IMAGE_NAMESPACE IMAGE_TAG
        
        log_info "准备环境变量..."
        ensure_env_basics_image
        
        log_info "选择 Compose 文件..."
        local compose_file
        if [[ -n "$compose_override" ]]; then
            compose_file="$compose_override"
        elif [[ -f docker-compose.ghcr.yml ]]; then
            compose_file=docker-compose.ghcr.yml
        else
            compose_file=$COMPOSE_FILE
        fi
        
        log_info "使用 Compose 文件: $compose_file"
        
        if [[ ! -f "$compose_file" ]]; then
            log_error "Compose 文件不存在: $compose_file"
            die "无法找到 Compose 配置文件"
        fi
        
        log_header "🚀 首次部署（镜像模式）"
        log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE (标签: $IMAGE_TAG)"
        
        # 完整清理流程
        log_info "清理残留资源..."
        
        # 1. 停止所有服务
        docker_compose -f "$compose_file" down --remove-orphans --volumes 2>&1 | grep -v "no configuration file" || true
        
        # 2. 强制删除所有可能的容器（不包括 agent，agent 在其他 VPS 上运行）
        for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-updater; do
            docker rm -f "$container" >/dev/null 2>&1 || true
        done
        
        # 3. 删除网络（重试机制）
        for i in {1..3}; do
            if docker network rm ssalgten-network >/dev/null 2>&1; then
                log_info "网络已删除"
                break
            elif ! docker network ls | grep -q ssalgten-network; then
                log_info "网络不存在"
                break
            else
                log_warning "网络删除失败，等待重试 ($i/3)..."
                sleep 1
            fi
        done
        
        # 4. 验证清理结果
        if docker network ls | grep -q ssalgten-network; then
            log_error "网络仍然存在，尝试查找占用的容器..."
            docker network inspect ssalgten-network 2>/dev/null || true
            log_warning "将继续部署，Docker 会尝试重用现有网络"
        fi
        
        # 5. 等待 Docker 完全释放资源
        log_info "等待 Docker 释放资源..."
        sleep 3
        
        log_info "拉取 Docker 镜像..."
        docker_compose -f "$compose_file" pull
        
        log_info "启动数据库服务..."
        # 使用 --force-recreate 强制重新创建，避免端口冲突
        docker_compose -f "$compose_file" up -d --force-recreate database
        
        log_info "等待数据库启动..."
        sleep 5
        
        log_info "执行数据库迁移..."
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        
        log_info "启动所有服务..."
        docker_compose -f "$compose_file" up -d --remove-orphans
        
        echo ""
        log_header "🎉 部署完成！"
        echo ""
        
        local access_url
        if [[ "$ENABLE_SSL" == "true" ]]; then
            access_url="https://$DOMAIN"
        else
            access_url="http://$(get_server_ip):${FRONTEND_PORT:-3000}"
        fi
        
        echo -e "${GREEN}✅ SsalgTen 已成功部署 (镜像模式)${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${CYAN}📍 访问地址${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "  🌐 前端页面: ${GREEN}$access_url${NC}"
        echo -e "  🔧 管理后台: ${GREEN}$access_url/admin${NC}"
        echo -e "  📡 API接口:  ${GREEN}$access_url/api${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${YELLOW}🔑 默认登录账户${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "  👤 管理员账户:"
        echo -e "     用户名: ${GREEN}admin${NC}"
        echo -e "     密码:   ${GREEN}admin123${NC}"
        echo ""
        echo -e "  ${RED}⚠️  安全提醒: 首次登录后请立即修改默认密码！${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${BLUE}💻 常用管理命令${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ssalgten status   - 查看系统状态"
        echo "  ssalgten logs     - 查看运行日志"
        echo "  ssalgten restart  - 重启所有服务"
        echo "  ssalgten stop     - 停止所有服务"
        echo "  ssalgten update   - 更新系统版本"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${YELLOW}💡 重要提示${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⏱️  首次部署需等待1-2分钟完成数据库初始化"
        echo "  📊 数据库初始化完成后才能正常登录和使用"
        echo "  🔍 如遇问题请运行: ssalgten logs 查看详细日志"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        exit 0
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
        
        # 完整清理流程
        log_info "清理残留资源..."
        
        # 1. 停止所有服务
        docker_compose -f "$compose_file" down --remove-orphans --volumes 2>&1 | grep -v "no configuration file" || true
        
        # 2. 强制删除所有可能的容器（不包括 agent，agent 在其他 VPS 上运行）
        for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-updater; do
            docker rm -f "$container" >/dev/null 2>&1 || true
        done
        
        # 3. 删除网络（重试机制）
        for i in {1..3}; do
            if docker network rm ssalgten-network >/dev/null 2>&1; then
                break
            elif ! docker network ls | grep -q ssalgten-network; then
                break
            else
                sleep 1
            fi
        done
        
        docker_compose -f "$compose_file" build
        docker_compose -f "$compose_file" up -d database
        log_info "等待数据库..."
        sleep 5
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        docker_compose -f "$compose_file" up -d --remove-orphans
        
        echo ""
        log_header "🎉 部署完成！"
        echo ""
        
        local access_url
        if [[ "$ENABLE_SSL" == "true" ]]; then
            access_url="https://$DOMAIN"
        else
            access_url="http://$(get_server_ip):${FRONTEND_PORT:-3000}"
        fi
        
        echo -e "${GREEN}✅ SsalgTen 已成功部署 (源码模式)${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${CYAN}📍 访问地址${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "  🌐 前端页面: ${GREEN}$access_url${NC}"
        echo -e "  🔧 管理后台: ${GREEN}$access_url/admin${NC}"
        echo -e "  📡 API接口:  ${GREEN}$access_url/api${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${YELLOW}🔑 默认登录账户${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "  👤 管理员账户:"
        echo -e "     用户名: ${GREEN}admin${NC}"
        echo -e "     密码:   ${GREEN}admin123${NC}"
        echo ""
        echo -e "  ${RED}⚠️  安全提醒: 首次登录后请立即修改默认密码！${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${BLUE}💻 常用管理命令${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ssalgten status   - 查看系统状态"
        echo "  ssalgten logs     - 查看运行日志"
        echo "  ssalgten restart  - 重启所有服务"
        echo "  ssalgten stop     - 停止所有服务"
        echo "  ssalgten update   - 更新系统版本"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${YELLOW}💡 重要提示${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⏱️  首次部署需等待1-2分钟完成数据库初始化"
        echo "  📊 数据库初始化完成后才能正常登录和使用"
        echo "  🔍 如遇问题请运行: ssalgten logs 查看详细日志"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        exit 0
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
                # 不再提示"重新运行"，因为交互式菜单会自动exec重新加载
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
    echo -e "  ${GREEN}5.${NC}  ▶️ 启动系统        ${GREEN}6.${NC}  ⏹️ 停止系统"
    echo -e "  ${BLUE}7.${NC}  🔄 重启系统        ${CYAN}8.${NC}  📊 系统状态"
    echo ""
    echo -e "${YELLOW}🔍 监控诊断:${NC}"
    echo -e "  ${CYAN}9.${NC}  📝 查看日志        ${CYAN}10.${NC}  🔍 容器信息"
    echo -e "  ${CYAN}11.${NC}  🔍 端口检查        ${CYAN}12.${NC}  📊 诊断报告"
    echo ""
    echo -e "${YELLOW}🛠️ 维护工具:${NC}"
    echo -e "  ${YELLOW}13.${NC}  💾 数据备份        ${YELLOW}14.${NC}  🧹 系统清理"
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
        3) 
            # 脚本更新：更新后重新执行脚本
            self_update
            if [[ $? -eq 0 ]]; then
                log_info "重新加载更新后的脚本..."
                sleep 1
                # 获取脚本的绝对路径
                local script_path
                if [[ -f "${BASH_SOURCE[0]}" ]]; then
                    script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
                else
                    # 如果BASH_SOURCE不可用，尝试使用which查找
                    script_path="$(which "$(basename "${BASH_SOURCE[0]}")" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
                fi
                exec bash "$script_path" "$@"  # 使用bash显式执行
            fi
            ;;
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
    
    if [[ "$choice" != "0" ]] && [[ "$choice" != "3" ]]; then
        echo
        # 操作完成后直接退出，不返回菜单（脚本更新除外）
        log_success "操作完成，程序退出"
        exit 0
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
    
    # 早期初始化默认镜像命名空间（避免后续调用时超时）
    if [[ -z "$DEFAULT_IMAGE_NAMESPACE" ]]; then
        DEFAULT_IMAGE_NAMESPACE="lonelyrower/ssalgten"
    fi
    
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
            update) 
                update_system "${COMMAND_ARGS[@]}"
                exit $?
                ;;
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
