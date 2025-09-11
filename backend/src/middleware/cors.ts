import cors from "cors";

// 解析多个CORS来源
const getCorsOrigins = (): string | string[] => {
  const corsOrigin = process.env.CORS_ORIGIN;
  
  // 如果未设置CORS_ORIGIN，返回空字符串，让后续逻辑处理智能检测
  if (!corsOrigin) {
    return "";
  }

  // 支持多种分隔符：逗号、分号、管道符
  const separators = /[,;|]/;
  if (separators.test(corsOrigin)) {
    return corsOrigin
      .split(separators)
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  return corsOrigin;
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
          if (originUrl.protocol === "https:" || 
              originUrl.hostname === "localhost" || 
              originUrl.hostname === "127.0.0.1") {
            return callback(null, true);
          }
        } else {
          // 开发环境：允许所有
          return callback(null, true);
        }
      } catch (e) {
        // URL解析失败，拒绝
        return callback(new Error(`Invalid origin: ${origin}`));
      }
    }

    // 用户自定义CORS配置的检查逻辑
    const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
    
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
        if (origin.endsWith("." + domain) || origin === domain || 
            origin.endsWith("://" + domain) || origin.includes("://" + domain)) {
          return callback(null, true);
        }
      }
      
      // 支持协议+域名通配符（如 https://*.example.com）
      if (allowedOrigin.includes("://*.")) {
        try {
          const [protocol, domainPattern] = allowedOrigin.split("://");
          const domain = domainPattern.substring(2);
          const originUrl = new URL(origin);
          if (originUrl.protocol === protocol + ":" && 
              (originUrl.hostname.endsWith("." + domain) || originUrl.hostname === domain)) {
            return callback(null, true);
          }
        } catch (e) {
          // URL解析失败，跳过此规则
          continue;
        }
      }
    }

    // 不在允许列表中的源被拒绝
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
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
