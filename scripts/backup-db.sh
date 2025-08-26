#!/bin/bash

# SsalgTen 数据库备份脚本
# 使用方法: ./backup-db.sh [backup_name]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️ SsalgTen 数据库备份工具${NC}"
echo "=================================="

# 获取备份名称
BACKUP_NAME=${1:-"manual-$(date +%Y%m%d-%H%M%S)"}
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/ssalgten-${BACKUP_NAME}.sql"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

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
    echo -e "${RED}❌ 数据库容器未运行${NC}"
    echo "请先启动服务: docker-compose up -d"
    exit 1
fi

# 读取数据库配置
DB_NAME=${POSTGRES_DB:-"ssalgten"}
DB_USER=${POSTGRES_USER:-"ssalgten"}

echo -e "${YELLOW}📋 备份信息:${NC}"
echo "  备份名称: $BACKUP_NAME"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo "  备份文件: $BACKUP_FILE"
echo ""

# 确认备份
read -p "确认开始备份？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️ 备份已取消${NC}"
    exit 0
fi

echo -e "${BLUE}🚀 开始备份...${NC}"

# 执行数据库备份
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE" 2>/dev/null; then
    # 获取备份文件大小
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    
    echo -e "${GREEN}✅ 备份完成！${NC}"
    echo "  文件: $BACKUP_FILE"
    echo "  大小: $BACKUP_SIZE"
    
    # 添加备份元信息
    cat > "${BACKUP_FILE}.info" <<EOF
备份信息
========
备份时间: $(date)
数据库名: $DB_NAME
用户名: $DB_USER
备份大小: $BACKUP_SIZE
容器ID: $DB_CONTAINER
项目目录: $(pwd)
Git版本: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
EOF
    
    echo -e "${BLUE}📄 备份信息已保存到: ${BACKUP_FILE}.info${NC}"
    
else
    echo -e "${RED}❌ 备份失败${NC}"
    exit 1
fi

# 列出现有备份
echo ""
echo -e "${BLUE}📦 现有备份列表:${NC}"
ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null | while read -r line; do
    filename=$(echo "$line" | awk '{print $9}')
    size=$(echo "$line" | awk '{print $5}')
    date=$(echo "$line" | awk '{print $6, $7, $8}')
    basename_file=$(basename "$filename")
    echo "  $basename_file ($size) - $date"
done

# 清理旧备份（保留最近10个）
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/ssalgten-*.sql 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
    echo ""
    echo -e "${YELLOW}🧹 清理旧备份 (保留最近10个)...${NC}"
    ls -t "$BACKUP_DIR"/ssalgten-*.sql | tail -n +11 | xargs -r rm -f
    ls -t "$BACKUP_DIR"/ssalgten-*.sql.info | tail -n +11 | xargs -r rm -f 2>/dev/null || true
    echo -e "${GREEN}✅ 清理完成${NC}"
fi

echo ""
echo -e "${GREEN}🎉 备份流程完成！${NC}"
echo ""
echo -e "${BLUE}💡 使用备份:${NC}"
echo "  恢复备份: ./restore-db.sh $BACKUP_NAME"
echo "  查看信息: cat ${BACKUP_FILE}.info"