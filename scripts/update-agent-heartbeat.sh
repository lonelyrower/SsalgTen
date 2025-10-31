#!/bin/bash

# SsalgTen Agent 心跳间隔批量更新脚本
# 用于将现有 Agent 的心跳间隔从 30 秒改为 5 分钟
#
# 使用方法:
#   方法1 - 手动在每台VPS上执行:
#     curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash
#
#   方法2 - 使用SSH批量执行（需要配置好SSH密钥）:
#     # 创建VPS列表文件 vps_list.txt，每行一个IP
#     # 然后执行:
#     cat vps_list.txt | while read ip; do ssh root@$ip "curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash"; done
#
# 参数:
#   --interval MILLISECONDS  设置心跳间隔（毫秒），默认 300000 (5分钟)
#   --no-restart            只修改配置，不重启服务
#   --dry-run              仅显示将要执行的操作，不实际修改

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认配置
NEW_INTERVAL=300000  # 5分钟
NO_RESTART=false
DRY_RUN=false
APP_DIR="/opt/ssalgten-agent"

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
        --interval)
            NEW_INTERVAL="$2"
            shift 2
            ;;
        --no-restart)
            NO_RESTART=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "未知参数: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "======================================"
echo "  SsalgTen Agent 心跳间隔更新工具"
echo "======================================"
echo ""

# 检查是否安装了 Agent
if [ ! -d "$APP_DIR" ]; then
    log_error "未找到 Agent 安装目录: $APP_DIR"
    log_info "请先安装 Agent 或修改 APP_DIR 变量"
    exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
    log_error "未找到配置文件: $APP_DIR/.env"
    exit 1
fi

# 显示当前配置
CURRENT_INTERVAL=$(grep '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "未设置")
log_info "当前心跳间隔: $CURRENT_INTERVAL ms"
log_info "新的心跳间隔: $NEW_INTERVAL ms ($(($NEW_INTERVAL / 1000 / 60)) 分钟)"
echo ""

# 如果是 dry-run 模式
if [ "$DRY_RUN" = true ]; then
    log_warning "[DRY RUN] 仅显示操作，不实际执行"
    log_info "将执行以下操作:"
    echo "  1. 修改 $APP_DIR/.env 中的 HEARTBEAT_INTERVAL=$NEW_INTERVAL"
    if [ "$NO_RESTART" = false ]; then
        echo "  2. 重启服务: systemctl restart ssalgten-agent"
    fi
    exit 0
fi

# 确认操作
if [ "$CURRENT_INTERVAL" = "$NEW_INTERVAL" ]; then
    log_success "心跳间隔已经是 $NEW_INTERVAL ms，无需修改"
    exit 0
fi

log_warning "即将修改 Agent 配置并重启服务"
read -p "确认继续？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "已取消操作"
    exit 0
fi

# 备份配置文件
log_info "备份配置文件..."
cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"

# 修改配置
log_info "修改心跳间隔配置..."
if grep -q '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env"; then
    # 已存在，替换
    sed -i "s/^HEARTBEAT_INTERVAL=.*/HEARTBEAT_INTERVAL=$NEW_INTERVAL/" "$APP_DIR/.env"
else
    # 不存在，追加
    echo "HEARTBEAT_INTERVAL=$NEW_INTERVAL" >> "$APP_DIR/.env"
fi

# 验证修改
NEW_VALUE=$(grep '^HEARTBEAT_INTERVAL=' "$APP_DIR/.env" | cut -d'=' -f2)
if [ "$NEW_VALUE" = "$NEW_INTERVAL" ]; then
    log_success "配置已更新: HEARTBEAT_INTERVAL=$NEW_INTERVAL"
else
    log_error "配置更新失败，请检查文件: $APP_DIR/.env"
    exit 1
fi

# 重启服务
if [ "$NO_RESTART" = false ]; then
    log_info "重启 Agent 服务..."

    if systemctl is-active --quiet ssalgten-agent.service; then
        systemctl restart ssalgten-agent.service
        sleep 2

        if systemctl is-active --quiet ssalgten-agent.service; then
            log_success "服务已重启，新配置已生效"
        else
            log_error "服务重启失败，请检查日志: journalctl -u ssalgten-agent -n 50"
            exit 1
        fi
    else
        log_warning "服务未运行，启动服务..."
        systemctl start ssalgten-agent.service
        sleep 2

        if systemctl is-active --quiet ssalgten-agent.service; then
            log_success "服务已启动"
        else
            log_error "服务启动失败"
            exit 1
        fi
    fi
else
    log_warning "已跳过服务重启（--no-restart）"
    log_info "请手动重启服务: systemctl restart ssalgten-agent"
fi

echo ""
log_success "✅ 更新完成！"
echo ""
log_info "验证服务状态: systemctl status ssalgten-agent"
log_info "查看日志: journalctl -u ssalgten-agent -f"
echo ""
