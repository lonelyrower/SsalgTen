import { createServer } from "http";
import { spawn } from "node:child_process";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./utils/logger";
import { initSystemConfig } from "./utils/initSystemConfig";
import { setupSocketHandlers } from "./sockets/socketHandlers";
import { setIO } from "./sockets/ioRegistry";
import { apiKeyService } from "./services/ApiKeyService";
import { APP_VERSION } from "./utils/version";
import { startSchedulers } from "./utils/scheduler";

// 强制要求安全的 JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "default-secret") {
  logger.error(
    "JWT_SECRET 未设置或使用不安全的默认值，请设置一个足够复杂的随机密钥 (env JWT_SECRET)",
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";

const runDatabaseMigrations = async (): Promise<void> => {
  logger.info("Running database migrations...");
  await new Promise<void>((resolve, reject) => {
    const prismaCli = require.resolve("prisma/build/index.js");
    const child = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma migrate exited with code ${code}`));
      }
    });
  });
  logger.info("Database migrations completed");
};

// 创建 HTTP 服务器和 Socket.IO 实例
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 设置 Socket.IO 处理程序
setupSocketHandlers(io);
setIO(io);

// 将 io 实例添加到 app 中以便在路由中使用
app.set("io", io);

const server = httpServer.listen(PORT, async () => {
  logger.info(
    `SsalgTen API Server v${APP_VERSION} is running on http://${HOST}:${PORT}`,
  );
  logger.info("Socket.IO server is ready for real-time connections");
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Health check: http://${HOST}:${PORT}/api/health`);
  logger.info(`API info: http://${HOST}:${PORT}/api/info`);
  logger.info(`Homepage: http://${HOST}:${PORT}/`);

  try {
    await runDatabaseMigrations();
  } catch (error) {
    logger.error("Database migrations failed:", error);
    process.exit(1);
  }

  try {
    await initSystemConfig();
    logger.info("System configuration initialized");
  } catch (error) {
    logger.error("Failed to initialize system configuration:", error);
  }

  try {
    await apiKeyService.initializeSystemApiKey();
    const systemApiKey = await apiKeyService.getSystemApiKey();
    const securityCheck = await apiKeyService.checkApiKeySecurity();

    if (!securityCheck.isSecure) {
      logger.error("API key security check failed:");
      securityCheck.warnings.forEach((warning) => {
        logger.error(`  - ${warning}`);
      });
      logger.error("Recommended actions:");
      securityCheck.recommendations.forEach((rec) => {
        logger.error(`  - ${rec}`);
      });
      throw new Error("System agent API key security check failed");
    }

    await apiKeyService.purgeExpiredPreviousKey();

    logger.info("API key system initialized");
    logger.info(
      `Active system API key prefix: ${systemApiKey.substring(0, 10)}...`,
    );

    try {
      const apiKeyInfo = await apiKeyService.getApiKeyInfo();
      logger.info("API key details:");
      logger.info(`  - keyId: ${apiKeyInfo.id}`);
      logger.info(`  - createdAt: ${apiKeyInfo.createdAt.toISOString()}`);
      logger.info(`  - usageCount: ${apiKeyInfo.usageCount}`);
      logger.info(
        `  - lastUsed: ${
          apiKeyInfo.lastUsed ? apiKeyInfo.lastUsed.toISOString() : "never"
        }`,
      );
    } catch (infoError) {
      logger.warn("Failed to fetch API key details:", infoError);
    }
  } catch (error) {
    logger.error("Failed to initialize API key system:", error);
    process.exit(1);
  }

  startSchedulers();
});
// 优雅关闭处理
const gracefulShutdown = (signal: string): void => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info("🛑 Server closed");
    process.exit(0);
  });
};

// 监听关闭信号
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// 未捕获异常处理
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  },
);
