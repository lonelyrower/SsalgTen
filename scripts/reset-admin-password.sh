#!/bin/bash

# 🔑 重置管理员密码脚本
# 适用于所有环境：开发环境和生产环境
# 
# 使用方法:
#   方式1 - 在项目目录执行:
#     bash scripts/reset-admin-password.sh
#
#   方式2 - 远程执行:
#     curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/reset-admin-password.sh | bash
#
#   方式3 - 指定项目目录:
#     SSALGTEN_DIR=/path/to/project bash scripts/reset-admin-password.sh

set -e

echo ""
echo "🔑 SsalgTen 管理员密码重置工具"
echo "=================================="
echo ""

# 查找项目目录
find_project_dir() {
    # 如果已设置环境变量
    if [ -n "$SSALGTEN_DIR" ] && [ -f "$SSALGTEN_DIR/docker-compose.yml" ]; then
        echo "$SSALGTEN_DIR"
        return 0
    fi
    
    # 检查当前目录
    if [ -f "docker-compose.yml" ]; then
        pwd
        return 0
    fi
    
    # 检查父目录
    if [ -f "../docker-compose.yml" ]; then
        cd .. && pwd
        return 0
    fi
    
    # 在常见位置查找
    for dir in \
        "$HOME/SsalgTen" \
        "$HOME/ssalgten" \
        "$HOME/projects/SsalgTen" \
        "$HOME/Projects/SsalgTen" \
        "/opt/SsalgTen" \
        "/srv/SsalgTen" \
        "/var/www/SsalgTen"; do
        if [ -f "$dir/docker-compose.yml" ]; then
            echo "$dir"
            return 0
        fi
    done
    
    return 1
}

# 查找 SsalgTen 后端容器
find_backend_container() {
    # 尝试不同的容器名称模式
    for pattern in \
        "ssalgten.*backend" \
        "SsalgTen.*backend" \
        "backend.*ssalgten" \
        "*backend*"; do
        local container=$(docker ps --filter "name=$pattern" --format "{{.Names}}" 2>/dev/null | head -n1)
        if [ -n "$container" ]; then
            echo "$container"
            return 0
        fi
    done
    return 1
}

echo "🔍 正在查找 SsalgTen 部署..."

# 尝试找到项目目录
PROJECT_DIR=""
if PROJECT_DIR=$(find_project_dir); then
    echo "✅ 找到项目目录: $PROJECT_DIR"
    cd "$PROJECT_DIR"
    USE_DOCKER_COMPOSE=true
else
    echo "⚠️  未找到项目目录，尝试直接使用 Docker 容器..."
    USE_DOCKER_COMPOSE=false
fi

# 检测 docker-compose 命令
if [ "$USE_DOCKER_COMPOSE" = true ]; then
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        echo "❌ 错误: 未找到 docker-compose 或 docker compose 命令"
        echo "请先安装 Docker Compose 或手动进入项目目录"
        exit 1
    fi
    
    # 检查后端容器状态
    echo "📋 检查容器状态..."
    BACKEND_RUNNING=$($DOCKER_COMPOSE ps backend 2>/dev/null | grep -c "Up" || echo "0")
    
    if [ "$BACKEND_RUNNING" = "0" ]; then
        echo "⚠️  backend 容器未运行"
        echo ""
        read -p "是否启动 backend 容器? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🚀 正在启动 backend 容器..."
            $DOCKER_COMPOSE up -d backend
            echo "⏳ 等待容器完全启动..."
            sleep 10
        else
            echo "❌ 已取消操作"
            exit 1
        fi
    fi
    
    BACKEND_CONTAINER="backend"
    EXEC_CMD="$DOCKER_COMPOSE exec -T"
else
    # 直接使用 Docker 查找容器
    echo "📋 查找 backend 容器..."
    if ! BACKEND_CONTAINER=$(find_backend_container); then
        echo "❌ 错误: 未找到 SsalgTen backend 容器"
        echo ""
        echo "请确保："
        echo "  1. Docker 容器正在运行"
        echo "  2. 或者在 SsalgTen 项目目录中执行此脚本"
        echo "  3. 或者设置环境变量: export SSALGTEN_DIR=/path/to/project"
        exit 1
    fi
    
    echo "✅ 找到容器: $BACKEND_CONTAINER"
    EXEC_CMD="docker exec"
fi

echo ""
echo "🔧 正在重置管理员密码..."
echo ""

# 直接尝试重置（如果 Prisma Client 缺失，后面的备用方案会处理）
if $EXEC_CMD $BACKEND_CONTAINER sh -c "cd /app && timeout 30 npm run reset-admin 2>&1" | grep -q "✅"; then
    # 成功
    echo ""
else
    # 备用方案：先确保生成 Prisma Client，然后使用内联脚本
    echo "⚠️  使用备用方案..."
    echo "� 生成 Prisma Client（这可能需要几秒钟）..."
    
    # 使用 timeout 防止卡死
    if $EXEC_CMD $BACKEND_CONTAINER sh -c "cd /app && timeout 60 npx prisma generate" 2>&1 | tail -5; then
        echo "✅ Prisma Client 已生成"
    fi
    
    echo "🔄 重新尝试重置..."
    
    # 创建临时重置脚本内容
    RESET_CODE='const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
async function reset() {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 12);
    const result = await prisma.user.updateMany({
      where: { role: "ADMIN" },
      data: { password: hashedPassword, active: true }
    });
    if (result.count > 0) {
      console.log("✅ 成功重置 " + result.count + " 个管理员用户的密码");
    } else {
      console.log("🆕 创建默认管理员账户...");
      await prisma.user.create({
        data: {
          username: "admin",
          email: "admin@ssalgten.local",
          password: hashedPassword,
          name: "Administrator",
          role: "ADMIN",
          active: true
        }
      });
      console.log("✅ 成功创建管理员用户");
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ 重置失败:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
reset();'
    
    # 执行内联脚本
    if $EXEC_CMD $BACKEND_CONTAINER sh -c "cd /app && node -e '$RESET_CODE'" 2>&1; then
        echo ""
    else
        echo ""
        echo "❌ 密码重置失败"
        echo ""
        echo "可能的原因:"
        echo "  1. Prisma Client 未生成"
        echo "  2. 数据库连接失败"
        echo ""
        echo "请尝试手动操作:"
        echo "  docker exec -it $BACKEND_CONTAINER sh"
        echo "  cd /app && npx prisma generate"
        echo "  npm run reset-admin"
        exit 1
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔑 默认登录凭据："
echo ""
echo "   用户名: admin"
echo "   密码:   admin123"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  安全提醒："
echo "   • 请立即登录系统"
echo "   • 进入【系统管理】→【用户管理】"
echo "   • 修改 admin 账户密码"
echo "   • 设置强密码（建议 12+ 字符）"
echo ""
echo "📍 访问地址："
echo "   开发环境: http://localhost:3000"
echo "   生产环境: 使用你的域名或 IP"
echo ""
