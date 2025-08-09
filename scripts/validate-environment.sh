#!/bin/bash

# SsalgTen 环境配置验证脚本
# 用于验证生产环境配置是否正确

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查结果统计
CHECKS_TOTAL=0
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# 检查函数
check_requirement() {
    local name="$1"
    local command="$2"
    local required_version="$3"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    log_info "检查 $name..."
    
    if eval "$command" &> /dev/null; then
        if [[ -n "$required_version" ]]; then
            local version=$(eval "$command")
            log_success "$name 已安装: $version"
        else
            log_success "$name 可用"
        fi
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        log_error "$name 未安装或不可用"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 检查环境变量
check_env_var() {
    local var_name="$1"
    local is_required="$2"
    local is_secret="$3"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [[ -n "${!var_name}" ]]; then
        if [[ "$is_secret" == "true" ]]; then
            log_success "环境变量 $var_name 已设置 (***)"
        else
            log_success "环境变量 $var_name = ${!var_name}"
        fi
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        if [[ "$is_required" == "true" ]]; then
            log_error "必需的环境变量 $var_name 未设置"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        else
            log_warning "可选的环境变量 $var_name 未设置"
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
        fi
    fi
}

# 检查文件存在性
check_file_exists() {
    local file_path="$1"
    local is_required="$2"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [[ -f "$file_path" ]]; then
        log_success "文件存在: $file_path"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        if [[ "$is_required" == "true" ]]; then
            log_error "必需文件不存在: $file_path"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        else
            log_warning "可选文件不存在: $file_path"
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
        fi
    fi
}

# 检查端口可用性
check_port() {
    local port="$1"
    local service_name="$2"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_warning "端口 $port ($service_name) 已被占用"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    else
        log_success "端口 $port ($service_name) 可用"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    fi
}

# 主要检查流程
main() {
    echo "========================================"
    echo "SsalgTen 生产环境验证脚本"
    echo "========================================"
    echo ""
    
    # 1. 系统要求检查
    log_info "========== 系统要求检查 =========="
    check_requirement "Docker" "docker --version" "true"
    check_requirement "Docker Compose" "docker-compose --version" "true"
    check_requirement "Git" "git --version" "true"
    check_requirement "Curl" "curl --version" "true"
    check_requirement "jq" "jq --version" "false"
    check_requirement "PostgreSQL Client" "psql --version" "false"
    
    echo ""
    
    # 2. 文件存在性检查
    log_info "========== 配置文件检查 =========="
    check_file_exists ".env" "true"
    check_file_exists "backend/.env" "true"
    check_file_exists "frontend/.env" "true"
    check_file_exists "agent/.env" "true"
    check_file_exists "docker-compose.yml" "true"
    check_file_exists "backend/prisma/schema.prisma" "true"
    
    echo ""
    
    # 3. 端口可用性检查
    log_info "========== 端口可用性检查 =========="
    check_port "80" "HTTP"
    check_port "443" "HTTPS"
    check_port "3001" "Backend API"
    check_port "3002" "Agent"
    check_port "5432" "PostgreSQL"
    
    echo ""
    
    # 4. 环境变量检查（后端）
    log_info "========== 后端环境变量检查 =========="
    
    if [[ -f "backend/.env" ]]; then
        # 加载后端环境变量
        export $(grep -v '^#' backend/.env | xargs)
        
        check_env_var "NODE_ENV" "true" "false"
        check_env_var "PORT" "true" "false"
        check_env_var "DATABASE_URL" "true" "true"
        check_env_var "JWT_SECRET" "true" "true"
        check_env_var "API_KEY_SECRET" "true" "true"
        check_env_var "CORS_ORIGIN" "false" "false"
        check_env_var "IPINFO_TOKEN" "false" "true"
    else
        log_error "backend/.env 文件不存在，跳过环境变量检查"
    fi
    
    echo ""
    
    # 5. 环境变量检查（前端）
    log_info "========== 前端环境变量检查 =========="
    
    if [[ -f "frontend/.env" ]]; then
        # 加载前端环境变量
        export $(grep -v '^#' frontend/.env | xargs)
        
        check_env_var "VITE_API_URL" "true" "false"
        check_env_var "VITE_NODE_ENV" "false" "false"
    else
        log_error "frontend/.env 文件不存在，跳过环境变量检查"
    fi
    
    echo ""
    
    # 6. Docker 镜像检查
    log_info "========== Docker 环境检查 =========="
    
    if docker info >/dev/null 2>&1; then
        log_success "Docker 守护进程运行正常"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        
        # 检查 Docker 磁盘空间
        local docker_space=$(docker system df --format "table {{.TotalCount}}\t{{.Size}}" | tail -n +2)
        log_info "Docker 存储使用情况: $docker_space"
        
    else
        log_error "Docker 守护进程未运行"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    echo ""
    
    # 7. 网络连接检查
    log_info "========== 网络连接检查 =========="
    
    # 检查外部API连接
    if curl -s --max-time 5 https://ipinfo.io/8.8.8.8 >/dev/null; then
        log_success "IPInfo API 连接正常"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        log_warning "IPInfo API 连接失败（可能影响ASN功能）"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    fi
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    # 8. 系统资源检查
    log_info "========== 系统资源检查 =========="
    
    # 内存检查
    local mem_total=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    local mem_available=$(free -m | awk 'NR==2{printf "%.0f", $7/1024}')
    
    if [[ $mem_total -ge 2 ]]; then
        log_success "内存充足: ${mem_total}GB 总内存，${mem_available}GB 可用"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        log_warning "内存不足: ${mem_total}GB 总内存（推荐至少4GB）"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    fi
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    # 磁盘空间检查
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_available=$(df -h . | awk 'NR==2 {print $4}')
    
    if [[ $disk_usage -lt 80 ]]; then
        log_success "磁盘空间充足: ${disk_available} 可用 (使用率: ${disk_usage}%)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        log_warning "磁盘空间不足: ${disk_available} 可用 (使用率: ${disk_usage}%)"
        CHECKS_WARNING=$((CHECKS_WARNING + 1))
    fi
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    echo ""
    echo "========================================"
    echo "验证结果汇总"
    echo "========================================"
    echo -e "总检查项目: $CHECKS_TOTAL"
    echo -e "${GREEN}通过: $CHECKS_PASSED${NC}"
    echo -e "${YELLOW}警告: $CHECKS_WARNING${NC}"
    echo -e "${RED}失败: $CHECKS_FAILED${NC}"
    echo ""
    
    # 生成建议
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        if [[ $CHECKS_WARNING -eq 0 ]]; then
            log_success "✅ 环境验证完全通过！可以开始部署。"
            echo ""
            echo "建议的下一步："
            echo "1. 运行 docker-compose up -d"
            echo "2. 执行数据库迁移"
            echo "3. 运行生产测试脚本"
        else
            log_warning "⚠️ 环境验证基本通过，但有警告项需要注意。"
            echo ""
            echo "建议："
            echo "1. 检查并解决警告项"
            echo "2. 确认警告项不会影响生产环境"
            echo "3. 然后开始部署"
        fi
        exit 0
    else
        log_error "❌ 环境验证失败，请解决以上错误后重新运行。"
        echo ""
        echo "常见解决方案："
        echo "1. 安装缺失的依赖"
        echo "2. 创建必需的配置文件"
        echo "3. 设置正确的环境变量"
        echo "4. 启动必需的服务"
        exit 1
    fi
}

# 运行主函数
main "$@"