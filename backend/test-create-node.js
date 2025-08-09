// 测试创建带有真实IP的节点
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestNode() {
  try {
    console.log('🔍 创建测试节点...');
    
    const testNode = await prisma.node.create({
      data: {
        name: 'Google DNS Test Node',
        country: 'United States',
        city: 'Mountain View',
        latitude: 37.4419,
        longitude: -122.1419,
        provider: 'Google',
        ipv4: '8.8.8.8',
        agentId: `test-${Date.now()}`,
        apiKey: 'test-key-' + Math.random().toString(36).substring(7),
        description: 'Test node for ASN functionality'
      }
    });
    
    console.log('✅ 测试节点创建成功:', testNode.name);
    console.log('📍 IP地址:', testNode.ipv4);
    console.log('🔧 节点ID:', testNode.id);
    
    return testNode;
    
  } catch (error) {
    console.error('❌ 创建测试节点失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNode();