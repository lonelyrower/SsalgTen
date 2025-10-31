#!/bin/bash

# SsalgTen Agent 一键安装脚本
# 用于在新VPS上快速部署代理节点
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash
#   
# 常用参数:
#   --master-url URL         主服务器地址
#   --api-key KEY           API密钥
#   --auto-config           自动配置模式（跳过交互）
#   --force-root            允许root用户运行（跳过安全提醒）
#   --node-name NAME        节点名称
#   --node-country COUNTRY  国家
#   --node-city CITY        城市

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Docker Compose 兼容性函数（优先 v2 插件，校验 v1）
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
    log_info "请安装 docker-compose-plugin 或修复后重试"
    exit 127
}

# 版本信息
SCRIPT_VERSION="1.6.0"
SCRIPT_URL="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh"
AGENT_VERSION="latest"
DEFAULT_AGENT_IPV6_SUBNET="fd00:6a:6c:10::/64"
SYSCTL_IPV6_CONFIG_FILE="/etc/sysctl.d/99-ssalgten-ipv6.conf"

# 部署模式（docker 或 native）
DEPLOY_MODE=""  # 空表示未设置，需要提示用户选择
DEPLOY_MODE_SET=false  # 标记是否通过参数设置了部署模式
APP_DIR="/opt/ssalgten-agent"
SERVICE_NAME="ssalgten-agent"
AGENT_USER="ssalgten"
NODE_REQUIRED_MAJOR=24

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

# 写 sysctl 时使用的帮助函数
set_sysctl_value() {
    local key="$1"
    local value="$2"
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        sysctl -w "${key}=${value}" >/dev/null 2>&1
    else
        sudo sysctl -w "${key}=${value}" >/dev/null 2>&1
    fi
}

# 检查脚本更新
check_script_update() {
    log_info "检查脚本更新..."
    
    # 获取远程版本号
    REMOTE_VERSION=$(curl -s "$SCRIPT_URL" | grep '^SCRIPT_VERSION=' | cut -d'"' -f2 2>/dev/null)
    
    if [[ -n "$REMOTE_VERSION" && "$REMOTE_VERSION" != "$SCRIPT_VERSION" ]]; then
        log_warning "发现新版本: $REMOTE_VERSION (当前: $SCRIPT_VERSION)"
        echo ""
        echo -e "${YELLOW}建议更新到最新版本以获得最佳体验${NC}"
        echo ""
        update_choice=$(read_from_tty "是否立即更新脚本？ [Y/N] (回车默认选择 Y): ")
        update_choice="${update_choice:-y}"  # 默认为 y
        if [[ "$update_choice" == "y" || "$update_choice" == "Y" ]]; then
            update_script
            return 0
        else
            log_warning "继续使用当前版本，可能遇到已知问题"
            echo ""
            confirm_continue=$(read_from_tty "确认继续？ [Y/N] (回车默认选择 Y): ")
            confirm_continue="${confirm_continue:-y}"  # 默认为 y
            if [[ "$confirm_continue" != "y" && "$confirm_continue" != "Y" ]]; then
                log_info "已取消安装"
                exit 0
            fi
        fi
    else
        log_success "脚本已是最新版本"
    fi
}

# 更新脚本
update_script() {
    log_info "下载最新脚本..."
    
    # 备份当前脚本
    cp "$0" "$0.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 下载新脚本
    if curl -fsSL "$SCRIPT_URL" -o "$0.new"; then
        chmod +x "$0.new"
        mv "$0.new" "$0"
        log_success "脚本更新完成！重新启动..."
        echo ""
        exec "$0" "$@"
    else
        log_error "脚本更新失败"
        exit 1
    fi
}

# 显示欢迎信息
show_welcome() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen Agent 一键安装脚本"
    echo "========================================"
    echo -e "${NC}"
    echo "版本: $SCRIPT_VERSION"
    echo "功能: 自动部署SsalgTen监控代理节点"
    echo "更新: 支持自动版本检查和更新"
    echo ""
    echo -e "${YELLOW}使用方法:${NC}"
    echo "  交互式安装: curl -fsSL ... | bash"
    echo "  自动化安装: curl -fsSL ... | bash -s -- --auto-config --master-url URL --api-key KEY"
    echo "  更新心跳配置: curl -fsSL ... | bash (选择菜单选项 2)"
    echo "  卸载Agent: curl -fsSL ... | bash -s -- --uninstall"
    echo ""
    echo -e "${GREEN}💡 温馨提示:${NC}"
    echo "  - 只需输入主服务器地址，其他信息全部自动检测"
    echo "  - 所有选择项支持直接按回车使用默认值"
    echo "  - 节点信息可在安装后通过管理界面修改"
    echo ""
}

# 检查系统要求
check_system() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ ! -f /etc/os-release ]]; then
        log_error "不支持的操作系统"
        exit 1
    fi
    
    source /etc/os-release
    log_success "操作系统: $PRETTY_NAME"
    
    # 检查系统架构
    ARCH=$(uname -m)
    log_success "系统架构: $ARCH"
    
    # 检查内存
    MEM_TOTAL=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    if [[ $MEM_TOTAL -lt 1 ]]; then
        log_warning "内存不足1GB，可能影响性能"
    else
        log_success "内存: ${MEM_TOTAL}GB"
    fi
    
    # 检查磁盘空间
    DISK_AVAILABLE=$(df -h . | awk 'NR==2{print $4}')
    log_success "可用磁盘空间: $DISK_AVAILABLE"
    
    # 检查网络连接
    if ping -c 1 google.com >/dev/null 2>&1; then
        log_success "网络连接正常"
    else
        log_error "无法连接到互联网"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "SsalgTen Agent 安装脚本"
    echo ""
    echo "使用方法:"
    echo "  交互式安装:"
    echo "    curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash"
    echo ""
    echo "  自动化安装 (Docker 模式 - 默认):"
    echo "    curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\"
    echo "      --auto-config \\"
    echo "      --master-url https://your-domain.com \\"
    echo "      --api-key your-api-key"
    echo ""
    echo "  自动化安装 (宿主机模式):"
    echo "    curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\"
    echo "      --auto-config \\"
    echo "      --deploy-mode native \\"
    echo "      --master-url https://your-domain.com \\"
    echo "      --api-key your-api-key"
    echo ""
    echo "  卸载Agent:"
    echo "    curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --uninstall"
    echo ""
    echo "必需参数 (自动配置模式):"
    echo "  --master-url URL     主服务器地址"
    echo "  --api-key KEY        API密钥"
    echo ""
    echo "可选参数:"
    echo "  --auto-config        启用自动配置模式"
    echo "  --deploy-mode MODE   部署模式: docker (默认) 或 native (宿主机)"
    echo "  --force-root         允许root用户运行"
    echo "  --node-name NAME     节点名称"
    echo "  --node-country NAME  国家"
    echo "  --node-city NAME     城市"
    echo "  --node-provider NAME 服务商"
    echo "  --agent-port PORT    Agent端口 (默认3002)"
    echo "  --uninstall          卸载Agent"
    echo "  --help               显示此帮助信息"
    echo ""
}

# 解析命令行参数
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --uninstall)
                UNINSTALL_MODE=true
                shift
                ;;
            --master-url)
                MASTER_URL="$2"
                shift 2
                ;;
            --api-key)
                AGENT_API_KEY="$2"
                shift 2
                ;;
            --auto-config)
                AUTO_CONFIG=true
                shift
                ;;
            --deploy-mode)
                DEPLOY_MODE="$2"
                DEPLOY_MODE_SET=true
                if [[ "$DEPLOY_MODE" != "docker" && "$DEPLOY_MODE" != "native" ]]; then
                    log_error "无效的部署模式: $DEPLOY_MODE (只支持 'docker' 或 'native')"
                    exit 1
                fi
                shift 2
                ;;
            --force-root)
                FORCE_ROOT=true
                shift
                ;;
            --node-name)
                NODE_NAME="$2"
                shift 2
                ;;
            --node-country)
                NODE_COUNTRY="$2"
                shift 2
                ;;
            --node-city)
                NODE_CITY="$2"
                shift 2
                ;;
            --node-provider)
                NODE_PROVIDER="$2"
                shift 2
                ;;
            --agent-port)
                AGENT_PORT="$2"
                shift 2
                ;;
            *)
                log_warning "未知参数: $1 (使用 --help 查看帮助)"
                shift
                ;;
        esac
    done
}

# 解析主机和端口
parse_master_host_port() {
    local url="$MASTER_URL"
    # 提取协议、主机、端口
    MASTER_SCHEME=$(echo "$url" | sed -nE 's#^(https?)://.*#\1#p')
    MASTER_HOST=$(echo "$url" | sed -nE 's#^https?://([^/:]+).*$#\1#p')
    MASTER_PORT=$(echo "$url" | sed -nE 's#^https?://[^/:]+:([0-9]+).*$#\1#p')
    if [[ -z "$MASTER_PORT" ]]; then
        # 默认使用标准端口：HTTPS=443，HTTP=80
        if [[ "$MASTER_SCHEME" == "https" ]]; then MASTER_PORT=443; else MASTER_PORT=80; fi
    fi
}

# 判断 MASTER_URL 是否指向本机（同机部署）
detect_same_host() {
    SAME_HOST=false
    # 解析主机和端口
    parse_master_host_port
    # 解析主机对应的IP（优先 IPv4）
    local resolved_ip
    resolved_ip=$(getent ahosts "$MASTER_HOST" 2>/dev/null | awk '/STREAM/ {print $1; exit}')
    # 本机所有IP
    local local_ips
    local_ips=$(hostname -I 2>/dev/null)
    if echo " $local_ips " | grep -q " $resolved_ip "; then
        SAME_HOST=true
    fi
}

