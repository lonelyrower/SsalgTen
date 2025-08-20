// 修复测试节点的ASN信息
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTestNode() {
  try {
    console.log('🔧 修复测试节点ASN信息...');
    
    // 先查找节点ID
    const testNode = await prisma.node.findFirst({
      where: { name: 'Google DNS Test Node' }
    });
    
    if (!testNode) {
      throw new Error('Test node not found');
    }
    
    const updatedNode = await prisma.node.update({
      where: { 
        id: testNode.id
      },
      data: {
        asnNumber: 'AS15169',
        asnName: 'Google LLC',
        asnOrg: 'AS15169 Google LLC',
        asnRoute: '8.8.8.0/24',
        asnType: 'hosting'
      }
    });
    
    console.log('✅ 节点ASN信息更新成功:');
    console.log('  节点:', updatedNode.name);
    console.log('  ASN:', updatedNode.asnNumber);
    console.log('  组织:', updatedNode.asnName);
    console.log('  详细:', updatedNode.asnOrg);
    
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixTestNode();