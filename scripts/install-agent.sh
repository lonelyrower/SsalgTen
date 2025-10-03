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
SCRIPT_VERSION="1.1.0"
SCRIPT_URL="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh"
AGENT_VERSION="latest"

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
    echo "  自动化安装:"
    echo "    curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\"
    echo "      --auto-config \\"
    echo "      --master-url https://your-domain.com \\"
    echo "      --api-key your-api-key \\"
    echo "      [可选参数...]"
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
            apt install -y curl wget git gnupg lsb-release
        else
            sudo apt update
            sudo apt install -y curl wget git gnupg lsb-release
        fi
    elif command -v yum >/dev/null 2>&1; then
        log_info "检测到YUM包管理器 (CentOS/RHEL 7)"
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            yum update -y
            yum install -y curl wget git
        else
            sudo yum update -y
            sudo yum install -y curl wget git
        fi
    elif command -v dnf >/dev/null 2>&1; then
        log_info "检测到DNF包管理器 (CentOS/RHEL 8+/Fedora)"
        if [[ "$RUNNING_AS_ROOT" == "true" ]]; then
            dnf update -y
            dnf install -y curl wget git
        else
            sudo dnf update -y
            sudo dnf install -y curl wget git
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
    local methods=(
        "git clone https://github.com/lonelyrower/SsalgTen.git ."
        "git clone https://github.com.cnpmjs.org/lonelyrower/SsalgTen.git ."
        "git clone https://hub.fastgit.xyz/lonelyrower/SsalgTen.git ."
    )
    
    cd $TEMP_DIR
    
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
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
ENABLE_DEBUG=false

# 系统配置
TZ=Asia/Shanghai

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
FROM node:18-alpine

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
Type=forking
Restart=always
RestartSec=10
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
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
    echo "  - 查看状态: cd $APP_DIR && docker_compose ps"
    echo "  - 查看日志: cd $APP_DIR && docker_compose logs -f"
    echo "  - 重启服务: cd $APP_DIR && docker_compose restart"
    echo "  - 停止服务: cd $APP_DIR && docker_compose down"
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
    echo "3. 如有问题，查看日志: docker_compose logs -f"
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

# 卸载Agent
uninstall_agent() {
    clear
    echo -e "${CYAN}"
    echo "========================================"
    echo "    SsalgTen Agent 卸载程序"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    
    log_warning "⚠️ 准备卸载SsalgTen Agent"
    echo ""
    echo "此操作将删除："
    echo "  - Agent Docker容器和镜像"
    echo "  - 应用目录：/opt/ssalgten-agent"
    echo "  - 系统服务：ssalgten-agent.service"
    echo "  - 相关配置文件"
    echo ""
    
    # 确认卸载
    confirm_uninstall=$(read_from_tty "是否确认卸载？这个操作不可逆！[Y/N] (回车默认选择 N): ")
    confirm_uninstall="${confirm_uninstall:-n}"  # 默认为 n，卸载操作更加谨慎
    if [[ "$confirm_uninstall" != "y" && "$confirm_uninstall" != "Y" ]]; then
        log_info "已取消卸载"
        exit 0
    fi
    
    log_info "开始卸载SsalgTen Agent..."
    
    # 设置应用目录
    APP_DIR="/opt/ssalgten-agent"
    
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
    
    # 3. 删除应用目录
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
    
    # 4. 清理Docker资源
    log_info "清理Docker资源..."
    docker system prune -f 2>/dev/null || true
    log_success "Docker资源清理完成"
    
    # 5. 删除防火墙规则（安装时添加的规则，卸载时自动清理）
    log_info "清理防火墙规则..."
    if command -v ufw >/dev/null 2>&1; then
        # 移除安装时添加的端口规则（默认 3002）
        if [[ -n "$AGENT_PORT" ]]; then
            sudo ufw --force delete allow "$AGENT_PORT"/tcp 2>/dev/null || true
            log_info "已移除端口 $AGENT_PORT 的防火墙规则"
        else
            sudo ufw --force delete allow 3002/tcp 2>/dev/null || true
            log_info "已移除端口 3002 的防火墙规则"
        fi
        log_success "UFW防火墙规则已清理"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # 移除安装时添加的端口规则（默认 3002）
        if [[ -n "$AGENT_PORT" ]]; then
            sudo firewall-cmd --permanent --remove-port="$AGENT_PORT"/tcp 2>/dev/null || true
            log_info "已移除端口 $AGENT_PORT 的防火墙规则"
        else
            sudo firewall-cmd --permanent --remove-port=3002/tcp 2>/dev/null || true
            log_info "已移除端口 3002 的防火墙规则"
        fi
        sudo firewall-cmd --reload 2>/dev/null || true
        log_success "Firewalld防火墙规则已清理"
    else
        log_info "未检测到防火墙管理工具，请手动检查防火墙规则"
    fi
    
    # 6. 保留Docker环境（可能被其他服务使用，不应该删除）
    log_info "Docker环境已保留（可能被其他应用使用）"
    log_info "如需手动卸载Docker，请参考官方文档"
    
    # 显示卸载完成信息
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  🗑️ Agent卸载完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    log_success "SsalgTen Agent已完全卸载"
    echo ""
    echo "已删除的组件："
    echo "  ✓ Docker容器和镜像"
    echo "  ✓ 应用目录 /opt/ssalgten-agent"
    echo "  ✓ 系统服务 ssalgten-agent.service"
    echo "  ✓ 防火墙规则（Agent端口）"
    echo "  ✓ 相关配置文件"
    echo ""
    echo "已保留的组件："
    echo "  ○ Docker环境（可能被其他应用使用）"
    echo ""
    echo "如需重新安装，请重新运行安装脚本。"
    echo ""
}
    echo ""
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
    echo -e "${RED}2.${NC} 卸载监控节点"
    echo -e "${YELLOW}0.${NC} 退出"
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

# 主安装流程
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
                # 有参数时直接执行相应操作
                show_welcome
                check_script_update
            else
                # 无参数时显示交互式菜单
                show_main_menu
                
                while true; do
                    choice=$(read_from_tty "请输入选项 [0-2]: ")
                    case $choice in
                        1)
                            log_info "开始安装监控节点..."
                            # 如果已经有预置参数，直接使用自动配置模式
                            if [[ -n "${MASTER_URL:-}" && -n "${AGENT_API_KEY:-}" ]]; then
                                log_info "检测到预置参数，使用自动配置模式"
                                AUTO_CONFIG=true
                                FORCE_ROOT=true
                            fi
                            show_welcome
                            check_script_update
                            break
                            ;;
                        2)
                            log_info "开始卸载监控节点..."
                            uninstall_agent
                            return
                            ;;
                        0)
                            log_info "退出程序"
                            echo -e "${GREEN}感谢使用 SsalgTen Agent 管理工具！${NC}"
                            exit 0
                            ;;
                        *)
                            echo -e "${RED}无效选项，请输入 1、2 或 0${NC}"
                            continue
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
    install_system_dependencies
    install_docker
    install_docker_compose
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
    
    log_success "🎉 SsalgTen Agent安装完成！"
    
    # 安装完成后直接退出，不需要用户手动确认
    exit 0
}

# 错误处理
trap 'log_error "安装过程中发生错误，请检查日志并重试"; exit 1' ERR

# 运行主函数
main "$@"
