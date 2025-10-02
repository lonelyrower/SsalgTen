#!/usr/bin/env bash

# WSL2 Docker 环境检查和修复助手
# 用于快速诊断 WSL2 中的 Docker 配置问题

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  WSL2 Docker 环境检查工具${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo

# 1. 检测是否在 WSL2 环境
echo -e "${BLUE}[1/6]${NC} 检测运行环境..."
if grep -qi microsoft /proc/version 2>/dev/null || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    echo -e "${GREEN}✓${NC} 检测到 WSL2 环境"
    IS_WSL2=true
    if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        echo -e "  发行版: ${CYAN}${WSL_DISTRO_NAME}${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} 原生 Linux 环境"
    IS_WSL2=false
fi
echo

# 2. 检查 Docker 命令是否可用
echo -e "${BLUE}[2/6]${NC} 检查 Docker 命令..."
if command -v docker >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker 命令已安装"
    docker --version
else
    echo -e "${RED}✗${NC} Docker 命令未找到"
    if [[ "$IS_WSL2" == "true" ]]; then
        echo -e "${YELLOW}💡 提示:${NC} 请确保 Docker Desktop 已安装并启动"
    else
        echo -e "${YELLOW}💡 提示:${NC} 请安装 Docker"
    fi
    exit 1
fi
echo

# 3. 检查 Docker 守护进程
echo -e "${BLUE}[3/6]${NC} 检查 Docker 守护进程..."
if docker version >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker 守护进程正在运行"
    docker version --format '  客户端: {{.Client.Version}}'
    docker version --format '  服务端: {{.Server.Version}}'
else
    echo -e "${RED}✗${NC} Docker 守护进程无法访问"
    
    if [[ "$IS_WSL2" == "true" ]]; then
        echo
        echo -e "${RED}❌ Docker Desktop WSL2 集成未配置！${NC}"
        echo
        echo -e "${YELLOW}请按以下步骤修复：${NC}"
        echo
        echo "1️⃣  确保 Windows 上的 Docker Desktop 已启动"
        echo "   → 检查任务栏是否有 Docker 图标"
        echo
        echo "2️⃣  打开 Docker Desktop 设置"
        echo "   → 点击右上角齿轮图标 ⚙️"
        echo
        echo "3️⃣  配置 WSL2 集成"
        echo "   → Resources → WSL Integration"
        echo "   → 启用 'Enable integration with my default WSL distro'"
        if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
            echo "   → 启用 '${WSL_DISTRO_NAME}' 的开关"
        fi
        echo
        echo "4️⃣  应用并重启"
        echo "   → 点击 'Apply & Restart'"
        echo "   → 等待 Docker Desktop 重启完成（约 30 秒）"
        echo
        echo "5️⃣  重新运行此脚本验证"
        echo
        echo -e "${CYAN}详细文档：${NC}https://docs.docker.com/desktop/wsl/"
    else
        echo
        echo -e "${YELLOW}请检查：${NC}"
        echo "1. Docker 服务是否启动: sudo systemctl status docker"
        echo "2. 当前用户权限: sudo usermod -aG docker \$USER"
        echo "3. 重新登录后生效: newgrp docker"
    fi
    exit 1
fi
echo

# 4. 检查 Docker Compose
echo -e "${BLUE}[4/6]${NC} 检查 Docker Compose..."
if docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker Compose V2 可用"
    docker compose version
elif command -v docker-compose >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker Compose V1 可用"
    docker-compose version
else
    echo -e "${RED}✗${NC} Docker Compose 不可用"
    if [[ "$IS_WSL2" == "true" ]]; then
        echo -e "${YELLOW}💡 提示:${NC} 确保 Docker Desktop 版本 >= 3.0"
    fi
    exit 1
fi
echo

# 5. 检查 Docker 上下文
echo -e "${BLUE}[5/6]${NC} 检查 Docker 上下文..."
if docker context ls >/dev/null 2>&1; then
    CURRENT_CONTEXT=$(docker context show 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓${NC} 当前上下文: ${CYAN}${CURRENT_CONTEXT}${NC}"
    
    if [[ "$CURRENT_CONTEXT" == *"desktop"* ]]; then
        echo -e "  ${GREEN}→${NC} 使用 Docker Desktop"
    else
        echo -e "  ${GREEN}→${NC} 使用原生 Docker"
    fi
fi
echo

# 6. 运行简单测试
echo -e "${BLUE}[6/6]${NC} 运行 Docker 测试..."
if docker run --rm hello-world >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker 运行测试成功"
else
    echo -e "${YELLOW}⚠${NC}  Docker 运行测试失败（可能是网络问题）"
fi
echo

# 总结
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 检查完成！Docker 环境已就绪${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo
echo -e "${GREEN}现在可以运行 SsalgTen 安装脚本：${NC}"
echo
echo "  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install"
echo
