#!/bin/bash

# SsalgTen 完全卸载脚本
# 用于彻底清理系统，方便重新安装

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 环境 / 选项
APP_DIR="/opt/ssalgten"
DRY_RUN=${DRY_RUN:-false}  # 设置 DRY_RUN=true 可仅查看将执行的操作

# Docker Compose 兼容性函数（支持 dry-run 输出）
docker_compose() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY_RUN] docker compose $*"
        return 0
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    elif docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        echo -e "${RED}[ERROR]${NC} 未找到 docker-compose 或 docker compose 命令"
        return 1
    fi
}

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

# 获取sudo权限
get_sudo() {
    if [[ $EUID -ne 0 ]]; then
        echo "此脚本需要sudo权限来完全清理系统"
        sudo -v
        if [[ $? -ne 0 ]]; then
            log_error "无法获取sudo权限"
            exit 1
        fi
        SUDO="sudo"
    else
        SUDO=""
    fi
}

# 显示警告和确认
show_warning() {
    echo ""
    echo "🚨🚨🚨 重要警告 🚨🚨🚨"
    echo ""
    echo -e "${RED}此脚本将完全卸载SsalgTen系统，包括：${NC}"
    echo "  ❌ 停止并删除所有Docker容器"
    echo "  ❌ 删除所有Docker镜像和数据卷"
    echo "  ❌ 删除所有监控数据和数据库"
    echo "  ❌ 删除项目文件和配置"
    echo "  ❌ 删除Nginx配置和SSL证书"
    echo "  ❌ 重置防火墙规则"
    echo ""
    echo -e "${YELLOW}⚠️  这个操作是不可逆的！所有数据都将丢失！${NC}"
    echo ""
    read -p "确认要继续卸载吗？请输入 'YES' 来确认: " confirm < /dev/tty
    
    if [[ "$confirm" != "YES" ]]; then
        log_info "卸载已取消"
        exit 0
    fi
    
    echo ""
    echo "开始卸载倒计时..."
    for i in {5..1}; do
        echo "  $i 秒后开始..."
        sleep 1
    done
    echo ""
}

# 停止并删除Docker服务
cleanup_docker_services() {
    log_info "清理Docker服务..."

    if ! command -v docker >/dev/null 2>&1; then
        log_warning "未安装Docker，跳过Docker资源清理"
        return 0
    fi

    # 进入项目目录（如果存在）
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR"
        if [[ -f "docker-compose.production.yml" ]]; then
            log_info "停止 SsalgTen 服务 (docker-compose.production.yml)..."
            docker_compose -f docker-compose.production.yml down --remove-orphans 2>/dev/null || true
        fi
    fi

    # 获取资源列表（精确匹配前缀，避免误删）
    containers=$(docker ps -a --format '{{.Names}}' | grep -E '^ssalgten' || true)
    images=$(docker images --format '{{.Repository}} {{.ID}}' | awk '/^ssalgten/ {print $2}' || true)
    volumes=$(docker volume ls --format '{{.Name}}' | grep -E '^ssalgten' || true)
    networks=$(docker network ls --format '{{.Name}}' | grep -E '^ssalgten' || true)

    # 删除容器
    if [[ -n "$containers" ]]; then
        log_info "删除容器: $(echo $containers | tr '\n' ' ')"
        if [[ "$DRY_RUN" != "true" ]]; then echo "$containers" | xargs -r docker rm -f 2>/dev/null || true; fi
    else
        log_info "无 SsalgTen 容器"
    fi

    # 删除镜像
    if [[ -n "$images" ]]; then
        log_info "删除镜像: $(echo $images | tr '\n' ' ')"
        if [[ "$DRY_RUN" != "true" ]]; then echo "$images" | xargs -r docker rmi -f 2>/dev/null || true; fi
    else
        log_info "无 SsalgTen 镜像"
    fi

    # 删除卷
    if [[ -n "$volumes" ]]; then
        log_info "删除数据卷: $(echo $volumes | tr '\n' ' ')"
        if [[ "$DRY_RUN" != "true" ]]; then echo "$volumes" | xargs -r docker volume rm -f 2>/dev/null || true; fi
    else
        log_info "无 SsalgTen 数据卷"
    fi

    # 删除网络
    if [[ -n "$networks" ]]; then
        log_info "删除网络: $(echo $networks | tr '\n' ' ')"
        if [[ "$DRY_RUN" != "true" ]]; then echo "$networks" | xargs -r docker network rm 2>/dev/null || true; fi
    else
        log_info "无 SsalgTen 网络"
    fi

    log_success "Docker服务清理完成"
}

