#!/bin/bash

# SsalgTen 系统完整卸载脚本
# 用于完全删除SsalgTen主服务系统

set -e

# 解析参数（--force / -y 自动回答“是”）
FORCE_MODE=false
for arg in "$@"; do
    case "$arg" in
        --force|-y)
            FORCE_MODE=true
            ;;
    esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量
APP_DIR="/opt/ssalgten"
SCRIPT_VERSION="1.0.0"

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

# 通用sudo函数
run_as_root() {
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        # 直接执行命令
        "$@"
    else
        # 使用sudo执行
        sudo "$@"
    fi
}

# Docker Compose 兼容性函数
docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
        return $?
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        if docker-compose version >/dev/null 2>&1; then
            docker-compose "$@"
            return $?
        else
            log_warning "检测到 docker-compose 可执行文件，但无法正常运行（可能被损坏）"
        fi
    fi
    log_error "未找到可用的 Docker Compose（docker compose 或 docker-compose）"
    return 1
}

# 从终端读取输入（解决管道输入问题）
read_from_tty() {
    local prompt="$1"
    local response=""
    
    # 在强制模式下，默认回答 Yes
    if [[ "$FORCE_MODE" == "true" ]]; then
        echo "Y"
        return 0
    fi
    
    # 尝试从 /dev/tty 读取（直接从终端读取）
    if [[ -r /dev/tty ]]; then
        echo -n "$prompt" > /dev/tty
        read response < /dev/tty
    else
        # 如果无法访问 /dev/tty，使用标准输入
        echo -n "$prompt"
        read response
    fi
    
    echo "$response"
}

# 显示卸载警告
show_uninstall_warning() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen 系统卸载程序"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    echo -e "${RED}⚠️ 危险操作警告 ⚠️${NC}"
    echo ""
    echo "此操作将完全删除以下内容："
    echo ""
    echo "📦 应用组件："
    echo "  • 所有 Docker 容器和镜像"
    echo "  • 应用目录：$APP_DIR"
    echo "  • 系统服务：ssalgten.service"
    echo "  • SSL 证书（Let's Encrypt）"
    echo ""
    echo "🗃️ 数据内容："
    echo "  • PostgreSQL 数据库（所有监控数据）"
    echo "  • Redis 缓存数据"
    echo "  • 日志文件"
    echo "  • 配置文件"
    echo ""
    echo "🔧 系统配置："
    echo "  • 防火墙规则"
    echo "  • Nginx/Caddy 配置"
    echo "  • 定时任务"
    echo ""
    echo -e "${YELLOW}注意：此操作不可逆！${NC}"
    echo ""
}

# 检查权限
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        export RUNNING_AS_ROOT=true
        log_info "使用root用户运行卸载程序"
    else
        # 检查sudo权限
        if ! sudo -v >/dev/null 2>&1; then
            log_error "需要sudo权限来卸载系统组件"
            exit 1
        fi
        log_info "使用sudo权限运行卸载程序"
    fi
}

