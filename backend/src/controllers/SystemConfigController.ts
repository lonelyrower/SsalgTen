import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

export interface SystemConfigData {
  key: string;
  value: any;
  category?: string;
  description?: string;
}

export interface UpdateSystemConfigRequest {
  value: any;
  category?: string;
  description?: string;
}

// 预定义的系统配置项
export const DEFAULT_SYSTEM_CONFIGS = {
  // 系统基础配置
  'system.name': {
    value: 'SsalgTen Network Monitor',
    category: 'system',
    description: 'System display name'
  },
  'system.version': {
    value: '1.0.0',
    category: 'system',
    description: 'Current system version'
  },
  'system.timezone': {
    value: 'UTC',
    category: 'system',
    description: 'System timezone'
  },
  'system.maintenance_mode': {
    value: false,
    category: 'system',
    description: 'Enable maintenance mode'
  },

  // 监控配置
  'monitoring.heartbeat_interval': {
    value: 30000,
    category: 'monitoring',
    description: 'Agent heartbeat interval in milliseconds'
  },
  'monitoring.heartbeat_timeout': {
    value: 90000,
    category: 'monitoring',
    description: 'Agent heartbeat timeout in milliseconds'
  },
  'monitoring.max_offline_time': {
    value: 300000,
    category: 'monitoring',
    description: 'Maximum offline time before marking node as offline'
  },
  'monitoring.cleanup_interval': {
    value: 86400000,
    category: 'monitoring',
    description: 'Cleanup interval for old records in milliseconds'
  },
  'monitoring.retention_days': {
    value: 30,
    category: 'monitoring',
    description: 'Data retention period in days'
  },

  // 诊断配置
  'diagnostics.default_ping_count': {
    value: 4,
    category: 'diagnostics',
    description: 'Default ping count for diagnostic tests'
  },
  'diagnostics.default_traceroute_hops': {
    value: 30,
    category: 'diagnostics',
    description: 'Default maximum hops for traceroute'
  },
  'diagnostics.default_mtr_count': {
    value: 10,
    category: 'diagnostics',
    description: 'Default MTR test count'
  },
  'diagnostics.speedtest_enabled': {
    value: true,
    category: 'diagnostics',
    description: 'Enable speedtest functionality'
  },
  'diagnostics.max_concurrent_tests': {
    value: 5,
    category: 'diagnostics',
    description: 'Maximum concurrent diagnostic tests per agent'
  },

  // 安全配置
  'security.jwt_expires_in': {
    value: '7d',
    category: 'security',
    description: 'JWT token expiration time'
  },
  'security.max_login_attempts': {
    value: 5,
    category: 'security',
    description: 'Maximum login attempts before lockout'
  },
  'security.lockout_duration': {
    value: 900000,
    category: 'security',
    description: 'Account lockout duration in milliseconds'
  },
  'security.require_strong_passwords': {
    value: true,
    category: 'security',
    description: 'Require strong passwords for new users'
  },

  // API配置
  'api.rate_limit_requests': {
    value: 100,
    category: 'api',
    description: 'API rate limit requests per window'
  },
  'api.rate_limit_window': {
    value: 900000,
    category: 'api',
    description: 'API rate limit window in milliseconds'
  },
  'api.cors_enabled': {
    value: true,
    category: 'api',
    description: 'Enable CORS for API requests'
  },
  'api.log_level': {
    value: 'info',
    category: 'api',
    description: 'API logging level (debug, info, warn, error)'
  },

  // 通知配置
  'notifications.email_enabled': {
    value: false,
    category: 'notifications',
    description: 'Enable email notifications'
  },
  'notifications.webhook_enabled': {
    value: false,
    category: 'notifications',
    description: 'Enable webhook notifications'
  },
  'notifications.alert_threshold': {
    value: 3,
    category: 'notifications',
    description: 'Number of failures before sending alert'
  }
};

export class SystemConfigController {

  // 获取所有系统配置
  async getAllConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { category } = req.query;

      const where = category ? { category: category as string } : {};

