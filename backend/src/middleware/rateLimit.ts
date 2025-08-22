import rateLimit from 'express-rate-limit';

// 登录接口限流：每个 IP 每 5 分钟最多 20 次
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
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