# 自动获取地理位置信息
get_geo_info() {
    log_info "自动获取地理位置信息..."
    
    # 尝试多个地理位置API服务
    local geo_info=""
    local public_ip=""
    
    # 首先获取公网IP
    public_ip=$(curl -s --max-time 10 http://ipinfo.io/ip 2>/dev/null || curl -s --max-time 10 http://icanhazip.com 2>/dev/null || echo "")
    
    if [[ -n "$public_ip" ]]; then
        log_info "检测到公网IP: $public_ip"
        
        # 尝试ipinfo.io API
        log_info "从ipinfo.io获取地理位置信息..."
        geo_info=$(curl -s --max-time 15 "http://ipinfo.io/$public_ip/json" 2>/dev/null)
        
        if [[ -n "$geo_info" && "$geo_info" != *"error"* ]]; then
            # 解析JSON响应 (使用基础shell命令，避免依赖jq)
            AUTO_DETECTED_COUNTRY=$(echo "$geo_info" | grep '"country"' | cut -d'"' -f4 2>/dev/null | head -1)
            AUTO_DETECTED_CITY=$(echo "$geo_info" | grep '"city"' | cut -d'"' -f4 2>/dev/null | head -1)
            AUTO_DETECTED_PROVIDER=$(echo "$geo_info" | grep '"org"' | cut -d'"' -f4 2>/dev/null | head -1)
            AUTO_DETECTED_COORDS=$(echo "$geo_info" | grep '"loc"' | cut -d'"' -f4 2>/dev/null | head -1)
            
            # 解析坐标 (格式: "latitude,longitude")
            if [[ -n "$AUTO_DETECTED_COORDS" && "$AUTO_DETECTED_COORDS" =~ ^[0-9.-]+,[0-9.-]+$ ]]; then
                AUTO_DETECTED_LATITUDE=$(echo "$AUTO_DETECTED_COORDS" | cut -d',' -f1)
                AUTO_DETECTED_LONGITUDE=$(echo "$AUTO_DETECTED_COORDS" | cut -d',' -f2)
            fi
            
            log_success "地理位置信息获取成功"
        else
            log_warning "ipinfo.io API调用失败，尝试备用方案..."
            
            # 备用方案：使用ip-api.com
            geo_info=$(curl -s --max-time 15 "http://ip-api.com/json/$public_ip" 2>/dev/null)
            
            if [[ -n "$geo_info" && "$geo_info" != *"fail"* ]]; then
                AUTO_DETECTED_COUNTRY=$(echo "$geo_info" | grep '"country"' | cut -d'"' -f4 2>/dev/null | head -1)
                AUTO_DETECTED_CITY=$(echo "$geo_info" | grep '"city"' | cut -d'"' -f4 2>/dev/null | head -1)
                AUTO_DETECTED_PROVIDER=$(echo "$geo_info" | grep '"isp"' | cut -d'"' -f4 2>/dev/null | head -1)
                AUTO_DETECTED_LATITUDE=$(echo "$geo_info" | grep '"lat"' | cut -d':' -f2 | cut -d',' -f1 | tr -d ' ' 2>/dev/null)
                AUTO_DETECTED_LONGITUDE=$(echo "$geo_info" | grep '"lon"' | cut -d':' -f2 | cut -d',' -f1 | tr -d ' ' 2>/dev/null)
                
                log_success "备用地理位置信息获取成功"
            else
                log_warning "所有地理位置API调用失败"
            fi
        fi
    else
        log_warning "无法获取公网IP地址"
    fi
    
    # 清理和验证数据
    AUTO_DETECTED_COUNTRY=${AUTO_DETECTED_COUNTRY// /}
    # 保留城市名中的空格，只清理首尾空格
    AUTO_DETECTED_CITY=$(echo "$AUTO_DETECTED_CITY" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # 移除提供商名称中的多余信息
    if [[ -n "$AUTO_DETECTED_PROVIDER" ]]; then
        # 移除常见的后缀和前缀
        AUTO_DETECTED_PROVIDER=$(echo "$AUTO_DETECTED_PROVIDER" | sed 's/ LLC.*//g' | sed 's/ Inc.*//g' | sed 's/ Ltd.*//g' | sed 's/AS[0-9]* //g')
    fi
    
    # 设置默认值以防获取失败
    AUTO_DETECTED_COUNTRY=${AUTO_DETECTED_COUNTRY:-"Unknown"}
    AUTO_DETECTED_CITY=${AUTO_DETECTED_CITY:-"Unknown"}  
    AUTO_DETECTED_PROVIDER=${AUTO_DETECTED_PROVIDER:-"Unknown Provider"}
    AUTO_DETECTED_LATITUDE=${AUTO_DETECTED_LATITUDE:-"0.0"}
    AUTO_DETECTED_LONGITUDE=${AUTO_DETECTED_LONGITUDE:-"0.0"}
    
    if [[ "$AUTO_DETECTED_COUNTRY" != "Unknown" ]]; then
        log_success "自动检测结果: $AUTO_DETECTED_CITY, $AUTO_DETECTED_COUNTRY ($AUTO_DETECTED_PROVIDER)"
    else
        log_warning "无法自动检测地理位置，将使用默认值"
    fi
}

# 收集节点信息
collect_node_info() {
    log_info "收集节点信息..."
    
    # 总是需要收集必需的参数（master-url 和 api-key）
    if [[ -z "$MASTER_URL" || -z "$AGENT_API_KEY" ]]; then
        echo ""
        echo "请提供以下信息来配置您的监控节点："
        echo ""
        
        # 主服务器地址
        if [[ -z "$MASTER_URL" ]]; then
            while true; do
                MASTER_URL=$(read_from_tty "主服务器地址 (例如: http://your-ip:3001 或 https://your-domain.com): ")
                # 若用户未填写协议，默认使用 https
                if [[ -n "$MASTER_URL" && ! "$MASTER_URL" =~ ^https?:// ]]; then
                    MASTER_URL="https://$MASTER_URL"
                fi
                if [[ -n "$MASTER_URL" && "$MASTER_URL" =~ ^https?:// ]]; then
                    # 检查是否包含端口，如果使用 http 但没有端口，提示用户
                    if [[ "$MASTER_URL" =~ ^http://[^:/]+$ ]]; then
                        log_warning "检测到使用 HTTP 但未指定端口"
                        log_warning "默认后端 API 端口通常是 3001"
                        confirm=$(read_from_tty "是否自动添加端口 :3001？ [Y/n]: ")
                        confirm="${confirm:-y}"
                        if [[ "$confirm" =~ ^[Yy] ]]; then
                            MASTER_URL="${MASTER_URL}:3001"
                            log_info "已设置为: $MASTER_URL"
                        fi
                    fi
                    break
                else
                    log_error "请输入有效的URL地址（以 http:// 或 https:// 开头）"
                fi
            done
        fi
        
        # API密钥
        if [[ -z "$AGENT_API_KEY" ]]; then
            while true; do
                AGENT_API_KEY=$(read_from_tty "Agent API密钥: ")
                if [[ -n "$AGENT_API_KEY" && ${#AGENT_API_KEY} -ge 16 ]]; then
                    break
                else
                    log_error "API密钥长度至少16个字符"
                fi
            done
        fi
    fi
    
    # 总是自动获取地理位置信息（用于提供智能建议）
    get_geo_info
    
    # 设置默认值（适用于自动配置和交互式配置）
    if [[ "$AUTO_CONFIG" == "true" ]]; then
        log_info "使用自动配置模式..."
        
        # 设置节点信息（优先使用手动指定的参数，其次使用自动检测的信息）
        NODE_NAME=${NODE_NAME:-"Agent-$(hostname)-$(date +%s)"}
        NODE_COUNTRY=${NODE_COUNTRY:-"$AUTO_DETECTED_COUNTRY"}
        NODE_CITY=${NODE_CITY:-"$AUTO_DETECTED_CITY"}
        NODE_PROVIDER=${NODE_PROVIDER:-"$AUTO_DETECTED_PROVIDER"}
        NODE_LATITUDE=${NODE_LATITUDE:-"$AUTO_DETECTED_LATITUDE"}
        NODE_LONGITUDE=${NODE_LONGITUDE:-"$AUTO_DETECTED_LONGITUDE"}
        AGENT_PORT=${AGENT_PORT:-"3002"}
        
        log_success "已使用自动配置模式"
    else
        # 交互式配置 - 直接使用自动检测的信息，无需用户输入
        log_info "使用交互式配置模式..."
        echo ""
        
        # 显示自动检测的信息
        if [[ "$AUTO_DETECTED_COUNTRY" != "Unknown" ]]; then
            echo "🔍 自动检测到以下信息，将直接使用："
            echo "   位置: $AUTO_DETECTED_CITY, $AUTO_DETECTED_COUNTRY"
            echo "   服务商: $AUTO_DETECTED_PROVIDER"
            echo "   坐标: $AUTO_DETECTED_LATITUDE, $AUTO_DETECTED_LONGITUDE"
            echo ""
        fi
        
        # 直接使用自动检测的信息，无需用户输入
        NODE_NAME="Agent-$(hostname)-$(date +%s)"
        NODE_COUNTRY="$AUTO_DETECTED_COUNTRY"
        NODE_CITY="$AUTO_DETECTED_CITY"
        NODE_PROVIDER="$AUTO_DETECTED_PROVIDER"
        NODE_LATITUDE="$AUTO_DETECTED_LATITUDE"
        NODE_LONGITUDE="$AUTO_DETECTED_LONGITUDE"
        AGENT_PORT="3002"
        
        log_success "节点信息配置完成（可在安装后通过管理界面修改）"
    fi
    
    # 生成唯一Agent ID
    AGENT_ID="agent_$(hostname)_$(date +%s)_$(shuf -i 1000-9999 -n 1)"

    # 如果与主站同机，则将 MASTER_URL 切换为 host.docker.internal 以避免容器访问宿主公网IP的回环问题
    detect_same_host
    EFFECTIVE_MASTER_URL="$MASTER_URL"
    if [[ "$SAME_HOST" == "true" ]]; then
        log_info "检测到与主站同机部署，准备选择最优内部地址..."
    else
        log_info "未检测到同机部署，准备验证主服务器可达性..."
    fi

    # 构建候选地址列表（优先原始地址，其次为同机可达地址）
    CANDIDATE_URLS=("$MASTER_URL")
    # 解析端口
    parse_master_host_port
    if [[ "$SAME_HOST" == "true" ]]; then
        CANDIDATE_URLS+=("http://host.docker.internal:${MASTER_PORT}")
        CANDIDATE_URLS+=("http://172.17.0.1:${MASTER_PORT}")
        CANDIDATE_URLS+=("http://localhost:${MASTER_PORT}")
        CANDIDATE_URLS+=("http://127.0.0.1:${MASTER_PORT}")
    fi

    # 在容器网络环境内预探测 /api/health，选择第一个可达地址
    choose_effective_master_url() {
        local chosen=""
        for url in "${CANDIDATE_URLS[@]}"; do
            log_info "探测主服务器: ${url}"
            # 使用轻量容器进行网络探测，贴近Agent运行环境
            if docker run --rm \
                --add-host host.docker.internal:host-gateway \
                alpine:3.20 sh -lc "apk add --no-cache curl ca-certificates >/dev/null 2>&1 && curl -sfm 5 ${url}/api/health >/dev/null"; then
                chosen="$url"
                log_success "探测通过，选择: $chosen"
                break
            else
                log_warning "不可达: ${url}"
            fi
        done
        if [[ -z "$chosen" ]]; then
            log_warning "所有候选地址在容器内均不可达，将保留原始地址: $MASTER_URL（Agent启动后将继续自动重试）"
            EFFECTIVE_MASTER_URL="$MASTER_URL"
        else
            EFFECTIVE_MASTER_URL="$chosen"
        fi
    }

    # SSL/HTTPS 验证函数
    validate_ssl_connection() {
        local url="$1"
        log_info "验证 SSL/HTTPS 连接: $url"
        
        # 检查是否为 HTTPS URL
        if [[ "$url" =~ ^https:// ]]; then
            # 使用 Docker 容器进行 SSL 验证
            if docker run --rm \
                --add-host host.docker.internal:host-gateway \
                alpine:3.20 sh -lc "
                    apk add --no-cache curl ca-certificates openssl >/dev/null 2>&1
                    # 基本 HTTPS 连接测试
                    if ! curl -sfm 10 '$url/api/health' >/dev/null 2>&1; then
                        echo 'SSL连接测试失败'
                        exit 1
                    fi
                    
                    # 获取域名
                    domain=\$(echo '$url' | sed -nE 's#^https://([^/:]+).*\$#\1#p')
                    
                    # SSL 证书验证
                    cert_info=\$(echo | openssl s_client -servername \"\$domain\" -connect \"\$domain\":443 -verify_return_error 2>/dev/null | openssl x509 -noout -text 2>/dev/null)
                    if [ \$? -ne 0 ]; then
                        echo 'SSL证书验证失败'
                        exit 1
                    fi
                    
                    # 检查证书有效期
                    not_after=\$(echo \"\$cert_info\" | grep 'Not After:' | sed 's/.*Not After: //')
                    if [ -n \"\$not_after\" ]; then
                        # 简单的日期检查（如果可以获取到）
                        echo \"证书有效期至: \$not_after\"
                    fi
                    
                    echo 'SSL验证通过'
                " 2>&1; then
                log_success "SSL/HTTPS 验证通过"
                return 0
            else
                log_warning "SSL/HTTPS 验证失败，将继续尝试连接"
                return 1
            fi
        else
            log_info "HTTP 连接，跳过 SSL 验证"
            return 0
        fi
    }

    # 增强的连接验证函数
    enhanced_connection_test() {
        local url="$1"
        log_info "执行增强连接测试: $url"
        
        # SSL 验证（如果是 HTTPS）
        if ! validate_ssl_connection "$url"; then
            log_warning "SSL 验证失败，但将继续尝试"
        fi
        
        # 测试关键端点
        local endpoints=("/api/health" "/api/stats" "/socket.io/")
        local success_count=0
        
        for endpoint in "${endpoints[@]}"; do
            if docker run --rm \
                --add-host host.docker.internal:host-gateway \
                alpine:3.20 sh -lc "
                    apk add --no-cache curl ca-certificates >/dev/null 2>&1
                    curl -sfm 10 '$url$endpoint' >/dev/null 2>&1
                " >/dev/null 2>&1; then
                log_success "端点可达: $endpoint"
                ((success_count++))
            else
                log_warning "端点不可达: $endpoint"
            fi
        done
        
        if [ $success_count -ge 1 ]; then
            log_success "连接测试通过 ($success_count/${#endpoints[@]} 端点可达)"
            return 0
        else
            log_error "连接测试失败 (0/${#endpoints[@]} 端点可达)"
            return 1
        fi
    }

    # 若Docker不可用或拉取失败则不阻断
    if ! choose_effective_master_url; then
        log_warning "容器内探测失败，保留原始地址: $MASTER_URL"
        EFFECTIVE_MASTER_URL="$MASTER_URL"
    fi

    # 对选定的URL进行增强验证
    if ! enhanced_connection_test "$EFFECTIVE_MASTER_URL"; then
        log_warning "增强连接测试失败，但继续安装过程"
        log_info "Agent 将在启动后持续重试连接"
    fi

    # 若同机部署，启用 host 网络模式以支持主站仅监听 127.0.0.1 的情况
    AGENT_USE_HOST_NETWORK=false
    if [[ "$SAME_HOST" == "true" ]]; then
        AGENT_USE_HOST_NETWORK=true
        log_info "同机部署：将为 Agent 启用 host 网络模式，确保可访问 localhost:${MASTER_PORT}"
    fi

    echo ""
    log_info "节点配置信息:"
    echo "  - 节点ID: $AGENT_ID"
    echo "  - 节点名称: $NODE_NAME"
    echo "  - 位置: $NODE_CITY, $NODE_COUNTRY"
    echo "  - 坐标: $NODE_LATITUDE, $NODE_LONGITUDE"
    echo "  - 服务商: $NODE_PROVIDER"
    echo "  - 端口: $AGENT_PORT"
    echo ""
    
    if [[ "$AUTO_CONFIG" != "true" ]]; then
        confirm=$(read_from_tty "确认配置信息正确？ [Y/N] (回车默认选择 Y): ")
        confirm="${confirm:-y}"  # 默认为 y
        if [[ "$confirm" =~ ^[Nn] ]]; then
            log_info "请重新运行脚本"
            exit 0
        fi
        log_success "配置信息已确认，开始安装"
    else
        log_success "自动配置模式，配置信息已确认"
    fi
}

# 检测包管理器并安装依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 检测操作系统
    if [[ ! -f /etc/os-release ]]; then
        log_error "不支持的操作系统"
        exit 1
    fi
    
    source /etc/os-release
    
    if command -v apt >/dev/null 2>&1; then
        log_info "检测到APT包管理器 (Debian/Ubuntu)"
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            apt update
            apt install -y curl wget git gnupg lsb-release python3
        else
            sudo apt update
            sudo apt install -y curl wget git gnupg lsb-release python3
        fi
    elif command -v yum >/dev/null 2>&1; then
        log_info "检测到YUM包管理器 (CentOS/RHEL 7)"
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            yum update -y
            yum install -y curl wget git python3
        else
            sudo yum update -y
            sudo yum install -y curl wget git python3
        fi
    elif command -v dnf >/dev/null 2>&1; then
        log_info "检测到DNF包管理器 (CentOS/RHEL 8+/Fedora)"
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            dnf update -y
            dnf install -y curl wget git python3
        else
            sudo dnf update -y
            sudo dnf install -y curl wget git python3
        fi
    else
        log_error "不支持的操作系统，未找到 apt/yum/dnf 包管理器"
        exit 1
    fi
    
    log_success "系统依赖安装完成"
}

# 安装Docker
install_docker() {
    log_info "检查Docker安装状态..."
    
    if command -v docker >/dev/null 2>&1; then
        log_success "Docker已安装: $(docker --version)"
        # 确保Docker服务运行
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            systemctl start docker
            systemctl enable docker
        else
            sudo systemctl start docker
            sudo systemctl enable docker
        fi
        return 0
    fi
    
    log_info "安装Docker..."
    
    # 使用官方安装脚本
    curl -fsSL https://get.docker.com -o get-docker.sh
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        sh get-docker.sh
    else
        sudo sh get-docker.sh
    fi
    rm get-docker.sh
    
    # 添加当前用户到docker组（非root用户）
    if [[ "$RUNNING_AS_ROOT" != "true" ]]; then
        sudo usermod -aG docker $USER
        log_info "已将用户 $USER 添加到docker组，重新登录后生效"
        # 临时切换到docker组
        newgrp docker || true
    fi
    
    # 启动Docker服务
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        systemctl start docker
        systemctl enable docker
    else
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
    
    log_success "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    log_info "检查Docker Compose安装状态..."
    
    # 优先使用 docker compose 插件
    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose v2 插件可用: $(docker compose version 2>/dev/null | head -n1)"
        return 0
    fi
    
    # 通过包管理器安装插件
    log_info "安装 Docker Compose 插件..."
    if command -v apt >/dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y docker-compose-plugin || true
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y docker-compose-plugin || true
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y docker-compose-plugin || true
    fi
    
    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose v2 插件已安装: $(docker compose version 2>/dev/null | head -n1)"
        return 0
    fi
    
    # 兜底：尝试安装独立二进制并做自检
    log_warning "docker-compose-plugin 不可用，尝试安装独立二进制作为后备"
    FALLBACK_COMPOSE_VERSION="1.29.2"
    if sudo curl -fsSL "https://github.com/docker/compose/releases/download/${FALLBACK_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose; then
        sudo chmod +x /usr/local/bin/docker-compose
        if docker-compose version >/dev/null 2>&1; then
            log_success "已安装 docker-compose 二进制: $(docker-compose version 2>/dev/null | head -n1)"
            return 0
        else
            log_error "docker-compose 二进制自检失败，移除以防干扰"
            sudo rm -f /usr/local/bin/docker-compose || true
        fi
    else
        log_warning "下载 docker-compose 二进制失败"
    fi
    
    log_error "未能安装可用的 Docker Compose，请先安装 docker-compose-plugin 后重试"
    return 1
}

# 确保宿主机 IPv6 内核参数打开（Docker IPv6 依赖）
ensure_kernel_ipv6_support() {
    log_info "检测宿主机 IPv6 内核配置..."

    local desired_conf="net.ipv6.conf.all.disable_ipv6=0
net.ipv6.conf.default.disable_ipv6=0
net.ipv6.conf.all.forwarding=1
net.ipv6.conf.default.forwarding=1"

    # 立即应用内核参数（运行时）
    set_sysctl_value "net.ipv6.conf.all.disable_ipv6" 0
    set_sysctl_value "net.ipv6.conf.default.disable_ipv6" 0
    set_sysctl_value "net.ipv6.conf.all.forwarding" 1
    set_sysctl_value "net.ipv6.conf.default.forwarding" 1

    # 写入持久化配置
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        mkdir -p "$(dirname "$SYSCTL_IPV6_CONFIG_FILE")"
        printf '%s\n' "$desired_conf" > "$SYSCTL_IPV6_CONFIG_FILE"
    else
        sudo mkdir -p "$(dirname "$SYSCTL_IPV6_CONFIG_FILE")"
        printf '%s\n' "$desired_conf" | sudo tee "$SYSCTL_IPV6_CONFIG_FILE" >/dev/null
    fi

    # 重新加载配置文件
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        sysctl -p "$SYSCTL_IPV6_CONFIG_FILE" >/dev/null 2>&1 || true
    else
        sudo sysctl -p "$SYSCTL_IPV6_CONFIG_FILE" >/dev/null 2>&1 || true
    fi

    # 验证最终状态
    local all_disable
    local def_disable
    local all_forward
    all_disable=$(sysctl -n net.ipv6.conf.all.disable_ipv6 2>/dev/null || echo 1)
    def_disable=$(sysctl -n net.ipv6.conf.default.disable_ipv6 2>/dev/null || echo 1)
    all_forward=$(sysctl -n net.ipv6.conf.all.forwarding 2>/dev/null || echo 0)

    if [[ "$all_disable" != "0" || "$def_disable" != "0" || "$all_forward" != "1" ]]; then
        log_warning "IPv6 内核参数配置可能未完全生效，请检查 sysctl 设置"
        return 1
    fi

    log_success "宿主机 IPv6 内核参数已启用"
    return 0
}

# 确保 Docker 已启用 IPv6 支持（非 host 网络模式依赖）
ensure_docker_ipv6_support() {
    if [[ "$AGENT_USE_HOST_NETWORK" == "true" ]]; then
        log_info "检测到 host 网络模式，跳过 Docker IPv6 自动配置（将直接复用宿主网络）"
        return 0
    fi

    log_info "检测 Docker IPv6 支持..."

    local ipv6_status
    ipv6_status=$(docker info --format '{{.IPv6}}' 2>/dev/null | tr '[:upper:]' '[:lower:]')

    if [[ "$ipv6_status" == "true" ]]; then
        log_success "Docker 已启用 IPv6"
        return 0
    fi

    log_warning "Docker 当前未启用 IPv6，将尝试自动配置"

    local daemon_file="/etc/docker/daemon.json"
    local need_restart=false
    local python_bin="python3"

    if ! command -v "$python_bin" >/dev/null 2>&1; then
        if command -v python >/dev/null 2>&1; then
            python_bin="python"
        else
            log_error "未找到 python3/python，无法自动配置 Docker IPv6"
            log_error "请手动编辑 $daemon_file 并重启 docker 后重试"
            return 1
        fi
    fi

    # 备份现有 daemon.json
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        mkdir -p /etc/docker
        if [[ -f "$daemon_file" ]]; then
            cp "$daemon_file" "${daemon_file}.bak.$(date +%Y%m%d%H%M%S)"
        fi
    else
        sudo mkdir -p /etc/docker
        if [[ -f "$daemon_file" ]]; then
            sudo cp "$daemon_file" "${daemon_file}.bak.$(date +%Y%m%d%H%M%S)"
        fi
    fi

    # 写入或更新配置
    local update_exit=1
    local updater_script="
import json, os, sys
path = sys.argv[1]
cidr = sys.argv[2]
cfg = {}
if os.path.exists(path):
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            cfg = json.load(fh)
    except Exception:
        cfg = {}
changed = False
if not cfg.get('ipv6'):
    cfg['ipv6'] = True
    changed = True
if 'fixed-cidr-v6' not in cfg:
    cfg['fixed-cidr-v6'] = cidr
    changed = True
if 'ip6tables' not in cfg:
    cfg['ip6tables'] = True
    changed = True
# 保持配置内容有序且易读
if changed:
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(cfg, fh, indent=2, ensure_ascii=False)
        fh.write('\\n')
    os.replace(tmp, path)
sys.exit(0 if changed else 1)
"

    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        "$python_bin" -c "$updater_script" "$daemon_file" "$DEFAULT_AGENT_IPV6_SUBNET"
        update_exit=$?
    else
        sudo "$python_bin" -c "$updater_script" "$daemon_file" "$DEFAULT_AGENT_IPV6_SUBNET"
        update_exit=$?
    fi

    if [[ $update_exit -eq 0 ]]; then
        need_restart=true
        log_success "已更新 Docker IPv6 配置 (fixed-cidr-v6=$DEFAULT_AGENT_IPV6_SUBNET)"
    else
        log_info "Docker IPv6 配置已存在，无需修改"
    fi

    if [[ "$need_restart" == "true" ]]; then
        log_info "重启 Docker 服务使 IPv6 配置生效..."
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            systemctl restart docker
        else
            sudo systemctl restart docker
        fi
        sleep 3
    fi

    # 等待 Docker 重启并确认 IPv6 状态
    local attempt=0
    local max_attempts=10
    while [[ $attempt -lt $max_attempts ]]; do
        sleep 2
        ipv6_status=$(docker info --format '{{.IPv6}}' 2>/dev/null | tr '[:upper:]' '[:lower:]')
        if [[ "$ipv6_status" == "true" ]]; then
            log_success "Docker IPv6 支持已启用"
            return 0
        fi
        ((attempt++))
    done

    # 即使 docker info 未报告 IPv6，检查 daemon.json 配置
    log_warning "Docker info 未报告 IPv6 支持，检查配置文件..."

    if [[ -f "$daemon_file" ]]; then
        local has_ipv6=$(grep -c '"ipv6".*true' "$daemon_file" 2>/dev/null || echo "0")
        local has_cidr=$(grep -c '"fixed-cidr-v6"' "$daemon_file" 2>/dev/null || echo "0")

        if [[ $has_ipv6 -gt 0 && $has_cidr -gt 0 ]]; then
            log_info "daemon.json 配置正确，将继续执行（旧网络将被删除重建）"
            log_info "当前 daemon.json 内容:"
            if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
                cat "$daemon_file" || true
            else
                sudo cat "$daemon_file" || true
            fi
            return 0
        fi
    fi

    log_error "daemon.json 配置不正确或不存在"
    log_info "请手动检查 /etc/docker/daemon.json 配置"
    return 1
}

# 创建应用目录
create_app_directory() {
    log_info "创建应用目录..."
    
    APP_DIR="/opt/ssalgten-agent"
    
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        mkdir -p $APP_DIR
        # root用户创建目录后设置合适权限
        chmod 755 $APP_DIR
    else
        sudo mkdir -p $APP_DIR
        sudo chown $USER:$USER $APP_DIR
    fi
    
    cd $APP_DIR
    log_success "应用目录创建: $APP_DIR"
}

# 下载Agent代码
download_agent_code() {
    log_info "下载Agent代码..."
    
    # 创建临时目录
    TEMP_DIR="/tmp/ssalgten-agent-install"
    rm -rf $TEMP_DIR
    mkdir -p $TEMP_DIR
    
    # 尝试多种下载方式
    local download_success=false
    local git_urls=(
        "https://github.com/lonelyrower/SsalgTen.git"
        "https://github.com.cnpmjs.org/lonelyrower/SsalgTen.git"
        "https://hub.fastgit.xyz/lonelyrower/SsalgTen.git"
    )

    cd $TEMP_DIR

    # 尝试Git克隆
    for git_url in "${git_urls[@]}"; do
        log_info "尝试: git clone --depth 1 $git_url"
        rm -rf repo 2>/dev/null || true

        if git clone --depth 1 "$git_url" repo >/dev/null 2>&1; then
            # 验证克隆成功并且有内容
            if [[ -d "repo/agent" ]] || [[ -d "repo/packages/agent" ]]; then
                # 移动所有内容到当前目录
                shopt -s dotglob nullglob
                mv repo/* . 2>/dev/null || true
                shopt -u dotglob nullglob
                rm -rf repo
                download_success=true
                log_success "Git克隆成功"
                break
            else
                log_warning "Git克隆成功但未找到agent目录，尝试下一种方法..."
                rm -rf repo
            fi
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
        )
        
        for zip_url in "${zip_urls[@]}"; do
            log_info "尝试下载: $zip_url"
            if wget -q "$zip_url" -O main.zip 2>/dev/null; then
                if unzip -q main.zip 2>/dev/null; then
                    if command -v python3 >/dev/null 2>&1 && python3 - <<'PY'
import os, shutil
src = 'SsalgTen-main'
dst = '.'
for name in os.listdir(src):
    shutil.move(os.path.join(src, name), dst)
PY
                    then
                        rmdir SsalgTen-main 2>/dev/null || true
                        rm -f main.zip
                        download_success=true
                        log_success "ZIP包下载成功"
                        break
                    else
                        log_warning "Python 搬运失败或未安装，使用Shell回退方案"
                        (
                            shopt -s dotglob nullglob
                            for item in SsalgTen-main/*; do
                                mv "$item" .
                            done
                            shopt -u dotglob nullglob
                        )
                        rmdir SsalgTen-main 2>/dev/null || true
                        rm -f main.zip
                        download_success=true
                        log_success "ZIP包下载成功"
                        break
                    fi
                fi
            fi
        done
    fi
    
    if [[ "$download_success" == false ]]; then
        log_error "所有下载方法都失败了"
        exit 1
    fi
    
    # 检查agent目录是否存在
    if [[ ! -d "agent" ]]; then
        log_error "下载的代码中未找到agent目录"
        exit 1
    fi
    
    # 复制Agent相关文件到应用目录
    cp -r agent/* $APP_DIR/
    
    # 确保package.json存在
    if [[ ! -f "$APP_DIR/package.json" ]]; then
        log_error "Agent目录中缺少package.json文件"
        exit 1
    fi
    
    # 清理临时目录
    rm -rf $TEMP_DIR
    
    cd $APP_DIR
    log_success "Agent代码下载完成"
}

# 创建Agent专用的docker_compose文件
create_docker_compose() {
    log_info "创建Docker Compose配置..."
    
    if [[ "$AGENT_USE_HOST_NETWORK" == "true" ]]; then
cat > docker-compose.yml << EOF
services:
  agent:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ssalgten-agent
    restart: unless-stopped
    network_mode: host
    # 仅从本目录下的 .env 文件注入环境变量，避免宿主机环境变量覆盖
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /etc:/host/etc:ro
      - /var/log:/host/var/log:ro
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${AGENT_PORT}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
    else
cat > docker-compose.yml << EOF
services:
  agent:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ssalgten-agent
    restart: unless-stopped
    ports:
      - "${AGENT_PORT}:${AGENT_PORT}"
    # 仅从本目录下的 .env 文件注入环境变量，避免宿主机环境变量覆盖
    env_file:
      - .env
    # 为同机通信提供稳定的宿主名解析
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./logs:/app/logs
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /etc:/host/etc:ro
      - /var/log:/host/var/log:ro
    networks:
      - agent-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${AGENT_PORT}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  agent-network:
    driver: bridge
    enable_ipv6: true
EOF
    fi

    log_success "Docker Compose配置创建完成"
}

# 创建环境配置文件
create_env_config() {
    log_info "创建环境配置文件..."
    
    cat > .env << EOF
# SsalgTen Agent 配置文件
# 自动生成于 $(date)

# Agent基本信息
AGENT_ID=${AGENT_ID}
NODE_NAME=${NODE_NAME}

# 服务器连接（同机部署自动切换为 host.docker.internal）
MASTER_URL=${EFFECTIVE_MASTER_URL}
AGENT_API_KEY=${AGENT_API_KEY}

# 地理位置信息
NODE_COUNTRY=${NODE_COUNTRY}
NODE_CITY=${NODE_CITY}
NODE_PROVIDER=${NODE_PROVIDER}
NODE_LATITUDE=${NODE_LATITUDE}
NODE_LONGITUDE=${NODE_LONGITUDE}

# 服务配置
PORT=${AGENT_PORT}
NODE_ENV=production

# 监控配置
HEARTBEAT_INTERVAL=300000
LOG_LEVEL=info
ENABLE_DEBUG=false

# 系统配置
TZ=Asia/Shanghai

# 服务检测配置（自动检测 Xray, Nginx, Docker 等服务）
SERVICE_DETECTION_ENABLED=true
SERVICE_SCAN_INTERVAL_HOURS=12

# 可选：Xray 自检（启用后将检测本机端口监听/TLS握手）
# XRAY_CHECK_PORT=443
# XRAY_CHECK_HOST=127.0.0.1
# XRAY_CHECK_TLS=true
# XRAY_CHECK_SNI=your.domain.com

# 可选：SSH 暴力破解监控（读取 /var/log/auth.log 或 /var/log/secure）
# SSH_MONITOR_ENABLED=false
# SSH_MONITOR_WINDOW_MIN=10
# SSH_MONITOR_THRESHOLD=10
EOF

    log_success "环境配置文件创建完成"
}

# 创建Dockerfile（适用于Agent）
create_dockerfile() {
    log_info "创建Agent Dockerfile..."
    
    cat > Dockerfile << 'EOF'
# SsalgTen Agent Dockerfile
FROM node:24-alpine

# Install system dependencies for network tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    iputils \
    traceroute \
    mtr \
    bind-tools \
    iperf3 \
    python3 \
    py3-pip

# Install speedtest-cli using --break-system-packages (safe in container)
RUN pip3 install --break-system-packages speedtest-cli

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S -u 1001 ssalgten

# Set working directory
WORKDIR /app

# Copy package files and install ALL dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Create necessary directories
RUN mkdir -p /app/logs && chown ssalgten:nodejs /app/logs

# Switch to app user
USER ssalgten

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3002) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
EOF

    log_success "Agent Dockerfile创建完成"
}

# 创建系统服务
create_system_service() {
    log_info "创建系统服务..."
    
    sudo tee /etc/systemd/system/ssalgten-agent.service > /dev/null << EOF
[Unit]
Description=SsalgTen Agent Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=5
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    # 重载systemd并启用服务
    sudo systemctl daemon-reload
    sudo systemctl enable ssalgten-agent.service
    
    log_success "系统服务创建完成"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian的ufw
        sudo ufw allow $AGENT_PORT/tcp
        log_success "UFW防火墙规则添加完成"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # CentOS/RHEL的firewalld
        sudo firewall-cmd --permanent --add-port=$AGENT_PORT/tcp
        sudo firewall-cmd --reload
        log_success "Firewalld防火墙规则添加完成"
    else
        log_warning "未检测到防火墙管理工具，请手动开放端口 $AGENT_PORT"
    fi
}

# 启动Agent服务
start_agent_service() {
    log_info "启动Agent服务..."

    if [[ "$AGENT_USE_HOST_NETWORK" != "true" ]]; then
        local compose_project
        compose_project=$(basename "$APP_DIR")
        local default_network="${compose_project}_agent-network"

        # 清理旧网络以应用最新的 IPv6 配置
        docker network rm "$default_network" >/dev/null 2>&1 && \
            log_info "已移除旧的 Docker 网络 $default_network 以重新创建 (IPv6)"
    fi

    # 构建镜像
    docker_compose build

    # 启动服务
    docker_compose up -d
    
    # 等待服务启动
    sleep 10
    
    log_success "Agent服务启动完成"
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 等待容器启动
    sleep 3
    
    # 检查容器状态
    log_info "检查容器状态..."
    docker_compose ps
    
    if docker_compose ps | grep -q "Up"; then
        log_success "Docker容器运行正常"
    else
        log_warning "Docker容器可能启动失败，查看详细日志："
        echo ""
        docker_compose logs --tail=50
        echo ""
        log_warning "如果容器持续重启，请检查："
        echo "  1. 环境变量配置是否正确 (cat $APP_DIR/.env)"
        echo "  2. 主服务器URL是否可访问"
        echo "  3. 容器日志： cd $APP_DIR && docker compose logs -f"
        echo ""
        # 不直接返回失败，继续执行后续步骤
    fi
    
    # 等待服务启动
    log_info "等待Agent服务启动..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:$AGENT_PORT/health >/dev/null 2>&1; then
            log_success "Agent健康检查通过"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
        
        if [ $attempt -eq $max_attempts ]; then
            log_warning "Agent健康检查超时，请检查日志"
            docker_compose logs agent
        fi
    done
    
    # 检查主服务器连接
    log_info "测试主服务器连接..."
    if curl -f "$MASTER_URL/api/health" >/dev/null 2>&1; then
        log_success "主服务器连接正常"
    else
        log_warning "无法连接到主服务器: $MASTER_URL"
        log_warning "请确保:"
        echo "  1. 主服务器正在运行"
        echo "  2. 网络连接正常"
        echo "  3. 防火墙设置正确"
        echo "  4. URL地址正确"
    fi
    
    # 检查Agent信息
    log_info "获取Agent信息..."
    if agent_info=$(curl -s http://localhost:$AGENT_PORT/info); then
        echo "$agent_info" | jq . 2>/dev/null || echo "$agent_info"
    else
        log_warning "无法获取Agent信息"
    fi
}

# 显示安装结果
show_installation_result() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  🎉 Agent安装完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo "📋 安装信息:"
    echo "  - Agent ID: $AGENT_ID"
    echo "  - 节点名称: $NODE_NAME"
    echo "  - 安装目录: $APP_DIR"
    echo "  - 服务端口: $AGENT_PORT"
    echo "  - 主服务器: $MASTER_URL"
    echo ""
    echo "🔧 管理命令:"
    echo "  - 查看状态: cd $APP_DIR && docker compose ps"
    echo "  - 查看日志: cd $APP_DIR && docker compose logs -f"
    echo "  - 重启服务: cd $APP_DIR && docker compose restart"
    echo "  - 停止服务: cd $APP_DIR && docker compose down"
    echo "  - 系统服务: sudo systemctl status ssalgten-agent"
    echo ""
    echo "🌐 访问地址:"
    echo "  - 本地健康检查: http://localhost:$AGENT_PORT/health"
    echo "  - 主服务器控制台: $MASTER_URL"
    echo ""
    echo "📁 重要文件:"
    echo "  - 配置文件: $APP_DIR/.env"
    echo "  - 日志目录: $APP_DIR/logs"
    echo "  - 服务文件: /etc/systemd/system/ssalgten-agent.service"
    echo ""
    
    # 获取公网IP
    PUBLIC_IP=$(curl -s http://ipinfo.io/ip || echo "无法获取")
    echo "📡 节点信息:"
    echo "  - 公网IP: $PUBLIC_IP"
    echo "  - 位置: $NODE_CITY, $NODE_COUNTRY"
    echo "  - 服务商: $NODE_PROVIDER"
    echo ""
    
    echo -e "${YELLOW}⚠️ 下一步:${NC}"
    echo "1. 检查防火墙是否开放端口 $AGENT_PORT"
    echo "2. 在主服务器控制台查看节点是否上线"
    echo "3. 如有问题，查看日志: docker compose logs -f"
    echo ""
}

# 创建管理脚本
create_management_script() {
    log_info "创建管理脚本..."
    
    cat > manage-agent.sh << 'EOF'
#!/bin/bash

# SsalgTen Agent 管理脚本

case "$1" in
    start)
        echo "启动Agent服务..."
        docker_compose up -d
        ;;
    stop)
        echo "停止Agent服务..."
        docker_compose down
        ;;
    restart)
        echo "重启Agent服务..."
        docker_compose restart
        ;;
    status)
        echo "查看服务状态..."
        docker_compose ps
        ;;
    logs)
        echo "查看服务日志..."
        docker_compose logs -f
        ;;
    update)
        echo "更新Agent..."
        docker_compose pull
        docker_compose up -d --build
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|update}"
        exit 1
        ;;
esac
EOF
    
    chmod +x manage-agent.sh
    log_success "管理脚本创建完成: $APP_DIR/manage-agent.sh"
}

# 更新 Agent 版本（Docker 模式）
update_agent_docker() {
    log_info "使用 Docker 模式更新 Agent"
    echo ""

    # 设置应用目录
    APP_DIR="/opt/ssalgten-agent"

    log_warning "更新操作将："
    echo "  1. 下载最新代码"
    echo "  2. 重新构建 Docker 镜像"
    echo "  3. 重启 Agent 服务"
    echo "  4. 保留现有配置（.env 文件）"
    echo ""

    confirm=$(read_from_tty "确认更新 Agent？[y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消操作"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 1. 备份当前配置
    log_info "备份配置文件..."
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        log_success "配置已备份"
    fi

    # 2. 下载最新代码
    log_info "下载最新 Agent 代码..."
    
    # 创建临时目录
    TEMP_DIR="/tmp/ssalgten-agent-update-$(date +%s)"
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    cd "$TEMP_DIR"
    
    # 尝试多种下载方式
    local download_success=false
    local git_urls=(
        "https://github.com/lonelyrower/SsalgTen.git"
        "https://github.com.cnpmjs.org/lonelyrower/SsalgTen.git"
        "https://hub.fastgit.xyz/lonelyrower/SsalgTen.git"
    )

    # 尝试Git克隆
    for git_url in "${git_urls[@]}"; do
        log_info "尝试: git clone --depth 1 $git_url"
        rm -rf repo 2>/dev/null || true

        if git clone --depth 1 "$git_url" repo >/dev/null 2>&1; then
            # 验证克隆成功并且有内容
            if [[ -d "repo/agent" ]] || [[ -d "repo/packages/agent" ]]; then
                # 移动所有内容到当前目录
                shopt -s dotglob nullglob
                mv repo/* . 2>/dev/null || true
                shopt -u dotglob nullglob
                rm -rf repo
                download_success=true
                log_success "代码下载成功"
                break
            else
                log_warning "Git克隆成功但未找到agent目录，尝试下一种方法..."
                rm -rf repo
            fi
        else
            log_warning "下载失败，尝试下一种方法..."
        fi
    done
    
    # 如果Git克隆都失败，使用wget下载ZIP包
    if [[ "$download_success" == false ]]; then
        log_warning "Git克隆失败，使用wget下载ZIP包..."
        
        local zip_urls=(
            "https://github.com/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
            "https://github.com.cnpmjs.org/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
        )
        
        for zip_url in "${zip_urls[@]}"; do
            log_info "尝试下载: $zip_url"
            if wget -q "$zip_url" -O main.zip 2>/dev/null; then
                if unzip -q main.zip 2>/dev/null; then
                    if command -v python3 >/dev/null 2>&1 && python3 - <<'PY'
import os, shutil
src = 'SsalgTen-main'
dst = '.'
for name in os.listdir(src):
    shutil.move(os.path.join(src, name), dst)
PY
                    then
                        rmdir SsalgTen-main 2>/dev/null || true
                        rm -f main.zip
                        download_success=true
                        log_success "ZIP包下载成功"
                        break
                    else
                        log_warning "Python 搬运失败或未安装，使用Shell回退方案"
                        (
                            shopt -s dotglob nullglob
                            for item in SsalgTen-main/*; do
                                mv "$item" .
                            done
                            shopt -u dotglob nullglob
                        )
                        rmdir SsalgTen-main 2>/dev/null || true
                        rm -f main.zip
                        download_success=true
                        log_success "ZIP包下载成功"
                        break
                    fi
                fi
            fi
        done
    fi
    
    if [[ "$download_success" == false ]]; then
        log_error "所有下载方法都失败了"
        rm -rf "$TEMP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 调试：显示当前目录内容
    log_info "当前临时目录: $(pwd)"
    log_info "目录内容:"
    ls -la 2>/dev/null | head -20 || true

    # 检查 agent 源目录
    local agent_source=""
    if [[ -d "agent" ]]; then
        agent_source="agent"
        log_info "找到 agent 目录"
    elif [[ -d "packages/agent" ]]; then
        agent_source="packages/agent"
        log_info "找到 packages/agent 目录"
    fi

    if [[ -z "$agent_source" ]]; then
        log_error "下载的代码中未找到 agent 目录"
        log_error "临时目录内容："
        ls -laR 2>/dev/null | head -50 || true
        rm -rf "$TEMP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi
    
    # 备份旧代码（保留.env和docker-compose.yml）
    log_info "备份旧代码..."
    BACKUP_DIR="/tmp/ssalgten-agent-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$APP_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true

    # 先保存 .env 和 docker-compose.yml 到临时位置
    ENV_BACKUP="/tmp/ssalgten-env-backup-$$.env"
    COMPOSE_BACKUP="/tmp/ssalgten-compose-backup-$$.yml"

    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$ENV_BACKUP"
        log_info "已保存 .env 配置"
    fi

    if [ -f "$APP_DIR/docker-compose.yml" ]; then
        cp "$APP_DIR/docker-compose.yml" "$COMPOSE_BACKUP"
        log_info "已保存 docker-compose.yml 配置"
    fi

    # 更新代码（删除所有旧文件）
    log_info "更新代码文件..."
    rm -rf "$APP_DIR"/*

    # 复制新的Agent文件
    mkdir -p "$APP_DIR"
    (
        shopt -s dotglob nullglob
        cp -r "$agent_source"/* "$APP_DIR/"
    )

    # 恢复 .env 配置文件
    if [ -f "$ENV_BACKUP" ]; then
        cp "$ENV_BACKUP" "$APP_DIR/.env"
        log_success ".env 配置已恢复"

        # 清理旧的 DEFAULT_AGENT_IPV6_SUBNET 配置（不再需要）
        if grep -q "^DEFAULT_AGENT_IPV6_SUBNET=" "$APP_DIR/.env" 2>/dev/null; then
            sed -i '/^DEFAULT_AGENT_IPV6_SUBNET=/d' "$APP_DIR/.env"
            sed -i '/^# Docker 网络配置$/d' "$APP_DIR/.env"
            log_info "已清理旧的 IPv6 子网配置（现在由 Docker 自动分配）"
        fi

        # 添加服务检测配置（如果不存在）
        if ! grep -q "^SERVICE_DETECTION_ENABLED=" "$APP_DIR/.env" 2>/dev/null; then
            log_info "添加服务检测配置..."
            cat >> "$APP_DIR/.env" << 'EOF'

# 服务检测配置（自动检测 Xray, Nginx, Docker 等服务）
SERVICE_DETECTION_ENABLED=true
SERVICE_SCAN_INTERVAL_HOURS=12
EOF
            log_success "服务检测配置已添加"
        fi

        # 清理临时 .env 备份
        rm -f "$ENV_BACKUP"
    else
        log_warning "未找到原 .env 文件，可能需要重新配置"
    fi

    # 恢复 docker-compose.yml 配置文件
    if [ -f "$COMPOSE_BACKUP" ]; then
        cp "$COMPOSE_BACKUP" "$APP_DIR/docker-compose.yml"
        log_success "docker-compose.yml 配置已恢复"
        rm -f "$COMPOSE_BACKUP"
    fi

    # 清理临时目录
    rm -rf "$TEMP_DIR"

    cd "$APP_DIR"

    # 验证 .env 文件存在
    if [ ! -f "$APP_DIR/.env" ]; then
        log_error ".env 文件不存在！"
        return
    fi

    log_success "代码更新完成"

    # 更新网络配置/IPv6 支持
    local compose_file="$APP_DIR/docker-compose.yml"
    if [[ -f "$compose_file" && $(grep -c 'network_mode: host' "$compose_file") -gt 0 ]]; then
        AGENT_USE_HOST_NETWORK=true
    else
        AGENT_USE_HOST_NETWORK=false
    fi

    # 确保 docker-compose.yml 包含正确的 IPv6 网络配置
    if [[ "$AGENT_USE_HOST_NETWORK" != "true" && -f "$compose_file" ]]; then
        log_info "检查并更新 docker-compose.yml 中的 IPv6 网络配置..."

        # 检查是否有旧的子网配置引用
        if grep -q 'DEFAULT_AGENT_IPV6_SUBNET' "$compose_file" 2>/dev/null; then
            log_warning "发现旧的子网配置，正在更新..."
            # 删除整个 networks 部分
            sed -i '/^networks:/,$ d' "$compose_file"

            # 添加新的简化配置
            cat >> "$compose_file" << 'EOF'

networks:
  agent-network:
    driver: bridge
    enable_ipv6: true
EOF
            log_success "已更新为简化的 IPv6 网络配置（由 Docker 自动分配子网）"
        elif ! grep -q "enable_ipv6: true" "$compose_file" 2>/dev/null; then
            log_info "添加 IPv6 网络配置到 docker-compose.yml"

            # 删除旧的 networks 部分（如果存在）
            sed -i '/^networks:/,$ d' "$compose_file"

            # 添加新的 IPv6 网络配置
            cat >> "$compose_file" << 'EOF'

networks:
  agent-network:
    driver: bridge
    enable_ipv6: true
EOF
            log_success "已添加 IPv6 网络配置"
        else
            log_info "docker-compose.yml 已包含正确的 IPv6 配置"
        fi
    fi
    if ! ensure_kernel_ipv6_support; then
        log_error "内核 IPv6 参数配置失败，已停止更新流程"
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR"/* "$APP_DIR/" 2>/dev/null || true
        log_info "已恢复到更新前的状态"
        log_info "备份目录: $BACKUP_DIR"
        return
    fi
    if ! ensure_docker_ipv6_support; then
        log_error "Docker IPv6 未成功启用，已停止更新流程"
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR"/* "$APP_DIR/" 2>/dev/null || true
        log_info "已恢复到更新前的状态"
        log_info "请检查 /etc/docker/daemon.json 后重新运行更新"
        log_info "备份目录: $BACKUP_DIR"
        return
    fi
    # 删除旧网络以便重新创建支持 IPv6 的网络
    if [[ "$AGENT_USE_HOST_NETWORK" != "true" ]]; then
        log_info "准备重新创建 Docker 网络（启用 IPv6 支持）..."

        cd "$APP_DIR"

        # 获取网络名称
        local compose_project
        compose_project=$(basename "$APP_DIR")
        local default_network="${compose_project}_agent-network"

        # 停止并删除所有容器和网络
        log_info "停止并清理旧容器和网络..."
        docker_compose down -v 2>&1 | grep -v "^$" || true
        sleep 2

        # 检查并删除残留的 agent 网络
        if docker network inspect "$default_network" >/dev/null 2>&1; then
            log_info "删除残留网络: $default_network"
            docker ps -a --filter "network=$default_network" -q | xargs -r docker rm -f 2>/dev/null || true
            docker network rm "$default_network" 2>/dev/null || true
            sleep 1
        fi

        log_success "网络清理完成，准备重新创建"
    fi

    # 3. 重新构建镜像
    log_info "重新构建 Agent 镜像（可能需要几分钟）..."
    if docker_compose build; then
        log_success "镜像构建完成"
    else
        log_error "镜像构建失败"
        log_info "正在恢复备份..."
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        log_info "已恢复到更新前的状态"
        log_info "备份位置: $BACKUP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 4. 重启服务
    log_info "重启 Agent 服务..."

    # 确保 systemd 服务文件使用最新模板
    if [ -f /etc/systemd/system/ssalgten-agent.service ]; then
        if grep -q "Type=oneshot" /etc/systemd/system/ssalgten-agent.service \
            || grep -q "RemainAfterExit" /etc/systemd/system/ssalgten-agent.service \
            || grep -Eq 'ExecStart=.*/docker compose up[[:space:]].*-d' /etc/systemd/system/ssalgten-agent.service \
            || ! grep -q "Type=simple" /etc/systemd/system/ssalgten-agent.service; then
            log_warning "检测到旧版本的 systemd 配置，正在修复..."

            SERVICE_USER=$(grep '^User=' /etc/systemd/system/ssalgten-agent.service | head -1 | cut -d'=' -f2)
            SERVICE_GROUP=$(grep '^Group=' /etc/systemd/system/ssalgten-agent.service | head -1 | cut -d'=' -f2)
            SERVICE_USER=${SERVICE_USER:-root}
            SERVICE_GROUP=${SERVICE_GROUP:-$SERVICE_USER}

            sudo tee /etc/systemd/system/ssalgten-agent.service > /dev/null <<SYSTEMD_EOF
[Unit]
Description=SsalgTen Agent Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=5
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

            sudo systemctl daemon-reload
            log_success "systemd 配置已更新为最新模板"
        else
            log_success "systemd 配置已是最新版本"
        fi
    fi

    # 停止服务
    if systemctl is-active --quiet ssalgten-agent.service 2>/dev/null; then
        systemctl stop ssalgten-agent.service
        sleep 2
    fi

    # 清理可能残留的容器
    docker_compose down 2>/dev/null || true
    sleep 1

    # 启动服务
    if systemctl start ssalgten-agent.service; then
        log_info "systemd 服务已启动"
    else
        log_error "systemd 服务启动失败"
        log_info "查看服务状态: systemctl status ssalgten-agent.service"
        log_info "查看服务日志: journalctl -xeu ssalgten-agent.service"

        # 尝试直接启动查看错误
        log_info "尝试直接启动容器以查看错误..."
        cd "$APP_DIR"
        docker_compose up -d 2>&1 | head -30

        log_warning "正在恢复备份..."
        docker_compose down 2>/dev/null || true
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        systemctl start ssalgten-agent.service
        log_info "已恢复到更新前的状态"
        return
    fi

    sleep 3

    # 验证容器状态
    if docker_compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
        log_success "Agent 已成功更新并启动"
        echo ""
        log_info "容器状态:"
        docker_compose ps
        echo ""
        log_info "旧版本备份位置: $BACKUP_DIR"
        log_info "如果一切正常，可以删除备份: rm -rf $BACKUP_DIR"
    else
        log_error "Agent 容器启动失败"
        log_info "查看容器日志: cd $APP_DIR && docker compose logs --tail 50"
        log_warning "正在恢复备份..."
        docker_compose down 2>/dev/null || true
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        systemctl restart ssalgten-agent.service
        log_info "已恢复到更新前的状态"
    fi

    echo ""
    log_success "✅ Agent 更新完成！"
    echo ""
    log_info "验证服务状态: systemctl status ssalgten-agent"
    log_info "查看 Agent 日志: cd $APP_DIR && docker compose logs -f"
    echo ""
}

# 更新 Agent 版本（宿主机模式）
update_agent_native() {
    log_info "使用宿主机模式更新 Agent"
    echo ""

    # 设置应用目录
    local APP_DIR="/opt/ssalgten-agent"
    local AGENT_USER="ssalgten"

    log_warning "更新操作将："
    echo "  1. 下载最新代码"
    echo "  2. 重新安装依赖 (npm install)"
    echo "  3. 重新构建项目 (npm run build)"
    echo "  4. 重启 Agent 服务"
    echo "  5. 保留现有配置（.env 文件）"
    echo ""

    confirm=$(read_from_tty "确认更新 Agent？[y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消操作"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 1. 备份当前配置
    log_info "备份配置文件..."
    if [ -f "$APP_DIR/.env" ]; then
        run_root cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        log_success "配置已备份"
    fi

    # 2. 下载最新代码
    log_info "下载最新 Agent 代码..."

    TEMP_DIR="/tmp/ssalgten-agent-update-$(date +%s)"
    run_root rm -rf "$TEMP_DIR"
    run_root mkdir -p "$TEMP_DIR"

    cd "$TEMP_DIR"

    local download_success=false
    local git_urls=(
        "https://github.com/lonelyrower/SsalgTen.git"
        "https://github.com.cnpmjs.org/lonelyrower/SsalgTen.git"
        "https://hub.fastgit.xyz/lonelyrower/SsalgTen.git"
    )

    # 尝试Git克隆
    for git_url in "${git_urls[@]}"; do
        log_info "尝试: git clone --depth 1 $git_url"
        run_root rm -rf repo 2>/dev/null || true

        if run_root git clone --depth 1 "$git_url" repo >/dev/null 2>&1; then
            if [[ -d "repo/agent" ]] || [[ -d "repo/packages/agent" ]]; then
                run_root bash -c 'cd repo && shopt -s dotglob nullglob && mv * .. 2>/dev/null || true'
                run_root rm -rf repo
                download_success=true
                log_success "代码下载成功"
                break
            else
                log_warning "Git克隆成功但未找到agent目录，尝试下一种方法..."
                run_root rm -rf repo
            fi
        else
            log_warning "下载失败，尝试下一种方法..."
        fi
    done

    # 如果Git克隆都失败，使用wget下载ZIP包
    if [[ "$download_success" == false ]]; then
        log_warning "Git克隆失败，使用wget下载ZIP包..."

        local zip_urls=(
            "https://github.com/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
            "https://github.com.cnpmjs.org/lonelyrower/SsalgTen/archive/refs/heads/main.zip"
        )

        for zip_url in "${zip_urls[@]}"; do
            log_info "尝试下载: $zip_url"
            if run_root wget -q "$zip_url" -O main.zip 2>/dev/null; then
                if run_root unzip -q main.zip 2>/dev/null; then
                    run_root bash -c 'cd SsalgTen-main && shopt -s dotglob nullglob && mv * .. && cd .. && rmdir SsalgTen-main'
                    run_root rm -f main.zip
                    download_success=true
                    log_success "ZIP包下载成功"
                    break
                fi
            fi
        done
    fi

    if [[ "$download_success" == false ]]; then
        log_error "所有下载方法都失败了"
        run_root rm -rf "$TEMP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 检查 agent 源目录
    local agent_source=""
    if [[ -d "$TEMP_DIR/agent" ]]; then
        agent_source="$TEMP_DIR/agent"
        log_info "找到 agent 目录"
    elif [[ -d "$TEMP_DIR/packages/agent" ]]; then
        agent_source="$TEMP_DIR/packages/agent"
        log_info "找到 packages/agent 目录"
    fi

    if [[ -z "$agent_source" ]]; then
        log_error "下载的代码中未找到 agent 目录"
        run_root rm -rf "$TEMP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 3. 备份旧代码
    log_info "备份旧代码..."
    BACKUP_DIR="/tmp/ssalgten-agent-backup-$(date +%Y%m%d_%H%M%S)"
    run_root mkdir -p "$BACKUP_DIR"
    run_root cp -r "$APP_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true

    # 保存 .env 到临时位置
    ENV_BACKUP="/tmp/ssalgten-env-backup-$$.env"
    if [ -f "$APP_DIR/.env" ]; then
        run_root cp "$APP_DIR/.env" "$ENV_BACKUP"
        log_info "已保存 .env 配置"
    fi

    # 4. 停止服务
    log_info "停止 Agent 服务..."
    run_root systemctl stop ssalgten-agent.service 2>/dev/null || true

    # 5. 更新代码
    log_info "更新代码文件..."
    run_root rm -rf "$APP_DIR"/*
    run_root bash -c "cd '$agent_source' && shopt -s dotglob nullglob && cp -r * '$APP_DIR/'"

    # 恢复 .env 配置文件
    if [ -f "$ENV_BACKUP" ]; then
        run_root cp "$ENV_BACKUP" "$APP_DIR/.env"
        log_success ".env 配置已恢复"

        # 添加服务检测配置（如果不存在）
        if ! grep -q "^SERVICE_DETECTION_ENABLED=" "$APP_DIR/.env" 2>/dev/null; then
            log_info "添加服务检测配置..."
            run_root sh -c "cat >> '$APP_DIR/.env' << 'EOF'

# 服务检测配置（自动检测 Xray, Nginx, Docker 等服务）
SERVICE_DETECTION_ENABLED=true
SERVICE_SCAN_INTERVAL_HOURS=12
EOF"
            log_success "服务检测配置已添加"
        fi

        run_root rm -f "$ENV_BACKUP"
    else
        log_warning "未找到原 .env 文件，可能需要重新配置"
    fi

    # 6. 清理临时目录
    run_root rm -rf "$TEMP_DIR"

    # 7. 设置文件权限
    log_info "设置文件权限..."
    run_root chown -R "$AGENT_USER":"$AGENT_USER" "$APP_DIR"

    # 8. 重新安装依赖
    log_info "安装 Node.js 依赖（可能需要几分钟）..."
    cd "$APP_DIR"
    if run_as_agent "cd '$APP_DIR' && npm install --production" 2>&1 | grep -v '^$'; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        log_info "正在恢复备份..."
        run_root rm -rf "$APP_DIR"/*
        run_root cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        run_root chown -R "$AGENT_USER":"$AGENT_USER" "$APP_DIR"
        run_root systemctl start ssalgten-agent.service
        log_info "已恢复到更新前的状态"
        log_info "备份位置: $BACKUP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 8.5. 安装构建工具
    log_info "安装构建工具 TypeScript..."
    run_as_agent "cd '$APP_DIR' && npm install --no-save typescript@latest" 2>&1 | grep -v '^$'
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        log_error "TypeScript 安装失败"
        log_info "正在恢复备份..."
        run_root rm -rf "$APP_DIR"/*
        run_root cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        run_root chown -R "$AGENT_USER":"$AGENT_USER" "$APP_DIR"
        run_root systemctl start ssalgten-agent.service
        log_info "已恢复到更新前的状态"
        log_info "备份位置: $BACKUP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi
    log_success "TypeScript 安装完成"

    # 9. 清理旧的构建文件
    log_info "清理旧的构建文件..."
    run_root rm -rf "$APP_DIR/dist"
    log_success "旧构建文件已清理"

    # 10. 重新构建项目
    log_info "构建项目（可能需要几分钟）..."
    if run_as_agent "cd '$APP_DIR' && npm run build" 2>&1 | grep -v '^$'; then
        log_success "项目构建完成"
    else
        log_error "项目构建失败"
        log_info "正在恢复备份..."
        run_root rm -rf "$APP_DIR"/*
        run_root cp -r "$BACKUP_DIR"/* "$APP_DIR/"
        run_root chown -R "$AGENT_USER":"$AGENT_USER" "$APP_DIR"
        run_root systemctl start ssalgten-agent.service
        log_info "已恢复到更新前的状态"
        log_info "备份位置: $BACKUP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 11. 创建日志目录
    log_info "创建日志目录..."
    run_root mkdir -p "$APP_DIR/logs"
    run_root chown "$AGENT_USER":"$AGENT_USER" "$APP_DIR/logs"
    run_root chmod 755 "$APP_DIR/logs"

    # 12. 启动服务
    log_info "启动 Agent 服务..."
    if run_root systemctl start ssalgten-agent.service; then
        log_success "服务已启动"
    else
        log_error "服务启动失败"
        log_info "查看服务状态: systemctl status ssalgten-agent.service"
        log_info "查看服务日志: journalctl -xeu ssalgten-agent.service"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 13. 验证服务状态
    sleep 3
    if run_root systemctl is-active --quiet ssalgten-agent.service; then
        log_success "Agent 服务运行正常"
    else
        log_error "Agent 服务未正常运行"
        log_info "查看服务日志: journalctl -xeu ssalgten-agent.service -n 50"
    fi

    # 清理备份（可选）
    log_info "备份保存在: $BACKUP_DIR"
    echo ""
    log_success "✅ Agent 更新完成！"
    echo ""
    log_info "验证服务状态: systemctl status ssalgten-agent"
    log_info "查看 Agent 日志: journalctl -u ssalgten-agent -f"
    echo ""
}

# 更新 Agent 版本（统一入口）
update_agent() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    更新 Agent 到最新版本"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    # 设置应用目录
    local APP_DIR="/opt/ssalgten-agent"

    # 检查 Agent 是否已安装
    if [ ! -d "$APP_DIR" ]; then
        log_error "未找到 Agent 安装目录: $APP_DIR"
        log_info "请先安装 Agent"
        echo ""
        read -p "按回车键返回主菜单..." -r
        return
    fi

    log_info "当前 Agent 目录: $APP_DIR"
    echo ""

    # 检测部署模式
    local detected_mode
    detected_mode=$(detect_deploy_mode)

    log_info "检测到部署模式: $detected_mode"
    echo ""

    case "$detected_mode" in
        docker)
            update_agent_docker
            ;;
        native)
            update_agent_native
            ;;
        unknown)
            log_warning "无法自动检测部署模式，请选择更新方式："
            echo ""
            echo "1. Docker 模式更新"
            echo "2. 宿主机模式更新"
            echo ""
            local mode_choice
            mode_choice=$(read_from_tty "请选择 [1-2]: ")

            case $mode_choice in
                1)
                    log_info "使用 Docker 模式更新"
                    update_agent_docker
                    ;;
                2)
                    log_info "使用宿主机模式更新"
                    update_agent_native
                    ;;
                *)
                    log_error "无效选项"
                    read -p "按回车键返回主菜单..." -r
                    return
                    ;;
            esac
            ;;
    esac

    read -p "按回车键返回主菜单..." -r
}

# 更新心跳配置
update_heartbeat_config() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    更新 Agent 心跳配置"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    # 设置应用目录
    APP_DIR="/opt/ssalgten-agent"

    # 检查 Agent 是否已安装
    if [ ! -d "$APP_DIR" ]; then
        log_error "未找到 Agent 安装目录: $APP_DIR"
        log_info "请先安装 Agent"
        echo ""
        read -p "按回车键返回主菜单..." -r
        return
    fi

    if [ ! -f "$APP_DIR/.env" ]; then
        log_error "未找到配置文件: $APP_DIR/.env"
        echo ""
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 显示当前配置
    CURRENT_INTERVAL=$(grep '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "30000")
    CURRENT_MINUTES=$((CURRENT_INTERVAL / 1000 / 60))

    log_info "当前心跳间隔: $CURRENT_INTERVAL ms ($CURRENT_MINUTES 分钟)"
    echo ""
    echo "推荐配置："
    echo "  • 5 分钟 (300000 ms) - 推荐，适合大规模部署"
    echo "  • 3 分钟 (180000 ms) - 更频繁的状态更新"
    echo "  • 1 分钟 (60000 ms)  - 实时监控，数据量较大"
    echo ""

    # 询问用户选择
    echo "请选择新的心跳间隔："
    echo "  1. 5 分钟 (300000 ms) ${GREEN}[推荐]${NC}"
    echo "  2. 3 分钟 (180000 ms)"
    echo "  3. 1 分钟 (60000 ms)"
    echo "  4. 自定义"
    echo "  0. 取消"
    echo ""

    choice=$(read_from_tty "请输入选项 [0-4]: ")

    case $choice in
        1)
            NEW_INTERVAL=300000
            ;;
        2)
            NEW_INTERVAL=180000
            ;;
        3)
            NEW_INTERVAL=60000
            ;;
        4)
            custom_minutes=$(read_from_tty "请输入心跳间隔（分钟）: ")
            if ! [[ "$custom_minutes" =~ ^[0-9]+$ ]]; then
                log_error "无效输入，必须是数字"
                read -p "按回车键返回主菜单..." -r
                return
            fi
            NEW_INTERVAL=$((custom_minutes * 60 * 1000))
            ;;
        0)
            log_info "已取消操作"
            read -p "按回车键返回主菜单..." -r
            return
            ;;
        *)
            log_error "无效选项"
            read -p "按回车键返回主菜单..." -r
            return
            ;;
    esac

    # 确认修改
    NEW_MINUTES=$((NEW_INTERVAL / 1000 / 60))
    echo ""
    log_info "即将修改心跳间隔："
    echo "  当前: $CURRENT_INTERVAL ms ($CURRENT_MINUTES 分钟)"
    echo "  新值: $NEW_INTERVAL ms ($NEW_MINUTES 分钟)"
    echo ""

    confirm=$(read_from_tty "确认修改并重启 Agent？[y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消操作"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 检查并修复 systemd 服务配置
    log_info "检查 systemd 服务配置..."
    if [ -f /etc/systemd/system/ssalgten-agent.service ]; then
        if grep -q "Type=oneshot" /etc/systemd/system/ssalgten-agent.service \
            || grep -q "RemainAfterExit" /etc/systemd/system/ssalgten-agent.service \
            || grep -Eq 'ExecStart=.*/docker compose up[[:space:]].*-d' /etc/systemd/system/ssalgten-agent.service \
            || ! grep -q "Type=simple" /etc/systemd/system/ssalgten-agent.service; then
            log_warning "检测到旧版本的 systemd 配置，正在修复..."

            sudo tee /etc/systemd/system/ssalgten-agent.service > /dev/null << 'SYSTEMD_EOF'
[Unit]
Description=SsalgTen Agent Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/ssalgten-agent
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=5
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

            sudo systemctl daemon-reload
            log_success "systemd 配置已修复为最新版本（前台运行 docker compose up）"
        else
            log_success "systemd 配置正常"
        fi
    fi

    # 备份配置文件
    log_info "备份配置文件..."
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"

    # 修改配置
    log_info "修改心跳间隔配置..."
    if grep -q '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env"; then
        # 已存在，替换
        sed -i "s/^HEARTBEAT_INTERVAL=.*/HEARTBEAT_INTERVAL=$NEW_INTERVAL/" "$APP_DIR/.env"
    else
        # 不存在，追加
        echo "HEARTBEAT_INTERVAL=$NEW_INTERVAL" >> "$APP_DIR/.env"
    fi

    # 验证修改
    NEW_VALUE=$(grep '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env" | cut -d'=' -f2)
    if [ "$NEW_VALUE" = "$NEW_INTERVAL" ]; then
        log_success "配置已更新: HEARTBEAT_INTERVAL=$NEW_INTERVAL"
    else
        log_error "配置更新失败"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 检测部署模式
    local detected_mode=$(detect_deploy_mode)
    log_info "检测到部署模式: $detected_mode"

    # 重启服务
    log_info "重启 Agent 服务..."

    if [[ "$detected_mode" == "docker" ]]; then
        # Docker 模式重启
        # 先停止服务以确保最新配置生效
        if systemctl is-active --quiet ssalgten-agent.service 2>/dev/null; then
            systemctl stop ssalgten-agent.service
            sleep 1
        fi

        # 启动服务
        systemctl start ssalgten-agent.service
        sleep 2

        # 验证 Docker 容器状态
        cd "$APP_DIR"
        if docker_compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
            log_success "服务已重启，新配置已生效"
            log_info "容器状态:"
            docker_compose ps
        else
            log_warning "systemd 服务已启动，正在验证容器状态..."
            sleep 2
            if docker_compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
                log_success "容器已启动"
            else
                log_error "容器启动失败，请手动检查"
                log_info "查看容器状态: cd $APP_DIR && docker compose ps"
                log_info "查看容器日志: cd $APP_DIR && docker compose logs --tail 50"
            fi
        fi
    else
        # 宿主机模式重启
        systemctl restart ssalgten-agent.service
        sleep 2

        # 验证服务状态
        if systemctl is-active --quiet ssalgten-agent.service; then
            log_success "服务已重启，新配置已生效"
            log_info "查看服务状态: systemctl status ssalgten-agent"
        else
            log_error "服务启动失败，请检查日志"
            log_info "查看日志: journalctl -u ssalgten-agent -n 50 --no-pager"
        fi
    fi

    echo ""
    log_success "✅ 心跳配置更新完成！"
    echo ""
    log_info "验证服务状态: systemctl status ssalgten-agent"
    echo ""
}

# 重启 Agent 服务
restart_agent() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    重启 Agent 服务"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    # 设置应用目录
    APP_DIR="/opt/ssalgten-agent"

    # 检查 Agent 是否已安装
    if [ ! -d "$APP_DIR" ]; then
        log_error "未找到 Agent 安装目录: $APP_DIR"
        log_info "请先安装 Agent"
        echo ""
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 检测部署模式
    local detected_mode=$(detect_deploy_mode)
    log_info "检测到部署模式: $detected_mode"
    echo ""

    # 确认重启
    confirm=$(read_from_tty "确认重启 Agent 服务？[y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消操作"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    echo ""
    log_info "正在重启 Agent 服务..."

    if [[ "$detected_mode" == "docker" ]]; then
        # Docker 模式重启
        cd "$APP_DIR"

        # 先停止
        if systemctl is-active --quiet ssalgten-agent.service 2>/dev/null; then
            systemctl stop ssalgten-agent.service
            log_info "已停止服务"
            sleep 2
        fi

        # 启动
        systemctl start ssalgten-agent.service
        sleep 3

        # 验证 Docker 容器状态
        if docker_compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
            log_success "服务已成功重启"
            echo ""
            log_info "容器状态:"
            docker_compose ps
        else
            log_warning "systemd 服务已启动，正在验证容器状态..."
            sleep 2
            if docker_compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
                log_success "容器已成功启动"
            else
                log_error "容器启动失败，请手动检查"
                log_info "查看容器状态: cd $APP_DIR && docker compose ps"
                log_info "查看容器日志: cd $APP_DIR && docker compose logs --tail 50"
            fi
        fi
    else
        # 宿主机模式重启
        systemctl restart ssalgten-agent.service
        sleep 3

        # 验证服务状态
        if systemctl is-active --quiet ssalgten-agent.service; then
            log_success "服务已成功重启"
            echo ""
            log_info "服务状态:"
            systemctl status ssalgten-agent --no-pager -l
        else
            log_error "服务启动失败，请检查日志"
            log_info "查看日志: journalctl -u ssalgten-agent -n 50 --no-pager"
        fi
    fi

    echo ""
    log_success "✅ 重启完成！"
    echo ""
    read -p "按回车键返回主菜单..." -r
}

# 检测部署模式
detect_deploy_mode() {
    local APP_DIR="/opt/ssalgten-agent"

    # 检查是否存在 docker-compose.yml（Docker 模式）
    if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
        echo "docker"
        return
    fi

    # 检查是否存在 node_modules 和 dist（宿主机模式）
    if [[ -d "$APP_DIR/node_modules" && -d "$APP_DIR/dist" ]]; then
        echo "native"
        return
    fi

    # 检查 systemd 服务描述
    if [[ -f /etc/systemd/system/ssalgten-agent.service ]]; then
        if grep -q "宿主机模式" /etc/systemd/system/ssalgten-agent.service 2>/dev/null; then
            echo "native"
            return
        elif grep -q "docker compose" /etc/systemd/system/ssalgten-agent.service 2>/dev/null; then
            echo "docker"
            return
        fi
    fi

    # 无法确定，返回 unknown
    echo "unknown"
}

# 卸载Agent（Docker模式）
uninstall_agent_docker() {
    log_info "卸载 Docker 部署模式的 Agent..."

    local APP_DIR="/opt/ssalgten-agent"

    # 1. 停止和删除系统服务
    log_info "停止系统服务..."
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        systemctl stop ssalgten-agent.service 2>/dev/null || true
        systemctl disable ssalgten-agent.service 2>/dev/null || true
        rm -f /etc/systemd/system/ssalgten-agent.service
        systemctl daemon-reload
    else
        sudo systemctl stop ssalgten-agent.service 2>/dev/null || true
        sudo systemctl disable ssalgten-agent.service 2>/dev/null || true
        sudo rm -f /etc/systemd/system/ssalgten-agent.service
        sudo systemctl daemon-reload
    fi
    log_success "系统服务已停止并删除"

    # 2. 停止和删除Docker容器
    log_info "停止Docker容器..."
    if [[ -d "$APP_DIR" ]]; then
        cd "$APP_DIR"

        # 使用Docker Compose停止服务
        if [[ -f "docker-compose.yml" ]]; then
            docker_compose down --remove-orphans --volumes 2>/dev/null || true
            log_success "Docker服务已停止"
        fi

        # 删除相关的Docker镜像（仅限 Agent 镜像，避免误删主服务镜像）
        log_info "删除Agent相关Docker镜像..."
        IMAGE_IDS=$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '/ssalgten-agent/ {print $2}' | sort -u)
        if [[ -n "$IMAGE_IDS" ]]; then
            for img in $IMAGE_IDS; do
                docker rmi "$img" 2>/dev/null || true
            done
        fi
        log_success "Agent镜像清理完成"
    fi
}

# 卸载Agent（宿主机模式）
uninstall_agent_native() {
    log_info "卸载宿主机部署模式的 Agent..."

    local APP_DIR="/opt/ssalgten-agent"
    local AGENT_USER="ssalgten"

    # 1. 停止和删除系统服务
    log_info "停止系统服务..."
    if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
        systemctl stop ssalgten-agent.service 2>/dev/null || true
        systemctl disable ssalgten-agent.service 2>/dev/null || true
        rm -f /etc/systemd/system/ssalgten-agent.service
        systemctl daemon-reload
    else
        sudo systemctl stop ssalgten-agent.service 2>/dev/null || true
        sudo systemctl disable ssalgten-agent.service 2>/dev/null || true
        sudo rm -f /etc/systemd/system/ssalgten-agent.service
        sudo systemctl daemon-reload
    fi
    log_success "系统服务已停止并删除"

    # 2. 询问是否删除专用用户
    echo ""
    log_info "检测到专用用户: $AGENT_USER"
    local delete_user
    delete_user=$(read_from_tty "是否删除用户 $AGENT_USER？[y/N] (回车默认选择 N): ")
    delete_user="${delete_user:-n}"

    if [[ "$delete_user" =~ ^[Yy]$ ]]; then
        log_info "删除用户 $AGENT_USER..."
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            userdel -r "$AGENT_USER" 2>/dev/null || userdel "$AGENT_USER" 2>/dev/null || true
        else
            sudo userdel -r "$AGENT_USER" 2>/dev/null || sudo userdel "$AGENT_USER" 2>/dev/null || true
        fi
        log_success "用户已删除"
    else
        log_info "保留用户 $AGENT_USER"
    fi
}

# 卸载Agent（统一入口）
uninstall_agent() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen Agent 卸载程序"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    # 检测部署模式
    local detected_mode
    detected_mode=$(detect_deploy_mode)

    log_info "检测到的部署模式: $detected_mode"
    echo ""

    log_warning "⚠️ 准备卸载SsalgTen Agent"
    echo ""
    echo "此操作将删除："
    if [[ "$detected_mode" == "docker" ]]; then
        echo "  - Agent Docker容器和镜像"
    elif [[ "$detected_mode" == "native" ]]; then
        echo "  - Agent 应用程序和依赖"
        echo "  - 专用用户 ssalgten（可选）"
    fi
    echo "  - 应用目录：/opt/ssalgten-agent"
    echo "  - 系统服务：ssalgten-agent.service"
    echo "  - 相关配置文件"
    echo ""

    # 确认卸载
    local confirm_uninstall
    confirm_uninstall=$(read_from_tty "是否确认卸载？这个操作不可逆！[y/N] (回车默认选择 N): ")
    confirm_uninstall="${confirm_uninstall:-n}"
    if [[ "$confirm_uninstall" != "y" && "$confirm_uninstall" != "Y" ]]; then
        log_info "已取消卸载"
        exit 0
    fi

    log_info "开始卸载SsalgTen Agent..."

    # 检查是否以root运行
    if [[ $EUID -eq 0 ]]; then
        export RUNNING_AS_ROOT=true
        log_info "使用root用户进行卸载"
    else
        # 检查sudo权限
        if ! sudo -v >/dev/null 2>&1; then
            log_error "需要sudo权限来卸载系统组件"
            exit 1
        fi
    fi

    # 根据检测到的模式执行相应的卸载
    if [[ "$detected_mode" == "docker" ]]; then
        uninstall_agent_docker
    elif [[ "$detected_mode" == "native" ]]; then
        uninstall_agent_native
    else
        log_warning "无法确定部署模式，将执行通用卸载..."
        # 通用卸载：停止服务
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            systemctl stop ssalgten-agent.service 2>/dev/null || true
            systemctl disable ssalgten-agent.service 2>/dev/null || true
            rm -f /etc/systemd/system/ssalgten-agent.service
            systemctl daemon-reload
        else
            sudo systemctl stop ssalgten-agent.service 2>/dev/null || true
            sudo systemctl disable ssalgten-agent.service 2>/dev/null || true
            sudo rm -f /etc/systemd/system/ssalgten-agent.service
            sudo systemctl daemon-reload
        fi
        log_success "系统服务已停止并删除"
    fi

    # 执行模式特定的卸载逻辑
    local detected_mode
    detected_mode=$(detect_deploy_mode)

    log_info "检测到部署模式: $detected_mode"
    echo ""

    case "$detected_mode" in
        docker)
            uninstall_agent_docker
            ;;
        native)
            uninstall_agent_native
            ;;
        unknown)
            log_warning "无法自动检测部署模式，请选择卸载方式："
            echo ""
            echo "1. Docker 模式卸载"
            echo "2. 宿主机模式卸载"
            echo ""
            local mode_choice
            mode_choice=$(read_from_tty "请选择 [1-2]: ")

            case $mode_choice in
                1)
                    log_info "使用 Docker 模式卸载"
                    uninstall_agent_docker
                    ;;
                2)
                    log_info "使用宿主机模式卸载"
                    uninstall_agent_native
                    ;;
                *)
                    log_error "无效选项"
                    return 1
                    ;;
            esac
            ;;
    esac

    # 通用清理：删除应用目录
    echo ""
    log_info "删除应用目录..."
    if [[ -d "$APP_DIR" ]]; then
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            rm -rf "$APP_DIR"
        else
            sudo rm -rf "$APP_DIR"
        fi
        log_success "应用目录已删除: $APP_DIR"
    else
        log_info "应用目录不存在，跳过删除"
    fi

    # Docker 模式额外清理
    if [[ "$detected_mode" == "docker" ]]; then
        # 清理防火墙规则（仅 Docker 模式配置了防火墙）
        log_info "清理防火墙规则..."
        if command -v ufw >/dev/null 2>&1; then
            if [[ -n "$AGENT_PORT" ]]; then
                sudo ufw --force delete allow "$AGENT_PORT"/tcp 2>/dev/null || true
            else
                sudo ufw --force delete allow 3002/tcp 2>/dev/null || true
            fi
            log_success "UFW防火墙规则已清理"
        elif command -v firewall-cmd >/dev/null 2>&1; then
            if [[ -n "$AGENT_PORT" ]]; then
                sudo firewall-cmd --permanent --remove-port="$AGENT_PORT"/tcp 2>/dev/null || true
            else
                sudo firewall-cmd --permanent --remove-port=3002/tcp 2>/dev/null || true
            fi
            sudo firewall-cmd --reload 2>/dev/null || true
            log_success "Firewalld防火墙规则已清理"
        fi

        # 清理 Docker 资源
        log_info "清理 Docker 资源..."
        docker system prune -f 2>/dev/null || true
        log_success "Docker 资源清理完成"

        log_info "Docker 环境已保留（可能被其他应用使用）"
    fi

    # 显示卸载完成信息
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Agent 卸载完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    log_success "SsalgTen Agent 已完全卸载"
    echo ""

    if [[ "$detected_mode" == "docker" ]]; then
        echo "已删除的组件："
        echo "  ✓ Docker 容器和镜像"
        echo "  ✓ 应用目录 /opt/ssalgten-agent"
        echo "  ✓ Docker Compose 配置"
        echo "  ✓ 防火墙规则（Agent 端口）"
        echo "  ✓ 相关配置文件"
        echo ""
        echo "已保留的组件："
        echo "  ○ Docker 环境（可能被其他应用使用）"
    else
        echo "已删除的组件："
        echo "  ✓ 应用目录 /opt/ssalgten-agent"
        echo "  ✓ 系统服务 ssalgten-agent.service"
        echo "  ✓ Node.js 依赖"
        echo "  ✓ 相关配置文件"
    fi

    echo ""
    echo "如需重新安装，请重新运行安装脚本。"
    echo ""
}

# 更新脚本本身
update_script() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    更新安装脚本到最新版本"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    log_warning "此操作将从 GitHub 下载最新的安装脚本并替换当前脚本"
    echo ""

    confirm=$(read_from_tty "确认更新脚本？[y/N]: ")
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "已取消操作"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    log_info "下载最新脚本..."

    # 确定脚本路径
    SCRIPT_PATH="${BASH_SOURCE[0]}"
    if [[ ! -f "$SCRIPT_PATH" ]]; then
        SCRIPT_PATH="$0"
    fi

    # 如果是从管道运行的，创建临时文件
    if [[ "$SCRIPT_PATH" == "/dev/fd/"* ]] || [[ "$SCRIPT_PATH" == "bash" ]] || [[ "$SCRIPT_PATH" == "-bash" ]]; then
        SCRIPT_PATH="/tmp/install-agent.sh"
        log_info "检测到从管道运行，将保存到: $SCRIPT_PATH"
    fi

    # 备份当前脚本
    BACKUP_PATH="${SCRIPT_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    if [[ -f "$SCRIPT_PATH" ]]; then
        cp "$SCRIPT_PATH" "$BACKUP_PATH"
        log_info "已备份当前脚本到: $BACKUP_PATH"
    fi

    # 下载最新脚本
    TEMP_SCRIPT="/tmp/install-agent-latest-$$.sh"
    if curl -fsSL "https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh" -o "$TEMP_SCRIPT"; then
        # 验证下载的文件不为空
        if [[ -s "$TEMP_SCRIPT" ]]; then
            # 替换当前脚本
            mv "$TEMP_SCRIPT" "$SCRIPT_PATH"
            chmod +x "$SCRIPT_PATH"
            log_success "脚本更新成功！正在重新启动脚本..."
            echo ""
            sleep 1

            # 重新执行脚本
            exec bash "$SCRIPT_PATH"
        else
            log_error "下载的文件为空"
            rm -f "$TEMP_SCRIPT"
            read -p "按回车键返回主菜单..." -r
            return
        fi
    else
        log_error "下载失败"
        rm -f "$TEMP_SCRIPT"
        read -p "按回车键返回主菜单..." -r
        return
    fi
}

# 查看应用日志
view_logs() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    查看 Agent 应用日志"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    local APP_DIR="/opt/ssalgten-agent"

    # 检查 Agent 是否已安装
    if [ ! -d "$APP_DIR" ]; then
        log_error "未找到 Agent 安装目录: $APP_DIR"
        read -p "按回车键返回主菜单..." -r
        return
    fi

    # 检测部署模式
    local detected_mode
    detected_mode=$(detect_deploy_mode)

    echo "请选择要查看的日志："
    echo ""
    echo -e "${GREEN}1.${NC} 实时日志（跟踪模式）"
    echo -e "${BLUE}2.${NC} 最近日志（最后 100 行）"
    echo -e "${BLUE}3.${NC} 错误日志"
    echo -e "${YELLOW}4.${NC} systemd 服务日志"
    echo -e "${YELLOW}0.${NC} 返回主菜单"
    echo ""

    local choice
    choice=$(read_from_tty "请选择 [0-4]: ")

    case $choice in
        1)
            clear
            log_info "实时查看应用日志（按 Ctrl+C 退出）"
            echo ""
            sleep 1

            if [[ "$detected_mode" == "docker" ]]; then
                cd "$APP_DIR" && docker compose logs -f
            else
                tail -f "$APP_DIR/logs/stdout.log"
            fi
            ;;
        2)
            clear
            log_info "显示最近 100 行日志"
            echo ""

            if [[ "$detected_mode" == "docker" ]]; then
                cd "$APP_DIR" && docker compose logs --tail 100
            else
                if [ -f "$APP_DIR/logs/stdout.log" ]; then
                    tail -100 "$APP_DIR/logs/stdout.log"
                else
                    log_error "日志文件不存在: $APP_DIR/logs/stdout.log"
                fi
            fi

            echo ""
            read -p "按回车键返回..." -r
            ;;
        3)
            clear
            log_info "显示错误日志"
            echo ""

            if [[ "$detected_mode" == "docker" ]]; then
                cd "$APP_DIR" && docker compose logs --tail 100 | grep -i error
            else
                if [ -f "$APP_DIR/logs/stderr.log" ]; then
                    echo -e "${RED}=== stderr.log ===${NC}"
                    tail -100 "$APP_DIR/logs/stderr.log"
                    echo ""
                fi
                if [ -f "$APP_DIR/logs/stdout.log" ]; then
                    echo -e "${RED}=== stdout.log (包含 ERROR 的行) ===${NC}"
                    tail -200 "$APP_DIR/logs/stdout.log" | grep -i error
                fi
            fi

            echo ""
            read -p "按回车键返回..." -r
            ;;
        4)
            clear
            log_info "显示 systemd 服务日志（最近 50 行）"
            echo ""
            journalctl -u ssalgten-agent.service -n 50 --no-pager
            echo ""
            read -p "按回车键返回..." -r
            ;;
        0)
            return
            ;;
        *)
            log_error "无效选项"
            sleep 1
            view_logs
            ;;
    esac
}

# 显示主菜单
show_main_menu() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen Agent 管理工具"
    echo "========================================"
    echo -e "${NC}"
    echo ""

    # 如果检测到预置参数，显示特殊提示
    if [[ -n "${MASTER_URL:-}" && -n "${AGENT_API_KEY:-}" ]]; then
        echo -e "${GREEN}🔗 已检测到预置连接参数${NC}"
        echo "   服务器地址: ${MASTER_URL}"
        echo "   API密钥: ${AGENT_API_KEY:0:8}..."
        echo ""
    fi

    echo "请选择要执行的操作："
    echo ""
    if [[ -n "${MASTER_URL:-}" && -n "${AGENT_API_KEY:-}" ]]; then
        echo -e "${GREEN}1.${NC} 一键安装监控节点 ${GREEN}(无需输入参数)${NC}"
    else
        echo -e "${GREEN}1.${NC} 安装监控节点"
    fi
    echo -e "${BLUE}2.${NC} 更新 Agent 版本"
    echo -e "${BLUE}3.${NC} 更新心跳配置"
    echo -e "${GREEN}4.${NC} 重启 Agent 服务"
    echo -e "${CYAN}5.${NC} 查看应用日志"
    echo -e "${CYAN}6.${NC} 更新脚本本身"
    echo -e "${RED}7.${NC} 卸载监控节点"
    echo -e "${YELLOW}0.${NC} 退出"
    echo ""
}

show_deployment_menu() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    选择部署方式"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    echo "请选择 Agent 部署方式："
    echo ""
    echo -e "${GREEN}1.${NC} Docker 部署 ${GREEN}[推荐]${NC}"
    echo "   - 隔离性好，易于管理"
    echo "   - 自动处理依赖"
    echo "   - 支持一键更新"
    echo ""
    echo -e "${BLUE}2.${NC} 宿主机部署"
    echo "   - 直接运行在系统上"
    echo "   - 性能开销更小"
    echo "   - 需要手动安装 Node.js"
    echo ""
    echo -e "${YELLOW}0.${NC} 返回主菜单"
    echo ""
}

