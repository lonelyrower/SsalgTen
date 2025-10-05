#!/usr/bin/env -S node --loader ts-node/esm

/**
 * 管理员密码重置工具
 * 用于重置管理员密码或创建默认管理员账户
 *
 * 使用方法:
 *   npm run reset-admin
 *   或
 *   npx tsx src/scripts/reset-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log("🔧 正在重置管理员密码...");
    console.log("");

    // 生成新的密码哈希
    const hashedPassword = await bcrypt.hash("admin123", 12);

    // 尝试更新所有ADMIN角色用户的密码
    const updateResult = await prisma.user.updateMany({
      where: { role: "ADMIN" },
      data: {
        password: hashedPassword,
        active: true,
      },
    });

    if (updateResult.count > 0) {
      console.log(`✅ 成功重置 ${updateResult.count} 个管理员用户的密码`);
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("🔑 管理员登录信息:");
      console.log("   用户名: admin");
      console.log("   密码:   admin123");
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("⚠️  安全提醒:");
      console.log("   • 请立即登录系统");
      console.log("   • 进入【系统管理】→【用户管理】");
      console.log("   • 修改 admin 账户密码");
      console.log("   • 设置强密码（建议 12+ 字符）");
      console.log("");
      return;
    }

    // 如果没有ADMIN用户，创建一个默认的
    console.log("🆕 没有找到管理员用户，正在创建默认账户...");
    await prisma.user.create({
      data: {
        username: "admin",
        email: "admin@ssalgten.local",
        password: hashedPassword,
        name: "Administrator",
        role: "ADMIN",
        active: true,
      },
    });

    console.log("✅ 成功创建管理员用户");
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("🔑 管理员登录信息:");
    console.log("   用户名: admin");
    console.log("   密码:   admin123");
    console.log("   邮箱:   admin@ssalgten.local");
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("⚠️  安全提醒:");
    console.log("   • 这是首次创建的默认账户");
    console.log("   • 请立即登录并修改密码");
    console.log("   • 建议更新邮箱地址");
    console.log("");
  } catch (error) {
    console.error("❌ 密码重置失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
resetAdminPassword()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 发生错误:", error);
    process.exit(1);
  });
