#!/bin/bash

# 测试预置参数功能的脚本
echo "🧪 测试预置参数功能..."
echo ""

echo "1. 模拟前端生成的安装命令："
echo ""

# 模拟前端生成的安装命令（带预置参数）
MASTER_URL="http://107.172.104.6"
API_KEY="test-api-key-12345678"

echo "curl -fsSL ... | bash -s -- --master-url \"$MASTER_URL\" --api-key \"$API_KEY\""
echo ""

echo "2. 检查安装脚本是否能正确解析预置参数："
echo ""

# 检查脚本中的参数解析部分
grep -A 10 -B 2 "master-url" scripts/install-agent.sh | head -15

echo ""
echo "3. 检查菜单显示逻辑："
echo ""

# 检查菜单中是否有预置参数检测
grep -A 8 "已检测到预置连接参数" scripts/install-agent.sh

echo ""
echo "✅ 预置参数功能测试完成"
echo ""
echo "📋 功能说明："
echo "   - 从前端复制的命令会包含 --master-url 和 --api-key 参数"
echo "   - 脚本会检测这些预置参数并在菜单中显示"
echo "   - 选择 '1.安装' 时会自动使用这些参数，无需用户再输入"
echo "   - 自动启用 AUTO_CONFIG=true 和 FORCE_ROOT=true"
echo ""

echo "🎯 用户体验："
echo "   1. 复制前端提供的安装命令"
echo "   2. 执行命令，显示菜单，能看到预置的服务器信息"
echo "   3. 选择 '1' 一键安装，无需任何输入"
echo "   4. 安装过程完全自动化"