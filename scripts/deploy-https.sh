#!/bin/bash

# SsalgTen HTTPS 部署脚本
# 一键部署带自动 SSL 证书的生产环境
#
# 使用方法:
# ./deploy-https.sh --domain your-domain.com --email admin@your-domain.com

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SsalgTen HTTPS 部署工具${NC}"
echo "================================="

# 参数解析
DOMAIN=""
EMAIL=""
FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "SsalgTen HTTPS 部署工具"
            echo ""
            echo "使用方法:"
            echo "  $0 --domain your-domain.com [选项]"
            echo ""
            echo "选项:"
            echo "  --domain DOMAIN    域名（必需）"
            echo "  --email EMAIL      证书申请邮箱（可选）"
            echo "  --force            强制部署，跳过确认"
            echo "  --dry-run          模拟运行，不执行实际操作"
            echo "  -h, --help         显示帮助信息"
            echo ""
            echo "例子:"
            echo "  $0 --domain example.com --email admin@example.com"
            exit 0
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            echo "使用 $0 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 验证必需参数
if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}错误: 必须指定域名${NC}"
    echo "使用方法: $0 --domain your-domain.com"
    exit 1
fi

# 设置默认邮箱
if [[ -z "$EMAIL" ]]; then
    EMAIL="admin@${DOMAIN}"
fi

echo -e "${BLUE}📋 部署配置${NC}"
echo "  域名: $DOMAIN"
echo "  邮箱: $EMAIL"
echo "  强制模式: $FORCE"
echo "  模拟运行: $DRY_RUN"
echo ""

# 检查运行环境
check_requirements() {
    echo -e "${BLUE}🔍 检查运行环境...${NC}"
    
    # 检查 root 权限
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}错误: 此脚本需要 root 权限${NC}"
        echo "请使用: sudo $0 $*"
        exit 1
    fi
    
    # 检查必需工具
    local required_tools=("docker" "curl" "dig")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo -e "${RED}错误: 未找到必需工具 $tool${NC}"
            echo "请先安装 $tool"
            exit 1
        fi
    done
    
    # 检查 Docker Compose
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}错误: 未找到 Docker Compose${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境检查通过${NC}"
}

# 验证域名解析
validate_dns() {
    echo -e "${BLUE}🔍 验证域名解析...${NC}"
    
    # 获取服务器外网 IP
    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "")
    if [[ -z "$SERVER_IP" ]]; then
        echo -e "${YELLOW}警告: 无法获取服务器外网 IP${NC}"
    else
        echo "  服务器 IP: $SERVER_IP"
    fi
    
    # 检查 A 记录
    DOMAIN_IP=$(dig +short A "$DOMAIN" 2>/dev/null | tail -n1)
    if [[ -z "$DOMAIN_IP" ]]; then
        echo -e "${RED}错误: 域名 $DOMAIN 没有 A 记录${NC}"
        echo "请先在 DNS 服务商处添加 A 记录指向服务器 IP"
        exit 1
    fi
    
    echo "  域名解析: $DOMAIN -> $DOMAIN_IP"
    
    # 验证 IP 匹配
    if [[ -n "$SERVER_IP" && "$SERVER_IP" != "$DOMAIN_IP" ]]; then
        echo -e "${YELLOW}警告: 域名解析的 IP ($DOMAIN_IP) 与服务器 IP ($SERVER_IP) 不匹配${NC}"
        if [[ "$FORCE" != true ]]; then
            read -p "继续部署？(y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "部署已取消"
                exit 0
            fi
        fi
    else
        echo -e "${GREEN}✅ DNS 解析验证通过${NC}"
    fi
}

