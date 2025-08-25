#!/bin/bash

# Deployment readiness check script for SsalgTen
# This script validates the deployment configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Compose 兼容性函数（优先 v2 插件）
docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
        return $?
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        if docker-compose version >/dev/null 2>&1; then
            docker-compose "$@"
            return $?
        fi
    fi
    log_error "未找到可用的 Docker Compose（docker compose 或 docker-compose）"
    return 127
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if required files exist
check_files() {
    log_info "Checking required files..."
    
    local files=(
        "docker_compose.yml"
        "Dockerfile.backend"
        "Dockerfile.frontend" 
        "Dockerfile.agent"
        ".env.example"
        "backend/package.json"
        "frontend/package.json"
        "agent/package.json"
        "docker/nginx.conf"
        "docker/inject-env.sh"
        "docker/init-db.sql"
    )
    
    local missing_files=()
    
    for file in "${files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Missing required files:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        return 1
    fi
    
    log_success "All required files found"
    return 0
}

# Check Docker and Docker Compose versions
check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        return 1
    fi
    
    local docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    local compose_version=$(docker_compose --version 2>/dev/null | awk '{print $3}' | cut -d',' -f1)
    
    log_success "Docker version: $docker_version"
    log_success "Docker Compose version: $compose_version"
    return 0
}

# Check environment configuration
check_environment() {
    log_info "Checking environment configuration..."
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_warning "No .env file found. Will use default values from docker_compose.yml"
        log_info "Consider copying .env.example to .env and customizing values"
        return 0
    fi
    
    # Check for sensitive default values
    local env_file="$PROJECT_ROOT/.env"
    local warnings=()
    
    if grep -q "your_secure_database_password_here" "$env_file" 2>/dev/null; then
        warnings+=("Default database password detected")
    fi
    
    if grep -q "your-super-secret-jwt-key-change-this" "$env_file" 2>/dev/null; then
        warnings+=("Default JWT secret detected")
    fi
    
    if grep -q "change-this-api-key" "$env_file" 2>/dev/null; then
        warnings+=("Default API keys detected")
    fi
    
    if [ ${#warnings[@]} -gt 0 ]; then
        log_warning "Security warnings found in .env file:"
        for warning in "${warnings[@]}"; do
            echo "  - $warning"
        done
        log_warning "Please update default values for production deployment"
    fi
    
    log_success "Environment configuration check completed"
    return 0
}

# Validate Docker Compose configuration
check_compose_config() {
    log_info "Validating Docker Compose configuration..."
    
    cd "$PROJECT_ROOT"
    
    if ! docker_compose config -q; then
        log_error "Docker Compose configuration is invalid"
        return 1
    fi
    
    log_success "Docker Compose configuration is valid"
    return 0
}

# Check network connectivity and ports
check_ports() {
    log_info "Checking port availability..."
    
    local ports=(80 3001 3002 5432 6379)
    local busy_ports=()
    
    for port in "${ports[@]}"; do
        if netstat -ln 2>/dev/null | grep -q ":$port "; then
            busy_ports+=("$port")
        fi
    done
    
    if [ ${#busy_ports[@]} -gt 0 ]; then
        log_warning "The following ports are already in use:"
        for port in "${busy_ports[@]}"; do
            echo "  - $port"
        done
        log_warning "You may need to stop other services or change port mappings"
    else
        log_success "All required ports are available"
    fi
    
    return 0
}

# Check available disk space
check_disk_space() {
    log_info "Checking available disk space..."
    
    local available_gb=$(df "$PROJECT_ROOT" | tail -1 | awk '{print int($4/1024/1024)}')
    
    if [ "$available_gb" -lt 2 ]; then
        log_error "Insufficient disk space. At least 2GB required, only ${available_gb}GB available"
        return 1
    elif [ "$available_gb" -lt 5 ]; then
        log_warning "Low disk space. ${available_gb}GB available, 5GB+ recommended"
    else
        log_success "Sufficient disk space available: ${available_gb}GB"
    fi
    
    return 0
}

# Check system resources
check_resources() {
    log_info "Checking system resources..."
    
    # Check available memory
    if command -v free &> /dev/null; then
        local available_mb=$(free -m | awk 'NR==2{print $7}')
        if [ "$available_mb" -lt 1024 ]; then
            log_warning "Low available memory: ${available_mb}MB (2GB+ recommended)"
        else
            log_success "Sufficient memory available: ${available_mb}MB"
        fi
    fi
    
    # Check CPU cores
    local cpu_cores=$(nproc 2>/dev/null || echo "unknown")
    if [ "$cpu_cores" != "unknown" ]; then
        log_success "CPU cores available: $cpu_cores"
    fi
    
    return 0
}

# Generate deployment summary
generate_summary() {
    log_info "Deployment Summary:"
    echo ""
    echo "Services that will be deployed:"
    echo "  - PostgreSQL Database (port 5432)"
    echo "  - Redis Cache (port 6379)" 
    echo "  - Backend API (port 3001)"
    echo "  - Frontend Web App (port 80)"
    echo "  - Agent NYC (port 3002)"
    echo ""
    echo "After deployment, access the application at:"
    echo "  - Frontend: http://localhost"
    echo "  - Backend API: http://localhost:3001/api"
    echo "  - Admin login: admin/admin123 (change in production)"
    echo ""
    echo "To deploy, run:"
    echo "  ./scripts/deploy.sh deploy"
    echo "  or"
    echo "  docker compose up -d"
}

# Main execution
main() {
    echo "SsalgTen Deployment Readiness Check"
    echo "====================================="
    echo ""
    
    local checks=(
        check_files
        check_docker
        check_environment
        check_compose_config
        check_ports
        check_disk_space
        check_resources
    )
    
    local failed_checks=()
    
    for check in "${checks[@]}"; do
        if ! $check; then
            failed_checks+=("$check")
        fi
        echo ""
    done
    
    if [ ${#failed_checks[@]} -gt 0 ]; then
        log_error "Deployment readiness check failed!"
        log_error "Failed checks: ${failed_checks[*]}"
        echo ""
        log_info "Please address the issues above before deploying"
        exit 1
    else
        log_success "All deployment readiness checks passed!"
        echo ""
        generate_summary
        exit 0
    fi
}

# Run main function
main "$@"
