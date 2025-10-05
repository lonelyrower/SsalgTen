# CSP 配置说明

## 问题描述

在开发环境中，浏览器控制台可能会显示以下警告：

```
Content Security Policy of your site blocks the use of 'eval' in JavaScript
```

## 原因

**Content Security Policy (CSP)** 是一个重要的安全特性：
- 防止跨站脚本攻击（XSS）
- 限制浏览器可以加载的资源来源
- 默认阻止 `eval()` 等不安全的代码执行

但是，**Vite 开发服务器**需要使用 `eval()` 来实现：
- 热模块替换（HMR - Hot Module Replacement）
- 快速的开发时模块加载
- 实时代码更新

## 解决方案

我们的配置根据环境自动调整 CSP 策略：

### 开发环境 (NODE_ENV=development)

```typescript
scriptSrc: ["'self'", "'unsafe-eval'"]
connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
```

- ✅ 允许 `eval()` - 支持 Vite HMR
- ✅ 允许 WebSocket - 支持热更新连接

### 生产环境 (NODE_ENV=production)

```typescript
scriptSrc: ["'self'"]
connectSrc: ["'self'"]
```

- 🔒 禁止 `eval()` - 提高安全性
- 🔒 限制连接来源 - 防止数据泄露

## 配置位置

文件：`backend/src/app.ts`

```typescript
const isDevelopment = process.env.NODE_ENV === "development";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: isDevelopment ? ["'self'", "'unsafe-eval'"] : ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: isDevelopment
          ? ["'self'", "ws:", "wss:", "http:", "https:"]
          : ["'self'"],
      },
    },
  }),
);
```

## 安全性说明

### ⚠️ 为什么生产环境不能使用 'unsafe-eval'？

在生产环境中允许 `eval()` 会：
- 增加 XSS 攻击风险
- 允许攻击者执行任意 JavaScript 代码
- 降低整体应用安全性

### ✅ 为什么开发环境可以使用？

开发环境的特点：
- 不对外公开访问
- 运行在本地或可信网络
- 需要快速的开发体验
- Vite 需要 eval 来实现 HMR

### 🔒 生产环境的构建

生产构建（`npm run build`）会：
- 将所有代码编译成静态文件
- 不需要 `eval()` 或动态代码执行
- 自动满足严格的 CSP 要求

## CSP 指令说明

| 指令 | 作用 | 开发环境 | 生产环境 |
|------|------|---------|---------|
| `defaultSrc` | 默认来源策略 | `'self'` | `'self'` |
| `scriptSrc` | JavaScript 来源 | `'self'`, `'unsafe-eval'` | `'self'` |
| `styleSrc` | CSS 来源 | `'self'`, `'unsafe-inline'` | `'self'`, `'unsafe-inline'` |
| `imgSrc` | 图片来源 | `'self'`, `data:`, `https:` | `'self'`, `data:`, `https:` |
| `connectSrc` | 网络连接来源 | `'self'`, `ws:`, `wss:`, `http:`, `https:` | `'self'` |

## 验证

### 检查当前环境

查看后端日志，确认环境变量：
```bash
# 开发环境
NODE_ENV=development

# 生产环境
NODE_ENV=production
```

### 验证 CSP 策略

打开浏览器开发者工具：
1. **Network** 标签
2. 查看任何请求的 **Response Headers**
3. 找到 `Content-Security-Policy` 头部
4. 验证策略是否正确

**开发环境应该看到**：
```
Content-Security-Policy: ... script-src 'self' 'unsafe-eval' ...
```

**生产环境应该看到**：
```
Content-Security-Policy: ... script-src 'self' ...
```

## 故障排查

### 如果开发环境仍然报错

1. 确认后端环境变量：
   ```bash
   echo $NODE_ENV  # 应该是 development
   ```

2. 重启后端服务：
   ```bash
   docker-compose restart backend
   ```

3. 清除浏览器缓存并刷新

### 如果生产环境出现 CSP 错误

这通常表示代码中使用了不安全的模式：
- 避免使用 `eval()`
- 避免使用 `new Function()`
- 避免使用 `setTimeout(string)`
- 使用 ESLint 检查代码

## 最佳实践

1. **开发时**：享受 HMR 的便利，CSP 会自动放宽
2. **部署前**：运行 `npm run build` 测试生产构建
3. **生产环境**：始终使用严格的 CSP 策略
4. **监控**：定期检查 CSP 违规报告

## 相关资源

- [MDN - Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Helmet.js 文档](https://helmetjs.github.io/)
- [Vite 安全性](https://vitejs.dev/guide/security.html)

---

**配置状态**: ✅ 已优化  
**影响范围**: 开发体验优化，生产安全性保持  
**安全等级**: 🔒 高（生产环境严格，开发环境适度放宽）