# 清理项目文件
cleanup_project_files() {
    log_info "清理项目文件..."
    if [[ -d "$APP_DIR" ]]; then
        log_info "删除项目目录 $APP_DIR ..."
        if [[ "$DRY_RUN" != "true" ]]; then $SUDO rm -rf "$APP_DIR"; fi
    fi
    if [[ "$DRY_RUN" != "true" ]]; then $SUDO rm -rf ${APP_DIR}.bak* 2>/dev/null || true; fi
    log_success "项目文件清理完成"
}

# 清理Nginx配置
cleanup_nginx_config() {
    log_info "清理Nginx配置..."
    
    # 删除SsalgTen的Nginx配置（Debian/Ubuntu: sites-available/sites-enabled）
    if [[ -f "/etc/nginx/sites-enabled/ssalgten" || -f "/etc/nginx/sites-available/ssalgten" ]]; then
        log_info "删除Nginx站点配置 (sites-*)..."
        $SUDO rm -f /etc/nginx/sites-enabled/ssalgten 2>/dev/null || true
        $SUDO rm -f /etc/nginx/sites-available/ssalgten 2>/dev/null || true
    fi
    # 删除SsalgTen的Nginx配置（CentOS/RHEL: conf.d）
    if [[ -f "/etc/nginx/conf.d/ssalgten.conf" ]]; then
        log_info "删除Nginx站点配置 (conf.d)..."
        $SUDO rm -f /etc/nginx/conf.d/ssalgten.conf 2>/dev/null || true
    fi
    
    # 重新加载Nginx（如果正在运行）
    if systemctl is-active --quiet nginx; then
        log_info "重新加载Nginx配置..."
        $SUDO systemctl reload nginx 2>/dev/null || true
    fi
    
    log_success "Nginx配置清理完成"
}

# 清理SSL证书
cleanup_ssl_certificates() {
    log_info "清理SSL证书..."
    if [[ ! -d "/etc/letsencrypt" ]]; then
        log_info "未检测到 /etc/letsencrypt 目录，跳过"
        return 0
    fi
    # 尝试从历史 Nginx 配置中解析域名
    domains=""
    for cfg in \
        /etc/nginx/sites-available/ssalgten \
        /etc/nginx/conf.d/ssalgten.conf; do
        if [[ -f "$cfg" ]]; then
            cfg_domains=$(grep -E 'server_name' "$cfg" 2>/dev/null | sed 's/.*server_name//' | sed 's/;//' | tr -s ' ' | tr ' ' '\n' | grep -v '^$' | grep -v '^_' | grep -v 'server_name' | sed 's/^www.//' | sort -u || true)
            domains="$domains
$cfg_domains"
        fi
    done
    domains=$(echo "$domains" | grep -v '^$' | sort -u || true)
    # 进一步从 .env 中解析 DOMAIN
    if [[ -f "$APP_DIR/.env" ]]; then
        env_domain=$(grep -E '^DOMAIN=' "$APP_DIR/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" )
        if [[ -n "$env_domain" ]]; then
            domains="$domains
$env_domain"
        fi
    fi
    domains=$(echo "$domains" | grep -v '^$' | sort -u || true)
    # 回退：匹配包含 ssalgten 的 live 目录
    if [[ -z "$domains" ]]; then
        domains=$(find /etc/letsencrypt/live -maxdepth 1 -mindepth 1 -type d -name '*ssalgten*' -exec basename {} \; 2>/dev/null || true)
    fi
    if [[ -z "$domains" ]]; then
        log_info "未发现需删除的证书"
    else
        echo "$domains" | while read d; do
            [[ -z "$d" ]] && continue
            log_info "删除证书: $d"
            if [[ "$DRY_RUN" != "true" ]]; then $SUDO certbot delete --cert-name "$d" --non-interactive 2>/dev/null || true; fi
        done
    fi
    log_success "SSL证书清理完成"
}

