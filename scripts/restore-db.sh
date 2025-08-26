#!/bin/bash

# SsalgTen 数据库恢复脚本
# 使用方法: ./restore-db.sh [backup_name]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 SsalgTen 数据库恢复工具${NC}"
echo "=================================="

# 备份目录
BACKUP_DIR="./backups"

# 如果没有提供备份名称，列出可用备份
if [ $# -eq 0 ]; then
    echo -e "${BLUE}📦 可用的备份文件:${NC}"
    if ls "$BACKUP_DIR"/ssalgten-*.sql >/dev/null 2>&1; then
        ls -lh "$BACKUP_DIR"/ssalgten-*.sql | while read -r line; do
            filename=$(echo "$line" | awk '{print $9}')
            size=$(echo "$line" | awk '{print $5}')
            date=$(echo "$line" | awk '{print $6, $7, $8}')
            basename_file=$(basename "$filename" .sql)
            backup_name=$(echo "$basename_file" | sed 's/^ssalgten-//')
            echo "  $backup_name ($size) - $date"
        done
        echo ""
        echo -e "${YELLOW}使用方法: ./restore-db.sh <backup_name>${NC}"
    else
        echo -e "${RED}❌ 未找到任何备份文件${NC}"
        echo "请先运行: ./backup-db.sh"
    fi
    exit 0
fi

BACKUP_NAME=$1
BACKUP_FILE="${BACKUP_DIR}/ssalgten-${BACKUP_NAME}.sql"

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ 备份文件不存在: $BACKUP_FILE${NC}"
    echo ""
    echo -e "${BLUE}可用备份:${NC}"
    ./restore-db.sh
    exit 1
fi

# 显示备份信息
if [ -f "${BACKUP_FILE}.info" ]; then
    echo -e "${BLUE}📋 备份信息:${NC}"
    cat "${BACKUP_FILE}.info"
    echo ""
fi

# 检查Docker环境
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未安装或不可用${NC}"
    exit 1
fi

# 检查docker-compose配置
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
    echo -e "${RED}❌ 未找到 docker-compose 配置文件${NC}"
    exit 1
fi

# 获取数据库容器信息
DB_CONTAINER=$(docker-compose ps -q database 2>/dev/null)
if [ -z "$DB_CONTAINER" ]; then
    echo -e "${YELLOW}⚠️ 数据库容器未运行，正在启动...${NC}"
    docker-compose up -d database
    
    # 等待数据库启动
    echo "等待数据库启动..."
    sleep 10
    
    DB_CONTAINER=$(docker-compose ps -q database 2>/dev/null)
    if [ -z "$DB_CONTAINER" ]; then
        echo -e "${RED}❌ 数据库容器启动失败${NC}"
        exit 1
    fi
fi

# 读取数据库配置
DB_NAME=${POSTGRES_DB:-"ssalgten"}
DB_USER=${POSTGRES_USER:-"ssalgten"}

echo -e "${YELLOW}📋 恢复信息:${NC}"
echo "  备份名称: $BACKUP_NAME"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo "  备份文件: $BACKUP_FILE"
echo ""

# 严重警告
echo -e "${RED}⚠️ 警告: 此操作将完全替换现有数据库！${NC}"
echo -e "${RED}⚠️ 所有当前数据将被永久删除！${NC}"
echo ""

# 双重确认
read -p "确认要恢复此备份吗？输入 'YES' 继续: " -r
if [ "$REPLY" != "YES" ]; then
    echo -e "${YELLOW}⏹️ 恢复已取消${NC}"
    exit 0
fi

# 创建当前数据的紧急备份
echo -e "${BLUE}🛡️ 创建紧急备份...${NC}"
EMERGENCY_BACKUP="${BACKUP_DIR}/emergency-backup-$(date +%Y%m%d-%H%M%S).sql"
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$EMERGENCY_BACKUP" 2>/dev/null; then
    echo -e "${GREEN}✅ 紧急备份已创建: $EMERGENCY_BACKUP${NC}"
else
    echo -e "${YELLOW}⚠️ 紧急备份失败，继续恢复过程${NC}"
fi

echo -e "${BLUE}🚀 开始恢复数据库...${NC}"

# 停止应用服务避免数据冲突
echo "停止应用服务..."
docker-compose stop backend frontend 2>/dev/null || true

# 执行数据库恢复
if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ 数据库恢复完成！${NC}"
    
    # 重启应用服务
    echo -e "${BLUE}🔄 重启应用服务...${NC}"
    docker-compose up -d
    
    # 等待服务启动
    echo "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    echo -e "${BLUE}📊 服务状态检查:${NC}"
    docker-compose ps
    
    echo ""
    echo -e "${GREEN}🎉 数据库恢复完成！${NC}"
    echo -e "${BLUE}💡 提示:${NC}"
    echo "  - 如果需要回滚，使用紧急备份: ./restore-db.sh $(basename "$EMERGENCY_BACKUP" .sql | sed 's/^ssalgten-//')"
    echo "  - 检查应用日志: docker-compose logs -f"
    
else
    echo -e "${RED}❌ 数据库恢复失败${NC}"
    
    # 尝试恢复紧急备份
    if [ -f "$EMERGENCY_BACKUP" ]; then
        echo -e "${YELLOW}🛡️ 尝试恢复紧急备份...${NC}"
        if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$EMERGENCY_BACKUP"; then
            echo -e "${GREEN}✅ 紧急备份恢复成功${NC}"
        else
            echo -e "${RED}❌ 紧急备份恢复也失败了${NC}"
        fi
    fi
    
    # 重启服务
    docker-compose up -d
    exit 1
fi