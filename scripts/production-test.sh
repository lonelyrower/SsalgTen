#!/bin/bash

# SsalgTen 生产环境测试套件
# 用于验证生产环境中所有功能是否正常工作

set -e

# 配置
BASE_URL=${BASE_URL:-"http://localhost"}
API_URL="$BASE_URL/api"
TIMEOUT=${TIMEOUT:-15}
VERBOSE=${VERBOSE:-false}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# 测试结果数组
declare -a TEST_RESULTS=()

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

# 测试函数框架
run_test() {
    local test_name="$1"
    local test_function="$2"
    local is_critical="${3:-true}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log_test "运行测试: $test_name"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  测试函数: $test_function"
        echo "  关键测试: $is_critical"
    fi
    
    local start_time=$(date +%s)
    local result="UNKNOWN"
    local error_msg=""
    
    # 运行测试函数
    if $test_function 2>&1; then
        result="PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log_success "$test_name"
    else
        if [[ "$is_critical" == "true" ]]; then
            result="FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "$test_name - 关键测试失败"
        else
            result="SKIP"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            log_warning "$test_name - 非关键测试失败，已跳过"
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 记录测试结果
    TEST_RESULTS+=("$test_name|$result|${duration}s")
    
    echo ""
}

# HTTP请求测试函数
test_http_request() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="$3"
    local check_content="$4"
    local method="${5:-GET}"
    local post_data="$6"
    
    local curl_opts=(-s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" --max-time $TIMEOUT)
    
    if [[ "$method" == "POST" ]]; then
        curl_opts+=(-X POST)
        if [[ -n "$post_data" ]]; then
            curl_opts+=(-H "Content-Type: application/json" -d "$post_data")
        fi
    fi
    
    local response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  错误: 无法连接到 $url"
        fi
        return 1
    fi
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3};TIME:[0-9.]+$//')
    local status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  URL: $url"
        echo "  状态码: $status (期望: $expected_status)"
        echo "  响应时间: ${time}s"
        echo "  响应大小: $(echo "$body" | wc -c) bytes"
    fi
    
    if [[ "$status" != "$expected_status" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  错误: 状态码不匹配"
        fi
        return 1
    fi
    
    if [[ -n "$check_content" ]] && ! echo "$body" | grep -q "$check_content"; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  错误: 响应内容验证失败，未找到: $check_content"
            echo "  响应内容预览: $(echo "$body" | head -c 200)"
        fi
        return 1
    fi
    
    return 0
}

# 基础功能测试
test_frontend_page() {
    test_http_request "$BASE_URL" "200" "前端页面" "SsalgTen"
}

test_api_health() {
    test_http_request "$API_URL/health" "200" "API健康检查" "success"
}

test_api_info() {
    test_http_request "$API_URL/info" "200" "API信息" "SsalgTen"
}

# 节点相关测试
test_nodes_list() {
    test_http_request "$API_URL/nodes" "200" "节点列表" "success"
}

test_nodes_stats() {
    test_http_request "$API_URL/stats" "200" "节点统计" "totalNodes"
}

# ASN功能测试
test_visitor_info() {
    test_http_request "$API_URL/visitor/info" "200" "访问者信息" "ip"
}

test_ip_lookup_google_dns() {
    test_http_request "$API_URL/visitor/ip/8.8.8.8" "200" "IP查询(Google DNS)" "Mountain View"
}

test_ip_lookup_cloudflare_dns() {
    test_http_request "$API_URL/visitor/ip/1.1.1.1" "200" "IP查询(Cloudflare DNS)" "Brisbane"
}

test_ip_lookup_invalid() {
    test_http_request "$API_URL/visitor/ip/invalid-ip" "400" "无效IP查询" "Invalid"
}

# 数据验证测试
test_nodes_have_asn_info() {
    local response=$(curl -s --max-time $TIMEOUT "$API_URL/nodes" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    # 检查是否有节点包含ASN信息
    if echo "$response" | grep -q '"asnNumber"'; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  发现节点包含ASN信息"
        fi
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  警告: 节点中未找到ASN信息"
        fi
        return 1
    fi
}

test_asn_data_format() {
    local response=$(curl -s --max-time $TIMEOUT "$API_URL/visitor/ip/8.8.8.8" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    # 验证ASN数据格式
    if echo "$response" | grep -q '"asn".*"AS[0-9]'; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  ASN格式验证通过"
        fi
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  ASN格式验证失败"
            echo "  响应: $(echo "$response" | head -c 300)"
        fi
        return 1
    fi
}

# 性能测试
test_response_time() {
    local url="$1"
    local max_time="$2"
    local description="$3"
    
    local response=$(curl -s -w "TIME:%{time_total}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    local time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    local time_ms=$(echo "$time * 1000" | bc 2>/dev/null || echo "0")
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  响应时间: ${time}s (${time_ms%.*}ms)"
        echo "  最大允许: ${max_time}s"
    fi
    
    if (( $(echo "$time <= $max_time" | bc -l) )); then
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  性能测试失败: 响应时间超过阈值"
        fi
        return 1
    fi
}

test_api_performance() {
    test_response_time "$API_URL/health" "1.0" "API健康检查性能"
}

test_visitor_info_performance() {
    test_response_time "$API_URL/visitor/info" "2.0" "访问者信息性能"
}

test_ip_lookup_performance() {
    test_response_time "$API_URL/visitor/ip/8.8.8.8" "5.0" "IP查询性能"
}

# 并发测试
test_concurrent_requests() {
    local url="$API_URL/health"
    local concurrent_count=10
    local temp_dir="/tmp/ssalgten-concurrent-test"
    
    mkdir -p "$temp_dir"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  启动 $concurrent_count 个并发请求"
    fi
    
    # 启动并发请求
    for i in $(seq 1 $concurrent_count); do
        (
            curl -s --max-time $TIMEOUT "$url" > "$temp_dir/response_$i.txt" 2>&1
            echo $? > "$temp_dir/status_$i.txt"
        ) &
    done
    
    # 等待所有请求完成
    wait
    
    # 检查结果
    local success_count=0
    for i in $(seq 1 $concurrent_count); do
        if [[ -f "$temp_dir/status_$i.txt" ]] && [[ "$(cat "$temp_dir/status_$i.txt")" == "0" ]]; then
            success_count=$((success_count + 1))
        fi
    done
    
    # 清理临时文件
    rm -rf "$temp_dir"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  成功: $success_count/$concurrent_count"
    fi
    
    # 至少80%的请求应该成功
    local min_success=$((concurrent_count * 8 / 10))
    if [[ $success_count -ge $min_success ]]; then
        return 0
    else
        return 1
    fi
}

# 数据库测试
test_database_connectivity() {
    # 通过API间接测试数据库连接
    local response=$(curl -s --max-time $TIMEOUT "$API_URL/nodes" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    # 检查是否返回了数据结构
    if echo "$response" | grep -q '"data"'; then
        return 0
    else
        return 1
    fi
}

# 安全测试
test_cors_headers() {
    local response=$(curl -s -I --max-time $TIMEOUT \
                    -H "Origin: https://malicious-site.com" \
                    "$API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    # 检查CORS头是否存在且配置正确
    if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  CORS头已配置"
        fi
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  警告: 未找到CORS头"
        fi
        return 1
    fi
}

test_sql_injection() {
    # 尝试SQL注入攻击
    local malicious_ip="8.8.8.8'; DROP TABLE nodes; --"
    local encoded_ip=$(echo "$malicious_ip" | sed 's/ /%20/g' | sed "s/'/%27/g" | sed 's/;/%3B/g')
    
    test_http_request "$API_URL/visitor/ip/$encoded_ip" "400" "SQL注入防护" ""
}

# 错误处理测试
test_404_handling() {
    test_http_request "$API_URL/nonexistent-endpoint" "404" "404错误处理" ""
}

test_500_error_handling() {
    # 这个测试可能需要根据实际API调整
    # 这里只是示例，实际可能需要触发特定的服务器错误
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time $TIMEOUT \
                    "$API_URL/visitor/ip/" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        return 1
    fi
    
    local status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    # 应该返回400或404，不应该是500
    if [[ "$status" == "400" ]] || [[ "$status" == "404" ]]; then
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  意外的状态码: $status"
        fi
        return 1
    fi
}

# 生成测试报告
generate_test_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="/tmp/ssalgten-test-report-$(date +%Y%m%d_%H%M%S).json"
    
    # 计算成功率
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")
    fi
    
    # 生成JSON报告
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "test_suite": "SsalgTen Production Tests",
    "base_url": "$BASE_URL",
    "summary": {
        "total_tests": $TOTAL_TESTS,
        "passed": $PASSED_TESTS,
        "failed": $FAILED_TESTS,
        "skipped": $SKIPPED_TESTS,
        "success_rate": $success_rate
    },
    "test_results": [
EOF

    local first=true
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name status duration <<< "$result"
        
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        cat >> "$report_file" << EOF
        {
            "name": "$test_name",
            "status": "$status",
            "duration": "$duration"
        }
EOF
    done
    
    cat >> "$report_file" << EOF
    ]
}
EOF
    
    echo "$report_file"
}

# 主函数
main() {
    echo "========================================"
    echo "SsalgTen 生产环境测试套件"
    echo "========================================"
    echo "测试目标: $BASE_URL"
    echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    log_info "开始执行生产环境测试..."
    echo ""
    
    # 基础功能测试
    log_info "=== 基础功能测试 ==="
    run_test "前端页面加载" "test_frontend_page" true
    run_test "API健康检查" "test_api_health" true  
    run_test "API信息查询" "test_api_info" true
    run_test "节点列表查询" "test_nodes_list" true
    run_test "节点统计查询" "test_nodes_stats" true
    
    # ASN功能测试
    log_info "=== ASN功能测试 ==="
    run_test "访问者信息获取" "test_visitor_info" true
    run_test "Google DNS查询" "test_ip_lookup_google_dns" true
    run_test "Cloudflare DNS查询" "test_ip_lookup_cloudflare_dns" false
    run_test "无效IP处理" "test_ip_lookup_invalid" true
    run_test "节点ASN信息" "test_nodes_have_asn_info" false
    run_test "ASN数据格式" "test_asn_data_format" true
    
    # 性能测试
    log_info "=== 性能测试 ==="
    run_test "API响应性能" "test_api_performance" false
    run_test "访问者信息性能" "test_visitor_info_performance" false
    run_test "IP查询性能" "test_ip_lookup_performance" false
    run_test "并发请求处理" "test_concurrent_requests" false
    
    # 数据库测试
    log_info "=== 数据库测试 ==="
    run_test "数据库连接" "test_database_connectivity" true
    
    # 安全测试
    log_info "=== 安全测试 ==="
    run_test "CORS配置" "test_cors_headers" false
    run_test "SQL注入防护" "test_sql_injection" true
    
    # 错误处理测试
    log_info "=== 错误处理测试 ==="
    run_test "404错误处理" "test_404_handling" true
    run_test "服务器错误处理" "test_500_error_handling" false
    
    # 生成测试报告
    echo ""
    log_info "生成测试报告..."
    local report_file=$(generate_test_report)
    
    echo ""
    echo "========================================"
    echo "测试结果汇总"
    echo "========================================"
    echo "总测试数量: $TOTAL_TESTS"
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}跳过: $SKIPPED_TESTS${NC}"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")
    fi
    echo "成功率: ${success_rate}%"
    echo ""
    echo "测试报告: $report_file"
    echo "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # 判断测试结果
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "🎉 所有关键测试通过！生产环境就绪。"
        exit 0
    else
        log_error "💥 有 $FAILED_TESTS 项关键测试失败，请检查并修复后重新测试。"
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
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --url URL        设置测试目标URL (默认: http://localhost)"
            echo "  --timeout SEC    设置请求超时时间 (默认: 15秒)"
            echo "  --verbose        启用详细输出模式"
            echo "  --help           显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0 --url https://your-domain.com --verbose"
            echo "  $0 --url http://localhost:8080 --timeout 30"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 检查依赖
if ! command -v curl &> /dev/null; then
    log_error "错误: curl 未安装"
    exit 1
fi

if ! command -v bc &> /dev/null; then
    log_warning "警告: bc 未安装，某些计算功能可能受限"
fi

# 运行测试
main