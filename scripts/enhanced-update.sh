#!/bin/bash

set -e

echo "🚀 开始 SsalgTen 增强重构流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 安全目录配置
echo -e "${BLUE}📁 配置安全目录...${NC}"
git config --global --add safe.directory /opt/ssalgten

# 切换到项目目录
cd /opt/ssalgten

# 检查并停止可能冲突的服务
echo -e "${YELLOW}⚠️  检查端口占用情况...${NC}"

check_port() {
    local port=$1
    local service_name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}端口 $port 被占用 ($service_name)${NC}"
        return 0
    else
        echo -e "${GREEN}端口 $port 可用${NC}"
        return 1
    fi
}

# 检查主要端口
echo "检查项目端口..."
check_port 3001 "后端服务" && BACKEND_OCCUPIED=1 || BACKEND_OCCUPIED=0
check_port 3000 "前端开发服务" && FRONTEND_DEV_OCCUPIED=1 || FRONTEND_DEV_OCCUPIED=0
check_port 80 "前端生产服务" && FRONTEND_PROD_OCCUPIED=1 || FRONTEND_PROD_OCCUPIED=0

echo "检查节点端口..."
check_port 3002 "节点服务" && AGENT_OCCUPIED=1 || AGENT_OCCUPIED=0
check_port 3003 "节点服务-备用" && AGENT_ALT_OCCUPIED=1 || AGENT_ALT_OCCUPIED=0

# 智能停止服务
stop_services() {
    echo -e "${YELLOW}🛑 智能停止相关服务...${NC}"
    
    # 停止 Docker 容器（如果存在）
    if docker ps -q --filter "name=ssalgten" | grep -q .; then
        echo "停止 SsalgTen Docker 容器..."
        docker stop $(docker ps -q --filter "name=ssalgten") 2>/dev/null || true
    fi
    
    # 停止可能的 PM2 进程
    if command -v pm2 >/dev/null 2>&1; then
        echo "检查 PM2 进程..."
        pm2 list | grep -E "(ssalgten|agent)" && pm2 stop all || echo "没有找到相关 PM2 进程"
    fi
    
    # 停止占用端口的进程（谨慎操作）
    if [ "$BACKEND_OCCUPIED" = "1" ]; then
        echo "正在停止后端服务 (端口 3001)..."
        fuser -k 3001/tcp 2>/dev/null || true
        sleep 2
    fi
    
    if [ "$FRONTEND_DEV_OCCUPIED" = "1" ]; then
        echo "正在停止前端开发服务 (端口 3000)..."
        fuser -k 3000/tcp 2>/dev/null || true
        sleep 2
    fi
    
    # 保护节点服务，询问用户是否停止
    if [ "$AGENT_OCCUPIED" = "1" ]; then
        echo -e "${YELLOW}⚠️  检测到节点服务正在运行 (端口 3002)${NC}"
        read -p "是否需要重启节点服务？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "停止节点服务..."
            fuser -k 3002/tcp 2>/dev/null || true
            RESTART_AGENT=1
        else
            echo "保持节点服务运行"
            RESTART_AGENT=0
        fi
    fi
}

# 执行服务停止
stop_services

# 拉取最新代码
echo -e "${BLUE}📥 拉取最新代码...${NC}"
git stash push -m "自动备份本地更改 $(date)" 2>/dev/null || true
git pull origin main

# 处理脚本文件格式
echo -e "${BLUE}🔧 处理脚本文件格式...${NC}"
if command -v dos2unix >/dev/null 2>&1; then
    find scripts/ -name "*.sh" -exec dos2unix {} \; 2>/dev/null || true
else
    find scripts/ -name "*.sh" -exec sed -i 's/\r$//' {} \; 2>/dev/null || true
fi

# 设置脚本执行权限
find scripts/ -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# 运行前端更新脚本
echo -e "${BLUE}🎨 更新前端...${NC}"
if [ -f scripts/update-frontend.sh ]; then
    bash scripts/update-frontend.sh
