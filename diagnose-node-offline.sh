#!/bin/bash

# 诊断节点未上线问题的脚本
echo "🔍 SsalgTen Agent 离线问题诊断"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 1. 检查Agent安装状态
echo "1. 检查Agent安装状态..."
AGENT_DIR="/opt/ssalgten-agent"

if [[ -d "$AGENT_DIR" ]]; then
    log_success "Agent目录存在: $AGENT_DIR"
    echo "   文件列表:"
    ls -la "$AGENT_DIR" | head -10
else
    log_error "Agent目录不存在: $AGENT_DIR"
    echo "   可能的原因:"
    echo "   - 安装未完成或失败"
    echo "   - 安装到了其他目录"
    echo ""
fi
echo ""

# 2. 检查Docker容器状态
echo "2. 检查Docker容器状态..."
if command -v docker >/dev/null 2>&1; then
    log_info "Docker已安装，检查Agent容器..."
    
    # 检查ssalgten相关容器
    CONTAINERS=$(docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i ssalgten || echo "无相关容器")
    if [[ "$CONTAINERS" != "无相关容器" ]]; then
        echo "   SsalgTen容器状态:"
        echo "$CONTAINERS"
    else
        log_warning "未找到SsalgTen相关容器"
        echo "   所有容器列表:"
        docker ps -a --format "table {{.Names}}\t{{.Status}}" | head -5
    fi
    
    # 如果在Agent目录，检查docker-compose
    if [[ -d "$AGENT_DIR" ]]; then
        cd "$AGENT_DIR"
        if [[ -f "docker-compose.yml" ]]; then
            log_info "检查docker-compose状态..."
            docker-compose ps 2>/dev/null || docker compose ps 2>/dev/null || echo "   docker-compose命令失败"
        fi
    fi
else
    log_error "Docker未安装或不在PATH中"
fi
echo ""

# 3. 检查系统服务状态
echo "3. 检查系统服务状态..."
if systemctl list-unit-files | grep -q ssalgten-agent; then
    log_info "检查ssalgten-agent系统服务..."
    systemctl status ssalgten-agent --no-pager -l || echo "   服务状态检查失败"
else
    log_warning "未找到ssalgten-agent系统服务"
    echo "   已安装的相关服务:"
    systemctl list-unit-files | grep -i agent | head -3 || echo "   无相关服务"
fi
echo ""

# 4. 检查网络连接
echo "4. 检查网络连接..."
log_info "检查基本网络连接..."

# 检查DNS解析
if nslookup github.com >/dev/null 2>&1; then
    log_success "DNS解析正常"
else
    log_error "DNS解析失败"
fi

# 检查外网连接
if curl -s --connect-timeout 5 https://www.google.com >/dev/null 2>&1; then
    log_success "外网连接正常"
else
    log_warning "外网连接可能有问题"
fi

# 检查GitHub访问
if curl -s --connect-timeout 5 https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh >/dev/null 2>&1; then
    log_success "GitHub访问正常"
else
    log_error "GitHub访问失败"
fi
echo ""

# 5. 检查端口占用
echo "5. 检查端口占用情况..."
PORTS=("3001" "3002" "3003")
for port in "${PORTS[@]}"; do
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | grep -q ":$port "; then
            log_info "端口 $port 正在监听"
            netstat -tuln | grep ":$port " | head -1
        else
            log_warning "端口 $port 未监听"
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -tuln | grep -q ":$port "; then
            log_info "端口 $port 正在监听"
            ss -tuln | grep ":$port " | head -1
        else
            log_warning "端口 $port 未监听"
        fi
    else
        log_warning "无法检查端口状态 (缺少netstat/ss命令)"
        break
    fi
done
echo ""

# 6. 检查Agent配置文件
echo "6. 检查Agent配置文件..."
if [[ -f "$AGENT_DIR/.env" ]]; then
    log_success "找到Agent配置文件"
    echo "   配置内容 (隐藏敏感信息):"
    sed 's/\(API_KEY=\).*/\1[隐藏]/' "$AGENT_DIR/.env" | head -10
else
    log_error "未找到Agent配置文件: $AGENT_DIR/.env"
fi
echo ""

# 7. 检查日志文件
echo "7. 检查日志文件..."
LOG_LOCATIONS=(
    "$AGENT_DIR/logs"
    "/var/log/ssalgten-agent"
    "/opt/ssalgten-agent/logs"
)

FOUND_LOGS=false
for log_dir in "${LOG_LOCATIONS[@]}"; do
    if [[ -d "$log_dir" ]]; then
        log_success "找到日志目录: $log_dir"
        echo "   日志文件列表:"
        ls -la "$log_dir" | head -5
        
        # 显示最新的日志内容
        LATEST_LOG=$(find "$log_dir" -name "*.log" -type f -exec ls -t {} + | head -1)
        if [[ -n "$LATEST_LOG" ]]; then
            echo "   最新日志内容 (最后20行):"
            tail -20 "$LATEST_LOG" 2>/dev/null | sed 's/^/   /'
        fi
        FOUND_LOGS=true
        break
    fi
done

if [[ "$FOUND_LOGS" == false ]]; then
    log_warning "未找到日志文件"
fi
echo ""

# 8. 提供解决建议
echo "8. 常见问题解决建议..."
echo "========================================"
echo ""
echo "如果Agent未上线，请按以下步骤排查:"
echo ""
echo "📋 步骤1: 检查Agent服务状态"
echo "   cd /opt/ssalgten-agent"
echo "   docker-compose ps"
echo "   docker-compose logs -f agent"
echo ""
echo "📋 步骤2: 检查网络连接"
echo "   curl -v http://你的主服务器:3001/api/health"
echo "   ping 你的主服务器IP"
echo ""
echo "📋 步骤3: 重启Agent服务"
echo "   cd /opt/ssalgten-agent"
echo "   docker-compose restart"
echo "   # 或"
echo "   sudo systemctl restart ssalgten-agent"
echo ""
echo "📋 步骤4: 检查防火墙设置"
echo "   # Ubuntu/Debian"
echo "   sudo ufw status"
echo "   sudo ufw allow 3002/tcp"
echo ""
echo "   # CentOS/RHEL"
echo "   sudo firewall-cmd --list-all"
echo "   sudo firewall-cmd --add-port=3002/tcp --permanent"
echo "   sudo firewall-cmd --reload"
echo ""
echo "📋 步骤5: 重新安装Agent"
echo "   # 如果以上都不行，重新安装"
echo "   cd /opt/ssalgten-agent"
echo "   docker-compose down"
echo "   cd /"
echo "   sudo rm -rf /opt/ssalgten-agent"
echo "   # 然后重新运行安装命令"
echo ""
echo "📞 如需进一步帮助，请提供:"
echo "   - Agent容器日志: docker-compose logs agent"
echo "   - 主服务器地址和端口"
echo "   - 错误信息截图"
echo "========================================"