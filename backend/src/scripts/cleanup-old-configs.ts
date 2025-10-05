/**
 * 清理数据库中的旧配置项
 * 只保留当前 DEFAULT_SYSTEM_CONFIGS 中定义的配置
 */

import { prisma } from "../lib/prisma";
import { DEFAULT_SYSTEM_CONFIGS } from "../controllers/SystemConfigController";

async function cleanupOldConfigs() {
  console.log("🧹 开始清理旧的系统配置...\n");

  try {
    // 获取当前定义的配置键
    const validKeys = Object.keys(DEFAULT_SYSTEM_CONFIGS);
    console.log(`✅ 当前有效的配置项 (${validKeys.length}个):`);
    validKeys.forEach((key) => console.log(`   - ${key}`));
    console.log();

    // 获取数据库中的所有配置
    const allConfigs = await prisma.setting.findMany({
      select: { key: true, category: true },
    });

    console.log(`📊 数据库中现有配置项 (${allConfigs.length}个):`);
    allConfigs.forEach((config) =>
      console.log(`   - ${config.key} (${config.category || "no-category"})`),
    );
    console.log();

    // 找出需要删除的配置
    const keysToDelete = allConfigs
      .filter((config) => !validKeys.includes(config.key))
      .map((config) => config.key);

    if (keysToDelete.length === 0) {
      console.log("✨ 数据库配置已是最新，无需清理！");
      return;
    }

    console.log(`🗑️  需要删除的旧配置项 (${keysToDelete.length}个):`);
    keysToDelete.forEach((key) => console.log(`   ❌ ${key}`));
    console.log();

    // 执行删除
    const deleteResult = await prisma.setting.deleteMany({
      where: {
        key: {
          in: keysToDelete,
        },
      },
    });

    console.log(`✅ 成功删除 ${deleteResult.count} 个旧配置项！`);
    console.log();

    // 验证清理后的状态
    const remainingConfigs = await prisma.setting.findMany({
      select: { key: true, category: true },
    });

    console.log(`✨ 清理后剩余配置项 (${remainingConfigs.length}个):`);
    remainingConfigs.forEach((config) =>
      console.log(`   ✓ ${config.key} (${config.category || "no-category"})`),
    );
    console.log();

    console.log("🎉 配置清理完成！");
  } catch (error) {
    console.error("❌ 清理配置时出错:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
cleanupOldConfigs()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
