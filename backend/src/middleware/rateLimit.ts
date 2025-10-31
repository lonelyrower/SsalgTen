import rateLimit from "express-rate-limit";

// 登录接口限流：每个 IP 每 15 分钟最多 5 次（防止暴力破解）
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Token 刷新限流：每个 IP 每分钟最多 10 次（防止滥用）
export const refreshTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many token refresh requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// 流媒体测试限流：每个 IP 每 5 分钟最多 3 次（资源密集型操作）
export const streamingTestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: "Too many streaming test requests, please try again after 5 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Agent 上报/注册限流：每个 IP 每分钟 120 次（心跳频繁，给出相对宽限）
export const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// 公共只读接口限流：每个 IP 每分钟 60 次
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
