import { Response, Request } from "express";
import { prisma } from "../lib/prisma";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";

export interface SystemConfigData {
  key: string;
  value: string;
  category?: string;
  description?: string;
  displayName?: string;
  inputType?: string;
  options?: string[];
  unit?: string;
}

interface ResetResult {
  key: string;
  value: unknown;
  category?: string | null;
  description?: string | null;
  updatedAt?: Date;
}

export interface UpdateSystemConfigRequest {
  value: string;
  category?: string;
  description?: string;
}

// 配置元数据：中文名称、输入类型、选项等
interface ConfigMetadata {
  value: unknown;
  category: string;
  description: string;
  displayName: string; // 中文名称
  inputType?: "text" | "number" | "boolean" | "select" | "textarea"; // 输入类型
  options?: string[]; // 下拉框选项
  unit?: string; // 单位
  min?: number; // 最小值（数字类型）
  max?: number; // 最大值（数字类型）
}

// 预定义的系统配置项
export const DEFAULT_SYSTEM_CONFIGS: Record<string, ConfigMetadata> = {
  // 系统基础配置
  "system.name": {
    value: "SsalgTen Network Monitor",
    category: "system",
    description: "System display name",
    displayName: "系统名称",
    inputType: "text",
  },
  "system.version": {
    value: "1.0.0",
    category: "system",
    description: "Current system version",
    displayName: "系统版本",
    inputType: "text",
  },
  "system.timezone": {
    value: "UTC",
    category: "system",
    description: "System timezone",
    displayName: "系统时区",
    inputType: "select",
    options: [
      "UTC",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "America/New_York",
      "Europe/London",
    ],
  },
  "system.maintenance_mode": {
    value: false,
    category: "system",
    description: "Enable maintenance mode",
    displayName: "维护模式",
    inputType: "boolean",
  },

  // 监控配置
  "monitoring.heartbeat_interval": {
    value: 30000,
    category: "monitoring",
    description: "Agent heartbeat interval in milliseconds",
    displayName: "心跳间隔",
    inputType: "number",
    unit: "毫秒",
    min: 5000,
    max: 300000,
  },
  "monitoring.heartbeat_timeout": {
    value: 90000,
    category: "monitoring",
    description: "Agent heartbeat timeout in milliseconds",
    displayName: "心跳超时",
    inputType: "number",
    unit: "毫秒",
    min: 10000,
    max: 600000,
  },
  "monitoring.max_offline_time": {
    value: 300000,
    category: "monitoring",
    description: "Maximum offline time before marking node as offline",
    displayName: "最大离线时间",
    inputType: "number",
    unit: "毫秒",
    min: 60000,
    max: 3600000,
  },
  "monitoring.cleanup_interval": {
    value: 86400000,
    category: "monitoring",
    description: "Cleanup interval for old records in milliseconds",
    displayName: "清理间隔",
    inputType: "number",
    unit: "毫秒",
    min: 3600000,
  },
  "monitoring.retention_days": {
    value: 30,
    category: "monitoring",
    description: "Data retention period in days",
    displayName: "数据保留天数",
    inputType: "number",
    unit: "天",
    min: 1,
    max: 365,
  },

  // 诊断配置
  "diagnostics.default_ping_count": {
    value: 4,
    category: "diagnostics",
    description: "Default ping count for diagnostic tests",
    displayName: "默认 Ping 次数",
    inputType: "number",
    min: 1,
    max: 100,
  },
  "diagnostics.default_traceroute_hops": {
    value: 30,
    category: "diagnostics",
    description: "Default maximum hops for traceroute",
    displayName: "默认跳数上限",
    inputType: "number",
    min: 1,
    max: 64,
  },
  "diagnostics.default_mtr_count": {
    value: 10,
    category: "diagnostics",
    description: "Default MTR test count",
    displayName: "默认 MTR 测试次数",
    inputType: "number",
    min: 1,
    max: 100,
  },
  "diagnostics.speedtest_enabled": {
    value: true,
    category: "diagnostics",
    description: "Enable speedtest functionality",
    displayName: "启用速度测试",
    inputType: "boolean",
  },
  "diagnostics.max_concurrent_tests": {
    value: 5,
    category: "diagnostics",
    description: "Maximum concurrent diagnostic tests per agent",
    displayName: "最大并发诊断数",
    inputType: "number",
    min: 1,
    max: 20,
  },
  "diagnostics.proxy_enabled": {
    value: false,
    category: "diagnostics",
    description: "Enable backend diagnostics proxy endpoints",
    displayName: "启用诊断代理",
    inputType: "boolean",
  },

  // 安全配置
  "security.jwt_expires_in": {
    value: "7d",
    category: "security",
    description: "JWT token expiration time",
    displayName: "JWT 过期时间",
    inputType: "select",
    options: ["1h", "6h", "12h", "1d", "3d", "7d", "30d"],
  },
  "security.max_login_attempts": {
    value: 5,
    category: "security",
    description: "Maximum login attempts before lockout",
    displayName: "最大登录尝试次数",
    inputType: "number",
    min: 1,
    max: 20,
  },
  "security.lockout_duration": {
    value: 900000,
    category: "security",
    description: "Account lockout duration in milliseconds",
    displayName: "账户锁定时长",
    inputType: "number",
    unit: "毫秒",
    min: 60000,
    max: 86400000,
  },
  "security.require_strong_passwords": {
    value: true,
    category: "security",
    description: "Require strong passwords for new users",
    displayName: "要求强密码",
    inputType: "boolean",
  },
  "security.ssh_monitor_default_enabled": {
    value: false,
    category: "security",
    description:
      "Default enabled state for SSH brute-force monitoring on new agents (for installer templates)",
    displayName: "默认启用 SSH 监控",
    inputType: "boolean",
  },
  "security.ssh_monitor_default_window_min": {
    value: 10,
    category: "security",
    description: "Default window minutes for SSH monitoring template",
    displayName: "SSH 监控时间窗口",
    inputType: "number",
    unit: "分钟",
    min: 1,
    max: 60,
  },
  "security.ssh_monitor_default_threshold": {
    value: 10,
    category: "security",
    description:
      "Default threshold of attempts in window for SSH monitoring template",
    displayName: "SSH 监控阈值",
    inputType: "number",
    min: 1,
    max: 100,
  },

  // API配置
  "api.rate_limit_requests": {
    value: 100,
    category: "api",
    description: "API rate limit requests per window",
    displayName: "速率限制请求数",
    inputType: "number",
    min: 10,
    max: 10000,
  },
  "api.rate_limit_window": {
    value: 900000,
    category: "api",
    description: "API rate limit window in milliseconds",
    displayName: "速率限制窗口",
    inputType: "number",
    unit: "毫秒",
    min: 60000,
    max: 3600000,
  },
  "api.cors_enabled": {
    value: true,
    category: "api",
    description: "Enable CORS for API requests",
    displayName: "启用 CORS",
    inputType: "boolean",
  },
  "api.log_level": {
    value: "info",
    category: "api",
    description: "API logging level (debug, info, warn, error)",
    displayName: "日志级别",
    inputType: "select",
    options: ["debug", "info", "warn", "error"],
  },

  // 地图配置
  "map.provider": {
    value: "carto",
    category: "map",
    description: "Map tile provider (carto, openstreetmap, mapbox)",
    displayName: "地图提供商",
    inputType: "select",
    options: ["carto", "openstreetmap", "mapbox"],
  },
  "map.api_key": {
    value: "",
    category: "map",
    description: "Map API key (required for mapbox)",
    displayName: "地图 API 密钥",
    inputType: "text",
  },
};