# 检查并清理Web服务器
cleanup_web_servers() {
    log_info "检查并清理Web服务器..."

    # 更稳健的端口检测：ss > netstat > lsof 三重回退
    local ports_in_use=""
    if command -v ss >/dev/null 2>&1; then
        ports_in_use=$(ss -ltn 2>/dev/null | awk '$4 ~ /:(80|443)$/ {print $4}' | sed 's/.*://g' | sort -u)
    elif command -v netstat >/dev/null 2>&1; then
        ports_in_use=$(netstat -tln 2>/dev/null | awk '$4 ~ /:(80|443)$/ {print $4}' | sed 's/.*://g' | sort -u)
    elif command -v lsof >/dev/null 2>&1; then
        ports_in_use=$(lsof -nP -iTCP:80,443 -sTCP:LISTEN 2>/dev/null | awk '{print $9}' | sed -n 's/.*:\([0-9]\+\)$/\1/p' | sort -u)
    else
        ports_in_use="unknown"
    fi

    # 无论是否检测到端口占用，都检查常见Web服务器的运行状态，避免因缺少netstat导致漏清理
    local web_servers=("nginx" "apache2" "httpd" "caddy" "lighttpd")
    local any_web_running=false
    for service in "${web_servers[@]}"; do
        if run_as_root systemctl is-active --quiet "$service" 2>/dev/null; then
            any_web_running=true
            log_info "检测到 $service 服务正在运行"
            cleanup_service=$(read_from_tty "是否停止并禁用 $service 服务？[Y/N]: ")
            if [[ "$cleanup_service" =~ ^[Yy]$ ]]; then
                run_as_root systemctl stop "$service" 2>/dev/null || true
                run_as_root systemctl disable "$service" 2>/dev/null || true
                log_success "$service 服务已停止并禁用"
            else
                log_info "保留 $service 服务"
            fi
        fi
    done

    # 如果端口被占用或有Web服务在运行，则尝试列出并清理占用80/443的进程
    if [[ -n "$ports_in_use" && "$ports_in_use" != "unknown" ]] || [[ "$any_web_running" == true ]]; then
        # 收集占用80/443的PID（lsof优先，其次ss解析）
        local remaining_pids=""
        if command -v lsof >/dev/null 2>&1; then
            remaining_pids=$(lsof -ti:80,443 2>/dev/null | sort -u || true)
        elif command -v ss >/dev/null 2>&1; then
            remaining_pids=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:(80|443)$/ {print $7}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
        else
            remaining_pids=""
        fi

        if [[ -n "$remaining_pids" ]]; then
            log_warning "仍有进程占用端口 80/443："
            if command -v lsof >/dev/null 2>&1; then
                lsof -nP -i:80,443 2>/dev/null || true
            else
                ss -ltnp 2>/dev/null | grep -E ":(80|443)\s" || true
            fi
            force_kill=$(read_from_tty "是否强制终止上述进程？[Y/N]: ")
            if [[ "$force_kill" =~ ^[Yy]$ ]]; then
                echo "$remaining_pids" | xargs -r -n1 sh -c 'kill -9 "$0" 2>/dev/null || true'
                log_success "已强制终止占用端口的进程"
            fi
        fi
    fi

    # 最终确认
    if command -v ss >/dev/null 2>&1; then
        if ss -ltn 2>/dev/null | grep -qE ":(80|443)\s"; then
            log_warning "端口 80/443 可能仍被占用，请稍后重试或手动检查"
        else
            log_success "端口 80/443 未被占用"
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -ti:80,443 2>/dev/null | grep -q .; then
            log_warning "端口 80/443 可能仍被占用，请稍后重试或手动检查"
        else
            log_success "端口 80/443 未被占用"
        fi
    else
        log_info "无法确认端口占用（缺少 ss/lsof），请手动验证"
    fi
}

# 停止所有服务
stop_services() {
    log_info "停止 SsalgTen 服务..."
    
    # 停止系统服务
    if run_as_root systemctl is-active --quiet ssalgten.service 2>/dev/null; then
        run_as_root systemctl stop ssalgten.service
        log_success "系统服务已停止"
    fi
    
    # 停止 Docker 服务
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR"
        if [[ -f "docker-compose.yml" ]]; then
            log_info "停止 Docker 容器..."
            docker_compose down --remove-orphans --volumes 2>/dev/null || true
            log_success "Docker 容器已停止"
        fi
    fi
    
    # 清理Web服务器
    cleanup_web_servers
}

# 删除系统服务
remove_system_service() {
    log_info "删除系统服务..."
    
    # 删除 SsalgTen 相关服务
    local ssalgten_services=("ssalgten" "ssalgten-agent" "ssalgten-backend" "ssalgten-frontend")
    
    for service in "${ssalgten_services[@]}"; do
        if run_as_root systemctl is-enabled "$service.service" 2>/dev/null; then
            run_as_root systemctl stop "$service.service" 2>/dev/null || true
            run_as_root systemctl disable "$service.service" 2>/dev/null || true
            log_info "已停止并禁用 $service.service"
        fi
        
        # 删除服务文件
        if [[ -f "/etc/systemd/system/$service.service" ]]; then
            run_as_root rm -f "/etc/systemd/system/$service.service"
            log_info "已删除服务文件: $service.service"
        fi
    done
    
    # 重新加载systemd
    run_as_root systemctl daemon-reload
    run_as_root systemctl reset-failed 2>/dev/null || true
    
    log_success "系统服务已删除"
}

# 删除Docker容器和镜像
remove_docker_resources() {
    log_info "删除 Docker 资源..."
    
    # 删除相关容器
    CONTAINERS=$(docker ps -a --format "table {{.Names}}" | grep -E "ssalgten|postgres|redis|caddy" 2>/dev/null || true)
    if [[ -n "$CONTAINERS" ]]; then
        echo "$CONTAINERS" | while read -r container; do
            if [[ "$container" != "NAMES" ]]; then
                docker rm -f "$container" 2>/dev/null || true
                log_info "已删除容器: $container"
            fi
        done
    fi
    
    # 删除相关镜像
    IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "ssalgten|postgres|redis|caddy" 2>/dev/null || true)
    if [[ -n "$IMAGES" ]]; then
        echo "$IMAGES" | while read -r image; do
            docker rmi "$image" 2>/dev/null || true
            log_info "已删除镜像: $image"
        done
    fi
    
    # 删除相关卷
    VOLUMES=$(docker volume ls -q | grep -E "ssalgten|postgres|redis" 2>/dev/null || true)
    if [[ -n "$VOLUMES" ]]; then
        echo "$VOLUMES" | while read -r volume; do
            docker volume rm "$volume" 2>/dev/null || true
            log_info "已删除卷: $volume"
        done
    fi
    
    # 删除相关网络
    NETWORKS=$(docker network ls --format "{{.Name}}" | grep -E "ssalgten" 2>/dev/null || true)
    if [[ -n "$NETWORKS" ]]; then
        echo "$NETWORKS" | while read -r network; do
            if [[ "$network" != "bridge" && "$network" != "host" && "$network" != "none" ]]; then
                docker network rm "$network" 2>/dev/null || true
                log_info "已删除网络: $network"
            fi
        done
    fi
    
    log_success "Docker 资源清理完成"
}

