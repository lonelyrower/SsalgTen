// 检查数据库中节点的ASN信息
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNodesASN() {
  try {
    console.log('🔍 检查数据库中节点的ASN信息...\n');
    
    const nodes = await prisma.node.findMany({
      select: {
        id: true,
        name: true,
        ipv4: true,
        ipv6: true,
        asnNumber: true,
        asnName: true,
        asnOrg: true,
        asnRoute: true,
        asnType: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 总共找到 ${nodes.length} 个节点\n`);
    
    for (const node of nodes) {
      console.log(`🖥️  节点: ${node.name} (${node.id})`);
      console.log(`   IP: ${node.ipv4 || node.ipv6 || 'N/A'}`);
      console.log(`   ASN编号: ${node.asnNumber || 'Unknown'}`);
      console.log(`   ASN名称: ${node.asnName || 'Unknown'}`);
      console.log(`   ASN组织: ${node.asnOrg || 'Unknown'}`);
      console.log(`   ASN路由: ${node.asnRoute || 'Unknown'}`);
      console.log(`   ASN类型: ${node.asnType || 'Unknown'}`);
      console.log(`   创建时间: ${node.createdAt.toISOString()}`);
      console.log('');
    }

    // 统计ASN信息完整性
    const withASN = nodes.filter(n => n.asnNumber && n.asnNumber !== 'Unknown');
    const withoutASN = nodes.filter(n => !n.asnNumber || n.asnNumber === 'Unknown');
    const withRoute = nodes.filter(n => n.asnRoute && n.asnRoute !== 'Unknown');
    const withType = nodes.filter(n => n.asnType && n.asnType !== 'Unknown');

    console.log('📈 ASN信息统计:');
    console.log(`   有ASN编号: ${withASN.length}/${nodes.length}`);
    console.log(`   缺少ASN编号: ${withoutASN.length}/${nodes.length}`);
    console.log(`   有路由信息: ${withRoute.length}/${nodes.length}`);
    console.log(`   有类型信息: ${withType.length}/${nodes.length}`);

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNodesASN();