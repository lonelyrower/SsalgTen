import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { refreshTokenService } from "../services/RefreshTokenService";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: string;
}

export class AuthController {
  // 管理员登录
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password }: LoginRequest = req.body;
      logger.info(`[Auth] Login attempt for user: ${username}`);

      if (!username || !password) {
        const response: ApiResponse = {
          success: false,
          error: "Username and password are required",
        };
        res.status(400).json(response);
        return;
      }

      // 查找用户（为兼容历史库结构，仅选择最小必要字段）
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          password: true,
        },
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid username or password",
        };
        res.status(401).json(response);
        return;
      }

      // 可选：检查账号状态（容错处理，避免缺列导致500）
      let isActive = true;
      let userRole: string = "ADMIN";
      try {
        const extra = await prisma.user.findUnique({
          where: { username },
          select: { active: true, role: true, email: true, name: true },
        });
        if (extra && typeof extra.active === "boolean") isActive = extra.active;
        const extraData = extra as { role?: string };
        if (extra && typeof extraData.role === "string")
          userRole = extraData.role;
      } catch {
        // 忽略：历史库缺少字段时仅使用默认
      }

      if (!isActive) {
        const response: ApiResponse = {
          success: false,
          error: "Account is disabled",
        };
        res.status(401).json(response);
        return;
      }

      // 验证密码（兼容旧库：如果存的是明文或非bcrypt格式，允许一次性迁移为bcrypt）
      let passwordValid = false;
      const looksBcrypt =
        typeof user.password === "string" &&
        /^\$2[aby]?\$\d{2}\$/.test(user.password);
      try {
        if (looksBcrypt) {
          passwordValid = await bcrypt.compare(password, user.password);
        } else {
          // 回退为明文比较（不安全，仅为兼容历史数据；登录成功后立即升级为bcrypt）
          passwordValid = password === user.password;
        }
      } catch {
        // bcrypt解析失败时，尝试明文比较
        passwordValid = password === user.password;
      }
      // Security Note: Backdoor password functionality has been removed for security reasons
      // If you need emergency access recovery, use proper password reset mechanisms or database access

      if (!passwordValid) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid username or password",
        };
        res.status(401).json(response);
        return;
      }

      // 如为明文密码且验证通过，升级为bcrypt存储
      if (passwordValid && !looksBcrypt) {
        try {
          const hashed = await bcrypt.hash(password, 12);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
          });
        } catch (e) {
          logger.warn("Password upgrade to bcrypt failed (continuing):", e);
        }
      }

      // 生成JWT access token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        username: user.username,
        role: userRole || "ADMIN",
      };

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
      }
      const token = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      } as jwt.SignOptions);

      // 创建 refresh token
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (req.socket as { remoteAddress?: string }).remoteAddress;
      const userAgent = req.headers["user-agent"];
      // 创建 refresh token（容错：若表未迁移或写入失败，不影响主登录流程）
      let refreshToken: string | undefined;
      try {
        const created = await refreshTokenService.create(
          user.id,
          clientIp,
          userAgent,
        );
        refreshToken = created.token;
      } catch (e) {
        logger.warn(
          "Refresh token creation failed (continuing login without refresh):",
          e,
        );
      }

      // 更新最后登录时间
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });
      } catch {
        // noop: lastLogin update failure should not block login response
      }

      // 返回用户信息（不包含密码）
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userInfo } = {
        ...user,
        role: userRole,
        active: isActive,
      };

      const response: ApiResponse = {
        success: true,
        data: {
          user: userInfo,
          token,
          ...(refreshToken ? { refreshToken } : {}),
          expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        },
        message: "Login successful",
      };

      logger.info(`Admin login successful: ${username}`);
      res.json(response);
    } catch (error) {
      logger.error("Login error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Login failed",
      };
      res.status(500).json(response);
    }
  }

  // 获取当前用户信息
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      // 从中间件中获取用户信息
      const userId = (req as AuthenticatedRequest).user?.userId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: "User not authenticated",
        };
        res.status(401).json(response);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          active: true,
          createdAt: true,
          lastLogin: true,
        },
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get profile error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get user profile",
      };
      res.status(500).json(response);
    }
  }

  // 修改密码
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        const response: ApiResponse = {
          success: false,
          error: "Current password and new password are required",
        };
        res.status(400).json(response);
        return;
      }

      if (newPassword.length < 6) {
        const response: ApiResponse = {
          success: false,
          error: "New password must be at least 6 characters long",
        };
        res.status(400).json(response);
        return;
      }

      // 获取用户当前密码
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      // 验证当前密码
      const currentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!currentPasswordValid) {
        const response: ApiResponse = {
          success: false,
          error: "Current password is incorrect",
        };
        res.status(400).json(response);
        return;
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // 更新密码
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      const response: ApiResponse = {
        success: true,
        message: "Password changed successfully",
      };

      logger.info(`Password changed for user: ${userId}`);
      res.json(response);
    } catch (error) {
      logger.error("Change password error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to change password",
      };
      res.status(500).json(response);
    }
  }

  // 登出：可选择性撤销 refresh token
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      if (refreshToken) {
        await refreshTokenService.revoke(refreshToken);
      }
      const response: ApiResponse = {
        success: true,
        message: "Logout successful",
      };
      res.json(response);
    } catch {
      const response: ApiResponse = { success: false, error: "Logout failed" };
      res.status(500).json(response);
    }
  }

  // 刷新token
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          error: "refreshToken is required",
        };
        res.status(400).json(response);
        return;
      }

      const verified = await refreshTokenService.verify(refreshToken);
      if (!verified) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid refresh token",
        };
        res.status(401).json(response);
        return;
      }

      // 校验用户仍然有效
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { id: true, username: true, role: true, active: true },
      });
      if (!user || !user.active) {
        const response: ApiResponse = {
          success: false,
          error: "User account is not active",
        };
        res.status(401).json(response);
        return;
      }

      // 轮换 refresh token
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (req.socket as { remoteAddress?: string }).remoteAddress;
      const userAgent = req.headers["user-agent"];
      const rotated = await refreshTokenService.rotate(
        refreshToken,
        clientIp,
        userAgent,
      );
      if (!rotated) {
        const response: ApiResponse = {
          success: false,
          error: "Failed to rotate refresh token",
        };
        res.status(500).json(response);
        return;
      }

      // 发新 access token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
      }
      const newToken = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      } as jwt.SignOptions);

      const response: ApiResponse = {
        success: true,
        data: {
          token: newToken,
          refreshToken: rotated.token,
          expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        },
      };
      res.json(response);
    } catch (error) {
      logger.error("Refresh token error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to refresh token",
      };
      res.status(500).json(response);
    }
  }
}

export const authController = new AuthController();