# 重置防火墙规则
reset_firewall() {
        log_info "配置防火墙规则..."
        # 优先处理 UFW，其次 firewalld；都不存在则跳过
        if command -v ufw >/dev/null 2>&1; then
            echo ""
            log_warning "防火墙配置选项 (UFW)："
            echo "1. 仅删除SsalgTen相关端口规则 (推荐)"
            echo "2. 完全重置防火墙规则 (危险)"
            echo "0. 不做任何更改"
            echo ""
            read -p "选择 [1/2/0] (默认1): " fw_choice < /dev/tty
            fw_choice=${fw_choice:-1}
            case "$fw_choice" in
                2)
                    log_warning "执行完全重置 (UFW)..."
                    if [[ "$DRY_RUN" != "true" ]]; then
                        $SUDO ufw --force reset
                        $SUDO ufw default deny incoming
                        $SUDO ufw default allow outgoing
                        $SUDO ufw allow ssh
                        $SUDO ufw --force enable
                    fi
                    ;;
                0)
                    log_info "跳过防火墙修改"
                    log_success "防火墙规则配置完成"
                    return 0
                    ;;
                *)
                    log_info "仅清理相关端口规则..."
                    for p in 80 443 3000 3001 5432; do
                        if [[ "$DRY_RUN" != "true" ]]; then $SUDO ufw delete allow $p 2>/dev/null || true; fi
                    done
                    ;;
            esac
            if [[ "$DRY_RUN" != "true" ]]; then
                log_info "当前防火墙规则："
                $SUDO ufw status numbered || true
            fi
            log_success "防火墙规则配置完成"
        elif command -v firewall-cmd >/dev/null 2>&1; then
            echo ""
            log_warning "防火墙配置选项 (firewalld)："
            echo "1. 仅删除SsalgTen相关端口规则 (推荐)"
            echo "2. 尝试恢复默认策略 (谨慎)"
            echo "0. 不做任何更改"
            echo ""
            read -p "选择 [1/2/0] (默认1): " fw_choice < /dev/tty
            fw_choice=${fw_choice:-1}
            case "$fw_choice" in
                2)
                    log_warning "执行恢复默认策略 (firewalld)..."
                    if [[ "$DRY_RUN" != "true" ]]; then
                        $SUDO firewall-cmd --permanent --remove-service=http 2>/dev/null || true
                        $SUDO firewall-cmd --permanent --remove-service=https 2>/dev/null || true
                        for p in 80 443 3000 3001 5432; do
                            $SUDO firewall-cmd --permanent --remove-port=${p}/tcp 2>/dev/null || true
                        done
                        $SUDO firewall-cmd --reload 2>/dev/null || true
                    fi
                    ;;
                0)
                    log_info "跳过防火墙修改"
                    log_success "防火墙规则配置完成"
                    return 0
                    ;;
                *)
                    log_info "仅清理相关端口规则 (firewalld)..."
                    for p in 80 443 3000 3001 5432; do
                        if [[ "$DRY_RUN" != "true" ]]; then $SUDO firewall-cmd --permanent --remove-port=${p}/tcp 2>/dev/null || true; fi
                    done
                    if [[ "$DRY_RUN" != "true" ]]; then $SUDO firewall-cmd --permanent --remove-service=http 2>/dev/null || true; fi
                    if [[ "$DRY_RUN" != "true" ]]; then $SUDO firewall-cmd --permanent --remove-service=https 2>/dev/null || true; fi
                    if [[ "$DRY_RUN" != "true" ]]; then $SUDO firewall-cmd --reload 2>/dev/null || true; fi
                    ;;
            esac
            log_success "防火墙规则配置完成"
        else
            log_info "未检测到 UFW 或 firewalld，跳过防火墙操作"
        fi
}

