#!/usr/bin/env node

// 调试节点显示问题的脚本
const axios = require('axios');

async function debugNodes() {
  console.log('🔍 调试节点显示问题...\n');

  try {
    // 1. 测试后端API健康检查
    console.log('1. 检查后端API健康状态...');
    const healthResponse = await axios.get('http://localhost:3001/api/health');
    console.log('   ✅ 后端API运行正常');
    console.log('   版本:', healthResponse.data.data.version);
    console.log('   环境:', healthResponse.data.data.environment);
    console.log('');

    // 2. 获取节点列表
    console.log('2. 获取节点列表...');
    const nodesResponse = await axios.get('http://localhost:3001/api/nodes');
    console.log('   请求状态:', nodesResponse.status);
    console.log('   响应数据:', JSON.stringify(nodesResponse.data, null, 2));
    
    if (nodesResponse.data.success) {
      const nodes = nodesResponse.data.data;
      console.log(`   ✅ 成功获取 ${nodes.length} 个节点`);
      
      if (nodes.length === 0) {
        console.log('   ⚠️  节点列表为空！这可能是问题所在。');
      } else {
        nodes.forEach((node, index) => {
          console.log(`   节点 ${index + 1}:`);
          console.log(`     ID: ${node.id}`);
          console.log(`     名称: ${node.name}`);
          console.log(`     状态: ${node.status}`);
          console.log(`     位置: ${node.city}, ${node.country}`);
          console.log(`     提供商: ${node.provider}`);
          console.log(`     Agent ID: ${node.agentId || '未设置'}`);
          console.log('');
        });
      }
    } else {
      console.log('   ❌ 获取节点失败:', nodesResponse.data.error);
    }

    // 3. 获取统计信息
    console.log('3. 获取统计信息...');
    const statsResponse = await axios.get('http://localhost:3001/api/stats');
    console.log('   统计数据:', JSON.stringify(statsResponse.data, null, 2));

    // 4. 检查数据库连接（通过Prisma）
    console.log('4. 检查数据库状态...');
    console.log('   提示：如果节点列表为空，可能的原因包括：');
    console.log('   - Agent没有成功注册到后端');
    console.log('   - 数据库连接问题');
    console.log('   - Agent和后端的API密钥不匹配');
    console.log('   - Agent和后端的URL配置不正确');

  } catch (error) {
    console.log('❌ 调试过程中发生错误:');
    if (error.code === 'ECONNREFUSED') {
      console.log('   无法连接到后端服务 (http://localhost:3001)');
      console.log('   请确保后端服务正在运行');
    } else if (error.response) {
      console.log('   HTTP状态:', error.response.status);
      console.log('   响应数据:', error.response.data);
    } else {
      console.log('   错误信息:', error.message);
    }
  }
}

// 运行调试
debugNodes().catch(console.error);