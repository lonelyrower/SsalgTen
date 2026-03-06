import jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { AuthenticatedSocket } from "./socketHandlers";

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const token = socket.handshake.auth.token as string | undefined;

    logger.info("Socket认证尝试:", {
      hasAuthToken: !!socket.handshake.auth.token,
      hasQueryToken: !!socket.handshake.query.token,
      tokenLength: token?.length || 0,
    });

    if (!token) {
      logger.warn("Socket连接缺少认证token");
      return next(new Error("未提供认证token"));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET 环境变量未设置");
      return next(new Error("服务器配置错误"));
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      username: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
      },
    });

    if (!user) {
      logger.warn(`Socket认证失败: 用户不存在 (${decoded.userId})`);
      return next(new Error("用户不存在"));
    }

    if (!user.active) {
      logger.warn(`Socket认证失败: 用户已被禁用 (${user.username})`);
      return next(new Error("用户已被禁用"));
    }

    (socket as AuthenticatedSocket).user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    logger.info(`Socket认证成功: ${user.username} (${user.role})`);
    next();
  } catch (error) {
    logger.warn("Socket认证失败:", error);
    next(new Error("认证失败"));
  }
}
