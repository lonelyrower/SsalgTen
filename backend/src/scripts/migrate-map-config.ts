#!/usr/bin/env tsx
/**
 * 地图配置迁移脚本
 * 用于为已部署的系统添加地图配置
 *
 * 使用方法:
 * docker compose exec backend npx tsx src/scripts/migrate-map-config.ts
 * 或者
 * npm run migrate:map-config
 */

import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

async function migrateMapConfig() {
  try {
    logger.info("🗺️  Starting map configuration migration...");

    const mapSettings = [
      {
        key: "map.provider",
        value: JSON.stringify("carto"),
        category: "map",
        description: "Map tile provider (carto, openstreetmap, mapbox)",
      },
      {
        key: "map.api_key",
        value: JSON.stringify(""),
        category: "map",
        description: "Map API key (required for mapbox)",
      },
    ];

    let created = 0;
    let updated = 0;

    for (const setting of mapSettings) {
      const existing = await prisma.setting.findUnique({
        where: { key: setting.key },
      });

      if (existing) {
        // 配置已存在，只更新描述
        await prisma.setting.update({
          where: { key: setting.key },
          data: {
            description: setting.description,
          },
        });
        logger.info(`✅ Updated description for: ${setting.key}`);
        updated++;
      } else {
        // 创建新配置
        await prisma.setting.create({ data: setting });
        logger.info(`✅ Created setting: ${setting.key} = ${setting.value}`);
        created++;
      }
    }

    logger.info("🎉 Map configuration migration completed!");
    logger.info(`   Created: ${created} settings`);
    logger.info(`   Updated: ${updated} settings`);
    logger.info("");
    logger.info("📋 Next steps:");
    logger.info("   1. Login to admin panel");
    logger.info("   2. Navigate to System Settings");
    logger.info("   3. Find 'Map Configuration' category");
    logger.info("   4. Configure map.provider and map.api_key");
    logger.info("   5. Save and refresh your browser");
  } catch (error) {
    logger.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行迁移
migrateMapConfig()
  .then(() => {
    logger.info("✅ Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("💥 Migration script failed:", error);
    process.exit(1);
  });
