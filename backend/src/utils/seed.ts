import { prisma } from "../lib/prisma";
import { NodeStatus } from "@prisma/client";
import { logger } from "./logger";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// 示例节点数据
const sampleNodes = [
  {
    name: "New York Node",
    country: "United States",
    city: "New York",
    latitude: 40.7128,
    longitude: -74.006,
    provider: "DigitalOcean",
    ipv4: "192.168.1.10",
    datacenter: "NYC3",
    description: "East Coast US monitoring node",
  },
  {
    name: "London Node",
    country: "United Kingdom",
    city: "London",
    latitude: 51.5074,
    longitude: -0.1278,
    provider: "Vultr",
    ipv4: "192.168.1.20",
    datacenter: "LHR",
    description: "European monitoring hub",
  },
  {
    name: "Tokyo Node",
    country: "Japan",
    city: "Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    provider: "Linode",
    ipv4: "192.168.1.30",
    datacenter: "ap-northeast",
    description: "Asia-Pacific monitoring point",
  },
  {
    name: "Sydney Node",
    country: "Australia",
    city: "Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
    provider: "AWS",
    ipv4: "192.168.1.40",
    datacenter: "ap-southeast-2",
    description: "Oceania monitoring station",
  },
  {
    name: "Frankfurt Node",
    country: "Germany",
    city: "Frankfurt",
    latitude: 50.1109,
    longitude: 8.6821,
    provider: "Hetzner",
    ipv4: "192.168.1.50",
    datacenter: "FSN1",
    description: "Central European node",
  },
  {
    name: "Singapore Node",
    country: "Singapore",
    city: "Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
    provider: "DigitalOcean",
    ipv4: "192.168.1.60",
    datacenter: "SGP1",
    description: "Southeast Asia gateway",
  },
];

// 创建示例节点
export async function seedNodes() {
  try {
    logger.info("🌱 Seeding sample nodes...");

    // 检查是否已有节点
    const existingCount = await prisma.node.count();

    if (existingCount > 0) {
      logger.info(`📊 Found ${existingCount} existing nodes, skipping seed`);
      return;
    }

    // 创建示例节点（避免空数组推断为 never[]）
    const createdNodes: Array<{
      id: string;
      name: string;
      agentId: string;
      apiKey: string;
      city: string | null;
      country: string | null;
    }> = [];

    for (const nodeData of sampleNodes) {
      const agentId = crypto.randomUUID();
      const apiKey = crypto.randomBytes(32).toString("hex");

      const node = await prisma.node.create({
        data: {
          ...nodeData,
          agentId,
          apiKey,
          status: NodeStatus.UNKNOWN,
        },
      });

      createdNodes.push(node);
      logger.info(`✅ Created node: ${node.name} (ID: ${node.agentId})`);
    }

    logger.info(`🎉 Successfully seeded ${createdNodes.length} sample nodes`);

    // 输出Agent配置信息
    logger.info("\n📋 Agent Configuration Instructions:");
    logger.info("Copy these Agent IDs for your agent configurations:\n");

    createdNodes.forEach((node, index) => {
      logger.info(`Agent ${index + 1} (${node.name}):`);
      logger.info(`  AGENT_ID=${node.agentId}`);
      logger.info(`  API_KEY=${node.apiKey}`);
      logger.info(
        `  LOCATION=${node.city || "Unknown"}, ${node.country || "Unknown"}`,
      );
      logger.info("");
    });
  } catch (error) {
    logger.error("❌ Seed operation failed:", error);
    throw error;
  }
}

// 创建默认管理员用户
export async function seedAdminUser() {
  try {
    logger.info("👤 Seeding admin user...");

    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [{ username: "admin" }, { role: "ADMIN" }],
      },
    });

    const hashedPassword = await bcrypt.hash("admin123", 12);

    if (existingAdmin) {
      logger.info("👤 Admin user already exists, updating password...");

      const updatedAdmin = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          username: "admin",
          email: "admin@ssalgten.local",
          password: hashedPassword,
          name: "Administrator",
          role: "ADMIN",
          active: true,
        },
      });

      logger.info(
        `✅ Updated admin user: ${updatedAdmin.username} (${updatedAdmin.email})`,
      );
      logger.info("🔑 Admin password reset to default:");
      logger.info("   Username: admin");
      logger.info("   Password: admin123");
      logger.info("   ⚠️  Please change the password after first login!");
      return;
    }

    // 创建新的管理员用户
    const adminUser = await prisma.user.create({
      data: {
        username: "admin",
        email: "admin@ssalgten.local",
        password: hashedPassword,
        name: "Administrator",
        role: "ADMIN",
        active: true,
      },
    });

    logger.info(
      `✅ Created admin user: ${adminUser.username} (${adminUser.email})`,
    );
    logger.info("🔑 Default admin credentials:");
    logger.info("   Username: admin");
    logger.info("   Password: admin123");
    logger.info("   ⚠️  Please change the password after first login!");
  } catch (error) {
    logger.error("❌ Admin user seed failed:", error);
    throw error;
  }
}

// 强制重置管理员密码（用于生产环境密码重置）
export async function forceResetAdminPassword() {
  try {
    logger.info("🔧 Force resetting admin password...");

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
      logger.info(`✅ Reset password for ${updateResult.count} admin user(s)`);
      logger.info("🔑 Admin password reset to:");
      logger.info("   Username: admin");
      logger.info("   Password: admin123");
      return;
    }

    // 如果没有ADMIN用户，创建一个
    logger.info("🆕 No admin users found, creating default admin...");
    await seedAdminUser();
  } catch (error) {
    logger.error("❌ Force reset admin password failed:", error);
    throw error;
  }
}

// 创建系统默认设置
export async function seedSystemSettings() {
  try {
    logger.info("⚙️  Seeding system settings...");

    // 使用统一的配置定义，避免重复维护
    const { DEFAULT_SYSTEM_CONFIGS } = await import(
      "../controllers/SystemConfigController"
    );

    let createdCount = 0;
    let skippedCount = 0;

    for (const [key, config] of Object.entries(DEFAULT_SYSTEM_CONFIGS)) {
      const existing = await prisma.setting.findUnique({
        where: { key },
      });

      if (!existing) {
        await prisma.setting.create({
          data: {
            key,
            value: JSON.stringify(config.value),
            category: config.category || "other",
            description: config.description,
          },
        });
        createdCount++;
        logger.debug(
          `⚙️  Created setting: ${key} = ${JSON.stringify(config.value)}`,
        );
      } else {
        skippedCount++;
      }
    }

    logger.info(
      `✅ System settings configured: ${createdCount} created, ${skippedCount} skipped`,
    );
  } catch (error) {
    logger.error("❌ Settings seed failed:", error);
    throw error;
  }
}

// 主种子函数
export async function runSeed() {
  try {
    logger.info("🌱 Starting database seeding...");

    await seedSystemSettings();
    await seedAdminUser();
    // 注释掉示例节点数据，用户可以通过Agent自动注册或手动添加
    // await seedNodes();

    logger.info("🎉 Database seeding completed successfully!");
    logger.info(
      "💡 Note: No sample nodes created. Nodes will be added when agents register or via admin panel.",
    );
  } catch (error) {
    logger.error("💥 Database seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runSeed();
}
