import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

      if (!username || !password) {
        const response: ApiResponse = {
          success: false,
          error: 'Username and password are required'
        };
        res.status(400).json(response);
        return;
      }

      // 查找用户
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          active: true,
          password: true
        }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid username or password'
        };
        res.status(401).json(response);
        return;
      }

      if (!user.active) {
        const response: ApiResponse = {
          success: false,
          error: 'Account is disabled'
        };
        res.status(401).json(response);
        return;
      }

      // 验证密码
      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid username or password'
        };
        res.status(401).json(response);
        return;
      }

      // 生成JWT token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
      );

      // 更新最后登录时间
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // 返回用户信息（不包含密码）
      const { password: _, ...userInfo } = user;
      
      const response: ApiResponse = {
        success: true,
        data: {
          user: userInfo,
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        },
        message: 'Login successful'
      };

      logger.info(`Admin login successful: ${username}`);
      res.json(response);

    } catch (error) {
      logger.error('Login error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Login failed'
      };
      res.status(500).json(response);
    }
  }

  // 获取当前用户信息
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      // 从中间件中获取用户信息
      const userId = (req as any).user?.userId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated'
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
          lastLogin: true
        }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: user
      };

      res.json(response);

    } catch (error) {
      logger.error('Get profile error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get user profile'
      };
      res.status(500).json(response);
    }
  }

  // 修改密码
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        const response: ApiResponse = {
          success: false,
          error: 'Current password and new password are required'
        };
        res.status(400).json(response);
        return;
      }

      if (newPassword.length < 6) {
        const response: ApiResponse = {
          success: false,
          error: 'New password must be at least 6 characters long'
        };
        res.status(400).json(response);
        return;
      }

      // 获取用户当前密码
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
        };
        res.status(404).json(response);
        return;
      }

      // 验证当前密码
      const currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!currentPasswordValid) {
        const response: ApiResponse = {
          success: false,
          error: 'Current password is incorrect'
        };
        res.status(400).json(response);
        return;
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // 更新密码
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully'
      };

      logger.info(`Password changed for user: ${userId}`);
      res.json(response);

    } catch (error) {
      logger.error('Change password error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to change password'
      };
      res.status(500).json(response);
    }
  }

  // 登出 (客户端处理，服务端可选择性实现token黑名单)
  async logout(req: Request, res: Response): Promise<void> {
    const response: ApiResponse = {
      success: true,
      message: 'Logout successful'
    };

    res.json(response);
  }

  // 刷新token
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const username = (req as any).user?.username;
      const role = (req as any).user?.role;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid token'
        };
        res.status(401).json(response);
        return;
      }

      // 验证用户仍然存在且活跃
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { active: true }
      });

      if (!user || !user.active) {
        const response: ApiResponse = {
          success: false,
          error: 'User account is not active'
        };
        res.status(401).json(response);
        return;
      }

      // 生成新的token
      const tokenPayload: AuthTokenPayload = {
        userId,
        username,
        role
      };

      const newToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
      );

      const response: ApiResponse = {
        success: true,
        data: {
          token: newToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Refresh token error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to refresh token'
      };
      res.status(500).json(response);
    }
  }
}

export const authController = new AuthController();