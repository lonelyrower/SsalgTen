#!/bin/bash

# SsalgTen 节点管理工具
# 用于批量管理多个Agent节点

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置文件
CONFIG_FILE="$HOME/.ssalgten/nodes.conf"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# 初始化配置目录
init_config() {
    if [[ ! -d "$HOME/.ssalgten" ]]; then
        mkdir -p "$HOME/.ssalgten"
        log_info "创建配置目录: $HOME/.ssalgten"
    fi
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        cat > "$CONFIG_FILE" << 'EOF'
# SsalgTen 节点配置文件
# 格式: NODE_NAME|IP_ADDRESS|SSH_USER|SSH_PORT|STATUS|LAST_CHECK
# 示例: tokyo-01|1.2.3.4|root|22|active|2023-01-01_12:00:00
EOF
        log_info "创建配置文件: $CONFIG_FILE"
    fi
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
SsalgTen 节点管理工具

用法: node-manager.sh [命令] [选项]

命令:
  add         添加新节点
  remove      删除节点
  list        列出所有节点
  status      检查节点状态
  deploy      部署Agent到节点
  update      更新节点Agent
  restart     重启节点Agent
  logs        查看节点日志
  batch       批量操作
  monitor     监控所有节点
  
选项:
  -n, --node NODE_NAME    指定节点名称
  -h, --host HOST         指定主机地址
  -u, --user USER         SSH用户名
  -p, --port PORT         SSH端口 (默认22)
  -k, --key KEY_FILE      SSH私钥文件
  -a, --all               所有节点
  -f, --force             强制操作
  -v, --verbose           详细输出
  
示例:
  node-manager.sh add -n tokyo-01 -h 1.2.3.4 -u root
  node-manager.sh deploy -n tokyo-01
  node-manager.sh status --all
  node-manager.sh batch restart -a

EOF
}

# 添加节点
add_node() {
    local node_name="$1"
    local host="$2" 
    local user="${3:-root}"
    local port="${4:-22}"
    
    if [[ -z "$node_name" || -z "$host" ]]; then
        log_error "请指定节点名称和主机地址"
        return 1
    fi
    
    # 检查节点是否已存在
    if grep -q "^${node_name}|" "$CONFIG_FILE" 2>/dev/null; then
        log_error "节点 $node_name 已存在"
        return 1
    fi
    
    # 测试SSH连接
    log_info "测试SSH连接 $user@$host:$port..."
    if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p "$port" "$user@$host" "echo 'SSH连接成功'" >/dev/null 2>&1; then
        log_success "SSH连接测试成功"
    else
        log_error "SSH连接失败，请检查主机地址和凭据"
        return 1
    fi
    
    # 添加到配置文件
    echo "${node_name}|${host}|${user}|${port}|inactive|never" >> "$CONFIG_FILE"
    log_success "节点 $node_name 添加成功"
}

# 删除节点
remove_node() {
    local node_name="$1"
    
    if [[ -z "$node_name" ]]; then
        log_error "请指定节点名称"
        return 1
    fi
    
    if ! grep -q "^${node_name}|" "$CONFIG_FILE" 2>/dev/null; then
        log_error "节点 $node_name 不存在"
        return 1
    fi
    
    # 备份配置文件
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"
    
    # 删除节点
    grep -v "^${node_name}|" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    log_success "节点 $node_name 删除成功"
}

# 列出所有节点
list_nodes() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_warning "配置文件不存在"
        return 1
    fi
    
    echo ""
    echo -e "${CYAN}节点列表${NC}"
    echo "========================================================"
    printf "%-15s %-15s %-10s %-6s %-10s %-20s\n" "节点名称" "IP地址" "SSH用户" "端口" "状态" "最后检查"
    echo "--------------------------------------------------------"
    
    while IFS='|' read -r name ip user port status last_check; do
        if [[ "$name" =~ ^#.*$ ]] || [[ -z "$name" ]]; then
            continue
        fi
        
        # 状态颜色
        case "$status" in
            "active") status_color="${GREEN}$status${NC}" ;;
            "inactive") status_color="${RED}$status${NC}" ;;
            *) status_color="${YELLOW}$status${NC}" ;;
        esac
        
        printf "%-15s %-15s %-10s %-6s %-18s %-20s\n" "$name" "$ip" "$user" "$port" "$status_color" "$last_check"
    done < "$CONFIG_FILE"
    
    echo ""
}