# 检查端口占用
check_ports() {
    echo -e "${BLUE}🔍 检查端口占用...${NC}"
    
    local ports=(80 443)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if ss -tuln | grep ":$port " >/dev/null 2>&1; then
            occupied_ports+=($port)
            echo -e "${YELLOW}警告: 端口 $port 被占用${NC}"
        else
            echo -e "${GREEN}端口 $port 可用${NC}"
        fi
    done
    
    if [[ ${#occupied_ports[@]} -gt 0 ]]; then
        echo -e "${YELLOW}检测到端口占用，可能需要停止相关服务${NC}"
        
        # 尝试识别占用端口的服务
        for port in "${occupied_ports[@]}"; do
            echo "端口 $port 占用情况:"
            ss -tulpn | grep ":$port " || true
        done
        
        if [[ "$FORCE" != true ]]; then
            read -p "继续部署？(y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "部署已取消"
                exit 0
            fi
        fi
    fi
}

# 停止可能冲突的服务
stop_conflicting_services() {
    echo -e "${BLUE}🛑 停止可能冲突的服务...${NC}"
    
    # 停止常见的 Web 服务
    local services=("nginx" "apache2" "httpd" "caddy" "traefik")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo "停止服务: $service"
            if [[ "$DRY_RUN" != true ]]; then
                systemctl stop "$service" || true
                systemctl disable "$service" || true
            fi
        fi
    done
    
    # 停止可能占用端口的 Docker 容器
    local running_containers=$(docker ps -q --filter "publish=80" --filter "publish=443" 2>/dev/null || true)
    if [[ -n "$running_containers" ]]; then
        echo "停止占用 80/443 端口的容器"
        if [[ "$DRY_RUN" != true ]]; then
            echo "$running_containers" | xargs docker stop || true
        fi
    fi
}

# 准备环境文件
setup_env_file() {
    echo -e "${BLUE}📝 配置环境文件...${NC}"
    
    local env_file=".env"
    local env_example=".env.example"
    
    # 如果没有 .env 文件，从示例复制
    if [[ ! -f "$env_file" ]]; then
        if [[ -f "$env_example" ]]; then
            echo "从 $env_example 创建 $env_file"
            if [[ "$DRY_RUN" != true ]]; then
                cp "$env_example" "$env_file"
            fi
        else
            echo "创建基础 $env_file"
            if [[ "$DRY_RUN" != true ]]; then
                cat > "$env_file" << EOF
# SsalgTen HTTPS 部署配置
DOMAIN=$DOMAIN
EMAIL=$EMAIL

# 数据库配置
POSTGRES_DB=ssalgten
POSTGRES_USER=ssalgten
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Redis 配置
REDIS_PASSWORD=$(openssl rand -base64 32)

# API 配置
API_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -base64 64)

# 前端配置
VITE_API_URL=/api
VITE_API_BASE_URL=/api

# 生产环境配置
NODE_ENV=production
LOG_LEVEL=info
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
METRICS_ENABLED=true
EOF
            fi
        fi
    fi
    
    # 更新域名和邮箱配置
    if [[ "$DRY_RUN" != true ]]; then
        # 更新或添加域名配置
        if grep -q "^DOMAIN=" "$env_file"; then
            sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" "$env_file"
        else
            echo "DOMAIN=$DOMAIN" >> "$env_file"
        fi
        
        # 更新或添加邮箱配置
        if grep -q "^EMAIL=" "$env_file"; then
            sed -i "s/^EMAIL=.*/EMAIL=$EMAIL/" "$env_file"
        else
            echo "EMAIL=$EMAIL" >> "$env_file"
        fi
        
        # 确保必需的密码存在
        if ! grep -q "^POSTGRES_PASSWORD=" "$env_file" || [[ $(grep "^POSTGRES_PASSWORD=" "$env_file" | cut -d'=' -f2) == "" ]]; then
            echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> "$env_file"
        fi
        
        if ! grep -q "^REDIS_PASSWORD=" "$env_file" || [[ $(grep "^REDIS_PASSWORD=" "$env_file" | cut -d'=' -f2) == "" ]]; then
            echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> "$env_file"
        fi
        
        if ! grep -q "^API_KEY=" "$env_file" || [[ $(grep "^API_KEY=" "$env_file" | cut -d'=' -f2) == "" ]]; then
            echo "API_KEY=$(openssl rand -hex 32)" >> "$env_file"
        fi
        
        if ! grep -q "^JWT_SECRET=" "$env_file" || [[ $(grep "^JWT_SECRET=" "$env_file" | cut -d'=' -f2) == "" ]]; then
            echo "JWT_SECRET=$(openssl rand -base64 64)" >> "$env_file"
        fi
    fi
    
    echo -e "${GREEN}✅ 环境文件配置完成${NC}"
}

# 创建备份
create_backup() {
    echo -e "${BLUE}💾 创建部署前备份...${NC}"
    
    local backup_dir="backups/https-deployment-$(date +%Y%m%d-%H%M%S)"
    
    if [[ "$DRY_RUN" != true ]]; then
        mkdir -p "$backup_dir"
        
        # 备份现有配置
        if [[ -f ".env" ]]; then
            cp ".env" "$backup_dir/"
        fi
        
        if [[ -f "docker-compose.yml" ]]; then
            cp "docker-compose.yml" "$backup_dir/"
        fi
        
        # 备份数据库（如果存在）
        if docker ps -q --filter "name=ssalgten-database" | grep -q .; then
            echo "备份现有数据库..."
            docker exec ssalgten-database pg_dump -U ssalgten ssalgten > "$backup_dir/database.sql" || true
        fi
        
        echo "备份已保存到: $backup_dir"
    fi
}

# 部署服务
deploy_services() {
    echo -e "${BLUE}🚀 部署 HTTPS 服务...${NC}"
    
    if [[ "$DRY_RUN" != true ]]; then
        # 拉取最新镜像
        echo "拉取最新镜像..."
        $DOCKER_COMPOSE_CMD -f docker-compose.https.yml pull
        
        # 构建自定义镜像
        echo "构建应用镜像..."
        $DOCKER_COMPOSE_CMD -f docker-compose.https.yml build
        
        # 启动服务
        echo "启动服务..."
        $DOCKER_COMPOSE_CMD -f docker-compose.https.yml up -d
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 30
        
        # 检查服务状态
        echo -e "${BLUE}📊 服务状态检查${NC}"
        $DOCKER_COMPOSE_CMD -f docker-compose.https.yml ps
    fi
}

# 验证部署
validate_deployment() {
    echo -e "${BLUE}✅ 验证部署结果...${NC}"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo "模拟运行模式，跳过验证"
        return 0
    fi
    
    # 等待 SSL 证书申请
    echo "等待 SSL 证书申请完成（最多等待 2 分钟）..."
    local wait_time=0
    local max_wait=120
    
    while [[ $wait_time -lt $max_wait ]]; do
        if curl -sf --max-time 10 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ HTTPS 连接验证成功${NC}"
            break
        fi
        
        echo -n "."
        sleep 5
        ((wait_time+=5))
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        echo -e "${YELLOW}⚠️  HTTPS 连接验证超时，请检查服务状态${NC}"
    fi
    
    # 测试各个端点
    echo -e "${BLUE}🔍 测试服务端点${NC}"
    
    local endpoints=("/" "/api/health" "/socket.io/")
    for endpoint in "${endpoints[@]}"; do
        if curl -sf --max-time 10 "https://$DOMAIN$endpoint" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $endpoint${NC}"
        else
            echo -e "${RED}❌ $endpoint${NC}"
        fi
    done
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo -e "${GREEN}🎉 HTTPS 部署完成！${NC}"
    echo "================================="
    echo -e "${BLUE}📊 服务信息${NC}"
    echo "  主站地址: https://$DOMAIN"
    echo "  API 地址: https://$DOMAIN/api"
    echo "  管理面板: https://$DOMAIN"
    echo ""
    echo -e "${BLUE}🔧 管理命令${NC}"
    echo "  查看服务状态: docker-compose -f docker-compose.https.yml ps"
    echo "  查看日志: docker-compose -f docker-compose.https.yml logs -f"
    echo "  重启服务: docker-compose -f docker-compose.https.yml restart"
    echo "  停止服务: docker-compose -f docker-compose.https.yml down"
    echo ""
    echo -e "${BLUE}📋 SSL 证书${NC}"
    echo "  证书提供商: Let's Encrypt"
    echo "  自动续期: 是"
    echo "  证书位置: Docker 数据卷 (caddy_data)"
    echo ""
    echo -e "${BLUE}🛡️  安全配置${NC}"
    echo "  HTTPS 重定向: 启用"
    echo "  HSTS: 启用"
    echo "  安全头部: 启用"
    echo ""
    echo -e "${YELLOW}💡 下一步${NC}"
    echo "1. 测试网站访问: https://$DOMAIN"
    echo "2. 安装 Agent 节点:"
    echo "   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\"
    echo "     --master-url https://$DOMAIN \\"
    echo "     --auto-config"
    echo "3. 查看部署日志: docker-compose -f docker-compose.https.yml logs -f"
    echo "4. 监控证书状态: ./scripts/check-ssl.sh $DOMAIN"
}

# 主执行函数
main() {
    # 检查运行环境
    check_requirements
    
    # 验证域名解析
    validate_dns
    
    # 检查端口占用
    check_ports
    
    # 最终确认
    if [[ "$FORCE" != true && "$DRY_RUN" != true ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  即将开始 HTTPS 部署${NC}"
        echo -e "${YELLOW}这将会：${NC}"
        echo "  1. 停止可能冲突的 Web 服务"
        echo "  2. 配置自动 SSL 证书"
        echo "  3. 部署完整的 SsalgTen 服务栈"
        echo "  4. 配置安全的反向代理"
        echo ""
        read -p "确认继续？(y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "部署已取消"
            exit 0
        fi
    fi
    
    # 创建备份
    create_backup
    
    # 停止冲突服务
    stop_conflicting_services
    
    # 配置环境文件
    setup_env_file
    
    # 部署服务
    deploy_services
    
    # 验证部署
    validate_deployment
    
    # 显示部署信息
    show_deployment_info
}

# 运行主程序
main "$@"