# 从终端读取输入（解决管道输入问题）
read_from_tty() {
    local prompt="$1"
    local response=""
    
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

# ============================================
# 宿主机部署相关函数
# ============================================

run_root() {
    if [[ $EUID -eq 0 ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

run_as_agent() {
    local cmd="$*"
    if [[ $EUID -eq 0 ]]; then
        su -s /bin/bash "$AGENT_USER" -c "$cmd"
    else
        sudo -u "$AGENT_USER" bash -c "$cmd"
    fi
}

detect_package_manager() {
    if command -v apt-get >/dev/null 2>&1; then
        PKG_MANAGER="apt"
    elif command -v dnf >/dev/null 2>&1; then
        PKG_MANAGER="dnf"
    elif command -v yum >/dev/null 2>&1; then
        PKG_MANAGER="yum"
    else
        log_error "不支持的发行版，请使用 Debian/Ubuntu 或 RHEL/CentOS/Fedora"
        exit 1
    fi
}

update_package_index() {
    log_info "更新软件包索引..."
    case "$PKG_MANAGER" in
        apt)
            DEBIAN_FRONTEND=noninteractive run_root apt-get update -y >/dev/null 2>&1
            ;;
        yum|dnf)
            run_root "$PKG_MANAGER" makecache -y >/dev/null 2>&1
            ;;
    esac
}

install_packages() {
    local packages=("$@")
    case "$PKG_MANAGER" in
        apt)
            NEEDRESTART_MODE=a NEEDRESTART_SUSPEND=1 DEBIAN_FRONTEND=noninteractive \
                run_root apt-get install -y \
                -o Dpkg::Options::="--force-confdef" \
                -o Dpkg::Options::="--force-confold" \
                "${packages[@]}"
            ;;
        yum|dnf)
            run_root "$PKG_MANAGER" install -y "${packages[@]}"
            ;;
    esac
}