export class SystemConfigController {
  // 获取公共地图配置(无需认证)
  async getPublicMapConfig(req: Request, res: Response): Promise<void> {
    try {
      // 获取地图相关配置
      const mapProvider = await prisma.setting.findUnique({
        where: { key: "map.provider" },
      });
      const mapApiKey = await prisma.setting.findUnique({
        where: { key: "map.api_key" },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          provider: mapProvider?.value
            ? JSON.parse(mapProvider.value)
            : "carto",
          apiKey: mapApiKey?.value ? JSON.parse(mapApiKey.value) : "",
        },
      };
      res.json(response);
    } catch (error) {
      logger.error("Error fetching public map config:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch map configuration",
      };
      res.status(500).json(response);
    }
  }

  // 获取所有系统配置
  async getAllConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { category } = req.query;

      const where = category ? { category: category as string } : {};

      const configs = await prisma.setting.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }],
      });

      // 转换为前端期望的数组格式，附加元数据
      const configsArray = configs.map((config) => {
        const metadata = DEFAULT_SYSTEM_CONFIGS[config.key];
        return {
          id: config.id,
          key: config.key,
          value: config.value,
          category: config.category,
          description: config.description,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
          // 附加元数据
          displayName: metadata?.displayName || config.key,
          inputType: metadata?.inputType || "text",
          options: metadata?.options,
          unit: metadata?.unit,
          min: metadata?.min,
          max: metadata?.max,
        };
      });

      const response: ApiResponse = {
        success: true,
        data: configsArray,
        message: `Found ${configs.length} configuration items`,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get all configs error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get system configurations",
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
          error: "Configuration key is required",
        };
        res.status(400).json(response);
        return;
      }

      const config = await prisma.setting.findUnique({
        where: { key },
      });

      if (!config) {
        const response: ApiResponse = {
          success: false,
          error: "Configuration not found",
        };
        res.status(404).json(response);
        return;
      }

      let parsedValue;
      try {
        parsedValue = JSON.parse(config.value);
      } catch {
        parsedValue = config.value;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          key: config.key,
          value: parsedValue,
          category: config.category,
          description: config.description,
          updatedAt: config.updatedAt,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Get config error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get configuration",
      };
      res.status(500).json(response);
    }
  }

  // 更新配置项
  async updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { value, category, description }: UpdateSystemConfigRequest =
        req.body;

      if (!key) {
        const response: ApiResponse = {
          success: false,
          error: "Configuration key is required",
        };
        res.status(400).json(response);
        return;
      }

      if (value === undefined) {
        const response: ApiResponse = {
          success: false,
          error: "Configuration value is required",
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
          ...(description && { description }),
        },
        create: {
          key,
          value: serializedValue,
          category: category || "other",
          description,
        },
      });

      let parsedValue;
      try {
        parsedValue = JSON.parse(updatedConfig.value);
      } catch {
        parsedValue = updatedConfig.value;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          key: updatedConfig.key,
          value: parsedValue,
          category: updatedConfig.category,
          description: updatedConfig.description,
          updatedAt: updatedConfig.updatedAt,
        },
        message: "Configuration updated successfully",
      };

      logger.info(`Config updated: ${key} by user: ${req.user?.username}`);
      res.json(response);
    } catch (error) {
      logger.error("Update config error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to update configuration",
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
          error: "Configuration key is required",
        };
        res.status(400).json(response);
        return;
      }

      // 检查是否为系统核心配置（不允许删除）
      const coreConfigs = [
        "system.name",
        "system.version",
        "monitoring.heartbeat_interval",
        "security.jwt_expires_in",
      ];

      if (coreConfigs.includes(key)) {
        const response: ApiResponse = {
          success: false,
          error: "Cannot delete core system configuration",
        };
        res.status(400).json(response);
        return;
      }

      const existingConfig = await prisma.setting.findUnique({
        where: { key },
      });

      if (!existingConfig) {
        const response: ApiResponse = {
          success: false,
          error: "Configuration not found",
        };
        res.status(404).json(response);
        return;
      }

      await prisma.setting.delete({
        where: { key },
      });

      const response: ApiResponse = {
        success: true,
        message: "Configuration deleted successfully",
      };

      logger.info(`Config deleted: ${key} by user: ${req.user?.username}`);
      res.json(response);
    } catch (error) {
      logger.error("Delete config error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to delete configuration",
      };
      res.status(500).json(response);
    }
  }

  // 批量更新配置
  async batchUpdateConfigs(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { configs }: { configs: SystemConfigData[] } = req.body;

      if (!configs || !Array.isArray(configs) || configs.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: "Configuration array is required",
        };
        res.status(400).json(response);
        return;
      }

      const results: ResetResult[] = [];

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
              ...(config.description && { description: config.description }),
            },
            create: {
              key: config.key,
              value: serializedValue,
              category: config.category || "other",
              description: config.description,
            },
          });

          results.push({
            key: updatedConfig.key,
            value: JSON.parse(updatedConfig.value),
            category: updatedConfig.category,
            description: updatedConfig.description,
            updatedAt: updatedConfig.updatedAt,
          });
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          updated: results,
          count: results.length,
        },
        message: `Successfully updated ${results.length} configurations`,
      };

      logger.info(
        `Batch config update: ${results.length} items by user: ${req.user?.username}`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Batch update configs error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to batch update configurations",
      };
      res.status(500).json(response);
    }
  }

  // 重置配置为默认值
  async resetToDefaults(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { category } = req.body;

      let configsToReset: Record<
        string,
        { value: unknown; category?: string; description?: string }
      > = DEFAULT_SYSTEM_CONFIGS;

      // 如果指定了分类，只重置该分类的配置
      if (category) {
        configsToReset = Object.fromEntries(
          Object.entries(DEFAULT_SYSTEM_CONFIGS).filter(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ([_key, config]) => config.category === category,
          ),
        );
      }

      const results: ResetResult[] = [];

      await prisma.$transaction(async (tx) => {
        for (const [key, defaultConfig] of Object.entries(configsToReset)) {
          const serializedValue = JSON.stringify(defaultConfig.value);

          const updatedConfig = await tx.setting.upsert({
            where: { key },
            update: {
              value: serializedValue,
              category: defaultConfig.category,
              description: defaultConfig.description,
            },
            create: {
              key,
              value: serializedValue,
              category: defaultConfig.category || "other",
              description: defaultConfig.description,
            },
          });

          results.push({
            key: updatedConfig.key,
            value: JSON.parse(updatedConfig.value),
            category: updatedConfig.category,
            description: updatedConfig.description,
            updatedAt: updatedConfig.updatedAt,
          });
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          reset: results,
          count: results.length,
        },
        message: `Successfully reset ${results.length} configurations to defaults`,
      };

      logger.info(
        `Config reset to defaults: ${category || "all"} by user: ${req.user?.username}`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Reset configs error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to reset configurations",
      };
      res.status(500).json(response);
    }
  }

  // 获取配置分类列表
  async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = await prisma.setting.groupBy({
        by: ["category"],
        _count: { category: true },
        orderBy: { category: "asc" },
      });

      const response: ApiResponse = {
        success: true,
        data: categories.map((cat) => ({
          name: cat.category || "other",
          count: cat._count.category,
        })),
      };

      res.json(response);
    } catch (error) {
      logger.error("Get categories error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get configuration categories",
      };
      res.status(500).json(response);
    }
  }
}

export const systemConfigController = new SystemConfigController();
