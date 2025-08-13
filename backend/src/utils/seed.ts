import { prisma } from '../lib/prisma';
import { NodeStatus } from '@prisma/client';
import { logger } from './logger';
import crypto from 'crypto';

// 示例节点数据
const sampleNodes = [
  {
    name: 'New York Node',
    country: 'United States',
    city: 'New York',
    latitude: 40.7128,
    longitude: -74.0060,
    provider: 'DigitalOcean',
    ipv4: '192.168.1.10',
    datacenter: 'NYC3',
    description: 'East Coast US monitoring node'
  },
  {
    name: 'London Node',
    country: 'United Kingdom', 
    city: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    provider: 'Vultr',
    ipv4: '192.168.1.20',
    datacenter: 'LHR',
    description: 'European monitoring hub'
  },
  {
    name: 'Tokyo Node',
    country: 'Japan',
    city: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    provider: 'Linode',
    ipv4: '192.168.1.30',
    datacenter: 'ap-northeast',
    description: 'Asia-Pacific monitoring point'
  },
  {
    name: 'Sydney Node',
    country: 'Australia',
    city: 'Sydney',
    latitude: -33.8688,
    longitude: 151.2093,
    provider: 'AWS',
    ipv4: '192.168.1.40',
    datacenter: 'ap-southeast-2',
    description: 'Oceania monitoring station'
  },
  {
    name: 'Frankfurt Node',
    country: 'Germany',
    city: 'Frankfurt',
    latitude: 50.1109,
    longitude: 8.6821,
    provider: 'Hetzner',
    ipv4: '192.168.1.50',
    datacenter: 'FSN1',
    description: 'Central European node'
  },
  {
    name: 'Singapore Node',
    country: 'Singapore',
    city: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    provider: 'DigitalOcean',
    ipv4: '192.168.1.60',
    datacenter: 'SGP1',
    description: 'Southeast Asia gateway'
  }
];

// 创建示例节点
export async function seedNodes() {
  try {
    logger.info('🌱 Seeding sample nodes...');
    
    // 检查是否已有节点
    const existingCount = await prisma.node.count();
    
    if (existingCount > 0) {
      logger.info(`📊 Found ${existingCount} existing nodes, skipping seed`);
      return;
    }
    
    // 创建示例节点
    const createdNodes = [];
    
    for (const nodeData of sampleNodes) {
      const agentId = crypto.randomUUID();
      const apiKey = crypto.randomBytes(32).toString('hex');
      
      const node = await prisma.node.create({
        data: {
          ...nodeData,
          agentId,
          apiKey,
          status: NodeStatus.UNKNOWN
        }
      });
      
      createdNodes.push(node);
      logger.info(`✅ Created node: ${node.name} (ID: ${node.agentId})`);
    }
    
    logger.info(`🎉 Successfully seeded ${createdNodes.length} sample nodes`);
    
    // 输出Agent配置信息
    logger.info('\n📋 Agent Configuration Instructions:');
    logger.info('Copy these Agent IDs for your agent configurations:\n');
    
    createdNodes.forEach((node, index) => {
      logger.info(`Agent ${index + 1} (${node.name}):`);
      logger.info(`  AGENT_ID=${node.agentId}`);
      logger.info(`  API_KEY=${node.apiKey}`);
      logger.info(`  LOCATION=${node.city}, ${node.country}`);
      logger.info('');
    });
    
  } catch (error) {
    logger.error('❌ Seed operation failed:', error);
    throw error;
  }
}

// 创建默认管理员用户
export async function seedAdminUser() {
  try {
    logger.info('👤 Seeding admin user...');
    
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (existingAdmin) {
      logger.info('👤 Admin user already exists, skipping');
      return;
    }
    
    // 注意：在生产环境中应该使用bcrypt加密密码
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
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
    
    logger.info(`✅ Created admin user: ${adminUser.username} (${adminUser.email})`);
    logger.info('🔑 Default admin credentials:');
    logger.info('   Username: admin');
    logger.info('   Password: admin123');
    logger.info('   ⚠️  Please change the password after first login!');
    
  } catch (error) {
    logger.error('❌ Admin user seed failed:', error);
    throw error;
  }
}

// 创建系统默认设置
export async function seedSystemSettings() {
  try {
    logger.info('⚙️  Seeding system settings...');
    
    const defaultSettings = [
      {
        key: 'heartbeat_interval',
        value: '30000',
        category: 'agent',
        description: 'Agent heartbeat interval in milliseconds'
      },
      {
        key: 'offline_threshold',
        value: '120000', 
        category: 'agent',
        description: 'Time in ms before marking agent as offline'
      },
      {
        key: 'cleanup_retention_days',
        value: '30',
        category: 'maintenance',
        description: 'Days to retain diagnostic and heartbeat records'
      },
      {
        key: 'max_concurrent_diagnostics',
        value: '5',
        category: 'diagnostics',
        description: 'Maximum concurrent diagnostic tests per agent'
      }
    ];
    
    for (const setting of defaultSettings) {
      const existing = await prisma.setting.findUnique({
        where: { key: setting.key }
      });
      
      if (!existing) {
        await prisma.setting.create({ data: setting });
        logger.info(`⚙️  Created setting: ${setting.key} = ${setting.value}`);
      }
    }
    
    logger.info('✅ System settings configured');
    
  } catch (error) {
    logger.error('❌ Settings seed failed:', error);
    throw error;
  }
}

// 主种子函数
export async function runSeed() {
  try {
    logger.info('🌱 Starting database seeding...');
    
    await seedSystemSettings();
    await seedAdminUser();
    // 注释掉示例节点数据，用户可以通过Agent自动注册或手动添加
    // await seedNodes();
    
    logger.info('🎉 Database seeding completed successfully!');
    logger.info('💡 Note: No sample nodes created. Nodes will be added when agents register or via admin panel.');
    
  } catch (error) {
    logger.error('💥 Database seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runSeed();
}