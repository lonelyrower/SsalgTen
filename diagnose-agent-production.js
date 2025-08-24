const { PrismaClient } = require('./backend/node_modules/@prisma/client');

async function diagnoseAgentProduction() {
  console.log('=== SsalgTen 生产环境Agent诊断工具 ===');
  console.log('');
  
  // 检查环境变量
  console.log('📋 当前配置:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
  console.log(`- PORT: ${process.env.PORT || '未设置'}`);
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '已设置' : '未设置'}`);
  console.log(`- DEFAULT_AGENT_API_KEY: ${process.env.DEFAULT_AGENT_API_KEY ? '已设置' : '未设置'}`);
  console.log('');

  // 尝试连接数据库
  console.log('🔗 尝试连接数据库...');
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    // 查询所有节点
    console.log('');
    console.log('📊 当前节点状态:');
    const nodes = await prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    if (nodes.length === 0) {
      console.log('❌ 没有找到任何节点记录');
      console.log('');
      console.log('🔍 可能的原因:');
      console.log('1. Agent从未成功注册');
      console.log('2. Agent配置错误(URL/API Key)');
      console.log('3. Agent容器未运行');
      console.log('4. 网络连接问题');
    } else {
      console.log(`✅ 找到 ${nodes.length} 个节点:`);
      nodes.forEach((node, index) => {
        console.log(`${index + 1}. ${node.name} (${node.agentId})`);
        console.log(`   状态: ${node.status}`);
        console.log(`   最后在线: ${node.lastSeen || '从未上线'}`);
        console.log(`   创建时间: ${node.createdAt}`);
        console.log('');
      });
    }
    
    // 检查心跳日志
    console.log('💓 最近心跳记录:');
    const heartbeats = await prisma.heartbeatLog.findMany({
      include: { node: true },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    if (heartbeats.length === 0) {
      console.log('❌ 没有找到任何心跳记录');
    } else {
      console.log(`✅ 最近 ${heartbeats.length} 条心跳:`);
      heartbeats.forEach((hb, index) => {
        console.log(`${index + 1}. ${hb.node.name} - ${hb.status} (${hb.timestamp})`);
      });
    }
    
  } catch (error) {
    console.log('❌ 数据库连接失败:', error.message);
    
    if (error.code === 'P1001') {
      console.log('');
      console.log('🔧 数据库连接问题排查:');
      console.log('1. 检查PostgreSQL是否运行');
      console.log('2. 检查DATABASE_URL配置');
      console.log('3. 检查防火墙和端口设置');
      console.log('4. 检查数据库用户权限');
    }
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('');
  console.log('🌐 生产环境Agent排查步骤:');
  console.log('1. SSH到生产服务器');
  console.log('2. 运行: docker ps | grep ssalgten-agent');
  console.log('3. 查看日志: docker logs ssalgten-agent');
  console.log('4. 检查配置: docker exec ssalgten-agent env | grep MASTER');
  console.log('5. 测试连接: docker exec ssalgten-agent curl http://host.docker.internal:3001/api/health');
  console.log('');
  console.log('📞 Agent注册测试命令:');
  console.log('curl -X POST http://YOUR_SERVER_IP:3001/api/agents/register \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "Authorization: Bearer default-agent-api-key-change-this-in-production" \\');
  console.log('  -d \'{"agentId":"test-agent","name":"Test Agent","country":"CN","city":"Test"}\'');
}

diagnoseAgentProduction().catch(console.error);