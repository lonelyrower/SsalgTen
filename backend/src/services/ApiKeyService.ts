import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import crypto from "crypto";

export interface ApiKeyInfo {
  id: string;
  key: string;
  description: string;
  isDefault: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  previousKeyGraceUntil?: string;
  hasPreviousKey?: boolean;
}

export class ApiKeyService {
  // 签名校验缓存（防重放）: nonce -> expireAt
  private nonceCache: Map<string, number> = new Map();
  private signatureTtlSec = parseInt(
    process.env.AGENT_SIGNATURE_TTL_SECONDS || "300",
  );
  private requireSignature =
    (process.env.AGENT_REQUIRE_SIGNATURE || "false").toLowerCase() === "true";

  // 内存缓存：系统密钥/旧密钥（减少 Setting 表查询）
  private keyCache: {
    systemKey?: string;
    previousKey?: string;
    previousKeyExpires?: string;
    fetchedAt?: number;
  } = {};
  private keyCacheTtlMs =
    parseInt(process.env.AGENT_KEY_CACHE_TTL_SECONDS || "300") * 1000; // 增加到 5 分钟
  private keyCacheRefreshing = false; // 防止并发刷新缓存

  // 使用统计写入节流（避免心跳高频写 DB）
  private lastUsageUpdateMs = 0;
  private usageUpdateMinIntervalMs = parseInt(
    process.env.API_KEY_USAGE_MIN_INTERVAL_MS || "60000",
  );
  // 旧密钥宽限期（小时）
  private previousKeyGraceHours = parseInt(
    process.env.PREVIOUS_API_KEY_GRACE_HOURS || "24",
  );
  // 生成安全的API密钥
  private generateSecureApiKey(): string {
    // 生成32字节的随机数据并转换为hex
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString(36);
    const randomString = randomBytes.toString("hex");
    return `ssalgten_${timestamp}_${randomString}`;
  }

  // 验证API密钥格式
  private isValidApiKeyFormat(key: string): boolean {
    // 检查是否为新格式的密钥
    if (key.startsWith("ssalgten_")) {
      return key.length >= 48; // ssalgten_ + timestamp + 64字符hex
    }

    // 兼容旧格式，但标记为不安全
    return key.length >= 16;
  }

  // 检查是否为不安全的默认密钥
  private isUnsafeDefaultKey(key: string): boolean {
    const unsafeKeys = [
      "default-agent-api-key",
      "default-agent-key-change-this",
      "default-agent-key-change-this-immediately",
      "change-this-api-key",
      "default-agent-api-key-change-this-in-production",
    ];
    return unsafeKeys.includes(key);
  }

