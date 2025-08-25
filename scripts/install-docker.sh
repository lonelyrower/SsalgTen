#!/bin/bash

# Docker 和 Docker Compose 安装脚本 (适用于 Ubuntu/Debian VPS)

set -e

echo "🐳 安装 Docker 和 Docker Compose..."

# 检查系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    echo "检测到系统: $OS"
else
    echo "❌ 无法检测系统类型"
    exit 1
fi

# 更新软件包
echo "📦 更新软件包列表..."
sudo apt-get update

# 安装必需的软件包
echo "📦 安装必需的软件包..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 的官方 GPG 密钥
echo "🔑 添加 Docker GPG 密钥..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置稳定版仓库
echo "📋 添加 Docker 仓库..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 更新软件包索引
sudo apt-get update

# 安装 Docker Engine, containerd, 和 Docker Compose
echo "🐳 安装 Docker Engine 和 Docker Compose..."
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 将当前用户添加到 docker 组
echo "👤 将用户添加到 docker 组..."
sudo usermod -aG docker $USER

# 启动 Docker 服务
echo "🚀 启动 Docker 服务..."
sudo systemctl enable docker
sudo systemctl start docker

# 测试 Docker 安装
echo "✅ 测试 Docker 安装..."
sudo docker run hello-world

echo ""
echo "🎉 Docker 安装完成！"
echo ""
echo "安装的版本:"
sudo docker --version
sudo docker compose version
echo ""
echo "⚠️  重要提醒:"
echo "1. 请重新登录或运行 'newgrp docker' 来应用组权限更改"
echo "2. 现在可以使用 'docker compose' 命令 (注意是空格，不是连字符)"
echo "3. 如果仍有问题，请重启系统"
echo ""
echo "快速测试命令:"
echo "docker --version"
echo "docker compose version"