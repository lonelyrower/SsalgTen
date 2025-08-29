#!/usr/bin/env bash

# SsalgTen 系统管理工具
# 一键式管理：启动、停止、更新、备份等完整功能
# 支持交互式菜单和命令行子命令，可远程运行

set -euo pipefail
IFS=$'\n\t'

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
${SCRIPT_NAME} v${SCRIPT_VERSION}

用法:
    $(basename "$0") [选项] [子命令]

选项:
    --dir PATH          指定应用目录 (默认自动检测)
    --compose-file FILE 指定compose文件路径
    --force, -y         强制执行，跳过确认提示
    --non-interactive   非交互模式，使用默认选择
    --verbose, -v       详细输出
    --help, -h          显示此帮助信息
    --version           显示版本信息

子命令:
    start               启动系统
    stop                停止系统  
    restart             重启系统
    status              查看系统状态
    logs [SERVICE]      查看日志 [可选指定服务]
    ps                  显示容器信息
    exec SERVICE CMD... 在容器中执行命令
    
    update              更新系统
    backup              备份数据
    clean [--docker-cache] [--with-volumes]  清理资源
    
    port-check          检查端口占用
    diagnose            生成诊断报告
    self-update         更新此脚本到最新版本

示例:
    $(basename "$0")                    # 交互式菜单
    $(basename "$0") start              # 启动系统
    $(basename "$0") logs backend       # 查看backend日志
    $(basename "$0") update --force     # 强制更新
    $(basename "$0") --dir=/opt/custom start  # 指定目录启动

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
    # 优先使用 docker compose (v2)
    if docker compose version &> /dev/null; then
        docker compose "$@"
    elif command -v docker-compose &> /dev/null && docker-compose version &> /dev/null; then
        docker-compose "$@"
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
            COMPOSE_FILE="$file"
            return 0
        fi
    done
    
    die "未找到 Docker Compose 文件。请确保在正确的项目目录下运行"
}

# 健康检查
health_check() {
    local service="$1"
    local url="$2"
    local max_attempts=10
    local delay=2
    
    log_info "检查 $service 健康状态..."
    
    for ((i=1; i<=max_attempts; i++)); do
        if curl -sf "$url" &> /dev/null; then
            log_success "$service 健康检查通过"
            return 0
        fi
        
        [[ $i -lt $max_attempts ]] && sleep $delay
    done
    
    log_warning "$service 健康检查失败"
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "显示 $service 日志:"
        docker_compose logs --tail=20 "$service" 2>/dev/null || true
    fi
    return 1
}

# 检查端口占用
port_check() {
    log_header "🔍 端口占用检查"
    
    local ports=(80 443 3000 3001 3002 5432)
    local tool_found=false
    
    # 优先使用 ss
    if command -v ss &> /dev/null; then
        tool_found=true
        echo "使用 ss 检查端口占用:"
        for port in "${ports[@]}"; do
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
        local port_list
        port_list=$(IFS=,; echo "${ports[*]}")
        lsof -nP -i:"$port_list" 2>/dev/null || echo "所有检查端口均空闲"
    fi
    
    if [[ "$tool_found" == "false" ]]; then
        log_warning "未找到端口检查工具 (ss/lsof)"
    fi
}