  public isSecureAgentApiKey(key?: string | null): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    if (!trimmed) return false;
    return (
      this.isValidApiKeyFormat(trimmed) && !this.isUnsafeDefaultKey(trimmed)
    );
  }

  // 初始化系统API密钥
  async initializeSystemApiKey(): Promise<string> {
    try {
      // 检查是否已存在默认系统密钥
      let defaultKey = await prisma.setting.findUnique({
        where: { key: "SYSTEM_AGENT_API_KEY" },
      });

      if (defaultKey) {
        const currentValue = (defaultKey.value || "").trim();

        if (!currentValue) {
          logger.warn(
            "System agent API key is empty; generating a new secure key...",
          );

          const newKey = this.generateSecureApiKey();

          await prisma.setting.update({
            where: { key: "SYSTEM_AGENT_API_KEY" },
            data: {
              value: newKey,
              description: `System default Agent API key - regenerated ${new Date().toISOString()}`,
            },
          });

          logger.info(
            "System agent API key regenerated because the stored value was empty",
          );
          return newKey;
        }

        if (this.isUnsafeDefaultKey(currentValue)) {
          logger.warn(
            "Detected an unsafe default system agent API key; rotating to a secure value...",
          );

          const newKey = this.generateSecureApiKey();

          await prisma.setting.update({
            where: { key: "SYSTEM_AGENT_API_KEY" },
            data: {
              value: newKey,
              description: `System default Agent API key - auto-rotated ${new Date().toISOString()}`,
            },
          });

          logger.info("System agent API key rotated to a secure value");
          return newKey;
        }

        logger.info(
          "System agent API key already exists and is considered safe",
        );
        return currentValue;
      }
      // 生成新的系统密钥
      const newKey = this.generateSecureApiKey();

      await prisma.setting.create({
        data: {
          key: "SYSTEM_AGENT_API_KEY",
          value: newKey,
          category: "security",
          description: `系统默认Agent API密钥 - 生成于 ${new Date().toISOString()}`,
        },
      });

      logger.info("新的系统API密钥已生成");
      return newKey;
    } catch (error) {
      logger.error("初始化系统API密钥失败:", error);

      throw error instanceof Error
        ? error
        : new Error("Failed to initialize system agent API key");
    }
  }

  // 获取系统API密钥
  async getSystemApiKey(): Promise<string> {
    try {
      const keys = await this.fetchSystemKeys();
      const candidate = keys.systemKey?.trim();
      if (candidate) {
        if (this.isSecureAgentApiKey(candidate)) {
          return candidate;
        }
        logger.warn(
          "System agent API key in settings is insecure. Regenerating a secure key...",
        );
        const regenerated = await this.initializeSystemApiKey();
        if (!this.isSecureAgentApiKey(regenerated)) {
          throw new Error(
            "Regenerated system agent API key does not meet security requirements",
          );
        }
        this.keyCache = {
          ...this.keyCache,
          systemKey: regenerated,
          fetchedAt: Date.now(),
        };
        return regenerated;
      }

      const created = await this.initializeSystemApiKey();
      if (!this.isSecureAgentApiKey(created)) {
        throw new Error(
          "Generated system agent API key does not meet security requirements",
        );
      }
      this.keyCache = {
        ...this.keyCache,
        systemKey: created,
        fetchedAt: Date.now(),
      };
      return created;
    } catch (error) {
      this.keyCache = {
        ...this.keyCache,
        systemKey: undefined,
        fetchedAt: undefined,
      };
      logger.error("Failed to resolve secure system agent API key:", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to resolve secure system agent API key");
    }
  }

  // 验证API密钥
  async validateApiKey(key: string): Promise<boolean> {
    logger.debug(
      `[ApiKeyService] 开始验证API密钥: ${key ? key.substring(0, 10) + "..." : "null/undefined"}`,
    );

    if (!key) {
      logger.warn(`[ApiKeyService] API密钥为空或未定义`);
      return false;
    }

    if (!this.isValidApiKeyFormat(key)) {
      logger.warn(
        `[ApiKeyService] API密钥格式无效: ${key.substring(0, 10)}...`,
      );
      return false;
    }

    try {
      const { systemKey, previousKey, previousKeyExpires } =
        await this.fetchSystemKeys();
      logger.debug(`[ApiKeyService] 已加载系统API密钥(截断显示)`);

      let matches = key === systemKey;
      logger.debug(`[ApiKeyService] 与当前系统密钥比较结果: ${matches}`);

      // 如果不匹配当前密钥，检查是否匹配仍在宽限期的旧密钥
      if (!matches) {
        logger.debug(`[ApiKeyService] 检查旧密钥宽限期...`);
        if (previousKey && previousKeyExpires) {
          const expiresAt = new Date(previousKeyExpires);
          logger.debug(
            `[ApiKeyService] 找到旧密钥，过期时间: ${expiresAt.toISOString()}`,
          );
          if (new Date() < expiresAt && key === previousKey) {
            matches = true;
            logger.debug("[ApiKeyService] 使用处于宽限期的旧API密钥");
          }
        } else {
          logger.debug(`[ApiKeyService] 未找到旧密钥记录`);
        }
      }

      logger.debug(`[ApiKeyService] 最终密钥匹配结果: ${matches}`);

      if (matches) {
        logger.debug(`[ApiKeyService] API密钥验证成功，更新使用统计(节流)`);
        await this.updateApiKeyUsage(key);
        return true;
      }

      logger.warn(
        `[ApiKeyService] API密钥不匹配 - 提供的密钥: ${key.substring(0, 10)}..., 系统密钥: ${systemKey ? (systemKey as string).substring(0, 10) : "unknown"}...`,
      );
      return false;
    } catch (error) {
      logger.error("[ApiKeyService] 验证API密钥时出错:", error);
      return false;
    }
  }

  // 更新API密钥使用统计
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async updateApiKeyUsage(_key: string): Promise<void> {
    try {
      // 节流：限制最小写入间隔
      const now = Date.now();
      if (now - this.lastUsageUpdateMs < this.usageUpdateMinIntervalMs) {
        return;
      }
      this.lastUsageUpdateMs = now;
      // 更新最后使用时间
      await prisma.setting.upsert({
        where: { key: "SYSTEM_AGENT_API_KEY_LAST_USED" },
        update: { value: new Date().toISOString() },
        create: {
          key: "SYSTEM_AGENT_API_KEY_LAST_USED",
          value: new Date().toISOString(),
          category: "security",
          description: "系统API密钥最后使用时间",
        },
      });

      // 更新使用次数
      const usageCount = await prisma.setting.findUnique({
        where: { key: "SYSTEM_AGENT_API_KEY_USAGE_COUNT" },
      });

      const currentCount = usageCount ? parseInt(usageCount.value) || 0 : 0;

      await prisma.setting.upsert({
        where: { key: "SYSTEM_AGENT_API_KEY_USAGE_COUNT" },
        update: { value: (currentCount + 1).toString() },
        create: {
          key: "SYSTEM_AGENT_API_KEY_USAGE_COUNT",
          value: "1",
          category: "security",
          description: "系统API密钥使用次数",
        },
      });
    } catch (error) {
      // 统计更新失败不应该影响主要功能
      logger.debug("更新API密钥使用统计失败:", error);
    }
  }

  // 获取API密钥信息
  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    try {
      const [
        keyRecord,
        lastUsedRecord,
        usageCountRecord,
        previousKeyRecord,
        previousKeyExpires,
      ] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "SYSTEM_AGENT_API_KEY" } }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_LAST_USED" },
        }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_USAGE_COUNT" },
        }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS" },
        }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES" },
        }),
      ]);

      const key = keyRecord?.value || (await this.getSystemApiKey());
      const lastUsed = lastUsedRecord?.value
        ? new Date(lastUsedRecord.value)
        : undefined;
      const usageCount = usageCountRecord?.value
        ? parseInt(usageCountRecord.value) || 0
        : 0;

      const info: ApiKeyInfo = {
        id: "system-default",
        key: key,
        description: keyRecord?.description || "系统默认API密钥",
        isDefault: true,
        createdAt: keyRecord?.createdAt || new Date(),
        lastUsed: lastUsed,
        usageCount: usageCount,
      };
      // 附加旧密钥宽限信息（不包含旧密钥的实际值）
      if (previousKeyExpires) {
        info.previousKeyGraceUntil = previousKeyExpires.value;
        info.hasPreviousKey = !!previousKeyRecord;
      }
      return info;
    } catch (error) {
      logger.error("获取API密钥信息失败:", error);
      throw new Error("获取API密钥信息失败");
    }
  }

  // 重新生成API密钥
  async regenerateSystemApiKey(): Promise<string> {
    try {
      const newKey = this.generateSecureApiKey();
      const now = new Date();
      const expires = new Date(
        now.getTime() + this.previousKeyGraceHours * 3600 * 1000,
      );

      // 读取旧密钥
      const current = await prisma.setting.findUnique({
        where: { key: "SYSTEM_AGENT_API_KEY" },
      });

      // 保存旧密钥及过期时间（如果存在旧密钥）
      if (current) {
        await prisma.setting.upsert({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS" },
          update: {
            value: current.value,
            description: "上一版本系统API密钥（宽限期内仍然有效）",
          },
          create: {
            key: "SYSTEM_AGENT_API_KEY_PREVIOUS",
            value: current.value,
            category: "security",
            description: "上一版本系统API密钥（宽限期内仍然有效）",
          },
        });
        await prisma.setting.upsert({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES" },
          update: {
            value: expires.toISOString(),
            description: "旧API密钥过期时间",
          },
          create: {
            key: "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES",
            value: expires.toISOString(),
            category: "security",
            description: "旧API密钥过期时间",
          },
        });
      }

      // 写入新密钥
      await prisma.setting.upsert({
        where: { key: "SYSTEM_AGENT_API_KEY" },
        update: {
          value: newKey,
          description: `系统默认Agent API密钥 - 重新生成于 ${now.toISOString()}`,
        },
        create: {
          key: "SYSTEM_AGENT_API_KEY",
          value: newKey,
          category: "security",
          description: `系统默认Agent API密钥 - 生成于 ${now.toISOString()}`,
        },
      });

      // 重置使用统计
      await prisma.setting.deleteMany({
        where: {
          key: {
            in: [
              "SYSTEM_AGENT_API_KEY_LAST_USED",
              "SYSTEM_AGENT_API_KEY_USAGE_COUNT",
            ],
          },
        },
      });

      logger.info(
        `系统API密钥已重新生成，旧密钥宽限期 ${this.previousKeyGraceHours} 小时`,
      );
      return newKey;
    } catch (error) {
      logger.error("重新生成系统API密钥失败:", error);
      throw new Error("重新生成系统API密钥失败");
    }
  }

  // 清理过期旧密钥
  async purgeExpiredPreviousKey(): Promise<void> {
    try {
      const previousExpires = await prisma.setting.findUnique({
        where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES" },
      });
      if (!previousExpires) return;
      const expiresAt = new Date(previousExpires.value);
      if (new Date() > expiresAt) {
        await prisma.setting.deleteMany({
          where: {
            key: {
              in: [
                "SYSTEM_AGENT_API_KEY_PREVIOUS",
                "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES",
              ],
            },
          },
        });
        logger.info("已清理过期旧API密钥");
      }
    } catch (error) {
      logger.warn("清理旧API密钥失败:", error);
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

      // 使用 isSecureAgentApiKey 统一校验
      if (!this.isSecureAgentApiKey(systemKey)) {
        isSecure = false;
        warnings.push("系统API密钥未满足最新的安全要求");
        recommendations.push("立即重新生成系统API密钥");
      }

      // 检查是否在环境变量中使用默认值
      const envKey = process.env.DEFAULT_AGENT_API_KEY;
      if (envKey && !this.isSecureAgentApiKey(envKey)) {
        warnings.push("环境变量 DEFAULT_AGENT_API_KEY 使用了不安全的值");
        recommendations.push("更新环境变量 DEFAULT_AGENT_API_KEY 以避免误用");
      }

      return {
        isSecure,
        warnings,
        recommendations,
      };
    } catch (error) {
      logger.error("检查API密钥安全性失败:", error);
      return {
        isSecure: false,
        warnings: ["无法检查API密钥安全性"],
        recommendations: ["检查数据库连接和配置"],
      };
    }
  }

  // 校验Agent签名请求（可选启用）
  async validateSignedRequest(options: {
    providedApiKey?: string;
    timestamp?: string;
    signature?: string;
    nonce?: string;
    body?: unknown;
  }): Promise<{ ok: boolean; reason?: string }> {
    const { timestamp, signature, nonce, body } = options;
    if (!this.requireSignature) {
      // 未强制要求时，如果未提供签名则放行，但记录提示
      if (!signature) {
        logger.debug("[ApiKeyService] Signature not provided (not required)");
        return { ok: true };
      }
    }

    if (!timestamp || !signature) {
      return { ok: false, reason: "missing_signature_or_timestamp" };
    }
    // 时间窗口校验
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts)) {
      return { ok: false, reason: "invalid_timestamp" };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > this.signatureTtlSec) {
      return { ok: false, reason: "timestamp_out_of_window" };
    }
    // nonce 防重放
    if (nonce) {
      const exist = this.nonceCache.get(nonce);
      if (exist && exist > Date.now()) {
        return { ok: false, reason: "replay_detected" };
      }
    }

    try {
      // 使用当前或处于宽限期的旧系统密钥（缓存化）
      const { systemKey, previousKey, previousKeyExpires } =
        await this.fetchSystemKeys();
      const candidates = [systemKey].filter(Boolean) as string[];
      if (
        previousKey &&
        previousKeyExpires &&
        new Date() < new Date(previousKeyExpires)
      ) {
        candidates.push(previousKey);
      }

      const payload = `${timestamp}.${JSON.stringify(body ?? {})}`;
      const compute = (key: string) =>
        crypto.createHmac("sha256", key).update(payload).digest("hex");
      const matched = candidates.some((k) => compute(k) === signature);
      if (!matched) {
        return { ok: false, reason: "bad_signature" };
      }
      // 记录 nonce
      if (nonce) {
        this.nonceCache.set(nonce, Date.now() + this.signatureTtlSec * 1000);
      }
      return { ok: true };
    } catch (e) {
      logger.warn("[ApiKeyService] Signature validation error:", e);
      return { ok: false, reason: "internal_error" };
    }
  }

  // 缓存化读取系统密钥及旧密钥
  private async fetchSystemKeys(): Promise<{
    systemKey?: string;
    previousKey?: string;
    previousKeyExpires?: string;
  }> {
    const now = Date.now();

    // 如果缓存仍然有效，直接返回
    if (
      this.keyCache.fetchedAt &&
      now - (this.keyCache.fetchedAt || 0) < this.keyCacheTtlMs
    ) {
      return {
        systemKey: this.keyCache.systemKey,
        previousKey: this.keyCache.previousKey,
        previousKeyExpires: this.keyCache.previousKeyExpires,
      };
    }

    // 防止并发刷新：如果已有请求在刷新，等待并返回旧缓存
    if (this.keyCacheRefreshing) {
      // 返回旧缓存（即使过期也比等待数据库查询好）
      return {
        systemKey: this.keyCache.systemKey,
        previousKey: this.keyCache.previousKey,
        previousKeyExpires: this.keyCache.previousKeyExpires,
      };
    }

    // 标记正在刷新
    this.keyCacheRefreshing = true;

    try {
      const [keyRec, prevRec, prevExpRec] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "SYSTEM_AGENT_API_KEY" } }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS" },
        }),
        prisma.setting.findUnique({
          where: { key: "SYSTEM_AGENT_API_KEY_PREVIOUS_EXPIRES" },
        }),
      ]);

      this.keyCache = {
        systemKey: keyRec?.value,
        previousKey: prevRec?.value,
        previousKeyExpires: prevExpRec?.value,
        fetchedAt: now,
      };

      return {
        systemKey: keyRec?.value,
        previousKey: prevRec?.value,
        previousKeyExpires: prevExpRec?.value,
      };
    } finally {
      // 确保释放锁
      this.keyCacheRefreshing = false;
    }
  }
}

export const apiKeyService = new ApiKeyService();
