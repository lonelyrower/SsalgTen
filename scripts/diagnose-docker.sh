#!/usr/bin/env bash

# SsalgTen 生产环境 Docker Compose 问题诊断和修复脚本
# 适用于所有 Linux 发行版

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SsalgTen 生产环境 Docker Compose 诊断工具${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo

# 1. 系统信息
echo -e "${BLUE}[1/7]${NC} 检测系统信息..."
echo -e "${GREEN}✓${NC} 操作系统:"
cat /etc/os-release | grep -E "PRETTY_NAME|VERSION_ID" | sed 's/^/  /'
echo -e "${GREEN}✓${NC} 内核版本:"
uname -r | sed 's/^/  /'
echo

# 2. Docker 命令检查
echo -e "${BLUE}[2/7]${NC} 检查 Docker 命令..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker 命令已安装"
    docker --version | sed 's/^/  /'
else
    echo -e "${RED}✗${NC} Docker 命令未找到"
    echo
    echo -e "${YELLOW}安装 Docker：${NC}"
    echo "  curl -fsSL https://get.docker.com | sudo sh"
    exit 1
fi
echo

# 3. Docker 守护进程
echo -e "${BLUE}[3/7]${NC} 检查 Docker 守护进程..."
if docker info &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker 守护进程运行正常"
    docker version --format '  客户端版本: {{.Client.Version}}'
    docker version --format '  服务端版本: {{.Server.Version}}'
else
    echo -e "${RED}✗${NC} Docker 守护进程无法访问"
    echo
    echo -e "${YELLOW}可能的原因：${NC}"
    
    # 检查服务状态
    if systemctl is-active docker &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker 服务正在运行"
    else
        echo -e "  ${RED}✗${NC} Docker 服务未运行"
        echo
        echo "启动 Docker 服务："
        echo "  sudo systemctl start docker"
        echo "  sudo systemctl enable docker"
    fi
    
    # 检查权限
    if groups | grep -q docker; then
        echo -e "  ${GREEN}✓${NC} 当前用户已在 docker 组"
    else
        echo -e "  ${RED}✗${NC} 当前用户不在 docker 组"
        echo
        echo "添加用户到 docker 组："
        echo "  sudo usermod -aG docker \$USER"
        echo "  newgrp docker  # 立即生效（或重新登录）"
    fi
    
    # 检查 socket 权限
    if [ -e /var/run/docker.sock ]; then
        echo -e "  ${GREEN}✓${NC} Docker socket 存在"
        ls -la /var/run/docker.sock | sed 's/^/    /'
    else
        echo -e "  ${RED}✗${NC} Docker socket 不存在"
    fi
    
    exit 1
fi
echo

# 4. Docker Compose V2 (docker compose)
echo -e "${BLUE}[4/7]${NC} 检查 Docker Compose V2 (docker compose)..."
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Compose V2 可用"
    docker compose version | sed 's/^/  /'
    COMPOSE_V2=true
else
    echo -e "${YELLOW}⚠${NC}  Docker Compose V2 不可用"
    docker compose version 2>&1 | head -3 | sed 's/^/  /'
    COMPOSE_V2=false
fi
echo

# 5. Docker Compose V1 (docker-compose)
echo -e "${BLUE}[5/7]${NC} 检查 Docker Compose V1 (docker-compose)..."
if command -v docker-compose &> /dev/null; then
    if docker-compose version &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker Compose V1 可用"
        docker-compose version | head -2 | sed 's/^/  /'
        COMPOSE_V1=true
    else
        echo -e "${RED}✗${NC} docker-compose 命令存在但无法运行"
        docker-compose version 2>&1 | head -3 | sed 's/^/  /'
        COMPOSE_V1=false
    fi
else
    echo -e "${YELLOW}⚠${NC}  Docker Compose V1 未安装"
    COMPOSE_V1=false
fi
echo

# 6. 整体评估
echo -e "${BLUE}[6/7]${NC} 整体评估..."
if [[ "$COMPOSE_V2" == "true" ]] || [[ "$COMPOSE_V1" == "true" ]]; then
    echo -e "${GREEN}✓${NC} Docker Compose 环境正常"
    
    if [[ "$COMPOSE_V2" == "true" ]]; then
        echo "  推荐使用: docker compose"
    else
        echo "  推荐使用: docker-compose"
    fi
else
    echo -e "${RED}✗${NC} Docker Compose 不可用"
    echo
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}需要安装 Docker Compose${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
fi
echo

# 7. 安装建议
if [[ "$COMPOSE_V2" != "true" ]] && [[ "$COMPOSE_V1" != "true" ]]; then
    echo -e "${BLUE}[7/7]${NC} 安装建议..."
    echo
    
    # 检测发行版
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        
        case "$ID" in
            ubuntu|debian)
                echo -e "${GREEN}方法 1: 安装 Docker Compose 插件（推荐）${NC}"
                echo "  sudo apt-get update"
                echo "  sudo apt-get install -y docker-compose-plugin"
                echo
                echo -e "${GREEN}方法 2: 安装独立版本${NC}"
                echo "  sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
                echo "  sudo chmod +x /usr/local/bin/docker-compose"
                ;;
            centos|rhel|fedora)
                echo -e "${GREEN}方法 1: 安装 Docker Compose 插件（推荐）${NC}"
                echo "  sudo yum install -y docker-compose-plugin"
                echo
                echo -e "${GREEN}方法 2: 安装独立版本${NC}"
                echo "  sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
                echo "  sudo chmod +x /usr/local/bin/docker-compose"
                ;;
            *)
                echo -e "${GREEN}通用安装方法：${NC}"
                echo "  sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
                echo "  sudo chmod +x /usr/local/bin/docker-compose"
                ;;
        esac
    fi
    echo
    echo -e "${CYAN}安装后请重新运行此脚本验证${NC}"
else
    echo -e "${BLUE}[7/7]${NC} 快速安装命令（可选升级）..."
    echo
    echo -e "${YELLOW}如需安装/升级 Docker Compose V2 插件：${NC}"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian)
                echo "  sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
                ;;
            centos|rhel|fedora)
                echo "  sudo yum install -y docker-compose-plugin"
                ;;
        esac
    fi
fi

echo
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

if [[ "$COMPOSE_V2" == "true" ]] || [[ "$COMPOSE_V1" == "true" ]]; then
    echo -e "${GREEN}✅ 环境检查完成！可以运行 SsalgTen 安装${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo
    echo "运行安装脚本："
    echo "  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install"
else
    echo -e "${RED}❌ 环境检查失败！请先安装 Docker Compose${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo
    echo "安装完成后再次运行此脚本验证："
    echo "  curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/diagnose-docker.sh | bash"
fi
echo
