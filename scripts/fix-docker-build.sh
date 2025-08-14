#!/bin/bash

# Docker构建问题诊断和修复脚本

set -e

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

# 检查系统资源
check_system_resources() {
    log_info "检查系统资源..."
    
    # 检查内存
    total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    
    echo "内存信息:"
    echo "  总内存: ${total_mem}MB"
    echo "  可用内存: ${available_mem}MB"
    
    # 检查磁盘空间
    disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    disk_available=$(df -h / | awk 'NR==2{print $4}')
    
    echo "磁盘信息:"
    echo "  使用率: ${disk_usage}%"
    echo "  可用空间: ${disk_available}"
    
    # 资源警告
    if [[ $total_mem -lt 1000 ]]; then
        log_warning "内存不足！建议至少1GB内存用于Docker构建"
        echo "解决方案:"
        echo "1. 升级VPS配置"
        echo "2. 使用swap文件增加虚拟内存"
        echo "3. 分别构建前后端服务"
        return 1
    fi
    
    if [[ $disk_usage -gt 85 ]]; then
        log_warning "磁盘空间不足！使用率已达 ${disk_usage}%"
        echo "解决方案:"
        echo "1. 清理Docker缓存"
        echo "2. 删除未使用的Docker镜像"
        echo "3. 升级存储空间"
        return 1
    fi
    
    log_success "系统资源检查通过"
    return 0
}

# 创建swap文件（如果内存不足）
create_swap() {
    log_info "创建swap文件增加虚拟内存..."
    
    # 检查是否已有swap
    if swapon --show | grep -q "/swapfile"; then
        log_info "Swap文件已存在"
        return 0
    fi
    
    # 创建2GB swap文件
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # 永久启用
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    log_success "Swap文件创建完成 (2GB)"
}

# 清理Docker缓存
clean_docker() {
    log_info "清理Docker缓存和未使用资源..."
    
    # 停止所有容器
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # 清理系统
    docker system prune -af --volumes
    
    # 清理构建缓存
    docker builder prune -af
    
    log_success "Docker清理完成"
}

# 重启Docker服务
restart_docker() {
    log_info "重启Docker服务..."
    
    sudo systemctl restart docker
    sleep 5
    
    if sudo systemctl is-active --quiet docker; then
        log_success "Docker服务重启成功"
    else
        log_error "Docker服务重启失败"
        return 1
    fi
}

# 分别构建服务（内存不足时的备用方案）
build_services_separately() {
    log_info "分别构建前后端服务（内存优化模式）..."
    
    cd /opt/ssalgten
    
    # 只构建后端
    log_info "构建后端服务..."
    docker-compose -f docker-compose.production.yml build backend
    
    # 清理中间缓存
    docker system prune -f
    
    # 只构建前端
    log_info "构建前端服务..."
    docker-compose -f docker-compose.production.yml build frontend
    
    log_success "分别构建完成"
}

# 主修复流程
main() {
    echo "🔧 Docker构建问题修复脚本"
    echo "================================"
    
    if ! check_system_resources; then
        log_warning "检测到资源不足，开始优化..."
        
        # 内存不足时创建swap
        total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
        if [[ $total_mem -lt 1000 ]]; then
            read -p "是否创建swap文件增加虚拟内存？[Y/N]: " create_swap_choice
            if [[ "$create_swap_choice" != "n" && "$create_swap_choice" != "N" ]]; then
                create_swap
            fi
        fi
        
        # 清理Docker缓存
        clean_docker
    fi
    
    # 重启Docker服务
    restart_docker
    
    echo ""
    echo "🚀 修复完成！现在可以尝试重新构建："
    echo ""
    echo "方法1 - 正常构建："
    echo "  cd /opt/ssalgten"
    echo "  docker-compose -f docker-compose.production.yml up --build -d"
    echo ""
    echo "方法2 - 分别构建（内存不足时）："
    echo "  bash /opt/ssalgten/scripts/fix-docker-build.sh --separate-build"
    echo ""
    
    # 如果传入参数要求分别构建
    if [[ "$1" == "--separate-build" ]]; then
        build_services_separately
    fi
}

# 运行主函数
main "$@"