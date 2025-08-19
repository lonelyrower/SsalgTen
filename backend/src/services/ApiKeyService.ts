import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface ApiKeyInfo {
  id: string;
  key: string;
  description: string;
  isDefault: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

export class ApiKeyService {
  // 旧密钥宽限期（小时）
  private previousKeyGraceHours = parseInt(process.env.PREVIOUS_API_KEY_GRACE_HOURS || '24');
  // 生成安全的API密钥
  private generateSecureApiKey(): string {
    // 生成32字节的随机数据并转换为hex
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString(36);
    const randomString = randomBytes.toString('hex');
    return `ssalgten_${timestamp}_${randomString}`;
  }

  // 验证API密钥格式
  private isValidApiKeyFormat(key: string): boolean {
    // 检查是否为新格式的密钥
    if (key.startsWith('ssalgten_')) {
      return key.length >= 48; // ssalgten_ + timestamp + 64字符hex
    }
    
    // 兼容旧格式，但标记为不安全
    return key.length >= 16;
  }

  // 检查是否为不安全的默认密钥
  private isUnsafeDefaultKey(key: string): boolean {
    const unsafeKeys = [
      'default-agent-api-key',
      'default-agent-key-change-this',
      'default-agent-key-change-this-immediately',
      'change-this-api-key',
      'default-agent-api-key-change-this-in-production'
    ];
    return unsafeKeys.includes(key);
  }

  // 初始化系统API密钥
  async initializeSystemApiKey(): Promise<string> {
    try {
      // 检查是否已存在默认系统密钥
      let defaultKey = await prisma.setting.findUnique({
        where: { key: 'SYSTEM_AGENT_API_KEY' }
      });

      if (defaultKey) {
        // 检查现有密钥是否安全
        if (this.isUnsafeDefaultKey(defaultKey.value)) {
          logger.warn('检测到不安全的默认API密钥，正在重新生成...');
          
          // 生成新的安全密钥
          const newKey = this.generateSecureApiKey();
          
          await prisma.setting.update({
            where: { key: 'SYSTEM_AGENT_API_KEY' },
            data: { 
              value: newKey,
              description: `系统默认Agent API密钥 - 自动生成于 ${new Date().toISOString()}`
            }
          });

          logger.info('系统API密钥已更新为安全密钥');
          return newKey;
        }

        logger.info('系统API密钥已存在且安全');
        return defaultKey.value;
      }

      // 生成新的系统密钥
      const newKey = this.generateSecureApiKey();
      
      await prisma.setting.create({
        data: {
          key: 'SYSTEM_AGENT_API_KEY',
          value: newKey,
          category: 'security',
          description: `系统默认Agent API密钥 - 生成于 ${new Date().toISOString()}`
        }
      });

      logger.info('新的系统API密钥已生成');
      return newKey;
    } catch (error) {
      logger.error('初始化系统API密钥失败:', error);
      
      // 回退到环境变量
      const envKey = process.env.DEFAULT_AGENT_API_KEY || 'default-agent-api-key';
      if (this.isUnsafeDefaultKey(envKey)) {
        logger.warn('环境变量中的API密钥不安全，建议更新');
      }
      
      return envKey;
    }
  }

  // 获取系统API密钥
  async getSystemApiKey(): Promise<string> {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'SYSTEM_AGENT_API_KEY' }
      });

      if (setting) {
        return setting.value;
      }

      // 如果没有找到，初始化一个新的
      return await this.initializeSystemApiKey();
    } catch (error) {
      logger.error('获取系统API密钥失败:', error);
      // 回退到环境变量
      return process.env.DEFAULT_AGENT_API_KEY || 'default-agent-api-key';
    }
  }

  // 验证API密钥
  async validateApiKey(key: string): Promise<boolean> {
  logger.debug(`[ApiKeyService] 开始验证API密钥: ${key ? key.substring(0, 4) + '...' : 'null/undefined'}`);
    
    if (!key || !this.isValidApiKeyFormat(key)) {
  logger.debug(`[ApiKeyService] API密钥格式无效`);
      return false;
    }

    try {
      const systemKey = await this.getSystemApiKey();
      let matches = key === systemKey;

      // 如果不匹配当前密钥，检查是否匹配仍在宽限期的旧密钥
      if (!matches) {
        const previousKeyRecord = await prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS' } });
        const previousKeyExpires = await prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES' } });
        if (previousKeyRecord && previousKeyExpires) {
          const expiresAt = new Date(previousKeyExpires.value);
            if (new Date() < expiresAt && key === previousKeyRecord.value) {
              matches = true; // 旧密钥仍然有效
              logger.debug('[ApiKeyService] 使用处于宽限期的旧API密钥');
            }
        }
      }

      logger.debug(`[ApiKeyService] 密钥匹配结果: ${matches}`);

      if (matches) {
        logger.debug(`[ApiKeyService] API密钥验证成功，更新使用统计`);
        await this.updateApiKeyUsage(key);
        return true;
      }

      logger.debug(`[ApiKeyService] API密钥不匹配`);
      return false;
    } catch (error) {
      logger.error('[ApiKeyService] 验证API密钥时出错:', error);
      return false;
    }
  }

  // 更新API密钥使用统计
  private async updateApiKeyUsage(key: string): Promise<void> {
    try {
      // 更新最后使用时间
      await prisma.setting.upsert({
        where: { key: 'SYSTEM_AGENT_API_KEY_LAST_USED' },
        update: { value: new Date().toISOString() },
        create: {
          key: 'SYSTEM_AGENT_API_KEY_LAST_USED',
          value: new Date().toISOString(),
          category: 'security',
          description: '系统API密钥最后使用时间'
        }
      });

      // 更新使用次数
      const usageCount = await prisma.setting.findUnique({
        where: { key: 'SYSTEM_AGENT_API_KEY_USAGE_COUNT' }
      });

      const currentCount = usageCount ? parseInt(usageCount.value) || 0 : 0;
      
      await prisma.setting.upsert({
        where: { key: 'SYSTEM_AGENT_API_KEY_USAGE_COUNT' },
        update: { value: (currentCount + 1).toString() },
        create: {
          key: 'SYSTEM_AGENT_API_KEY_USAGE_COUNT',
          value: '1',
          category: 'security',
          description: '系统API密钥使用次数'
        }
      });
    } catch (error) {
      // 统计更新失败不应该影响主要功能
      logger.debug('更新API密钥使用统计失败:', error);
    }
  }

  // 获取API密钥信息
  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    try {
      const [keyRecord, lastUsedRecord, usageCountRecord, previousKeyRecord, previousKeyExpires] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY' } }),
        prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_LAST_USED' } }),
        prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_USAGE_COUNT' } }),
        prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS' } }),
        prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES' } })
      ]);

      const key = keyRecord?.value || await this.getSystemApiKey();
      const lastUsed = lastUsedRecord?.value ? new Date(lastUsedRecord.value) : undefined;
      const usageCount = usageCountRecord?.value ? parseInt(usageCountRecord.value) || 0 : 0;

      const info: ApiKeyInfo = {
        id: 'system-default',
        key: key,
        description: keyRecord?.description || '系统默认API密钥',
        isDefault: true,
        createdAt: keyRecord?.createdAt || new Date(),
        lastUsed: lastUsed,
        usageCount: usageCount
      };
      // 附加旧密钥宽限信息（不包含旧密钥的实际值）
      if (previousKeyExpires) {
        (info as any).previousKeyGraceUntil = previousKeyExpires.value;
        (info as any).hasPreviousKey = !!previousKeyRecord;
      }
      return info;
    } catch (error) {
      logger.error('获取API密钥信息失败:', error);
      throw new Error('获取API密钥信息失败');
    }
  }

  // 重新生成API密钥
  async regenerateSystemApiKey(): Promise<string> {
    try {
      const newKey = this.generateSecureApiKey();
      const now = new Date();
      const expires = new Date(now.getTime() + this.previousKeyGraceHours * 3600 * 1000);

      // 读取旧密钥
      const current = await prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY' } });

      // 保存旧密钥及过期时间（如果存在旧密钥）
      if (current) {
        await prisma.setting.upsert({
          where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS' },
          update: { value: current.value, description: '上一版本系统API密钥（宽限期内仍然有效）' },
          create: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS', value: current.value, category: 'security', description: '上一版本系统API密钥（宽限期内仍然有效）' }
        });
        await prisma.setting.upsert({
          where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES' },
          update: { value: expires.toISOString(), description: '旧API密钥过期时间' },
          create: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES', value: expires.toISOString(), category: 'security', description: '旧API密钥过期时间' }
        });
      }

      // 写入新密钥
      await prisma.setting.upsert({
        where: { key: 'SYSTEM_AGENT_API_KEY' },
        update: { value: newKey, description: `系统默认Agent API密钥 - 重新生成于 ${now.toISOString()}` },
        create: { key: 'SYSTEM_AGENT_API_KEY', value: newKey, category: 'security', description: `系统默认Agent API密钥 - 生成于 ${now.toISOString()}` }
      });

      // 重置使用统计
      await prisma.setting.deleteMany({
        where: { key: { in: ['SYSTEM_AGENT_API_KEY_LAST_USED', 'SYSTEM_AGENT_API_KEY_USAGE_COUNT'] } }
      });

      logger.info(`系统API密钥已重新生成，旧密钥宽限期 ${this.previousKeyGraceHours} 小时`);
      return newKey;
    } catch (error) {
      logger.error('重新生成系统API密钥失败:', error);
      throw new Error('重新生成系统API密钥失败');
    }
  }

  // 清理过期旧密钥
  async purgeExpiredPreviousKey(): Promise<void> {
    try {
      const previousExpires = await prisma.setting.findUnique({ where: { key: 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES' } });
      if (!previousExpires) return;
      const expiresAt = new Date(previousExpires.value);
      if (new Date() > expiresAt) {
        await prisma.setting.deleteMany({ where: { key: { in: ['SYSTEM_AGENT_API_KEY_PREVIOUS', 'SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES'] } } });
        logger.info('已清理过期旧API密钥');
      }
    } catch (error) {
      logger.warn('清理旧API密钥失败:', error);
    }
  }

  // 检查API密钥安全性
  async checkApiKeySecurity(): Promise<{
    isSecure: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const systemKey = await this.getSystemApiKey();
      let isSecure = true;

      // 检查是否为不安全的默认密钥
      if (this.isUnsafeDefaultKey(systemKey)) {
        isSecure = false;
        warnings.push('正在使用不安全的默认API密钥');
        recommendations.push('立即重新生成API密钥');
      }

      // 检查密钥格式
      if (!systemKey.startsWith('ssalgten_')) {
        isSecure = false;
        warnings.push('API密钥格式较旧，安全性较低');
        recommendations.push('升级到新格式的API密钥');
      }

      // 检查密钥长度
      if (systemKey.length < 32) {
        isSecure = false;
        warnings.push('API密钥长度不足，容易被破解');
        recommendations.push('使用更长的API密钥（推荐64+字符）');
      }

      // 检查是否在环境变量中使用默认值
      const envKey = process.env.DEFAULT_AGENT_API_KEY;
      if (envKey && this.isUnsafeDefaultKey(envKey)) {
        warnings.push('环境变量中仍使用默认API密钥');
        recommendations.push('更新环境变量DEFAULT_AGENT_API_KEY');
      }

      return {
        isSecure,
        warnings,
        recommendations
      };
    } catch (error) {
      logger.error('检查API密钥安全性失败:', error);
      return {
        isSecure: false,
        warnings: ['无法检查API密钥安全性'],
        recommendations: ['检查数据库连接和配置']
      };
    }
  }
}

export const apiKeyService = new ApiKeyService();