# 删除应用目录和配置文件
remove_app_directory() {
    log_info "删除应用目录和配置文件..."
    
    # 删除主应用目录
    if [[ -d "$APP_DIR" ]]; then
        run_as_root rm -rf "$APP_DIR"
        log_success "应用目录已删除: $APP_DIR"
    else
        log_info "应用目录不存在，跳过删除"
    fi
    
    # 删除可能的其他目录
    local other_dirs=(
        "/opt/ssalgten-agent"
        "/var/lib/ssalgten"
        "/var/log/ssalgten"
        "/etc/ssalgten"
        "/home/ssalgten"
    )
    
    for dir in "${other_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            cleanup_dir=$(read_from_tty "发现目录 $dir，是否删除？[Y/N]: ")
            if [[ "$cleanup_dir" =~ ^[Yy]$ ]]; then
                run_as_root rm -rf "$dir"
                log_success "已删除目录: $dir"
            else
                log_info "保留目录: $dir"
            fi
        fi
    done
    
    # 删除可能的配置文件
    local config_files=(
        "/etc/nginx/sites-available/ssalgten"
        "/etc/nginx/sites-enabled/ssalgten"
        "/etc/nginx/conf.d/ssalgten.conf"
        "/etc/apache2/sites-available/ssalgten.conf"
        "/etc/apache2/sites-enabled/ssalgten.conf"
        "/etc/caddy/Caddyfile"
    )
    
    for file in "${config_files[@]}"; do
        if [[ -f "$file" ]]; then
            cleanup_file=$(read_from_tty "发现配置文件 $file，是否删除？[Y/N]: ")
            if [[ "$cleanup_file" =~ ^[Yy]$ ]]; then
                run_as_root rm -f "$file"
                log_success "已删除配置文件: $file"
            else
                log_info "保留配置文件: $file"
            fi
        fi
    done

    # 如果Nginx仍在运行，尝试重载或停止以释放端口
    if run_as_root systemctl is-active --quiet nginx 2>/dev/null; then
        if run_as_root nginx -t >/dev/null 2>&1; then
            run_as_root systemctl reload nginx 2>/dev/null || true
            log_info "已重载 Nginx 配置"
        else
            run_as_root systemctl stop nginx 2>/dev/null || true
            run_as_root systemctl disable nginx 2>/dev/null || true
            log_info "已停止并禁用 Nginx 服务"
        fi
    fi
}

# 卸载流程结束前的最终端口校验，确保无残留占用
final_port_check() {
    log_info "执行最终端口校验 (80/443)..."
    local still_in_use=""
    if command -v ss >/dev/null 2>&1; then
        still_in_use=$(ss -ltnp 2>/dev/null | grep -E ":(80|443)\s" || true)
    elif command -v lsof >/dev/null 2>&1; then
        still_in_use=$(lsof -nP -i:80,443 2>/dev/null || true)
    else
        still_in_use="unknown"
    fi

    if [[ -n "$still_in_use" && "$still_in_use" != "unknown" ]]; then
        log_warning "检测到仍有进程监听 80/443："
        echo "$still_in_use"
        echo "如需彻底清理，请手动确认后终止相关进程。"
    else
        log_success "80/443 端口已释放"
    fi
}

# 删除SSL证书
remove_ssl_certificates() {
    log_info "删除 SSL 证书..."
    
    # 删除 Let's Encrypt 证书目录
    if [[ -d "/etc/letsencrypt" ]]; then
        cleanup_certs=$(read_from_tty "是否删除 Let's Encrypt 证书目录？[Y/N]: ")
        if [[ "$cleanup_certs" =~ ^[Yy]$ ]]; then
            run_as_root rm -rf /etc/letsencrypt
            log_success "SSL 证书已删除"
        else
            log_info "保留 SSL 证书"
        fi
    fi
    
    # 删除 Caddy 数据目录
    if [[ -d "/var/lib/caddy" ]]; then
        run_as_root rm -rf /var/lib/caddy 2>/dev/null || true
    fi
}