# 系统状态
system_status() {
    log_header "📊 系统状态"
    
    check_docker_ready
    cd "$APP_DIR"
    
    echo
    echo "=== Docker 容器状态 ==="
    docker_compose ps
    
    echo
    echo "=== 服务健康检查 ==="
    local backend_healthy=false
    local frontend_healthy=false
    
    if curl -sf "http://localhost:3001/api/health" &> /dev/null; then
        echo -e "Backend API: ${GREEN}✓ 正常${NC}"
        backend_healthy=true
    else
        echo -e "Backend API: ${RED}✗ 异常${NC}"
    fi
    
    if curl -sf "http://localhost:3000/" &> /dev/null; then
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
        echo -e "${GREEN}Frontend: http://localhost:3000${NC}"
        echo -e "${GREEN}Backend API: http://localhost:3001${NC}"
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
        
        # 健康检查
        local healthy=true
        health_check "backend" "http://localhost:3001/api/health" || healthy=false
        health_check "frontend" "http://localhost:3000/" || healthy=false
        
        if [[ "$healthy" == "true" ]]; then
            log_success "🎉 系统启动成功!"
            echo -e "${GREEN}访问地址: http://localhost:3000${NC}"
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
        
        # 检查端口是否释放
        local ports_to_check=(3000 3001 3002 5432)
        local occupied_ports=()
        
        for port in "${ports_to_check[@]}"; do
            if lsof -ti:"$port" &> /dev/null; then
                occupied_ports+=("$port")
            fi
        done
        
        if [[ ${#occupied_ports[@]} -gt 0 ]]; then
            log_warning "发现未释放的端口: ${occupied_ports[*]}"
            if confirm "是否强制终止占用这些端口的进程?"; then
                for port in "${occupied_ports[@]}"; do
                    lsof -ti:"$port" | xargs -r kill -9 2>/dev/null || true
                done
                log_info "已清理残留进程"
            fi
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
view_logs() {
    local service="${1:-}"
    local follow="${2:-false}"
    local tail_lines="${3:-100}"
    
    check_docker_ready
    cd "$APP_DIR"
    
    if [[ -n "$service" ]]; then
        log_header "📋 $service 服务日志"
    else
        log_header "📋 系统日志"
    fi
    
    local cmd_args=(logs)
    [[ "$follow" == "true" ]] && cmd_args+=(--follow)
    [[ -n "$tail_lines" ]] && cmd_args+=(--tail="$tail_lines")
    [[ -n "$service" ]] && cmd_args+=("$service")
    
    docker_compose "${cmd_args[@]}"
}

# 进入容器执行命令
exec_in_container() {
    local service="$1"
    shift
    local cmd=("$@")
    
    check_docker_ready  
    cd "$APP_DIR"
    
    log_info "在 $service 容器中执行命令: ${cmd[*]}"
    
    # 检查容器是否运行
    if ! docker_compose ps --services --filter "status=running" | grep -q "^${service}$"; then
        die "服务 $service 未运行"
    fi
    
    # 检测是否为交互模式
    local exec_flags=(-T)
    if [[ -t 0 ]] && [[ -t 1 ]]; then
        exec_flags=(-it)
    fi
    
    docker_compose exec "${exec_flags[@]}" "$service" "${cmd[@]}"
}

# 更新系统
update_system() {
    log_header "⚡ 更新系统"
    
    cd "$APP_DIR"
    
    # 检查 Git 状态
    if ! git rev-parse --git-dir &> /dev/null; then
        die "当前目录不是Git仓库"
    fi
    
    if ! git diff --quiet 2>/dev/null; then
        log_warning "发现未提交的更改:"
        git status --short
        echo
        
        if confirm "继续更新将丢失这些更改，是否继续?" "N"; then
            log_info "暂存本地更改..."
            git stash push -m "Auto-stash before update at $(date)"
        else
            log_info "更新已取消"
            return 0
        fi
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
        
        # 健康检查
        local healthy=true
        health_check "backend" "http://localhost:3001/api/health" || healthy=false
        health_check "frontend" "http://localhost:3000/" || healthy=false
        
        if [[ "$healthy" == "true" ]]; then
            log_success "🎉 系统更新完成!"
        else
            log_warning "更新完成，但部分服务可能异常"
        fi
    else
        log_error "服务启动失败"
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

# 清理系统
clean_system() {
    local clean_docker_cache=false
    local clean_volumes=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --docker-cache) clean_docker_cache=true; shift ;;
            --with-volumes) clean_volumes=true; shift ;;
            *) shift ;;
        esac
    done
    
    log_header "🧹 系统清理"
    
    echo "将要清理的内容:"
    echo "  - 悬挂的 Docker 镜像"
    [[ "$clean_docker_cache" == "true" ]] && echo "  - Docker 构建缓存"
    [[ "$clean_volumes" == "true" ]] && echo "  - 数据卷 (⚠️ 会删除所有数据)"
    echo
    
    if ! confirm "确认执行清理操作?" "N"; then
        log_info "清理已取消"
        return 0
    fi
    
    cd "$APP_DIR"
    
    # 停止服务（如果需要清理卷）
    if [[ "$clean_volumes" == "true" ]]; then
        log_info "停止所有服务..."
        docker_compose down --remove-orphans
    fi
    
    # 清理悬挂镜像
    log_info "清理悬挂镜像..."
    docker image prune -f
    
    # 清理 Docker 缓存
    if [[ "$clean_docker_cache" == "true" ]]; then
        log_info "清理 Docker 构建缓存..."
        docker builder prune -f 2>/dev/null || true
        docker system prune -f
    fi
    
    # 清理卷（需要二次确认）
    if [[ "$clean_volumes" == "true" ]]; then
        echo
        log_warning "⚠️ 即将删除所有数据卷，此操作不可恢复！"
        if confirm "真的要删除所有数据吗?" "N"; then
            log_info "清理数据卷..."
            docker_compose down --volumes
            # 只删除项目相关的卷
            docker volume ls -q | grep -E "(ssalgten|postgres)" | xargs -r docker volume rm 2>/dev/null || true
            log_warning "数据卷已删除"
        else
            log_info "跳过数据卷清理"
        fi
    fi
    
    # 清理日志文件
    if [[ -d ".update/logs" ]]; then
        log_info "清理旧的更新日志..."
        find .update/logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
    
    log_success "✅ 清理完成"
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
self_update() {
    log_header "🔄 脚本自更新"
    
    local script_url="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh"
    local temp_script="/tmp/ssalgten_new.sh"
    
    if ! confirm "确认更新脚本到最新版本?" "Y"; then
        log_info "自更新已取消"
        return 0
    fi
    
    log_info "下载最新版本..."
    if curl -fsSL "$script_url" -o "$temp_script"; then
        chmod +x "$temp_script"
        
        # 简单验证
        if [[ -s "$temp_script" ]] && head -1 "$temp_script" | grep -q "#!/"; then
            log_info "备份当前版本..."
            cp "${BASH_SOURCE[0]}" "${BASH_SOURCE[0]}.bak.$(date +%Y%m%d_%H%M%S)"
            
            log_info "安装新版本..."
            cp "$temp_script" "${BASH_SOURCE[0]}"
            
            log_success "脚本已更新到最新版本"
            log_info "重新运行以使用新版本"
        else
            log_error "下载的文件无效"
            return 1
        fi
    else
        log_error "下载失败"
        return 1
    fi
    
    rm -f "$temp_script"
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
            start|stop|restart|status|logs|ps|exec|update|backup|clean|port-check|diagnose|self-update)
                COMMAND="$1"
                shift
                COMMAND_ARGS=("$@")
                break
                ;;
            *)
                log_error "未知选项: $1"
                log_info "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
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
                local service="${COMMAND_ARGS[0]:-}"
                local follow=false
                [[ "${COMMAND_ARGS[*]}" =~ --follow ]] && follow=true
                view_logs "$service" "$follow"
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
            self-update) self_update ;;
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