else
    echo -e "${RED}❌ 前端更新脚本不存在${NC}"
    exit 1
fi

# 检查是否需要更新后端依赖
echo -e "${BLUE}🔧 检查后端依赖...${NC}"
if [ -f backend/package.json ]; then
    cd backend
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi
    cd ..
fi

# 安全的容器清理（仅针对项目相关）
safe_docker_cleanup() {
    echo -e "${YELLOW}🧹 安全清理项目容器...${NC}"
    
    # 获取项目相关的容器
    PROJECT_NAME=$(basename $(pwd) | tr '[:upper:]' '[:lower:]')
    
    # 停止并删除项目相关容器
    if docker-compose ps -q 2>/dev/null | grep -q .; then
        echo "停止项目容器..."
        docker-compose down -v --rmi local 2>/dev/null || true
    fi
    
    # 清理项目相关的悬空镜像（可选，需要确认）
    read -p "是否清理项目相关的悬空镜像？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "清理悬空镜像..."
        docker image prune -f --filter "label=com.docker.compose.project=${PROJECT_NAME}" 2>/dev/null || true
    fi
}

# 创建变更摘要
create_change_summary() {
    local log_dir="/tmp/ssalgten-update-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$log_dir"
    
    # 记录服务状态变更
    echo "=== 更新前后服务状态对比 ===" > "$log_dir/changes.txt"
    echo "更新时间: $(date)" >> "$log_dir/changes.txt"
    echo "项目目录: $(pwd)" >> "$log_dir/changes.txt"
    echo "" >> "$log_dir/changes.txt"
    
    # Docker服务状态
    if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
        echo "=== Docker服务状态 ===" >> "$log_dir/changes.txt"
        docker-compose ps >> "$log_dir/changes.txt" 2>&1
        echo "" >> "$log_dir/changes.txt"
    fi
    
    # 端口占用情况
    echo "=== 端口占用情况 ===" >> "$log_dir/changes.txt"
    echo "后端端口 (3001): $(lsof -ti:3001 >/dev/null 2>&1 && echo "占用" || echo "空闲")" >> "$log_dir/changes.txt"
    echo "前端端口 (80): $(lsof -ti:80 >/dev/null 2>&1 && echo "占用" || echo "空闲")" >> "$log_dir/changes.txt"
    echo "节点端口 (3002): $(lsof -ti:3002 >/dev/null 2>&1 && echo "占用" || echo "空闲")" >> "$log_dir/changes.txt"
    echo "" >> "$log_dir/changes.txt"
    
    echo -e "${BLUE}📋 变更摘要已保存到: $log_dir/changes.txt${NC}"
    CHANGE_LOG_DIR="$log_dir"
}

# 重新启动服务
restart_services() {
    echo -e "${GREEN}🚀 重新启动服务...${NC}"
    
    # 执行安全清理
    safe_docker_cleanup
    
    # 创建变更摘要
    create_change_summary
    
    # 如果存在 Docker Compose 配置，优先使用 Docker
    if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
        echo "使用 Docker Compose 启动服务..."
        
        # 启动服务并捕获输出
        if docker-compose up -d 2>"${CHANGE_LOG_DIR}/docker-startup.log"; then
            echo -e "${GREEN}✅ Docker服务启动成功${NC}"
        else
            echo -e "${RED}❌ Docker服务启动失败${NC}"
            echo "查看错误日志: cat ${CHANGE_LOG_DIR}/docker-startup.log"
            echo "查看服务日志: docker-compose logs"
            return 1
        fi
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        echo -e "${BLUE}📊 检查服务状态...${NC}"
        docker-compose ps
        
    # 如果有 PM2 配置，使用 PM2
    elif [ -f ecosystem.config.js ] && command -v pm2 >/dev/null 2>&1; then
        echo "使用 PM2 启动服务..."
        pm2 start ecosystem.config.js
        
    # 手动启动服务
    else
        echo "手动启动服务..."
        
        # 启动后端
        if [ -f backend/package.json ]; then
            cd backend
            npm run start &
            BACKEND_PID=$!
            cd ..
            echo "后端服务已启动 (PID: $BACKEND_PID)"
        fi
        
        # 如果需要重启节点服务
        if [ "${RESTART_AGENT:-0}" = "1" ] && [ -f agent/package.json ]; then
            echo "重启节点服务..."
            cd agent
            npm run start &
            AGENT_PID=$!
            cd ..
            echo "节点服务已启动 (PID: $AGENT_PID)"
        fi
    fi
}