      const configs = await prisma.setting.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { key: 'asc' }
        ]
      });

      // 按分类分组配置项
      const configsByCategory = configs.reduce((acc, config) => {
        const cat = config.category || 'other';
        if (!acc[cat]) {
          acc[cat] = {};
        }
        
        try {
          acc[cat][config.key] = {
            value: JSON.parse(config.value),
            description: config.description,
            updatedAt: config.updatedAt
          };
        } catch (error) {
          acc[cat][config.key] = {
            value: config.value,
            description: config.description,
            updatedAt: config.updatedAt
          };
        }

        return acc;
      }, {} as Record<string, any>);

      const response: ApiResponse = {
        success: true,
        data: {
          configs: configsByCategory,
          total: configs.length
        },
        message: `Found ${configs.length} configuration items`
      };

      res.json(response);

    } catch (error) {
      logger.error('Get all configs error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get system configurations'
      };
      res.status(500).json(response);
    }
  }

  // 获取单个配置项
  async getConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration key is required'
        };
        res.status(400).json(response);
        return;
      }

      const config = await prisma.setting.findUnique({
        where: { key }
      });

      if (!config) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration not found'
        };
        res.status(404).json(response);
        return;
      }

      let parsedValue;
      try {
        parsedValue = JSON.parse(config.value);
      } catch (error) {
        parsedValue = config.value;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          key: config.key,
          value: parsedValue,
          category: config.category,
          description: config.description,
          updatedAt: config.updatedAt
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Get config error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get configuration'
      };
      res.status(500).json(response);
    }
  }

  // 更新配置项
  async updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { value, category, description }: UpdateSystemConfigRequest = req.body;

      if (!key) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration key is required'
        };
        res.status(400).json(response);
        return;
      }

      if (value === undefined) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration value is required'
        };
        res.status(400).json(response);
        return;
      }

      // 将值序列化为JSON字符串
      const serializedValue = JSON.stringify(value);

      const updatedConfig = await prisma.setting.upsert({
        where: { key },
        update: {
          value: serializedValue,
          ...(category && { category }),
          ...(description && { description })
        },
        create: {
          key,
          value: serializedValue,
          category: category || 'other',
          description
        }
      });

      let parsedValue;
      try {
        parsedValue = JSON.parse(updatedConfig.value);
      } catch (error) {
        parsedValue = updatedConfig.value;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          key: updatedConfig.key,
          value: parsedValue,
          category: updatedConfig.category,
          description: updatedConfig.description,
          updatedAt: updatedConfig.updatedAt
        },
        message: 'Configuration updated successfully'
      };

      logger.info(`Config updated: ${key} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Update config error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update configuration'
      };
      res.status(500).json(response);
    }
  }

  // 删除配置项
  async deleteConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration key is required'
        };
        res.status(400).json(response);
        return;
      }

      // 检查是否为系统核心配置（不允许删除）
      const coreConfigs = [
        'system.name',
        'system.version',
        'monitoring.heartbeat_interval',
        'security.jwt_expires_in'
      ];

      if (coreConfigs.includes(key)) {
        const response: ApiResponse = {
          success: false,
          error: 'Cannot delete core system configuration'
        };
        res.status(400).json(response);
        return;
      }

      const existingConfig = await prisma.setting.findUnique({
        where: { key }
      });

      if (!existingConfig) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration not found'
        };
        res.status(404).json(response);
        return;
      }

      await prisma.setting.delete({
        where: { key }
      });

      const response: ApiResponse = {
        success: true,
        message: 'Configuration deleted successfully'
      };

      logger.info(`Config deleted: ${key} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Delete config error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete configuration'
      };
      res.status(500).json(response);
    }
  }

  // 批量更新配置
  async batchUpdateConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { configs }: { configs: SystemConfigData[] } = req.body;

      if (!configs || !Array.isArray(configs) || configs.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Configuration array is required'
        };
        res.status(400).json(response);
        return;
      }

      const results: any[] = [];

      // 使用事务批量更新
      await prisma.$transaction(async (tx) => {
        for (const config of configs) {
          if (!config.key || config.value === undefined) {
            continue;
          }

          const serializedValue = JSON.stringify(config.value);

          const updatedConfig = await tx.setting.upsert({
            where: { key: config.key },
            update: {
              value: serializedValue,
              ...(config.category && { category: config.category }),
              ...(config.description && { description: config.description })
            },
            create: {
              key: config.key,
              value: serializedValue,
              category: config.category || 'other',
              description: config.description
            }
          });

          results.push({
            key: updatedConfig.key,
            value: JSON.parse(updatedConfig.value),
            category: updatedConfig.category,
            description: updatedConfig.description,
            updatedAt: updatedConfig.updatedAt
          });
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          updated: results,
          count: results.length
        },
        message: `Successfully updated ${results.length} configurations`
      };

      logger.info(`Batch config update: ${results.length} items by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Batch update configs error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to batch update configurations'
      };
      res.status(500).json(response);
    }
  }

  // 重置配置为默认值
  async resetToDefaults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { category } = req.body;

      let configsToReset: Record<string, any> = DEFAULT_SYSTEM_CONFIGS;

      // 如果指定了分类，只重置该分类的配置
      if (category) {
        configsToReset = Object.fromEntries(
          Object.entries(DEFAULT_SYSTEM_CONFIGS).filter(
            ([key, config]) => config.category === category
          )
        );
      }

      const results: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const [key, defaultConfig] of Object.entries(configsToReset)) {
          const serializedValue = JSON.stringify(defaultConfig.value);

          const updatedConfig = await tx.setting.upsert({
            where: { key },
            update: {
              value: serializedValue,
              category: defaultConfig.category,
              description: defaultConfig.description
            },
            create: {
              key,
              value: serializedValue,
              category: defaultConfig.category || 'other',
              description: defaultConfig.description
            }
          });

          results.push({
            key: updatedConfig.key,
            value: JSON.parse(updatedConfig.value),
            category: updatedConfig.category,
            description: updatedConfig.description,
            updatedAt: updatedConfig.updatedAt
          });
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          reset: results,
          count: results.length
        },
        message: `Successfully reset ${results.length} configurations to defaults`
      };

      logger.info(`Config reset to defaults: ${category || 'all'} by user: ${req.user?.username}`);
      res.json(response);

    } catch (error) {
      logger.error('Reset configs error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to reset configurations'
      };
      res.status(500).json(response);
    }
  }

  // 获取配置分类列表
  async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = await prisma.setting.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { category: 'asc' }
      });

      const response: ApiResponse = {
        success: true,
        data: categories.map(cat => ({
          name: cat.category || 'other',
          count: cat._count.category
        }))
      };

      res.json(response);

    } catch (error) {
      logger.error('Get categories error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get configuration categories'
      };
      res.status(500).json(response);
    }
  }
}

export const systemConfigController = new SystemConfigController();