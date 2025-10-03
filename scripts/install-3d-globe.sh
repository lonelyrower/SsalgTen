#!/bin/bash
# 3D 地球功能安装脚本

set -e

echo "🌍 SsalgTen 3D 地球可视化 - 安装脚本"
echo "================================================"
echo ""

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 frontend 目录下运行此脚本"
    exit 1
fi

echo "📦 安装 Cesium 依赖..."
npm install cesium@^1.123.1 vite-plugin-cesium@^1.2.23

echo "📦 安装 TypeScript 类型定义..."
npm install --save-dev @types/cesium@^1.123.1

echo ""
echo "✅ 安装完成！"
echo ""
echo "🚀 下一步："
echo "   1. 运行 'npm run dev' 启动开发服务器"
echo "   2. 访问 http://localhost:3000"
echo "   3. 点击右上角的 '3D 地球' 按钮"
echo ""
echo "📚 详细文档请查看: docs/3D_GLOBE_GUIDE.md"
echo ""
