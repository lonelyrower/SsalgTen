#!/bin/bash

# SsalgTen 健康检查脚本
# 用于监控生产环境服务状态

set -e

# 配置
BASE_URL=${BASE_URL:-"http://localhost"}
API_URL="$BASE_URL/api"
TIMEOUT=${TIMEOUT:-10}
RETRY_COUNT=${RETRY_COUNT:-3}
RETRY_DELAY=${RETRY_DELAY:-5}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# 健康检查统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# HTTP健康检查函数
check_http_endpoint() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local description="$3"
    local check_content="$4"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "检查 $description ($endpoint)"
    
    local retry_count=0
    local success=false
    
    while [[ $retry_count -lt $RETRY_COUNT ]]; do
        local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
                        --max-time $TIMEOUT \
                        "$endpoint" 2>/dev/null || echo "ERROR")
        
        if [[ "$response" == "ERROR" ]]; then
            log_warning "尝试 $((retry_count + 1))/$RETRY_COUNT 连接失败: $endpoint"
        else
            local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3};TIME:[0-9.]+$//')
            local status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            local time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
            
            if [[ "$status" == "$expected_status" ]]; then
                if [[ -n "$check_content" ]] && ! echo "$body" | grep -q "$check_content"; then
                    log_warning "状态码正确但内容验证失败: $description"
                else
                    log_success "$description (${time}s, ${status})"
                    PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    success=true
                    break
                fi
            else
                log_warning "状态码不匹配: 期望$expected_status, 实际$status"
            fi
        fi
        
        retry_count=$((retry_count + 1))
        if [[ $retry_count -lt $RETRY_COUNT ]]; then
            sleep $RETRY_DELAY
        fi
    done
    
    if [[ "$success" == "false" ]]; then
        log_error "$description 检查失败"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
    
    return 0
}

# Docker容器健康检查
check_docker_containers() {
    log_info "检查 Docker 容器状态"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
    
    local containers=$(docker_compose ps -q 2>/dev/null || echo "")
    
    if [[ -z "$containers" ]]; then
        log_warning "没有找到运行中的容器"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
        return 0
    fi
    
    local all_healthy=true
    local container_count=0
    
    while IFS= read -r container_id; do
        if [[ -n "$container_id" ]]; then
            container_count=$((container_count + 1))
            local container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/^\///')
            local container_status=$(docker inspect --format='{{.State.Status}}' "$container_id")
            local container_health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health-check{{end}}' "$container_id")
            
            if [[ "$container_status" == "running" ]]; then
                if [[ "$container_health" == "healthy" ]] || [[ "$container_health" == "no-health-check" ]]; then
                    log_success "容器健康: $container_name ($container_status)"
                else
                    log_error "容器不健康: $container_name ($container_health)"
                    all_healthy=false
                fi
            else
                log_error "容器未运行: $container_name ($container_status)"
                all_healthy=false
            fi
        fi
    done <<< "$containers"
    
    if [[ "$all_healthy" == "true" ]]; then
        log_success "所有 $container_count 个容器状态正常"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_error "部分容器状态异常"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# 数据库连接检查
check_database_connection() {
    log_info "检查数据库连接"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # 尝试通过后端API检查数据库连接
    if check_http_endpoint "$API_URL/nodes" "200" "数据库连接（通过API）" "success" 2>/dev/null; then
        log_success "数据库连接正常（通过API验证）"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        # 如果API检查失败，尝试直接连接数据库
        if docker_compose exec -T postgres pg_isready -U ssalgten >/dev/null 2>&1; then
            log_success "数据库连接正常（直接连接）"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            log_error "数据库连接失败"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    fi
}

# 磁盘空间检查
check_disk_space() {
    log_info "检查磁盘空间"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local disk_usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_available=$(df -h . | awk 'NR==2 {print $4}')
    
    if [[ $disk_usage -lt 80 ]]; then
        log_success "磁盘空间充足: $disk_available 可用 (使用率: ${disk_usage}%)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [[ $disk_usage -lt 90 ]]; then
        log_warning "磁盘空间紧张: $disk_available 可用 (使用率: ${disk_usage}%)"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        log_error "磁盘空间严重不足: $disk_available 可用 (使用率: ${disk_usage}%)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# 内存使用检查
check_memory_usage() {
    log_info "检查内存使用"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3/$2 * 100.0}')
    local mem_available=$(free -h | awk 'NR==2{print $7}')
    
    if [[ $mem_usage -lt 80 ]]; then
        log_success "内存使用正常: $mem_available 可用 (使用率: ${mem_usage}%)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [[ $mem_usage -lt 90 ]]; then
        log_warning "内存使用偏高: $mem_available 可用 (使用率: ${mem_usage}%)"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    else
        log_error "内存使用过高: $mem_available 可用 (使用率: ${mem_usage}%)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# SSL证书检查（如果使用HTTPS）
check_ssl_certificate() {
    if [[ "$BASE_URL" =~ ^https:// ]]; then
        log_info "检查SSL证书"
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        local domain=$(echo "$BASE_URL" | sed 's|https\?://||' | sed 's|/.*||')
        local cert_info
        
        cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "ERROR")
        
        if [[ "$cert_info" == "ERROR" ]]; then
            log_error "SSL证书检查失败"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            local not_after=$(echo "$cert_info" | grep "notAfter" | sed 's/notAfter=//')
            local expiry_date=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
            local current_date=$(date +%s)
            local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
            
            if [[ $days_until_expiry -gt 30 ]]; then
                log_success "SSL证书有效，还有 $days_until_expiry 天过期"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
            elif [[ $days_until_expiry -gt 0 ]]; then
                log_warning "SSL证书即将过期，还有 $days_until_expiry 天"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
            else
                log_error "SSL证书已过期"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
                return 1
            fi
        fi
    fi
}

# ASN功能特定检查
check_asn_functionality() {
    log_info "检查ASN功能"
    
    # 检查访问者信息API
    if check_http_endpoint "$API_URL/visitor/info" "200" "访问者信息API" "ip"; then
        log_success "访问者信息API正常"
    fi
    
    # 检查IP信息查询API
    if check_http_endpoint "$API_URL/visitor/ip/8.8.8.8" "200" "IP信息查询API" "asn"; then
        log_success "IP信息查询API正常"
    fi
    
    # 检查节点ASN信息
    if check_http_endpoint "$API_URL/nodes" "200" "节点ASN信息" "asnNumber"; then
        log_success "节点ASN信息正常"
    fi
}

# 生成健康报告
generate_health_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local status
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        if [[ $WARNING_CHECKS -eq 0 ]]; then
            status="HEALTHY"
        else
            status="WARNING"
        fi
    else
        status="UNHEALTHY"
    fi
    
    # 创建JSON格式的健康报告
    cat > "/tmp/ssalgten-health-report.json" << EOF
{
    "timestamp": "$timestamp",
    "status": "$status",
    "checks": {
        "total": $TOTAL_CHECKS,
        "passed": $PASSED_CHECKS,
        "warning": $WARNING_CHECKS,
        "failed": $FAILED_CHECKS
    },
    "uptime": $(cat /proc/uptime | awk '{print $1}'),
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | sed 's/^ *//')",
    "memory_usage": $(free | awk 'NR==2{printf "%.1f", $3/$2 * 100.0}'),
    "disk_usage": $(df . | awk 'NR==2 {print $5}' | sed 's/%//')
}
EOF
    
    log_info "健康报告已生成: /tmp/ssalgten-health-report.json"
}

# 发送告警（可集成到监控系统）
send_alert() {
    local message="$1"
    local severity="$2"
    
    # 这里可以集成各种告警通道
    # 例如：Slack、钉钉、邮件、短信等
    
    log_info "告警: [$severity] $message"
    
    # 示例：发送到文件日志
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$severity] $message" >> "/tmp/ssalgten-alerts.log"
    
    # 示例：发送到Webhook（取消注释并配置URL）
    # if [[ -n "$WEBHOOK_URL" ]]; then
    #     curl -X POST "$WEBHOOK_URL" \
    #          -H "Content-Type: application/json" \
    #          -d "{\"text\":\"SsalgTen Alert: [$severity] $message\"}" \
    #          >/dev/null 2>&1 || true
    # fi
}

