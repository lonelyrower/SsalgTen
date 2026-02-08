import cors from "cors";
import type { CorsOptions } from "cors";

type AllowedOrigins = "*" | string[] | null;

const normalizeOrigin = (raw: string): string => raw.replace(/\/$/, "");

// 解析多个CORS来源（支持 CORS_ORIGIN / FRONTEND_URL / DOMAIN / PUBLIC_URL）
const getExplicitCorsOrigins = (): AllowedOrigins => {
  const sources: string[] = [];

  const pushFromEnv = (raw?: string) => {
    const v = (raw || "").trim();
    if (!v) return;
    const parts = v
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      if (p === "*") {
        sources.push("*");
        continue;
      }

      const cleaned = normalizeOrigin(p);

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
  pushFromEnv(process.env.FRONTEND_URL);
  pushFromEnv(process.env.DOMAIN);
  pushFromEnv(process.env.PUBLIC_URL);

  if (sources.length === 0) return null;
  if (sources.includes("*")) return "*";
  return Array.from(new Set(sources));
};

const isPrivateOrLocalHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1")
    return true;
  // Private IPv4 ranges
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host);
};

const matchAllowedOrigin = (allowed: string, origin: string): boolean => {
  if (allowed === "*" || allowed === origin) return true;

  // 支持协议通配符（如 https://*）
  if (allowed.endsWith("://*")) {
    try {
      const originUrl = new URL(origin);
      const allowedProtocol = allowed.slice(0, -3); // "https"
      return originUrl.protocol === `${allowedProtocol}:`;
    } catch {
      return false;
    }
  }

  // 支持域名通配符（如 *.example.com）
  if (allowed.startsWith("*.")) {
    try {
      const originUrl = new URL(origin);
      const domain = allowed.substring(2).toLowerCase();
      const hn = originUrl.hostname.toLowerCase();
      return hn === domain || hn.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  }

  // 支持协议 + 域名通配符（如 https://*.example.com）
  if (allowed.includes("://*.")) {
    try {
      const [protocol, domainPattern] = allowed.split("://");
      const domain = domainPattern.substring(2).toLowerCase();
      const originUrl = new URL(origin);
      const hn = originUrl.hostname.toLowerCase();
      return (
        originUrl.protocol === `${protocol}:` &&
        (hn === domain || hn.endsWith(`.${domain}`))
      );
    } catch {
      return false;
    }
  }

  return false;
};

type RequestLike = {
  headers: Record<string, unknown>;
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const resolveServerOrigin = (req: RequestLike): string => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const forwardedHost = (req.headers["x-forwarded-host"] as string) || "";
  const hostHeader = (
    forwardedHost ||
    (typeof req.get === "function" ? req.get("host") : "") ||
    ""
  ).trim();
  const host = hostHeader.split(",")[0].trim(); // handle "a,b" just in case
  if (!host) return "";
  return normalizeOrigin(`${proto}://${host}`);
};

const baseOptions: Omit<CorsOptions, "origin"> = {
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

// Use delegate so we can safely implement "same-origin" fallback when no explicit origins are configured.
export const corsMiddleware = cors((req, callback) => {
  const explicit = getExplicitCorsOrigins();
  const originHeader = (req.headers.origin as string | undefined) || "";

  // 对于非浏览器/无 Origin 的请求（如健康检查、服务间调用），不启用 CORS
  if (!originHeader) {
    return callback(null, { ...baseOptions, origin: false });
  }

  const origin = normalizeOrigin(originHeader);

  // 显式允许所有来源（不推荐，但尊重配置）
  if (explicit === "*") {
    return callback(null, { ...baseOptions, origin: true });
  }

  // 显式来源列表：只允许匹配项
  if (Array.isArray(explicit)) {
    const ok = explicit.some((allowed) => matchAllowedOrigin(allowed, origin));
    return callback(null, { ...baseOptions, origin: ok });
  }

  // 未显式配置：开发环境默认放行；生产环境仅允许 same-origin + 本地/内网
  if (process.env.NODE_ENV !== "production") {
    return callback(null, { ...baseOptions, origin: true });
  }

  let ok = false;
  try {
    const originUrl = new URL(origin);
    if (isPrivateOrLocalHostname(originUrl.hostname)) ok = true;
  } catch {
    ok = false;
  }

  const serverOrigin = resolveServerOrigin(req);
  if (serverOrigin && origin === serverOrigin) ok = true;

  return callback(null, { ...baseOptions, origin: ok });
});