compare_node_version() {
    local version
    version=$(node -v 2>/dev/null | sed 's/^v//')
    local major=${version%%.*}
    [[ -n "${major}" && "$major" -ge "$NODE_REQUIRED_MAJOR" ]]
}

install_node() {
    log_info "安装 Node.js (>= ${NODE_REQUIRED_MAJOR})"
    case "$PKG_MANAGER" in
        apt)
            run_root bash -c "curl -fsSL https://deb.nodesource.com/setup_${NODE_REQUIRED_MAJOR}.x | bash -"
            NEEDRESTART_MODE=a NEEDRESTART_SUSPEND=1 DEBIAN_FRONTEND=noninteractive \
                run_root apt-get install -y \
                -o Dpkg::Options::="--force-confdef" \
                -o Dpkg::Options::="--force-confold" \
                nodejs
            ;;
        yum|dnf)
            run_root bash -c "curl -fsSL https://rpm.nodesource.com/setup_${NODE_REQUIRED_MAJOR}.x | bash -"
            run_root "$PKG_MANAGER" install -y nodejs
            ;;
    esac
}

ensure_node() {
    if command -v node >/dev/null 2>&1; then
        if compare_node_version; then
            log_success "Node.js 版本正常 ($(node -v))"
            return
        else
            log_warning "Node.js 版本过旧 ($(node -v))，正在安装新版本"
        fi
    else
        log_info "未找到 Node.js，正在安装"
    fi
    install_node
}