# 主函数
main() {
    echo "========================================"
    echo "SsalgTen 健康检查 - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================"
    echo ""
    
    # 执行各项检查
    log_info "开始健康检查..."
    
    # 1. Docker容器检查
    check_docker_containers
    
    # 2. HTTP端点检查
    check_http_endpoint "$BASE_URL" "200" "前端页面" "SsalgTen"
    check_http_endpoint "$API_URL/health" "200" "API健康检查" "success"
    check_http_endpoint "$API_URL/info" "200" "API信息" "SsalgTen"
    
    # 3. 数据库连接检查
    check_database_connection
    
    # 4. 系统资源检查
    check_disk_space
    check_memory_usage
    
    # 5. SSL证书检查
    check_ssl_certificate
    
    # 6. ASN功能检查
    check_asn_functionality
    
    echo ""
    echo "========================================"
    echo "健康检查结果汇总"
    echo "========================================"
    echo "总检查项目: $TOTAL_CHECKS"
    echo -e "${GREEN}通过: $PASSED_CHECKS${NC}"
    echo -e "${YELLOW}警告: $WARNING_CHECKS${NC}"
    echo -e "${RED}失败: $FAILED_CHECKS${NC}"
    echo ""
    
    # 生成报告
    generate_health_report
    
    # 判断整体状态并发送告警
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        if [[ $WARNING_CHECKS -eq 0 ]]; then
            log_success "✅ 系统健康状态良好"
            exit 0
        else
            log_warning "⚠️ 系统基本健康，但有警告项需要关注"
            send_alert "$WARNING_CHECKS 项检查有警告" "WARNING"
            exit 0
        fi
    else
        log_error "❌ 系统健康检查失败，需要立即处理"
        send_alert "$FAILED_CHECKS 项检查失败" "CRITICAL"
        exit 1
    fi
}

# 处理命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL="$2"
            API_URL="$BASE_URL/api"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retry)
            RETRY_COUNT="$2"
            shift 2
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  --url URL        设置基础URL (默认: http://localhost)"
            echo "  --timeout SEC    设置超时时间 (默认: 10秒)"
            echo "  --retry COUNT    设置重试次数 (默认: 3次)"
            echo "  --help           显示此帮助信息"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 运行主函数
main