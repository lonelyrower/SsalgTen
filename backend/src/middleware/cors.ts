import cors from "cors";

// 解析多个CORS来源
const getCorsOrigins = (): string | string[] => {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    // 默认放行（反向代理内网环境，通常与前端同域）。如需收紧，请设置 CORS_ORIGIN。
    return "*";
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

    // 检查允许的源
    if (typeof allowedOrigins === "string") {
      if (allowedOrigins === "*" || allowedOrigins === origin) {
        return callback(null, true);
      }
      // 支持简单的域名模式匹配（如 *.xiaohei.vip）
      if (allowedOrigins.includes("*") && allowedOrigins.startsWith("*.")) {
        const domain = allowedOrigins.substring(2);
        if (origin.endsWith("." + domain) || origin === domain) {
          return callback(null, true);
        }
      }
    } else {
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // 检查域名模式匹配
      for (const allowedOrigin of allowedOrigins) {
        if (allowedOrigin.startsWith("*.")) {
          const domain = allowedOrigin.substring(2);
          if (origin.endsWith("." + domain) || origin === domain) {
            return callback(null, true);
          }
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
