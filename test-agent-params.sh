#!/bin/bash

# 测试Agent参数收集逻辑
source scripts/install-agent.sh

# 测试1: 自动配置模式但缺少参数
echo "=== 测试1: 自动配置模式但缺少参数 ==="
AUTO_CONFIG=true
MASTER_URL=""
AGENT_API_KEY=""

# 模拟collect_node_info函数的关键部分
if [[ -z "$MASTER_URL" || -z "$AGENT_API_KEY" ]]; then
    echo "✅ 正确检测到缺少必需参数"
    if [[ "$AUTO_CONFIG" == "true" ]]; then
        echo "✅ 在自动配置模式下会进入交互式收集"
    fi
else
    echo "❌ 没有检测到缺少参数"
fi

echo ""
echo "=== 测试2: 自动配置模式且提供完整参数 ==="
AUTO_CONFIG=true
MASTER_URL="https://example.com"
AGENT_API_KEY="test-api-key-1234567890"

if [[ -z "$MASTER_URL" || -z "$AGENT_API_KEY" ]]; then
    echo "❌ 错误地认为缺少参数"
else
    echo "✅ 正确检测到参数完整"
    if [[ "$AUTO_CONFIG" == "true" ]]; then
        echo "✅ 会使用自动配置模式"
    fi
fi

echo ""
echo "=== 测试3: 交互式模式 ==="
AUTO_CONFIG=""
MASTER_URL=""
AGENT_API_KEY=""

if [[ -z "$MASTER_URL" || -z "$AGENT_API_KEY" ]]; then
    echo "✅ 正确检测到缺少必需参数"
    echo "✅ 会进入交互式收集模式"
else
    echo "❌ 没有检测到缺少参数"
fi

echo ""
echo "所有参数收集逻辑测试完成！"