# 检查单个节点状态
check_node_status() {
    local node_name="$1"
    local verbose="${2:-false}"
    
    local node_info=$(grep "^${node_name}|" "$CONFIG_FILE" 2>/dev/null)
    if [[ -z "$node_info" ]]; then
        log_error "节点 $node_name 不存在"
        return 1
    fi
    
    IFS='|' read -r name ip user port status last_check <<< "$node_info"
    
    if [[ "$verbose" == "true" ]]; then
        log_info "检查节点 $node_name ($ip)..."
    fi
    
    # 检查SSH连接
    if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" "exit" >/dev/null 2>&1; then
        update_node_status "$node_name" "ssh_failed"
        return 1
    fi
    
    # 检查Agent服务
    local agent_status=$(ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" \
        "cd /opt/ssalgten-agent && docker_compose ps -q | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo 'not_running'")
    
    if [[ "$agent_status" == "running" ]]; then
        # 检查健康状态
        local health_check=$(ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" \
            "curl -f http://localhost:3002/health 2>/dev/null && echo 'healthy' || echo 'unhealthy'")
        
        if [[ "$health_check" == "healthy" ]]; then
            update_node_status "$node_name" "active"
            if [[ "$verbose" == "true" ]]; then
                log_success "节点 $node_name 状态正常"
            fi
            return 0
        else
            update_node_status "$node_name" "unhealthy"
            if [[ "$verbose" == "true" ]]; then
                log_warning "节点 $node_name Agent不健康"
            fi
            return 1
        fi
    else
        update_node_status "$node_name" "agent_down"
        if [[ "$verbose" == "true" ]]; then
            log_warning "节点 $node_name Agent未运行"
        fi
        return 1
    fi
}

# 更新节点状态
update_node_status() {
    local node_name="$1"
    local new_status="$2"
    local timestamp=$(date '+%Y-%m-%d_%H:%M:%S')
    
    # 备份配置文件
    cp "$CONFIG_FILE" "${CONFIG_FILE}.tmp"
    
    # 更新状态
    while IFS='|' read -r name ip user port status last_check; do
        if [[ "$name" == "$node_name" ]]; then
            echo "${name}|${ip}|${user}|${port}|${new_status}|${timestamp}"
        else
            echo "${name}|${ip}|${user}|${port}|${status}|${last_check}"
        fi
    done < "${CONFIG_FILE}.tmp" > "$CONFIG_FILE"
    
    rm "${CONFIG_FILE}.tmp"
}

# 批量检查节点状态
check_all_nodes_status() {
    log_info "检查所有节点状态..."
    
    local active_count=0
    local total_count=0
    
    while IFS='|' read -r name ip user port status last_check; do
        if [[ "$name" =~ ^#.*$ ]] || [[ -z "$name" ]]; then
            continue
        fi
        
        total_count=$((total_count + 1))
        
        if check_node_status "$name" "false"; then
            active_count=$((active_count + 1))
            echo -e "  ${GREEN}✓${NC} $name ($ip) - 正常"
        else
            echo -e "  ${RED}✗${NC} $name ($ip) - 异常"
        fi
    done < "$CONFIG_FILE"
    
    echo ""
    log_info "状态汇总: $active_count/$total_count 节点正常"
}

# 部署Agent到节点
deploy_agent_to_node() {
    local node_name="$1"
    local force="${2:-false}"
    
    local node_info=$(grep "^${node_name}|" "$CONFIG_FILE" 2>/dev/null)
    if [[ -z "$node_info" ]]; then
        log_error "节点 $node_name 不存在"
        return 1
    fi
    
    IFS='|' read -r name ip user port status last_check <<< "$node_info"
    
    log_info "部署Agent到节点 $node_name ($ip)..."
    
    # 上传安装脚本
    if ! scp -P "$port" -o StrictHostKeyChecking=no "$SCRIPT_DIR/install-agent.sh" "$user@$ip:/tmp/"; then
        log_error "上传安装脚本失败"
        return 1
    fi
    
    # 执行安装脚本
    log_info "执行远程安装..."
    if ssh -o ConnectTimeout=30 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" \
        "chmod +x /tmp/install-agent.sh && /tmp/install-agent.sh"; then
        log_success "Agent部署成功到节点 $node_name"
        update_node_status "$node_name" "deployed"
    else
        log_error "Agent部署失败到节点 $node_name"
        return 1
    fi
}

# 重启节点Agent
restart_node_agent() {
    local node_name="$1"
    
    local node_info=$(grep "^${node_name}|" "$CONFIG_FILE" 2>/dev/null)
    if [[ -z "$node_info" ]]; then
        log_error "节点 $node_name 不存在"
        return 1
    fi
    
    IFS='|' read -r name ip user port status last_check <<< "$node_info"
    
    log_info "重启节点 $node_name Agent..."
    
    if ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" \
        "cd /opt/ssalgten-agent && docker_compose restart"; then
        log_success "节点 $node_name Agent重启成功"
        sleep 5
        check_node_status "$node_name" "true"
    else
        log_error "节点 $node_name Agent重启失败"
        return 1
    fi
}

# 查看节点日志
view_node_logs() {
    local node_name="$1"
    local lines="${2:-50}"
    
    local node_info=$(grep "^${node_name}|" "$CONFIG_FILE" 2>/dev/null)
    if [[ -z "$node_info" ]]; then
        log_error "节点 $node_name 不存在"
        return 1
    fi
    
    IFS='|' read -r name ip user port status last_check <<< "$node_info"
    
    log_info "查看节点 $node_name 日志 (最近${lines}行)..."
    echo ""
    
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p "$port" "$user@$ip" \
        "cd /opt/ssalgten-agent && docker_compose logs --tail=$lines -t"
}

# 批量操作
batch_operation() {
    local operation="$1"
    local all_nodes="${2:-false}"
    local specific_nodes=("${@:3}")
    
    log_info "执行批量操作: $operation"
    
    local nodes_to_process=()
    
    if [[ "$all_nodes" == "true" ]]; then
        # 处理所有节点
        while IFS='|' read -r name ip user port status last_check; do
            if [[ "$name" =~ ^#.*$ ]] || [[ -z "$name" ]]; then
                continue
            fi
            nodes_to_process+=("$name")
        done < "$CONFIG_FILE"
    else
        # 处理指定节点
        nodes_to_process=("${specific_nodes[@]}")
    fi
    
    if [[ ${#nodes_to_process[@]} -eq 0 ]]; then
        log_error "没有指定要处理的节点"
        return 1
    fi
    
    log_info "将对以下节点执行 $operation 操作: ${nodes_to_process[*]}"
    read -p "确认继续？ (y/n): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "操作已取消"
        return 0
    fi
    
    local success_count=0
    local fail_count=0
    
    for node in "${nodes_to_process[@]}"; do
        echo ""
        log_info "处理节点: $node"
        
        case "$operation" in
            "restart")
                if restart_node_agent "$node"; then
                    success_count=$((success_count + 1))
                else
                    fail_count=$((fail_count + 1))
                fi
                ;;
            "status")
                if check_node_status "$node" "true"; then
                    success_count=$((success_count + 1))
                else
                    fail_count=$((fail_count + 1))
                fi
                ;;
            "deploy")
                if deploy_agent_to_node "$node"; then
                    success_count=$((success_count + 1))
                else
                    fail_count=$((fail_count + 1))
                fi
                ;;
            *)
                log_error "不支持的批量操作: $operation"
                return 1
                ;;
        esac
        
        sleep 2  # 避免过快操作
    done
    
    echo ""
    log_info "批量操作完成: 成功 $success_count, 失败 $fail_count"
}

# 监控模式
monitor_mode() {
    log_info "进入监控模式 (按 Ctrl+C 退出)"
    
    while true; do
        clear
        echo -e "${CYAN}SsalgTen 节点实时监控 - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        echo "========================================================"
        
        local active_count=0
        local total_count=0
        
        printf "%-15s %-15s %-10s %-20s\n" "节点名称" "IP地址" "状态" "最后更新"
        echo "--------------------------------------------------------"
        
        while IFS='|' read -r name ip user port status last_check; do
            if [[ "$name" =~ ^#.*$ ]] || [[ -z "$name" ]]; then
                continue
            fi
            
            total_count=$((total_count + 1))
            
            # 快速状态检查
            if check_node_status "$name" "false" >/dev/null 2>&1; then
                status_display="${GREEN}在线${NC}"
                active_count=$((active_count + 1))
            else
                status_display="${RED}离线${NC}"
            fi
            
            printf "%-15s %-15s %-18s %-20s\n" "$name" "$ip" "$status_display" "$(date '+%H:%M:%S')"
        done < "$CONFIG_FILE"
        
        echo ""
        echo "在线节点: $active_count/$total_count"
        echo ""
        echo "下次更新: 30秒后 (按 Ctrl+C 退出)"
        
        sleep 30
    done
}

# 生成部署报告
generate_report() {
    local report_file="ssalgten_nodes_report_$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "生成节点报告..."
    
    {
        echo "SsalgTen 节点状态报告"
        echo "生成时间: $(date)"
        echo "========================================"
        echo ""
        
        echo "节点列表:"
        echo "----------------------------------------"
        while IFS='|' read -r name ip user port status last_check; do
            if [[ "$name" =~ ^#.*$ ]] || [[ -z "$name" ]]; then
                continue
            fi
            
            echo "节点名称: $name"
            echo "IP地址: $ip"
            echo "SSH: $user@$ip:$port"
            echo "状态: $status"
            echo "最后检查: $last_check"
            echo ""
        done < "$CONFIG_FILE"
        
        echo "统计信息:"
        echo "----------------------------------------"
        local total=$(grep -c '^[^#]' "$CONFIG_FILE" 2>/dev/null || echo 0)
        local active=$(grep -c '|active|' "$CONFIG_FILE" 2>/dev/null || echo 0)
        echo "总节点数: $total"
        echo "活跃节点: $active"
        echo "离线节点: $((total - active))"
        
    } > "$report_file"
    
    log_success "报告生成完成: $report_file"
}

# 主函数
main() {
    # 初始化配置
    init_config
    
    # 解析命令行参数
    case "${1:-help}" in
        "add")
            shift
            node_name=""
            host=""
            user="root"
            port="22"
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -n|--node) node_name="$2"; shift 2 ;;
                    -h|--host) host="$2"; shift 2 ;;
                    -u|--user) user="$2"; shift 2 ;;
                    -p|--port) port="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            add_node "$node_name" "$host" "$user" "$port"
            ;;
        
        "remove")
            shift
            node_name=""
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -n|--node) node_name="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            remove_node "$node_name"
            ;;
        
        "list")
            list_nodes
            ;;
        
        "status")
            shift
            all_nodes="false"
            node_name=""
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -a|--all) all_nodes="true"; shift ;;
                    -n|--node) node_name="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            if [[ "$all_nodes" == "true" ]]; then
                check_all_nodes_status
            elif [[ -n "$node_name" ]]; then
                check_node_status "$node_name" "true"
            else
                log_error "请指定 --all 或 --node"
                exit 1
            fi
            ;;
        
        "deploy")
            shift
            node_name=""
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -n|--node) node_name="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            deploy_agent_to_node "$node_name"
            ;;
        
        "restart")
            shift
            node_name=""
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -n|--node) node_name="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            restart_node_agent "$node_name"
            ;;
        
        "logs")
            shift
            node_name=""
            lines="50"
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -n|--node) node_name="$2"; shift 2 ;;
                    -l|--lines) lines="$2"; shift 2 ;;
                    *) log_error "未知参数: $1"; exit 1 ;;
                esac
            done
            
            view_node_logs "$node_name" "$lines"
            ;;
        
        "batch")
            shift
            operation="$1"
            shift
            all_nodes="false"
            nodes=()
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -a|--all) all_nodes="true"; shift ;;
                    -n|--node) nodes+=("$2"); shift 2 ;;
                    *) nodes+=("$1"); shift ;;
                esac
            done
            
            batch_operation "$operation" "$all_nodes" "${nodes[@]}"
            ;;
        
        "monitor")
            monitor_mode
            ;;
        
        "report")
            generate_report
            ;;
        
        "help"|*)
            show_help
            ;;
    esac
}

# 错误处理
trap 'log_error "操作中断"; exit 1' INT

# 运行主函数
main "$@"