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
  optionLabels?: Record<string, string>; // 选项的显示标签
  unit?: string; // 单位
  min?: number; // 最小值（数字类型）
  max?: number; // 最大值（数字类型）
}

// 预定义的系统配置项（仅保留用户真正需要的配置）
export const DEFAULT_SYSTEM_CONFIGS: Record<string, ConfigMetadata> = {
  // 🎨 基础配置
  "system.name": {
    value: "SsalgTen Network Monitor",
    category: "basic",
    description: "在页面标题和导航栏中显示的系统名称",
    displayName: "站点名称",
    inputType: "text",
  },

  // 📊 数据管理
  "monitoring.retention_days": {
    value: 1,
    category: "data",
    description:
      "历史监控数据保留天数（心跳日志、诊断记录）。⚠️ 数值越大，数据库占用越大。推荐 1-3 天，足够查看节点状态。",
    displayName: "数据保留天数",
    inputType: "number",
    unit: "天",
    min: 1,
    max: 7,
  },

  // 🗺️ 地图配置
  "map.api_key": {
    value: "",
    category: "map",
    description:
      "可选配置。如果要使用 Mapbox 地图样式，需要在 Mapbox 官网免费注册并填写密钥",
    displayName: "Mapbox API 密钥",
    inputType: "text",
  },

  // 🌍 Cesium 3D 地球配置
  "cesium.ion_token": {
    value: "",
    category: "map",
    description:
      "可选配置。用于访问 Cesium Ion 的高质量 3D 地形和影像数据。在 cesium.com/ion 免费注册获取（每月 5万次免费加载）",
    displayName: "Cesium Ion API Token",
    inputType: "text",
  },
};

export class SystemConfigController {
  // 获取公共地图配置(无需认证)
  async getPublicMapConfig(req: Request, res: Response): Promise<void> {
    try {
      // 获取地图相关配置
      const [mapApiKey, cesiumToken] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "map.api_key" } }),
        prisma.setting.findUnique({ where: { key: "cesium.ion_token" } }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          apiKey: mapApiKey?.value ? JSON.parse(mapApiKey.value) : "",
          cesiumIonToken: cesiumToken?.value
            ? JSON.parse(cesiumToken.value)
            : "",
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

      // 如果已经是字符串，直接使用；否则序列化
      const serializedValue =
        typeof value === "string" ? value : JSON.stringify(value);

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
          const serializedValue =
            typeof defaultConfig.value === "string"
              ? defaultConfig.value
              : JSON.stringify(defaultConfig.value);

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

  // 清理数据库中的旧配置项（只保留当前定义的配置）
  async cleanupOldConfigs(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // 获取当前定义的配置键
      const validKeys = Object.keys(DEFAULT_SYSTEM_CONFIGS);

      // 获取数据库中的所有配置
      const allConfigs = await prisma.setting.findMany({
        select: { key: true },
      });

      // 找出需要删除的配置
      const keysToDelete = allConfigs
        .filter((config) => !validKeys.includes(config.key))
        .map((config) => config.key);

      if (keysToDelete.length === 0) {
        logger.info("No old configs to cleanup");
        const response: ApiResponse = {
          success: true,
          message: "Database configs are up to date",
          data: { deleted: 0, remaining: allConfigs.length },
        };
        res.json(response);
        return;
      }

      // 执行删除
      const deleteResult = await prisma.setting.deleteMany({
        where: {
          key: {
            in: keysToDelete,
          },
        },
      });

      logger.info(
        `Cleaned up ${deleteResult.count} old configs: ${keysToDelete.join(", ")}`,
      );

      const response: ApiResponse = {
        success: true,
        message: `Successfully deleted ${deleteResult.count} old configuration items`,
        data: {
          deleted: deleteResult.count,
          deletedKeys: keysToDelete,
          remaining: allConfigs.length - keysToDelete.length,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Cleanup configs error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to cleanup old configurations",
      };
      res.status(500).json(response);
    }
  }
}

export const systemConfigController = new SystemConfigController();
