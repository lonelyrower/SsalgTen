#!/bin/bash

# SsalgTen Agent 批量更新脚本
# 用于批量更新多台VPS上的Agent心跳间隔
#
# 使用方法:
#   1. 创建 VPS 列表文件（如 vps_list.txt），每行一个IP地址或主机名:
#      192.168.1.100
#      192.168.1.101
#      node1.example.com
#
#   2. 执行批量更新:
#      bash batch-update-agents.sh vps_list.txt
#
#   3. 使用自定义SSH用户:
#      bash batch-update-agents.sh vps_list.txt --user ubuntu
#
# 前置要求:
#   - 已配置SSH密钥免密登录所有VPS
#   - 远程用户有sudo权限（或使用root用户）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认配置
SSH_USER="root"
VPS_LIST_FILE=""
PARALLEL=false
MAX_PARALLEL=10
UPDATE_SCRIPT_URL="https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh"

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

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --user)
            SSH_USER="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        --max-parallel)
            MAX_PARALLEL="$2"
            shift 2
            ;;
        *)
            if [ -z "$VPS_LIST_FILE" ]; then
                VPS_LIST_FILE="$1"
            else
                log_error "未知参数: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# 显示帮助
if [ -z "$VPS_LIST_FILE" ]; then
    echo "Usage: $0 <vps_list_file> [options]"
    echo ""
    echo "Options:"
    echo "  --user <username>       SSH用户名 (默认: root)"
    echo "  --parallel             并行执行更新 (默认: 串行)"
    echo "  --max-parallel <num>    最大并行数 (默认: 10)"
    echo ""
    echo "Example:"
    echo "  $0 vps_list.txt"
    echo "  $0 vps_list.txt --user ubuntu --parallel --max-parallel 5"
    echo ""
    exit 1
fi

# 检查VPS列表文件
if [ ! -f "$VPS_LIST_FILE" ]; then
    log_error "VPS列表文件不存在: $VPS_LIST_FILE"
    exit 1
fi

# 统计VPS数量
TOTAL_VPS=$(grep -v '^#' "$VPS_LIST_FILE" | grep -v '^[[:space:]]*$' | wc -l)

echo ""
echo "================================================"
echo "  SsalgTen Agent 批量更新工具"
echo "================================================"
echo ""
log_info "VPS列表文件: $VPS_LIST_FILE"
log_info "VPS总数: $TOTAL_VPS"
log_info "SSH用户: $SSH_USER"
log_info "执行模式: $([ "$PARALLEL" = true ] && echo "并行 (最大 $MAX_PARALLEL)" || echo "串行")"
echo ""

# 确认操作
log_warning "即将在 $TOTAL_VPS 台VPS上更新Agent心跳间隔"
read -p "确认继续？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "已取消操作"
    exit 0
fi

# 创建临时结果文件
RESULT_FILE=$(mktemp)
SUCCESS_COUNT=0
FAILED_COUNT=0

# 单个VPS更新函数
update_vps() {
    local host=$1
    local index=$2

    log_info "[$index/$TOTAL_VPS] 开始更新: $host"

    # SSH连接并执行更新脚本
    if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${SSH_USER}@${host}" \
        "curl -fsSL $UPDATE_SCRIPT_URL | bash -s -- --no-confirm" > /tmp/update_${host}.log 2>&1; then
        echo "SUCCESS:$host" >> "$RESULT_FILE"
        log_success "[$index/$TOTAL_VPS] ✅ $host - 更新成功"
    else
        echo "FAILED:$host" >> "$RESULT_FILE"
        log_error "[$index/$TOTAL_VPS] ❌ $host - 更新失败（查看日志: /tmp/update_${host}.log）"
    fi
}

# 执行更新
INDEX=0
while IFS= read -r host || [ -n "$host" ]; do
    # 跳过注释和空行
    [[ "$host" =~ ^#.*$ ]] && continue
    [[ -z "$host" ]] && continue

    INDEX=$((INDEX + 1))

    if [ "$PARALLEL" = true ]; then
        # 并行模式
        while [ $(jobs -r | wc -l) -ge $MAX_PARALLEL ]; do
            sleep 1
        done
        update_vps "$host" "$INDEX" &
    else
        # 串行模式
        update_vps "$host" "$INDEX"
    fi
done < "$VPS_LIST_FILE"

# 等待所有后台任务完成
if [ "$PARALLEL" = true ]; then
    wait
fi

# 统计结果
SUCCESS_COUNT=$(grep -c "^SUCCESS:" "$RESULT_FILE" 2>/dev/null || echo 0)
FAILED_COUNT=$(grep -c "^FAILED:" "$RESULT_FILE" 2>/dev/null || echo 0)

echo ""
echo "================================================"
echo "  更新结果汇总"
echo "================================================"
log_success "成功: $SUCCESS_COUNT / $TOTAL_VPS"
if [ $FAILED_COUNT -gt 0 ]; then
    log_error "失败: $FAILED_COUNT / $TOTAL_VPS"
    echo ""
    log_info "失败的VPS列表:"
    grep "^FAILED:" "$RESULT_FILE" | cut -d':' -f2
fi
echo ""

# 清理临时文件
rm -f "$RESULT_FILE"

exit $FAILED_COUNT
