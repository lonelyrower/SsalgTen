import cors from "cors";

// 解析多个CORS来源（支持 CORS_ORIGIN 与 FRONTEND_URL）
const getCorsOrigins = (): string | string[] => {
  const sources: string[] = [];

  const pushFromEnv = (raw?: string) => {
    if (!raw) return;
    const parts = raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (p === "*") {
        sources.push("*");
        continue;
      }
      // 规范化：去除末尾斜杠
      const cleaned = p.replace(/\/$/, "");
      // 若未包含协议，默认加入 https 与 http 两种形式，提升容错
      if (!/^https?:\/\//i.test(cleaned)) {
        sources.push(`https://${cleaned}`);
        sources.push(`http://${cleaned}`);
      } else {
        sources.push(cleaned);
      }
    }
  };

  pushFromEnv(process.env.CORS_ORIGIN);
  // 作为补充来源，允许通过 FRONTEND_URL 与 DOMAIN 指定前端地址
  pushFromEnv(process.env.FRONTEND_URL);
  pushFromEnv(process.env.DOMAIN);

  // 如果没有任何显式来源，返回空字符串，让后续逻辑走智能检测
  if (sources.length === 0) return "";

  // 若包含通配符，直接返回 "*"
  if (sources.includes("*")) return "*";

  // 去重
  return Array.from(new Set(sources));
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getCorsOrigins();

    // 对于非浏览器/无 Origin 的请求（如健康检查、服务间调用），统一允许
    if (!origin) {
      return callback(null, true);
    }

    // 通配：显式允许所有来源
    if (allowedOrigins === "*") {
      return callback(null, true);
    }

    // 智能同域检测：如果没有配置CORS_ORIGIN，自动允许同域请求
    if (!process.env.CORS_ORIGIN) {
      try {
        const originUrl = new URL(origin);
        // 生产环境：只允许HTTPS同域 + localhost
        if (process.env.NODE_ENV === "production") {
          const host = originUrl.hostname;
          const isLocal =
            host === "localhost" || host === "127.0.0.1" || host === "::1";
          const isPrivateIPv4 =
            /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host);
          if (originUrl.protocol === "https:" || isLocal || isPrivateIPv4) {
            return callback(null, true);
          }
        } else {
          // 开发环境：允许所有
          return callback(null, true);
        }
      } catch {
        // URL解析失败，拒绝
        return callback(new Error(`Invalid origin: ${origin}`));
      }
    }

    // 用户自定义CORS配置的检查逻辑
    const origins = Array.isArray(allowedOrigins)
      ? allowedOrigins
      : [allowedOrigins];

    for (const allowedOrigin of origins) {
      if (allowedOrigin === "*" || allowedOrigin === origin) {
        return callback(null, true);
      }

      // 支持协议通配符（如 https://*）
      if (allowedOrigin.endsWith("://*")) {
        const protocol = allowedOrigin.slice(0, -3);
        if (origin.startsWith(protocol + "://")) {
          return callback(null, true);
        }
      }

      // 支持域名通配符（如 *.example.com）
      if (allowedOrigin.startsWith("*.")) {
        const domain = allowedOrigin.substring(2);
        if (
          origin.endsWith("." + domain) ||
          origin === domain ||
          origin.endsWith("://" + domain) ||
          origin.includes("://" + domain)
        ) {
          return callback(null, true);
        }
      }

      // 支持协议+域名通配符（如 https://*.example.com）
      if (allowedOrigin.includes("://*.")) {
        try {
          const [protocol, domainPattern] = allowedOrigin.split("://");
          const domain = domainPattern.substring(2);
          const originUrl = new URL(origin);
          if (
            originUrl.protocol === protocol + ":" &&
            (originUrl.hostname.endsWith("." + domain) ||
              originUrl.hostname === domain)
          ) {
            return callback(null, true);
          }
        } catch {
          // URL解析失败，跳过此规则
          continue;
        }
      }
    }

    // 不在允许列表中的源：禁用本次请求的 CORS（不抛错，避免返回500）
    // 让浏览器基于缺失的CORS响应头自行阻止跨域请求
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Updater-Token",
  ],
  optionsSuccessStatus: 200, // IE11支持
};

export const corsMiddleware = cors(corsOptions);