# 清理防火墙规则
cleanup_firewall() {
    log_info "清理防火墙规则..."
    
    cleanup_fw=$(read_from_tty "是否删除 SsalgTen 相关防火墙规则（端口 80,443,3001,3002,3003）？[Y/N]: ")
    if [[ "$cleanup_fw" =~ ^[Yy]$ ]]; then
        # UFW
        if command -v ufw >/dev/null 2>&1; then
            for port in 80 443 3001 3002 3003; do
                run_as_root ufw --force delete allow $port 2>/dev/null || true
            done
            log_success "UFW 防火墙规则已清理"
        fi
        
        # Firewalld
        if command -v firewall-cmd >/dev/null 2>&1; then
            for port in 80 443 3001 3002 3003; do
                run_as_root firewall-cmd --permanent --remove-port=$port/tcp 2>/dev/null || true
            done
            run_as_root firewall-cmd --reload 2>/dev/null || true
            log_success "Firewalld 防火墙规则已清理"
        fi
    else
        log_info "保留防火墙规则"
    fi
}

# 清理定时任务
cleanup_cron_jobs() {
    log_info "清理定时任务..."
    
    # 清理 root 用户的定时任务
    if run_as_root crontab -l 2>/dev/null | grep -q "ssalgten"; then
        cleanup_cron=$(read_from_tty "发现 SsalgTen 相关定时任务，是否删除？[Y/N]: ")
        if [[ "$cleanup_cron" =~ ^[Yy]$ ]]; then
            run_as_root crontab -l 2>/dev/null | grep -v "ssalgten" | run_as_root crontab -
            log_success "定时任务已清理"
        else
            log_info "保留定时任务"
        fi
    fi
}

# 清理系统包（可选）
cleanup_system_packages() {
    log_info "系统包清理选项..."
    
    cleanup_docker=$(read_from_tty "是否同时卸载 Docker？（不推荐，可能影响其他应用）[Y/N]: ")
    if [[ "$cleanup_docker" =~ ^[Yy]$ ]]; then
        log_info "卸载 Docker..."
        
        # 停止 Docker 服务
        run_as_root systemctl stop docker 2>/dev/null || true
        run_as_root systemctl disable docker 2>/dev/null || true
        
        # 根据包管理器卸载 Docker
        if command -v apt >/dev/null 2>&1; then
            run_as_root apt remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
            run_as_root apt autoremove -y 2>/dev/null || true
        elif command -v yum >/dev/null 2>&1; then
            run_as_root yum remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
        elif command -v dnf >/dev/null 2>&1; then
            run_as_root dnf remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
        fi
        
        # 删除 Docker 数据目录
        run_as_root rm -rf /var/lib/docker 2>/dev/null || true
        run_as_root rm -rf /var/lib/containerd 2>/dev/null || true
        
        log_success "Docker 已卸载"
    else
        log_info "保留 Docker 环境"
    fi
}

# 显示卸载完成信息
show_completion_message() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  🗑️ SsalgTen 系统卸载完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    
    log_success "SsalgTen 系统已完全卸载"
    echo ""
    echo "已删除的组件："
    echo "  ✓ 所有 Docker 容器、镜像和卷"
    echo "  ✓ 应用目录 $APP_DIR"
    echo "  ✓ 系统服务 ssalgten.service"
    echo "  ✓ 相关配置文件"
    echo ""
    echo "如果之前选择了额外清理："
    echo "  ✓ SSL 证书（Let's Encrypt）"
    echo "  ✓ 防火墙规则"
    echo "  ✓ 定时任务"
    echo "  ✓ Docker 环境（如果选择）"
    echo ""
    echo "感谢使用 SsalgTen 监控系统！"
    echo ""
    echo "如需重新安装，请访问："
    echo "https://github.com/lonelyrower/SsalgTen"
    echo ""
}

# 主函数
main() {
    show_uninstall_warning
    
    # 确认卸载
    confirm=$(read_from_tty "确认要完全卸载 SsalgTen 系统吗？这个操作不可逆！[Y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消卸载"
        exit 0
    fi
    
    echo ""
    log_info "开始卸载 SsalgTen 系统..."
    
    check_permissions
    stop_services
    remove_docker_resources
    remove_system_service
    remove_app_directory
    remove_ssl_certificates
    cleanup_firewall
    cleanup_cron_jobs
    cleanup_system_packages
    final_port_check
    
    show_completion_message
}

# 错误处理
trap 'log_error "卸载过程中发生错误，请检查并手动清理剩余组件"; exit 1' ERR

# 运行主函数
main "$@"
