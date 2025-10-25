#!/bin/bash

# 流媒体表修复脚本 - 修复枚举类型错误
# 此脚本用于修复数据库中错误的枚举值并重新创建表

echo "=========================================================="
echo "流媒体表枚举类型修复脚本"
echo "=========================================================="
echo ""
echo "问题: 之前创建的枚举类型与 schema.prisma 不匹配"
echo "解决: 删除错误的表和枚举,使用正确的枚举值重新创建"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 从 docker-compose.yml 或环境变量获取数据库信息
DB_CONTAINER="ssalgten-database"
DB_NAME="${POSTGRES_DB:-ssalgten}"
DB_USER="${POSTGRES_USER:-ssalgten}"

# 检查数据库容器是否运行
echo -e "${YELLOW}步骤 1: 检查数据库连接...${NC}"
if ! docker ps | grep -q $DB_CONTAINER; then
    echo -e "${RED}错误: 数据库容器未运行${NC}"
    echo "请先启动数据库: docker-compose up -d database"
    exit 1
fi
echo -e "${GREEN}✓ 数据库容器正在运行${NC}"

echo ""
echo -e "${YELLOW}步骤 2: 备份现有数据...${NC}"

# 检查表是否有数据
STREAMING_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT COUNT(*) FROM streaming_tests;" 2>/dev/null || echo "0")

SERVICES_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT COUNT(*) FROM detected_services;" 2>/dev/null || echo "0")

echo "现有数据统计:"
echo "  - streaming_tests: ${STREAMING_COUNT} 条记录"
echo "  - detected_services: ${SERVICES_COUNT} 条记录"

if [ "$STREAMING_COUNT" != "0" ] || [ "$SERVICES_COUNT" != "0" ]; then
    echo -e "${YELLOW}警告: 发现现有数据,将被删除!${NC}"
    echo -e "${BLUE}这些数据是测试数据,删除后 Agent 会在下次检测时重新生成${NC}"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}步骤 3: 删除错误的表和枚举...${NC}"

# 执行回滚
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < rollback-streaming-tables.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 成功删除旧表和枚举${NC}"
else
    echo -e "${RED}✗ 删除失败,请检查日志${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}步骤 4: 使用正确的枚举值创建表...${NC}"

# 执行修复后的迁移
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < fix-streaming-tables-corrected.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 成功创建表和枚举${NC}"
else
    echo -e "${RED}✗ 创建失败,请检查日志${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}步骤 5: 验证枚举类型...${NC}"

# 验证枚举值
echo "验证 StreamingService 枚举:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
    "SELECT unnest(enum_range(NULL::\"StreamingService\"));"

echo ""
echo "验证 StreamingStatus 枚举:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
    "SELECT unnest(enum_range(NULL::\"StreamingStatus\"));"

echo ""
echo "验证 UnlockType 枚举:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
    "SELECT unnest(enum_range(NULL::\"UnlockType\"));"

echo ""
echo -e "${YELLOW}步骤 6: 验证表结构...${NC}"

# 检查表是否创建成功
STREAMING_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'streaming_tests');")

SERVICES_EXISTS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'detected_services');")

echo "表状态:"
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
    echo -e "${GREEN}=========================================================="
    echo "✓ 修复完成!"
    echo "==========================================================${NC}"
    echo ""
    echo -e "${BLUE}下一步操作:${NC}"
    echo "  1. 重启 Backend 服务:"
    echo "     docker-compose restart backend"
    echo ""
    echo "  2. 刷新浏览器中的流媒体页面"
    echo ""
    echo "  3. Agent 会在启动后 1 分钟内执行首次检测"
    echo "     之后每 24 小时自动执行一次"
    echo ""
    echo -e "${YELLOW}注意:${NC}"
    echo "  - 500 错误应该已修复 (枚举类型现在正确)"
    echo "  - 如果仍有 429 错误,请稍等几分钟后再试"
    echo "  - 可以查看日志: docker-compose logs -f backend"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================================="
    echo "✗ 修复失败"
    echo "==========================================================${NC}"
    echo ""
    echo "请检查数据库日志: docker-compose logs database"
    exit 1
fi