ensure_native_dependencies() {
    detect_package_manager
    update_package_index
    log_info "安装必需的依赖项..."
    case "$PKG_MANAGER" in
        apt)
            install_packages curl wget git rsync tar build-essential
            ;;
        yum|dnf)
            install_packages curl wget git rsync tar gcc gcc-c++ make
            ;;
    esac
    ensure_node
}

ensure_agent_user() {
    if ! id "$AGENT_USER" >/dev/null 2>&1; then
        log_info "创建用户 $AGENT_USER"
        run_root useradd -m -s /bin/bash "$AGENT_USER"
    fi
}

sync_agent_source_native() {
    local temp_dir
    temp_dir=$(mktemp -d)
    log_info "下载 Agent 源代码..."

    if ! git clone --depth 1 "https://github.com/lonelyrower/SsalgTen.git" "$temp_dir/repo" 2>&1 | tee /tmp/git-clone.log | grep -q "Cloning"; then
        log_error "Git clone 失败，请检查网络连接"
        cat /tmp/git-clone.log
        rm -rf "$temp_dir"
        exit 1
    fi

    run_root mkdir -p "$APP_DIR"
    run_root mkdir -p "$APP_DIR/logs"

    local env_backup=""
    if [[ -f "$APP_DIR/.env" ]]; then
        env_backup=$(mktemp)
        run_root cp "$APP_DIR/.env" "$env_backup"
        log_info "备份现有 .env 文件"
    fi

    log_info "同步 Agent 文件..."
    run_root rsync -a --delete \
        --exclude ".git" \
        --exclude "logs" \
        --exclude "node_modules" \
        --exclude "dist" \
        --exclude ".env" \
        "$temp_dir/repo/agent/" "$APP_DIR/"

    if [[ -n "$env_backup" ]]; then
        run_root mv "$env_backup" "$APP_DIR/.env"
        log_success "已恢复 .env 配置"
    fi

    run_root chown -R "$AGENT_USER":"$AGENT_USER" "$APP_DIR"
    rm -rf "$temp_dir"
    log_success "Agent 源代码已同步"
}

