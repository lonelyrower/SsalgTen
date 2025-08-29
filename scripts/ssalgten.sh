#!/bin/bash

# SsalgTen 交互式系统控制台
# 一个命令管理整个系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Docker Compose 命令兼容性检查
if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DC="docker compose"
else
    DC=""
fi

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${CYAN}$1${NC}"
}

# 清屏和显示标题
show_header() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
   _____ _____ ____  _      _____ _______ ______ _   _ 
  / ___// __  / __ \| |    / ____|__   __|  ____| \ | |
  \`--. \`' / /' / \ | |   | |  __   | |  | |__  |  \| |
   `--. \ / /  | |  | |   | | |_ |  | |  |  __| | . ` |
  /\__/ ./ /___| |__| |___| |__| |  | |  | |____| |\  |
  \____/ \_____/____/\_____\_____|  |_|  |______|_| \_|
                                                       
                   网络监控管理系统
EOF
    echo -e "${NC}"
    echo -e "${CYAN}================================================================${NC}"
    echo ""
}

# 检查Docker服务
check_docker() {
    if [ -z "$DC" ]; then
        log_error "未找到 docker-compose 或 docker compose 命令"
        return 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker 服务未运行或无法访问"
        return 1
    fi
    return 0
}

# 获取系统状态
get_system_status() {
    if ! check_docker >/dev/null 2>&1; then
        echo "Docker未运行"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    local running_containers=$($DC ps --services --filter "status=running" 2>/dev/null | wc -l)
    local total_services=$($DC config --services 2>/dev/null | wc -l)
    
    if [ "$running_containers" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
        echo "运行中"
    elif [ "$running_containers" -gt 0 ]; then
        echo "部分运行"
    else
        echo "已停止"
    fi
}

# 显示主菜单
show_main_menu() {
    local status=$(get_system_status)
    local status_color
    
    case "$status" in
        "运行中") status_color="${GREEN}● $status${NC}" ;;
        "部分运行") status_color="${YELLOW}◐ $status${NC}" ;;
        "已停止") status_color="${RED}○ $status${NC}" ;;
        *) status_color="${RED}✗ $status${NC}" ;;
    esac
    
    echo -e "${CYAN}系统状态:${NC} $status_color"
    echo -e "${CYAN}项目目录:${NC} $PROJECT_DIR"
    echo ""
    echo -e "${YELLOW}请选择操作:${NC}"
    echo ""
    echo -e "  ${GREEN}1.${NC} 🚀 启动系统"
    echo -e "  ${RED}2.${NC} 🛑 停止系统"
    echo -e "  ${BLUE}3.${NC} 🔄 重启系统"
    echo -e "  ${PURPLE}4.${NC} ⚡ 更新系统"
    echo ""
    echo -e "  ${CYAN}5.${NC} 📊 系统状态"
    echo -e "  ${CYAN}6.${NC} 📋 查看日志"
    echo -e "  ${CYAN}7.${NC} 🔍 容器列表"
    echo ""
    echo -e "  ${YELLOW}8.${NC} 🧹 清理系统"
    echo -e "  ${YELLOW}9.${NC} 🔧 维护模式"
    echo ""
    echo -e "  ${GREEN}0.${NC} 🚪 退出"
    echo ""
    echo -e "${CYAN}================================================================${NC}"
}

# 启动系统
start_system() {
    log_header "🚀 启动 SsalgTen 系统"
    echo ""
    
    if ! check_docker; then
        read -p "按任意键继续..."
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    log_info "启动所有服务..."
    if $DC up -d --remove-orphans; then
        echo ""
        log_info "等待服务启动完成..."
        sleep 10
        
        # 健康检查
        log_info "检查服务健康状态..."
        local healthy=true
        
        if curl -f -s "http://localhost:3001/api/health" >/dev/null 2>&1; then
            log_success "✅ 后端API正常"
        else
            log_warning "⚠️  后端API未响应"
            healthy=false
        fi
        
        if curl -f -s "http://localhost:3000/" >/dev/null 2>&1; then
            log_success "✅ 前端服务正常"
        else
            log_warning "⚠️  前端服务未响应"
            healthy=false
        fi
        
        echo ""
        if [ "$healthy" = true ]; then
            log_success "🎉 系统启动完成！"
            echo -e "${GREEN}前端访问: http://localhost:3000${NC}"
            echo -e "${GREEN}后端API: http://localhost:3001${NC}"
        else
            log_warning "系统启动完成，但部分服务可能未正常运行"
        fi
    else
        log_error "系统启动失败"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 停止系统
stop_system() {
    log_header "🛑 停止 SsalgTen 系统"
    echo ""
    
    if ! check_docker; then
        read -p "按任意键继续..."
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    log_info "正在优雅关闭所有服务..."
    if $DC down --remove-orphans; then
        sleep 3
        
        # 检查端口释放
        log_info "检查端口释放..."
        local remaining_processes=$(lsof -ti:3000,3001,3002,5432 2>/dev/null | wc -l)
        if [ "$remaining_processes" -gt 0 ]; then
            log_warning "发现残留进程，正在清理..."
            lsof -ti:3000,3001,3002,5432 2>/dev/null | xargs -r kill -9 2>/dev/null || true
            sleep 2
        fi
        
        log_success "✅ 系统已完全停止！"
        log_info "所有端口已释放，可以安全进行更新操作"
    else
        log_error "系统停止失败"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 重启系统
restart_system() {
    log_header "🔄 重启 SsalgTen 系统"
    echo ""
    
    log_info "第一步: 停止系统..."
    cd "$PROJECT_DIR"
    $DC down --remove-orphans >/dev/null 2>&1
    sleep 3
    
    log_info "第二步: 启动系统..."
    if $DC up -d --remove-orphans; then
        sleep 10
        log_success "✅ 系统重启完成！"
    else
        log_error "系统重启失败"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 更新系统
update_system() {
    log_header "⚡ 更新 SsalgTen 系统"
    echo ""
    
    # 检查git状态
    cd "$PROJECT_DIR"
    if ! git diff --quiet 2>/dev/null; then
        log_warning "发现未提交的更改："
        git status --short
        echo ""
        echo -e "${YELLOW}请选择操作:${NC}"
        echo "1. 继续更新 (将丢失未提交的更改)"
        echo "2. 返回主菜单"
        echo ""
        read -p "请输入选择 [1-2]: " choice
        
        case $choice in
            1)
                log_info "重置所有更改..."
                git reset --hard HEAD
                ;;
            *)
                return 0
                ;;
        esac
    fi
    
    echo -e "${YELLOW}⚠️  系统将会停止→更新→重启，确认继续吗？${NC}"
    read -p "输入 'yes' 确认: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "更新已取消"
        read -p "按任意键继续..."
        return 0
    fi
    
    log_info "第一步: 停止系统..."
    $DC down --remove-orphans >/dev/null 2>&1
    
    log_info "第二步: 拉取最新代码..."
    if git pull origin main; then
        log_success "代码更新完成"
    else
        log_error "代码更新失败"
        read -p "按任意键继续..."
        return 1
    fi
    
    log_info "第三步: 重新构建并启动..."
    if $DC up -d --build --remove-orphans; then
        sleep 15
        log_success "🎉 系统更新完成！"
        
        # 显示更新信息
        local new_version=$(git rev-parse --short HEAD)
        echo ""
        log_info "新版本: $new_version"
        log_info "更新时间: $(date)"
    else
        log_error "系统启动失败"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 显示系统状态
show_system_status() {
    log_header "📊 SsalgTen 系统状态"
    echo ""
    
    if ! check_docker; then
        read -p "按任意键继续..."
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # 容器状态
    echo -e "${CYAN}Docker 容器状态:${NC}"
    $DC ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo -e "${CYAN}端口占用情况:${NC}"
    local ports_info=$(lsof -i:3000,3001,3002,5432 2>/dev/null)
    if [ -n "$ports_info" ]; then
        echo "$ports_info" | head -10
    else
        echo "所有端口空闲"
    fi
    
    echo ""
    echo -e "${CYAN}系统资源:${NC}"
    echo "磁盘使用: $(df -h . | tail -1 | awk '{print $5}') ($(df -h . | tail -1 | awk '{print $3}') / $(df -h . | tail -1 | awk '{print $2}'))"
    echo "系统负载: $(uptime | awk -F'load average:' '{print $2}')"
    
    # API健康检查
    echo ""
    echo -e "${CYAN}服务健康检查:${NC}"
    if curl -f -s "http://localhost:3001/api/health" >/dev/null 2>&1; then
        echo -e "后端API: ${GREEN}✅ 正常${NC}"
    else
        echo -e "后端API: ${RED}❌ 异常${NC}"
    fi
    
    if curl -f -s "http://localhost:3000/" >/dev/null 2>&1; then
        echo -e "前端服务: ${GREEN}✅ 正常${NC}"
    else
        echo -e "前端服务: ${RED}❌ 异常${NC}"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 查看日志
view_logs() {
    log_header "📋 系统日志"
    echo ""
    
    if ! check_docker; then
        read -p "按任意键继续..."
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    echo -e "${YELLOW}选择日志查看方式:${NC}"
    echo "1. 实时日志 (按Ctrl+C退出)"
    echo "2. 最近100行"
    echo "3. 返回主菜单"
    echo ""
    read -p "请选择 [1-3]: " choice
    
    case $choice in
        1)
            echo ""
            log_info "显示实时日志 (按Ctrl+C返回菜单)..."
            echo ""
            $DC logs -f
            ;;
        2)
            echo ""
            log_info "最近100行日志:"
            echo ""
            $DC logs --tail=100
            echo ""
            read -p "按任意键继续..."
            ;;
        *)
            return 0
            ;;
    esac
}

# 容器列表
show_containers() {
    log_header "🔍 容器详情"
    echo ""
    
    if ! check_docker; then
        read -p "按任意键继续..."
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    echo -e "${CYAN}SsalgTen 服务容器:${NC}"
    $DC ps --format "table {{.Name}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo -e "${CYAN}所有Docker容器:${NC}"
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | head -20
    
    echo ""
    echo -e "${CYAN}Docker镜像占用:${NC}"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(ssalgten|postgres|node)" | head -10
    
    echo ""
    read -p "按任意键继续..."
}

# 清理系统
clean_system() {
    log_header "🧹 系统清理"
    echo ""
    
    echo -e "${YELLOW}⚠️  这将清理Docker镜像和缓存，确认继续吗？${NC}"
    read -p "输入 'yes' 确认: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "清理已取消"
        read -p "按任意键继续..."
        return 0
    fi
    
    cd "$PROJECT_DIR"
    
    log_info "停止所有服务..."
    $DC down --remove-orphans >/dev/null 2>&1
    
    log_info "清理Docker资源..."
    docker system prune -f
    docker image prune -f
    docker builder prune -f 2>/dev/null || true
    
    # 清理日志文件
    if [ -d ".update/logs" ]; then
        log_info "清理更新日志..."
        find .update/logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
    
    log_success "✅ 系统清理完成！"
    echo ""
    read -p "按任意键继续..."
}

# 维护模式
maintenance_mode() {
    log_header "🔧 维护模式"
    echo ""
    
    echo -e "${YELLOW}维护工具:${NC}"
    echo "1. 🔍 检查系统完整性"
    echo "2. 🗂️  备份数据"
    echo "3. 🔄 重建所有容器"
    echo "4. 📊 生成诊断报告"
    echo "5. 🏠 返回主菜单"
    echo ""
    read -p "请选择 [1-5]: " choice
    
    case $choice in
        1)
            check_system_integrity
            ;;
        2)
            backup_data
            ;;
        3)
            rebuild_containers
            ;;
        4)
            generate_diagnostic_report
            ;;
        *)
            return 0
            ;;
    esac
}

# 检查系统完整性
check_system_integrity() {
    echo ""
    log_info "检查系统完整性..."
    
    cd "$PROJECT_DIR"
    
    # 检查关键文件
    local files_ok=true
    for file in "docker-compose.yml" "package.json" ".env"; do
        if [ -f "$file" ]; then
            log_success "✅ $file 存在"
        else
            log_error "❌ $file 缺失"
            files_ok=false
        fi
    done
    
    # 检查Git状态
    echo ""
    log_info "检查Git仓库状态..."
    git status --porcelain
    
    # 检查磁盘空间
    echo ""
    log_info "检查磁盘空间..."
    df -h .
    
    if [ "$files_ok" = true ]; then
        log_success "系统完整性检查通过"
    else
        log_warning "发现系统文件问题"
    fi
    
    echo ""
    read -p "按任意键继续..."
}

# 备份数据
backup_data() {
    echo ""
    log_info "创建数据备份..."
    
    cd "$PROJECT_DIR"
    local backup_dir=".backup/manual_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # 备份配置文件
    cp .env "$backup_dir/" 2>/dev/null || true
    cp docker-compose.yml "$backup_dir/" 2>/dev/null || true
    
    # 备份数据库
    if $DC ps database >/dev/null 2>&1; then
        log_info "备份数据库..."
        $DC exec -T database pg_dump -U ssalgten -d ssalgten --clean --if-exists > "$backup_dir/database.sql" 2>/dev/null || true
    fi
    
    log_success "备份完成: $backup_dir"
    echo ""
    read -p "按任意键继续..."
}

# 重建容器
rebuild_containers() {
    echo ""
    echo -e "${YELLOW}⚠️  这将重建所有容器，确认继续吗？${NC}"
    read -p "输入 'yes' 确认: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "重建已取消"
        read -p "按任意键继续..."
        return 0
    fi
    
    cd "$PROJECT_DIR"
    
    log_info "停止并删除所有容器..."
    $DC down --remove-orphans
    
    log_info "重建并启动容器..."
    $DC up -d --build --force-recreate
    
    log_success "容器重建完成"
    echo ""
    read -p "按任意键继续..."
}

# 生成诊断报告
generate_diagnostic_report() {
    echo ""
    log_info "生成系统诊断报告..."
    
    local report_file="diagnostic_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "SsalgTen 系统诊断报告"
        echo "生成时间: $(date)"
        echo "========================================"
        echo ""
        
        echo "系统信息:"
        echo "----------------------------------------"
        uname -a
        echo ""
        
        echo "Docker版本:"
        echo "----------------------------------------"
        docker --version
        $DC version
        echo ""
        
        echo "容器状态:"
        echo "----------------------------------------"
        cd "$PROJECT_DIR"
        $DC ps
        echo ""
        
        echo "磁盘使用:"
        echo "----------------------------------------"
        df -h
        echo ""
        
        echo "内存使用:"
        echo "----------------------------------------"
        free -h
        echo ""
        
        echo "网络端口:"
        echo "----------------------------------------"
        netstat -tlnp | grep -E ":300[0-2]|:5432"
        echo ""
        
    } > "$report_file"
    
    log_success "诊断报告生成完成: $report_file"
    echo ""
    read -p "按任意键继续..."
}

# 主循环
main_loop() {
    while true; do
        show_header
        show_main_menu
        echo ""
        read -p "请输入选择 [0-9]: " choice
        
        case $choice in
            1) start_system ;;
            2) stop_system ;;
            3) restart_system ;;
            4) update_system ;;
            5) show_system_status ;;
            6) view_logs ;;
            7) show_containers ;;
            8) clean_system ;;
            9) maintenance_mode ;;
            0) 
                echo ""
                log_success "感谢使用 SsalgTen 系统控制台！"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                log_error "无效选择，请重试"
                sleep 1
                ;;
        esac
    done
}

# 错误处理
trap 'echo ""; log_error "操作中断"; exit 1' INT

# 启动主程序
main_loop