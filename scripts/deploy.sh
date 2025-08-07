#!/bin/bash

# SsalgTen Deployment Script
# This script helps deploy SsalgTen using Docker Compose

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Functions
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

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Check if environment file exists
check_environment() {
    log_info "Checking environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file not found. Creating from template..."
        cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
        log_warning "Please edit $ENV_FILE with your configuration before running again."
        exit 1
    fi
    
    # Check for default values that should be changed
    if grep -q "your_secure_database_password_here" "$ENV_FILE"; then
        log_warning "Please update the default database password in $ENV_FILE"
        exit 1
    fi
    
    if grep -q "your-super-secret-jwt-key-change-this-in-production" "$ENV_FILE"; then
        log_warning "Please update the default JWT secret in $ENV_FILE"
        exit 1
    fi
    
    log_success "Environment configuration check passed"
}

# Build images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build all images
    docker-compose build --no-cache
    
    log_success "Docker images built successfully"
}

# Start services
start_services() {
    log_info "Starting SsalgTen services..."
    
    cd "$PROJECT_ROOT"
    
    # Start database first
    log_info "Starting database..."
    docker-compose up -d database redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 30
    
    # Start backend
    log_info "Starting backend..."
    docker-compose up -d backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    sleep 30
    
    # Start frontend
    log_info "Starting frontend..."
    docker-compose up -d frontend
    
    # Start agents
    log_info "Starting agents..."
    docker-compose up -d agent-nyc
    
    log_success "All services started successfully"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    cd "$PROJECT_ROOT"
    
    # Check all services
    if docker-compose ps | grep -q "Up (healthy)"; then
        log_success "Services are healthy"
    else
        log_warning "Some services may not be healthy. Check with: docker-compose ps"
    fi
}

# Show service status
show_status() {
    log_info "Service status:"
    cd "$PROJECT_ROOT"
    docker-compose ps
    
    echo ""
    log_info "Service URLs:"
    echo "Frontend: http://localhost"
    echo "Backend API: http://localhost:3001/api"
    echo "Backend Health: http://localhost:3001/api/health"
    echo "Agent NYC: http://localhost:3002/api/health"
}

# Stop services
stop_services() {
    log_info "Stopping SsalgTen services..."
    
    cd "$PROJECT_ROOT"
    docker-compose down
    
    log_success "Services stopped"
}

# Clean up (remove containers and volumes)
cleanup() {
    log_warning "This will remove all containers and volumes. Data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up..."
        cd "$PROJECT_ROOT"
        docker-compose down -v --remove-orphans
        docker system prune -f
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Update and restart services
update_services() {
    log_info "Updating SsalgTen services..."
    
    cd "$PROJECT_ROOT"
    
    # Pull latest images and rebuild
    docker-compose pull
    docker-compose build --no-cache
    
    # Restart services
    docker-compose up -d --force-recreate
    
    log_success "Services updated and restarted"
}

# Show logs
show_logs() {
    local service=${1:-}
    
    cd "$PROJECT_ROOT"
    
    if [ -n "$service" ]; then
        log_info "Showing logs for $service..."
        docker-compose logs -f "$service"
    else
        log_info "Showing logs for all services..."
        docker-compose logs -f
    fi
}

# Main script logic
main() {
    local command=${1:-deploy}
    
    case $command in
        "deploy")
            check_dependencies
            check_environment
            build_images
            start_services
            check_health
            show_status
            ;;
        "start")
            start_services
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            start_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "update")
            update_services
            ;;
        "cleanup")
            cleanup
            ;;
        "build")
            build_images
            ;;
        *)
            echo "Usage: $0 {deploy|start|stop|restart|status|logs|update|cleanup|build}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment (build images and start services)"
            echo "  start    - Start all services"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart all services"
            echo "  status   - Show service status"
            echo "  logs     - Show service logs (add service name for specific service)"
            echo "  update   - Update and restart services"
            echo "  cleanup  - Remove all containers and volumes (WARNING: data loss)"
            echo "  build    - Build Docker images only"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"