# 清理Docker配置和用户组
cleanup_docker_config() {
    log_info "清理Docker配置和用户组..."
    
    # 停止Docker服务
    if systemctl is-active --quiet docker; then
        log_info "停止Docker服务..."
        $SUDO systemctl stop docker 2>/dev/null || true
        $SUDO systemctl stop docker.socket 2>/dev/null || true
    fi
    
    # 从docker组移除ssalgten用户
    if id "ssalgten" &>/dev/null; then
        log_info "从docker组移除ssalgten用户..."
        $SUDO gpasswd -d ssalgten docker 2>/dev/null || true
    fi
    
    # 清理Docker systemd状态
    log_info "重置Docker systemd状态..."
    $SUDO systemctl daemon-reload 2>/dev/null || true
    $SUDO systemctl reset-failed docker 2>/dev/null || true
    $SUDO systemctl reset-failed docker.socket 2>/dev/null || true
    
    # 删除Docker APT源
    $SUDO rm -f /etc/apt/sources.list.d/docker*.list 2>/dev/null || true
    $SUDO rm -f /usr/share/keyrings/docker*.gpg 2>/dev/null || true
    
    # 清理sources.list中的docker条目
    if grep -q "docker.com" /etc/apt/sources.list 2>/dev/null; then
        $SUDO sed -i '/docker\.com/d' /etc/apt/sources.list
    fi
    
    # 清理Docker配置目录中可能的残留配置
    $SUDO rm -rf /etc/docker/daemon.json.bak* 2>/dev/null || true
    
    # 清理APT缓存
    $SUDO apt clean 2>/dev/null || true
    $SUDO rm -rf /var/lib/apt/lists/*docker* 2>/dev/null || true
    
    # 清理可能的端口占用和进程（避免误杀，精确匹配）
    log_info "清理相关进程..."
    if pgrep -f "ssalgten" >/dev/null 2>&1; then
        $SUDO pkill -f "ssalgten" 2>/dev/null || true
    fi
    sleep 1

    # 可选清理 iptables (默认跳过)
    if [[ "$ASKED_IPTABLES" != "true" ]]; then
    read -p "是否刷新 NAT/MANGLE iptables 规则以清理残留? [Y/N]: " flush_iptable < /dev/tty || true
        if [[ "$flush_iptable" =~ ^[Yy]$ ]]; then
            log_warning "刷新 NAT / MANGLE 表..."
            $SUDO iptables -t nat -F 2>/dev/null || true
            $SUDO iptables -t mangle -F 2>/dev/null || true
        else
            log_info "跳过 iptables 刷新"
        fi
        export ASKED_IPTABLES=true
    fi
    
    log_success "Docker配置和用户组清理完成"
}

# 询问是否要深度清理
ask_deep_cleanup() {
    echo ""
    log_warning "可选的深度清理选项："
    echo ""
    echo "1. 完全卸载Docker (会影响其他Docker项目)"
    echo "2. 清理所有未使用的Docker资源"
    echo "3. 卸载相关系统依赖包"
    echo ""
    read -p "是否执行深度清理？[Y/N] (回车默认选择 N): " deep_clean < /dev/tty
    
    if [[ "$deep_clean" =~ ^[Yy]$ ]]; then
        deep_cleanup
    fi
}

# 深度清理
deep_cleanup() {
    log_info "执行深度清理..."
    
    # 清理所有Docker资源
    log_info "清理所有Docker资源..."
    docker system prune -af --volumes 2>/dev/null || true
    
    # 询问是否卸载Docker
    read -p "是否完全卸载Docker？这会影响其他Docker项目 [Y/N] (回车默认选择 N): " remove_docker < /dev/tty
    if [[ "$remove_docker" =~ ^[Yy]$ ]]; then
        log_info "卸载Docker..."
        # 停止所有Docker服务
        $SUDO systemctl stop docker docker.socket containerd 2>/dev/null || true
        # 禁用服务
        $SUDO systemctl disable docker docker.socket containerd 2>/dev/null || true
        # 卸载包
        $SUDO apt remove -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
        $SUDO apt autoremove -y 2>/dev/null || true
        # 清理配置和数据
        $SUDO rm -rf /var/lib/docker 2>/dev/null || true
        $SUDO rm -rf /var/lib/containerd 2>/dev/null || true
        $SUDO rm -rf /etc/docker 2>/dev/null || true
    else
        # 不卸载Docker，但重启服务以清理状态
        if command -v docker >/dev/null 2>&1; then
            log_info "重启Docker服务以清理状态..."
            $SUDO systemctl restart docker 2>/dev/null || true
        fi
    fi
    
    # 询问是否清理依赖包
    read -p "是否清理系统依赖包？(curl, wget, git, nginx等) [Y/N] (回车默认选择 N): " remove_deps < /dev/tty
    if [[ "$remove_deps" =~ ^[Yy]$ ]]; then
        log_info "清理系统依赖包..."
        # 这里列出的是部署脚本安装的包，用户可能其他地方也在用，所以默认不删除
        packages_to_remove="nginx certbot python3-certbot-nginx htop jq"
        $SUDO apt remove -y $packages_to_remove 2>/dev/null || true
        $SUDO apt autoremove -y 2>/dev/null || true
    fi
    
    log_success "深度清理完成"
}

# 验证卸载
verify_uninstall() {
    log_info "验证卸载结果..."
    
    issues=0
    
    # 检查Docker容器
    if docker ps -a --format "table {{.Names}}" 2>/dev/null | grep -q ssalgten; then
        log_warning "发现残留的Docker容器"
        issues=$((issues + 1))
    fi
    
    # 检查Docker镜像
    if docker images --format "table {{.Repository}}" 2>/dev/null | grep -q ssalgten; then
        log_warning "发现残留的Docker镜像"
        issues=$((issues + 1))
    fi
    
    # 检查项目目录
    if [[ -d "/opt/ssalgten" ]]; then
        log_warning "项目目录仍然存在"
        issues=$((issues + 1))
    fi
    
    # 检查Nginx配置
    if [[ -f "/etc/nginx/sites-available/ssalgten" ]]; then
        log_warning "Nginx配置文件仍然存在"
        issues=$((issues + 1))
    fi
    
    if [[ $issues -eq 0 ]]; then
        log_success "✅ 卸载验证通过，系统已完全清理"
    else
        log_warning "⚠️ 发现 $issues 个残留项目，但主要组件已清理"
    fi
}

# 显示卸载完成信息
show_completion() {
    echo ""
    echo "🎉🎉🎉 卸载完成 🎉🎉🎉"
    echo ""
    log_success "SsalgTen已完全卸载！"
    echo ""
    echo "📋 已清理的内容："
    echo "  ✅ Docker容器、镜像和数据卷"
    echo "  ✅ 项目文件和配置"
    echo "  ✅ Nginx配置和SSL证书"
    echo "  ✅ 防火墙规则已重置"
    echo ""
    echo "🚀 现在您可以："
    echo "  1. 重新运行安装脚本进行全新安装"
    echo "  2. 安装其他项目"
    echo "  3. 或保持系统为干净状态"
    echo ""
    echo "📥 重新安装命令："
    echo "  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh | bash"
    echo ""
}

# 主函数
main() {
    echo "🗑️  SsalgTen 完全卸载脚本"
    echo "=================================="
    
    get_sudo
    show_warning
    
    log_info "开始卸载SsalgTen..."
    
    cleanup_docker_services
    cleanup_project_files  
    cleanup_nginx_config
    cleanup_ssl_certificates
    reset_firewall
    cleanup_docker_config
    
    ask_deep_cleanup
    verify_uninstall
    show_completion
}

# 运行主函数
main "$@"
