import { prisma } from '../lib/prisma';
import { DEFAULT_SYSTEM_CONFIGS } from '../controllers/SystemConfigController';
import { logger } from './logger';

/**
 * 初始化系统配置
 * 检查并创建默认的系统配置项
 */
export async function initSystemConfig(): Promise<void> {
  try {
    logger.info('Initializing system configurations...');

    const results = {
      created: 0,
      updated: 0,
      skipped: 0
    };

    for (const [key, defaultConfig] of Object.entries(DEFAULT_SYSTEM_CONFIGS)) {
      try {
        const existingConfig = await prisma.setting.findUnique({
          where: { key }
        });

        if (!existingConfig) {
          // 创建新的配置项
          await prisma.setting.create({
            data: {
              key,
              value: JSON.stringify(defaultConfig.value),
              category: defaultConfig.category || 'other',
              description: defaultConfig.description
            }
          });
          results.created++;
          logger.debug(`Created config: ${key}`);
        } else {
          // 配置已存在，只更新描述和分类（保留现有值）
          const needsUpdate = 
            existingConfig.description !== defaultConfig.description ||
            existingConfig.category !== defaultConfig.category;

          if (needsUpdate) {
            await prisma.setting.update({
              where: { key },
              data: {
                category: defaultConfig.category || 'other',
                description: defaultConfig.description
              }
            });
            results.updated++;
            logger.debug(`Updated metadata for config: ${key}`);
          } else {
            results.skipped++;
          }
        }
      } catch (error) {
        logger.error(`Failed to process config ${key}:`, error);
      }
    }

    logger.info(`System config initialization completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);

  } catch (error) {
    logger.error('System config initialization failed:', error);
    throw error;
  }
}

/**
 * 获取系统配置值
 * @param key 配置键
 * @param defaultValue 默认值
 * @returns 配置值
 */
export async function getSystemConfig<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  try {
    const config = await prisma.setting.findUnique({
      where: { key }
    });

    if (!config) {
      return defaultValue;
    }

    try {
      return JSON.parse(config.value) as T;
    } catch (error) {
      logger.warn(`Failed to parse config value for ${key}, returning raw value`);
      return config.value as T;
    }
  } catch (error) {
    logger.error(`Failed to get system config ${key}:`, error);
    return defaultValue;
  }
}

/**
 * 设置系统配置值
 * @param key 配置键
 * @param value 配置值
 * @param category 配置分类
 * @param description 配置描述
 */
export async function setSystemConfig(
  key: string, 
  value: any, 
  category?: string, 
  description?: string
): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        ...(category && { category }),
        ...(description && { description })
      },
      create: {
        key,
        value: JSON.stringify(value),
        category: category || 'other',
        description
      }
    });

    logger.debug(`System config ${key} set to:`, value);
  } catch (error) {
    logger.error(`Failed to set system config ${key}:`, error);
    throw error;
  }
}

/**
 * 删除系统配置
 * @param key 配置键
 */
export async function deleteSystemConfig(key: string): Promise<boolean> {
  try {
    const deleted = await prisma.setting.delete({
      where: { key }
    });

    logger.debug(`System config ${key} deleted`);
    return !!deleted;
  } catch (error) {
    logger.error(`Failed to delete system config ${key}:`, error);
    return false;
  }
}

/**
 * 获取指定分类的所有配置
 * @param category 配置分类
 * @returns 配置对象
 */
export async function getSystemConfigsByCategory(category: string): Promise<Record<string, any>> {
  try {
    const configs = await prisma.setting.findMany({
      where: { category }
    });

    const result: Record<string, any> = {};

    for (const config of configs) {
      try {
        result[config.key] = JSON.parse(config.value);
      } catch (error) {
        result[config.key] = config.value;
      }
    }

    return result;
  } catch (error) {
    logger.error(`Failed to get system configs for category ${category}:`, error);
    return {};
  }
}