# 执行服务重启
restart_services

# 最终检查和状态汇总
final_status_check() {
    echo -e "${BLUE}🔍 最终服务状态检查...${NC}"
    sleep 5

    local all_services_ok=true
    
    echo "检查服务端口状态..."
    if check_port 3001 "后端服务"; then
        echo -e "${GREEN}✅ 后端服务运行正常${NC}"
    else
        echo -e "${RED}❌ 后端服务未启动${NC}"
        all_services_ok=false
    fi

    if [ "${RESTART_AGENT:-0}" = "1" ] || [ "$AGENT_OCCUPIED" = "1" ]; then
        if check_port 3002 "节点服务"; then
            echo -e "${GREEN}✅ 节点服务运行正常${NC}"
        else
            echo -e "${RED}❌ 节点服务未启动${NC}"
            all_services_ok=false
        fi
    fi
    
    # 生成最终变更摘要
    if [ -n "$CHANGE_LOG_DIR" ]; then
        echo "" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "=== 最终服务状态 ===" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "后端服务 (3001): $(check_port 3001 "后端服务" && echo "✅ 运行正常" || echo "❌ 未启动")" >> "$CHANGE_LOG_DIR/changes.txt"
        if [ "${RESTART_AGENT:-0}" = "1" ] || [ "$AGENT_OCCUPIED" = "1" ]; then
            echo "节点服务 (3002): $(check_port 3002 "节点服务" && echo "✅ 运行正常" || echo "❌ 未启动")" >> "$CHANGE_LOG_DIR/changes.txt"
        fi
        echo "" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "=== 故障排查指南 ===" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "如果服务启动失败，请检查：" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "1. 查看Docker日志: docker-compose logs -f" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "2. 查看具体服务: docker-compose logs <service_name>" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "3. 检查端口占用: lsof -i :3001" >> "$CHANGE_LOG_DIR/changes.txt"
        echo "4. 重启服务: docker-compose restart" >> "$CHANGE_LOG_DIR/changes.txt"
        
        echo -e "${BLUE}📄 完整变更报告: $CHANGE_LOG_DIR/changes.txt${NC}"
    fi
    
    # 如果有服务异常，提供故障排查提示
    if [ "$all_services_ok" = false ]; then
        echo -e "${RED}⚠️  部分服务启动异常，请检查:${NC}"
        echo "   - 查看详细日志: docker-compose logs -f"
        echo "   - 检查端口占用: ss -tlnp"
        echo "   - 手动重启: docker-compose restart"
        if [ -n "$CHANGE_LOG_DIR" ]; then
            echo "   - 查看变更报告: cat $CHANGE_LOG_DIR/changes.txt"
        fi
        return 1
    fi
    
    return 0
}

# 执行最终检查
final_status_check

# 显示访问信息
echo -e "${GREEN}"
echo "===========================================" 
echo "🎉 SsalgTen 重构完成！"
echo "==========================================="
echo "📊 监控面板: http://$(hostname -I | awk '{print $1}'):3001"
echo "🌐 前端页面: http://$(hostname -I | awk '{print $1}'):80"
echo "🔧 节点状态: http://$(hostname -I | awk '{print $1}'):3002"
echo "===========================================" 
echo -e "${NC}"

# 显示有用的命令
echo -e "${BLUE}💡 有用的管理命令:${NC}"
echo "查看日志: docker-compose logs -f"
echo "重启服务: docker-compose restart"
echo "停止服务: docker-compose down"
echo "查看状态: docker-compose ps"

echo -e "${GREEN}✅ 重构流程完成！${NC}"
