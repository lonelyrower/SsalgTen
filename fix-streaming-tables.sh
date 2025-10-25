#!/bin/bash

# 流媒体表修复脚本
# 用于创建缺失的 streaming_tests 和 detected_services 表

echo "=================================================="
echo "流媒体和服务检测表修复脚本"
echo "=================================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}步骤 1: 检查数据库连接...${NC}"

# 从 docker-compose.yml 或环境变量获取数据库信息
DB_CONTAINER="ssalgten-database"
DB_NAME="${POSTGRES_DB:-ssalgten}"
DB_USER="${POSTGRES_USER:-ssalgten}"

# 检查数据库容器是否运行
if ! docker ps | grep -q $DB_CONTAINER; then
    echo -e "${RED}错误: 数据库容器未运行${NC}"
    echo "请先启动数据库: docker-compose up -d database"
    exit 1
fi

echo -e "${GREEN}✓ 数据库容器正在运行${NC}"

echo ""
echo -e "${YELLOW}步骤 2: 检查表是否存在...${NC}"

# 检查 streaming_tests 表
STREAMING_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'streaming_tests');")

# 检查 detected_services 表
SERVICES_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detected_services');")

if [ "$STREAMING_EXISTS" = "t" ] && [ "$SERVICES_EXISTS" = "t" ]; then
    echo -e "${GREEN}✓ 表已存在，无需修复${NC}"
    echo ""
    echo "表状态:"
    echo "  - streaming_tests: 存在"
    echo "  - detected_services: 存在"
    exit 0
fi

echo "表状态:"
if [ "$STREAMING_EXISTS" = "t" ]; then
    echo -e "  - streaming_tests: ${GREEN}存在${NC}"
else
    echo -e "  - streaming_tests: ${RED}缺失${NC}"
fi

if [ "$SERVICES_EXISTS" = "t" ]; then
    echo -e "  - detected_services: ${GREEN}存在${NC}"
else
    echo -e "  - detected_services: ${RED}缺失${NC}"
fi

echo ""
echo -e "${YELLOW}步骤 3: 执行数据库迁移...${NC}"

cd backend

# 方式一：使用 Prisma Migrate
echo "尝试使用 Prisma Migrate..."
if npm run prisma:migrate:deploy 2>/dev/null; then
    echo -e "${GREEN}✓ Prisma 迁移成功${NC}"
else
    echo -e "${YELLOW}Prisma 迁移失败，尝试手动执行 SQL...${NC}"

    # 方式二：直接执行 SQL
    SQL_FILE="../backend/prisma/migrations/20251025000000_add_streaming_and_services/migration.sql"

    if [ -f "$SQL_FILE" ]; then
        echo "执行迁移 SQL..."
        docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < $SQL_FILE

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ SQL 迁移成功${NC}"
        else
            echo -e "${RED}✗ SQL 迁移失败${NC}"
            exit 1
        fi
    else
        echo -e "${RED}错误: 找不到迁移文件 $SQL_FILE${NC}"
        exit 1
    fi
fi

cd ..

echo ""
echo -e "${YELLOW}步骤 4: 验证表创建...${NC}"

# 再次检查表
STREAMING_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'streaming_tests');")

SERVICES_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detected_services');")

echo "验证结果:"
if [ "$STREAMING_EXISTS" = "t" ]; then
    echo -e "  - streaming_tests: ${GREEN}✓ 已创建${NC}"
else
    echo -e "  - streaming_tests: ${RED}✗ 创建失败${NC}"
fi

if [ "$SERVICES_EXISTS" = "t" ]; then
    echo -e "  - detected_services: ${GREEN}✓ 已创建${NC}"
else
    echo -e "  - detected_services: ${RED}✗ 创建失败${NC}"
fi

if [ "$STREAMING_EXISTS" = "t" ] && [ "$SERVICES_EXISTS" = "t" ]; then
    echo ""
    echo -e "${GREEN}=================================================="
    echo "✓ 修复完成！"
    echo "=================================================="
    echo -e "${NC}"
    echo "下一步操作："
    echo "  1. 重启 Backend 服务: docker-compose restart backend"
    echo "  2. 重启 Agent 服务（在各个节点上）"
    echo "  3. 刷新流媒体页面"
    echo ""
    echo "Agent 会在启动后 1 分钟内执行首次流媒体检测"
    exit 0
else
    echo ""
    echo -e "${RED}=================================================="
    echo "✗ 修复失败"
    echo "=================================================="
    echo -e "${NC}"
    echo "请检查数据库日志: docker-compose logs database"
    exit 1
fi
