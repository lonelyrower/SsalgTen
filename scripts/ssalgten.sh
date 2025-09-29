#!/usr/bin/env bash

# 严格模式与基础环境
set -euo pipefail
IFS=$'\n\t'

# 脚本基本信息
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="SsalgTen Manager"

# 全局变量
APP_DIR=""
COMPOSE_FILE=""
FORCE_MODE=false
NON_INTERACTIVE=false
VERBOSE=false
LAST_RESULT_MSG=""

# 镜像默认值
DEFAULT_IMAGE_REGISTRY="ghcr.io"
DEFAULT_IMAGE_NAMESPACE=""
DEFAULT_IMAGE_TAG="latest"

# 颜色（可通过 LOG_NO_COLOR=true 关闭）
if [[ "${LOG_NO_COLOR:-}" == "true" ]] || [[ ! -t 1 ]]; then
    RED="" GREEN="" YELLOW="" BLUE="" CYAN="" PURPLE="" NC=""
else
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[1;33m'
    BLUE=$'\033[0;34m'
    CYAN=$'\033[0;36m'
    PURPLE=$'\033[0;35m'
    NC=$'\033[0m'
fi

# 日志输出
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_header() { echo -e "${CYAN}$*${NC}"; }

# 非交互环境（如 curl|bash）下的保护：未指定命令则直接提示退出
if [[ ! -t 0 ]] && [[ ! -r /dev/tty ]]; then
    NON_INTERACTIVE=true
    if [[ $# -eq 0 ]]; then
        echo "[INFO] 检测到非交互环境。请追加命令使用，例如：" >&2
        echo "       curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install" >&2
        echo "       curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- status" >&2
        exit 1
    fi
fi

# 镜像命名空间自动推断（git remote > 环境变量 > 默认）
detect_default_image_namespace() {
    local git_url
    git_url=$(git remote get-url origin 2>/dev/null || true)
    if [[ -n "$git_url" ]]; then
        local parsed
        parsed=$(echo "$git_url" | sed -E 's#(git@|https://|http://)?github.com[:/]+##; s#\\.git$##')
        if [[ "$parsed" == */* ]]; then
            echo "$parsed"
            return
        fi
    fi
    echo "${DEFAULT_IMAGE_NAMESPACE:-lonelyrower/ssalgten}"
}

# 交互输入辅助（在 curl|bash 时避免无限菜单重绘）
read_from_tty() {
    local prompt="$1"; local default_value="${2:-}"; local __outvar="${3:-}"
    local answer=""
    if [[ -r /dev/tty ]]; then
        printf "%s" "$prompt" > /dev/tty
        IFS= read -r answer < /dev/tty || answer=""
    else
        # 非交互环境：直接用默认值并标记
        answer="$default_value"
        NON_INTERACTIVE=true
    fi
    if [[ -n "$__outvar" ]]; then
        printf -v "$__outvar" "%s" "${answer:-$default_value}"
    else
        echo "${answer:-$default_value}"
    fi
}

prompt_yes_no() {
    local prompt="$1"; local default_ans="${2:-Y}"; local ans
    local hint="[Y/N] (回车默认 ${default_ans^^})"
    ans=$(read_from_tty "$prompt $hint: " "${default_ans}")
    if [[ "$ans" =~ ^[Yy]$ ]]; then echo "y"; else echo "n"; fi
}

prompt_input() {
    local prompt="$1"; local default_value="${2:-}"; local out
    out=$(read_from_tty "${prompt}${default_value:+ [默认: $default_value]}: " "$default_value")
    echo "$out"
}

prompt_port() {
    local prompt="$1"; local default_port="${2:-80}"; local port
    while true; do
        port=$(read_from_tty "${prompt} [默认: ${default_port}]: " "$default_port")
        if [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 1 ]] && [[ "$port" -le 65535 ]]; then
            echo "$port"; return 0
        fi
        [[ "$NON_INTERACTIVE" == "true" ]] && echo "$default_port" && return 0
        log_warning "无效端口: $port"
    done
}

confirm() {
    local prompt="$1"; local default_ans="${2:-Y}"; local r
    r=$(prompt_yes_no "$prompt" "$default_ans")
    [[ "$r" == "y" ]]
}

# 基础工具与环境探测
die() { log_error "$*"; exit 1; }

check_docker_ready() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "未检测到 Docker，请先安装 Docker 再继续"
        return 1
    fi
    if ! docker info >/dev/null 2>&1; then
        log_warning "Docker 未处于运行状态或当前用户无权限"
        return 1
    fi
    return 0
}

docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
        return $?
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
        return $?
    fi
    log_error "未找到 docker compose，请安装 Docker Compose 插件或 docker-compose"
    return 127
}

detect_app_dir() {
    if [[ -n "${APP_DIR:-}" ]]; then
        return 0
    fi
    # 优先当前目录
    local d="$PWD"
    if [[ -f "$d/docker-compose.yml" || -f "$d/docker-compose.production.yml" || -f "$d/docker-compose.ghcr.yml" ]]; then
        APP_DIR="$d"; return 0
    fi
    # 兜底使用当前目录
    APP_DIR="$d"
}

detect_compose_file() {
    if [[ -n "${COMPOSE_FILE:-}" && -f "$COMPOSE_FILE" ]]; then return 0; fi
    local d="$APP_DIR"
    for f in docker-compose.ghcr.yml docker-compose.production.yml docker-compose.yml; do
        if [[ -f "$d/$f" ]]; then COMPOSE_FILE="$d/$f"; return 0; fi
    done
    COMPOSE_FILE="$d/docker-compose.yml"
}

detect_curl_bash_mode() {
    # 通过 BASH_SOURCE 与是否为临时 fd 判断
    if [[ "${BASH_SOURCE[0]}" == /dev/fd/* ]] || [[ "${BASH_SOURCE[0]}" == /proc/self/fd/* ]] || [[ ! -f "${BASH_SOURCE[0]}" ]] || [[ "${CURL_BASH_MODE:-}" == "true" ]]; then
        return 0
    fi
    return 1
}

handle_curl_bash_install() {
    # 在 curl|bash 下处理 --install，转交给 self_update
    for arg in "$@"; do
        if [[ "$arg" == "--install" ]]; then
            log_info "检测到 --install，开始安装到系统 PATH"
            self_update --install "$@"
            return 0
        fi
    done
    return 1
}

# 统一交互菜单（含 13/14）
show_menu_unified() {
    local status status_color choice tip_of_day day_num
    status=$(get_system_status || true)
    case "$status" in
        running) status_color="${GREEN}✓ 运行中${NC}" ;;
        partial) status_color="${YELLOW}△ 部分运行${NC}" ;;
        stopped) status_color="${RED}○ 已停止${NC}" ;;
        *) status_color="${RED}✗ ${status:-未知}${NC}" ;;
    esac

    clear
    echo -e "${CYAN}================================================================${NC}"
    echo -e "系统状态: $status_color"
    echo -e "应用目录: ${APP_DIR:-$PWD}"
    echo
    echo -e "${YELLOW}📋 主要操作:${NC}"
    echo -e "  ${GREEN}1.${NC} 🚀 启动系统        ${GREEN}2.${NC} 🛑 停止系统"
    echo -e "  ${BLUE}3.${NC} 🔄 重启系统        ${PURPLE}4.${NC} ⚡ 更新系统"
    echo
    echo -e "${YELLOW}📊 监控管理:${NC}"
    echo -e "  ${CYAN}5.${NC} 📊 系统状态        ${CYAN}6.${NC} 📋 查看日志"
    echo -e "  ${CYAN}7.${NC} 🔍 容器信息        ${CYAN}8.${NC} 🔍 端口检查"
    echo
    echo -e "${YELLOW}🛠️  维护工具:${NC}"
    echo -e "  ${YELLOW}9.${NC} 🗂️  数据备份        ${YELLOW}10.${NC} 🧹 系统清理"
    echo -e "  ${YELLOW}11.${NC} 📊 诊断报告       ${YELLOW}12.${NC} 🔄 脚本更新"
    echo -e "  ${PURPLE}13.${NC} 🚀 镜像快速更新       ${PURPLE}14.${NC} 🛠️ 一键部署"
    echo
    echo -e "  ${GREEN}0.${NC} 🚪 退出程序"
    echo -e "${CYAN}================================================================${NC}"

    day_num=$(($(date +%j) % 7))
    case $day_num in
        0) tip_of_day="小贴士: 用 'logs backend -f' 查看后端实时日志" ;;
        1) tip_of_day="小贴士: 'clean --basic' 是安全的日常清理" ;;
        2) tip_of_day="小贴士: 用 'sh' 进入容器快速排查" ;;
        3) tip_of_day="小贴士: 'status' 一键查看服务概况" ;;
        4) tip_of_day="小贴士: 记得 'backup' 定期备份数据库" ;;
        5) tip_of_day="小贴士: 'port-check' 检测端口冲突" ;;
        6) tip_of_day="小贴士: 加 '--verbose' 查看详细过程" ;;
    esac
    echo -e "${BLUE}${tip_of_day}${NC}"
    echo

    choice=$(read_from_tty "请选择操作 [0-14]: " "0")
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
        13) update_system --image ;;
        14) deploy_flow ;;
        0) log_success "感谢使用 SsalgTen 管理器!"; exit 0 ;;
        *) log_error "无效选择: $choice"; sleep 1 ;;
    esac

    if [[ "$choice" != "0" ]]; then
        echo
        read_from_tty "按回车继续..." ""
        SKIP_CLEAR_ONCE=true
    fi
}

# 统一部署：默认镜像模式，可用 --source 切换源码模式
random_string() {
    # 生成长度参数的随机串，默认32
    local len=${1:-32}
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len" 2>/dev/null || date +%s%N | sha1sum | cut -c1-"$len"
}

ensure_env_kv() {
    # ensure_env_kv KEY VALUE [file]
    local key="$1"; local val="$2"; local file="${3:-.env}"
    if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
        sed -i "s#^${key}=.*#${key}=${val//#/\#}#" "$file"
    else
        echo "${key}=${val}" >> "$file"
    fi
}

ensure_env_basics_image() {
    # 准备 .env （若不存在则创建），写入镜像与必要密钥
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

deploy_flow() {
    # 解析参数
    local mode="image"  # 默认镜像模式
    local registry="" namespace="" tag="" compose_override=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode) mode="$2"; shift 2;;
            --image) mode="image"; shift;;
            --source) mode="source"; shift;;
            --registry) registry="$2"; shift 2;;
            --namespace|--repo) namespace="$2"; shift 2;;
            --tag) tag="$2"; shift 2;;
            --compose-file) compose_override="$2"; shift 2;;
            --help) echo "用法: ssalgten deploy [--image|--source] [--registry ghcr.io] [--namespace owner/repo] [--tag latest]"; return 0;;
            *) shift;;
        esac
    done

    check_docker_ready || return 1
    detect_app_dir
    cd "$APP_DIR" || die "无法进入应用目录: $APP_DIR"

    if [[ "$mode" == "image" ]]; then
        IMAGE_REGISTRY="${registry:-${IMAGE_REGISTRY:-$DEFAULT_IMAGE_REGISTRY}}"
        IMAGE_NAMESPACE="${namespace:-${IMAGE_NAMESPACE:-$(detect_default_image_namespace)}}"
        IMAGE_TAG="${tag:-${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}}"
        export IMAGE_REGISTRY IMAGE_NAMESPACE IMAGE_TAG
        ensure_env_basics_image
        local compose_file
        if [[ -n "$compose_override" ]]; then compose_file="$compose_override";
        elif [[ -f docker-compose.ghcr.yml ]]; then compose_file=docker-compose.ghcr.yml; else compose_file=$COMPOSE_FILE; fi
        log_header "🚀 首次部署（镜像模式）"
        log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE:(backend|frontend|updater|agent) 标签: $IMAGE_TAG"
        docker_compose -f "$compose_file" pull
        docker_compose -f "$compose_file" up -d postgres
        log_info "等待数据库..."; sleep 5
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        docker_compose -f "$compose_file" up -d --remove-orphans
        log_success "部署完成"
        echo "模式: 镜像 | 入口: http://localhost:${FRONTEND_PORT:-3000}"
    else
        ensure_env_basics_source
        local compose_file
        if [[ -n "$compose_override" ]]; then compose_file="$compose_override";
        elif [[ -f docker-compose.production.yml ]]; then compose_file=docker-compose.production.yml; else compose_file=$COMPOSE_FILE; fi
        log_header "🚀 首次部署（源码模式）"
        docker_compose -f "$compose_file" build
        docker_compose -f "$compose_file" up -d postgres
        log_info "等待数据库..."; sleep 5
        docker_compose -f "$compose_file" run --rm backend npx prisma migrate deploy || log_warning "数据库迁移失败，可稍后重试"
        docker_compose -f "$compose_file" up -d --remove-orphans
        log_success "部署完成"
        echo "模式: 源码 | 入口: http://localhost:${FRONTEND_PORT:-3000}"
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
    echo -e "  ${PURPLE}13.${NC} 🚀 镜像快速更新       ${PURPLE}14.${NC} 🛠️ 一键部署"
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
show_menu_unified() {
    local status
    status=$(get_system_status)
    local status_color
    
    case "$status" in
        "running") status_color="${GREEN}● 运行中${NC}" ;;
        "partial") status_color="${YELLOW}◐ 部分运行${NC}" ;;
        "stopped") status_color="${RED}○ 已停止${NC}" ;;
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
        # 在 curl|bash 环境下也尽量停留，避免信息被清掉
        read_from_tty "按回车键继续..." ""
        # 下一次进入菜单时跳过 clear，一次性保留上一轮输出
        SKIP_CLEAR_ONCE=true
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
            start|stop|restart|status|logs|ps|exec|update|backup|clean|port-check|diagnose|self-update|deploy)
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
    local IN_CURL_BASH=false
    # 首先检查是否为curl|bash模式
    if detect_curl_bash_mode; then
        IN_CURL_BASH=true
        # 处理curl|bash安装
        if handle_curl_bash_install "$@"; then
            exit 0  # 安装成功，退出
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
            deploy) deploy_flow "${COMMAND_ARGS[@]}" ;;
            *) die "未知命令: $COMMAND" ;;
        esac
    else
        # 交互式菜单逻辑
        if [[ "$IN_CURL_BASH" == "true" ]]; then
            # 在curl|bash下优先尝试使用 /dev/tty 交互
            if [[ -r /dev/tty ]]; then
                while true; do
                    show_menu_unified
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
                show_menu_unified
            done
        fi
    fi
}

# 运行主函数
main "$@"
