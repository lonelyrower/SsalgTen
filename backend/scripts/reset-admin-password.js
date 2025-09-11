// 管理员密码重置脚本 - 不依赖构建过程
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log('🔧 正在重置管理员密码...');
    
    // 生成新的密码哈希
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // 尝试更新所有ADMIN角色用户的密码
    const updateResult = await prisma.user.updateMany({
      where: { role: 'ADMIN' },
      data: {
        password: hashedPassword,
        active: true
      }
    });
    
    if (updateResult.count > 0) {
      console.log(`✅ 成功重置 ${updateResult.count} 个管理员用户的密码`);
      console.log('');
      console.log('🔑 管理员登录信息:');
      console.log('   用户名: admin');
      console.log('   密码: admin123');
      console.log('');
      console.log('⚠️  请在首次登录后立即更改密码！');
      return;
    }
    
    // 如果没有ADMIN用户，创建一个默认的
    console.log('🆕 没有找到管理员用户，正在创建...');
    const adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@ssalgten.local',
        password: hashedPassword,
        name: 'Administrator',
        role: 'ADMIN',
        active: true
      }
    });
    
    console.log('✅ 成功创建管理员用户');
    console.log('');
    console.log('🔑 管理员登录信息:');
    console.log('   用户名: admin');
    console.log('   密码: admin123');
    console.log('');
    console.log('⚠️  请在首次登录后立即更改密码！');
    
  } catch (error) {
    console.error('❌ 密码重置失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
resetAdminPassword()
  .then(() => {
    console.log('🎉 密码重置完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
  });