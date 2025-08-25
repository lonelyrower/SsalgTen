#!/bin/bash

# SsalgTen Port 5432 调试脚本
# 用于深度调试端口5432占用问题

set -e

echo "🔍 深度调试端口5432占用问题..."
echo "========================================"

echo "1. 检查所有PostgreSQL相关进程:"
ps aux | grep -i postgres || echo "未找到PostgreSQL进程"

echo ""
echo "2. 检查端口5432占用详情:"
sudo netstat -tlnp | grep :5432 || echo "端口5432未被占用"

echo ""
echo "3. 使用lsof检查端口5432:"
sudo lsof -i :5432 || echo "lsof未发现5432端口占用"

echo ""
echo "4. 使用ss检查端口5432:"
sudo ss -tulpn | grep :5432 || echo "ss未发现5432端口占用"

echo ""
echo "5. 检查所有Docker容器状态:"
docker ps -a

echo ""
echo "6. 检查Docker网络:"
docker network ls

echo ""
echo "7. 检查系统服务状态:"
sudo systemctl status postgresql 2>/dev/null || echo "PostgreSQL服务未安装或已停止"

echo ""
echo "8. 检查是否有PostgreSQL在开机启动:"
sudo systemctl is-enabled postgresql 2>/dev/null || echo "PostgreSQL未设置为开机启动"

echo ""
echo "9. 检查/etc/postgresql配置文件:"
ls -la /etc/postgresql* 2>/dev/null || echo "未找到PostgreSQL配置文件"

echo ""
echo "10. 检查snap安装的PostgreSQL:"
snap list | grep postgres 2>/dev/null || echo "未通过snap安装PostgreSQL"

echo ""
echo "========================================"
echo "调试完成！如果端口5432仍被占用，请手动执行以下命令："
echo "sudo fuser -k 5432/tcp"
echo "docker system prune -af --volumes"
echo "sudo systemctl mask postgresql"