install_node_modules() {
    log_info "安装生产依赖（可能需要几分钟）..."

    if [[ -f "$APP_DIR/package-lock.json" ]]; then
        if run_as_agent "cd '$APP_DIR' && npm ci --omit=dev" 2>&1 | tee /tmp/npm-install.log; then
            log_success "依赖已通过 npm ci 安装"
        else
            log_warning "npm ci 失败，尝试 npm install..."
            run_as_agent "cd '$APP_DIR' && npm install --production"
        fi
    else
        run_as_agent "cd '$APP_DIR' && npm install --production"
        log_success "依赖已通过 npm install 安装"
    fi

    log_info "安装构建工具..."
    run_as_agent "cd '$APP_DIR' && npm install --no-save typescript@latest"

    log_info "构建 TypeScript 项目..."
    if run_as_agent "cd '$APP_DIR' && npm run build" 2>&1 | tee /tmp/npm-build.log; then
        log_success "构建完成"
    else
        log_error "构建失败。查看 /tmp/npm-build.log 了解详情"
        exit 1
    fi
}

setup_systemd_service() {
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    local node_path

    # Dynamically find node path
    if [[ $EUID -eq 0 ]]; then
        node_path=$(which node)
    else
        node_path=$(sudo which node || which node)
    fi

    if [[ -z "$node_path" ]]; then
        log_error "无法确定 node 路径"
        exit 1
    fi

    log_info "配置 systemd 服务 (Node: $node_path)"
    run_root tee "$service_file" >/dev/null <<EOF
[Unit]
Description=SsalgTen Agent (宿主机模式)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${AGENT_USER}
Group=${AGENT_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production

ExecStart=${node_path} ${APP_DIR}/dist/app.js

# Logging
StandardOutput=append:${APP_DIR}/logs/stdout.log
StandardError=append:${APP_DIR}/logs/stderr.log
SyslogIdentifier=${SERVICE_NAME}

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/logs ${APP_DIR}/.env

# Network diagnostic capabilities (for ping, traceroute, etc.)
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN

# Resource limits
LimitNOFILE=65535
TasksMax=4096

[Install]
WantedBy=multi-user.target
EOF

    run_root systemctl daemon-reload
    run_root systemctl enable "${SERVICE_NAME}"
    log_success "服务已配置并启用"
}

verify_native_installation() {
    log_info "启动服务..."
    run_root systemctl restart "${SERVICE_NAME}"

    log_info "等待服务启动（10秒）..."
    sleep 5

    local retry=0
    local max_retries=3

    while [[ $retry -lt $max_retries ]]; do
        if systemctl is-active --quiet "${SERVICE_NAME}"; then
            log_success "Agent 运行成功"
            echo ""
            log_info "服务状态:"
            run_root systemctl status "${SERVICE_NAME}" --no-pager -l | head -n 15
            echo ""
            log_info "常用命令:"
            echo "  - 查看日志: journalctl -u ${SERVICE_NAME} -f"
            echo "  - 检查状态: systemctl status ${SERVICE_NAME}"
            echo "  - 重启服务: systemctl restart ${SERVICE_NAME}"
            echo "  - 查看最近日志: tail -f ${APP_DIR}/logs/stdout.log"
            return 0
        else
            retry=$((retry + 1))
            if [[ $retry -lt $max_retries ]]; then
                log_warning "服务尚未就绪，重试中 ($retry/$max_retries)..."
                sleep 3
            fi
        fi
    done

    log_error "Agent 服务启动失败"
    echo ""
    log_info "最近的日志:"
    run_root journalctl -u "${SERVICE_NAME}" -n 30 --no-pager || true
    echo ""
    log_info "查看完整日志: journalctl -u ${SERVICE_NAME} -f"
    return 1
}

create_env_config_native() {
    log_info "创建环境配置文件 (宿主机模式)..."

    run_root tee "$APP_DIR/.env" >/dev/null <<EOF
# SsalgTen Agent 配置文件 (宿主机模式)
# 自动生成于 $(date)

# Agent基本信息
AGENT_ID=${AGENT_ID}
NODE_NAME=${NODE_NAME}

# 服务器连接
MASTER_URL=${MASTER_URL}
AGENT_API_KEY=${AGENT_API_KEY}

# 地理位置信息
NODE_COUNTRY=${NODE_COUNTRY}
NODE_CITY=${NODE_CITY}
NODE_PROVIDER=${NODE_PROVIDER}
NODE_LATITUDE=${NODE_LATITUDE}
NODE_LONGITUDE=${NODE_LONGITUDE}

# 服务配置
PORT=${AGENT_PORT}
NODE_ENV=production

# 监控配置
HEARTBEAT_INTERVAL=300000
LOG_LEVEL=info
ENABLE_DEBUG=false

# 系统配置
TZ=Asia/Shanghai

# 服务检测配置（自动检测 Xray, Nginx, Docker 等服务）
SERVICE_DETECTION_ENABLED=true
SERVICE_SCAN_INTERVAL_HOURS=12

# 可选：Xray 自检（启用后将检测本机端口监听/TLS握手）
# XRAY_CHECK_PORT=443
# XRAY_CHECK_HOST=127.0.0.1
# XRAY_CHECK_TLS=true
# XRAY_CHECK_SNI=your.domain.com

# 可选：SSH 暴力破解监控（读取 /var/log/auth.log 或 /var/log/secure）
# SSH_MONITOR_ENABLED=false
# SSH_MONITOR_WINDOW_MIN=10
# SSH_MONITOR_THRESHOLD=10
EOF

    run_root chown "$AGENT_USER":"$AGENT_USER" "$APP_DIR/.env"
    run_root chmod 600 "$APP_DIR/.env"
    log_success "环境配置文件已创建: $APP_DIR/.env"
}

install_agent_native() {
    log_info "使用宿主机部署模式安装 Agent"
    ensure_native_dependencies
    ensure_agent_user
    sync_agent_source_native
    create_env_config_native
    install_node_modules
    setup_systemd_service
    verify_native_installation
}

# ============================================
# 主安装流程
# ============================================

main() {
    # 处理特殊命令行参数
    # 解析所有参数
    parse_arguments "$@"
    
    # 检查是否是卸载模式
    if [[ "${UNINSTALL_MODE:-false}" == "true" ]]; then
        uninstall_agent
        return
    fi
    
    case "${1:-}" in
        --update)
            log_info "强制更新脚本..."
            update_script
            return
            ;;
        --no-update-check)
            log_info "跳过更新检查"
            show_welcome
            ;;
        *)
            # 检查是否有命令行参数（自动配置模式）
            if [[ -n "${MASTER_URL:-}" || -n "${AGENT_API_KEY:-}" || "${AUTO_CONFIG:-false}" == "true" ]]; then
                # 有参数时，先显示欢迎和更新检查
                show_welcome
                check_script_update

                # 如果没有指定部署模式，提示用户选择
                if [[ "$DEPLOY_MODE_SET" != "true" ]]; then
                    log_info "请选择部署方式..."
                    show_deployment_menu
                    while true; do
                        deploy_choice=$(read_from_tty "请选择部署方式 [1-2]: ")
                        case $deploy_choice in
                            1)
                                DEPLOY_MODE="docker"
                                log_info "选择 Docker 部署模式"
                                break
                                ;;
                            2)
                                DEPLOY_MODE="native"
                                log_info "选择宿主机部署模式"
                                break
                                ;;
                            *)
                                echo -e "${RED}无效选项，请输入 1 或 2${NC}"
                                ;;
                        esac
                    done
                fi
            else
                # 无参数时显示交互式菜单
                show_main_menu

                while true; do
                    choice=$(read_from_tty "请输入选项 [0-7]: ")
                    case $choice in
                        1)
                            log_info "开始安装监控节点..."
                            # 如果已经有预置参数，直接使用自动配置模式
                            if [[ -n "${MASTER_URL:-}" && -n "${AGENT_API_KEY:-}" ]]; then
                                log_info "检测到预置参数，使用自动配置模式"
                                AUTO_CONFIG=true
                                FORCE_ROOT=true
                            fi

                            # 选择部署方式
                            show_deployment_menu
                            while true; do
                                deploy_choice=$(read_from_tty "请选择部署方式 [0-2]: ")
                                case $deploy_choice in
                                    1)
                                        DEPLOY_MODE="docker"
                                        log_info "选择 Docker 部署模式"
                                        break
                                        ;;
                                    2)
                                        DEPLOY_MODE="native"
                                        log_info "选择宿主机部署模式"
                                        break
                                        ;;
                                    0)
                                        # 返回主菜单
                                        continue 2
                                        ;;
                                    *)
                                        echo -e "${RED}无效选项，请输入 0-2${NC}"
                                        show_deployment_menu
                                        ;;
                                esac
                            done

                            show_welcome
                            check_script_update
                            break
                            ;;
                        2)
                            update_agent
                            exit 0
                            ;;
                        3)
                            update_heartbeat_config
                            exit 0
                            ;;
                        4)
                            restart_agent
                            ;;
                        5)
                            view_logs
                            ;;
                        6)
                            update_script
                            ;;
                        7)
                            uninstall_agent
                            exit 0
                            ;;
                        0)
                            log_info "退出程序"
                            echo -e "${GREEN}感谢使用 SsalgTen Agent 管理工具！${NC}"
                            exit 0
                            ;;
                        *)
                            echo -e "${RED}无效选项，请输入 0-7${NC}"
                            ;;
                    esac
                done
            fi
            ;;
    esac
    
    # 检查用户权限
    if [[ $EUID -eq 0 ]]; then
        # 如果用户指定了--force-root或--auto-config，跳过提醒
        if [[ "${FORCE_ROOT:-false}" == "true" || "${AUTO_CONFIG:-false}" == "true" ]]; then
            log_info "使用root用户运行（已通过参数确认）"
            export RUNNING_AS_ROOT=true
        else
            log_warning "⚠️ 检测到root用户运行"
            echo ""
            echo -e "${YELLOW}安全提醒：${NC}"
            echo "- 使用root用户运行Agent存在安全风险"
            echo "- 建议创建专用用户： useradd -m -s /bin/bash agentuser"
            echo "- 然后切换用户运行： su - agentuser"
            echo ""
            echo -e "${CYAN}快速选项：${NC}"
            echo "- 回车继续使用root用户"
            echo "- 输入 'n' 取消安装"
            echo ""
            confirm_root=$(read_from_tty "继续使用root用户？ [Y/N] (回车默认选择 Y): ")
            confirm_root="${confirm_root:-y}"  # 默认为 y
            if [[ "$confirm_root" =~ ^[Nn] ]]; then
                log_info "已取消安装"
                echo ""
                echo -e "${GREEN}推荐操作步骤：${NC}"
                echo "1. useradd -m -s /bin/bash agentuser"
                echo "2. usermod -aG sudo agentuser"
                echo "3. su - agentuser"
                echo "4. 重新运行安装脚本"
                exit 0
            fi
            
            # 使用root用户时的特殊处理
            export RUNNING_AS_ROOT=true
            log_info "继续使用root用户部署Agent"
        fi
    else
        # 检查sudo权限
        if ! sudo -v >/dev/null 2>&1; then
            log_error "需要sudo权限来安装系统依赖"
            exit 1
        fi
    fi
    
    log_info "开始SsalgTen Agent安装流程..."

    check_system
    collect_node_info

    # 如果部署模式仍未设置，默认使用 docker
    if [[ -z "$DEPLOY_MODE" ]]; then
        log_warning "部署模式未设置，默认使用 Docker 模式"
        DEPLOY_MODE="docker"
    fi

    # 根据部署模式选择不同的安装流程
    if [[ "$DEPLOY_MODE" == "native" ]]; then
        # 宿主机部署模式
        install_agent_native
        log_success "🎉 SsalgTen Agent (宿主机模式) 安装完成！"
    else
        # Docker 部署模式（默认）
        install_system_dependencies
        install_docker
        install_docker_compose
        if ! ensure_kernel_ipv6_support; then
            log_error "无法启用宿主机 IPv6 参数，请检查系统设置后重试"
            exit 1
        fi
        if ! ensure_docker_ipv6_support; then
            log_error "Docker 未成功启用 IPv6，请检查 /etc/docker/daemon.json 后重试"
            exit 1
        fi
        create_app_directory
        download_agent_code
        create_docker_compose
        create_env_config
        create_dockerfile
        configure_firewall
        start_agent_service
        create_system_service
        verify_installation
        create_management_script
        show_installation_result
        log_success "🎉 SsalgTen Agent (Docker模式) 安装完成！"
    fi
    
    # 安装完成后直接退出，不需要用户手动确认
    exit 0
}

# 错误处理
trap 'log_error "安装过程中发生错误，请检查日志并重试"; exit 1' ERR

# 运行主函数
main "$@"
