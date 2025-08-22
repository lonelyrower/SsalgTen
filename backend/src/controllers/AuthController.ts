import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { refreshTokenService } from '../services/RefreshTokenService';

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

      // 生成JWT access token
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

      // 创建 refresh token
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.socket as any).remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { token: refreshToken, expiresAt } = await refreshTokenService.create(user.id, clientIp, userAgent);

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
          refreshToken,
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

  // 登出：可选择性撤销 refresh token
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      if (refreshToken) {
        await refreshTokenService.revoke(refreshToken);
      }
      const response: ApiResponse = { success: true, message: 'Logout successful' };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = { success: false, error: 'Logout failed' };
      res.status(500).json(response);
    }
  }

  // 刷新token
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      if (!refreshToken) {
        const response: ApiResponse = { success: false, error: 'refreshToken is required' };
        res.status(400).json(response);
        return;
      }

      const verified = await refreshTokenService.verify(refreshToken);
      if (!verified) {
        const response: ApiResponse = { success: false, error: 'Invalid refresh token' };
        res.status(401).json(response);
        return;
      }

      // 校验用户仍然有效
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { id: true, username: true, role: true, active: true }
      });
      if (!user || !user.active) {
        const response: ApiResponse = { success: false, error: 'User account is not active' };
        res.status(401).json(response);
        return;
      }

      // 轮换 refresh token
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.socket as any).remoteAddress;
      const userAgent = req.headers['user-agent'];
      const rotated = await refreshTokenService.rotate(refreshToken, clientIp, userAgent);
      if (!rotated) {
        const response: ApiResponse = { success: false, error: 'Failed to rotate refresh token' };
        res.status(500).json(response);
        return;
      }

      // 发新 access token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role
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
          refreshToken: rotated.token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
      };
      res.json(response);
    } catch (error) {
      logger.error('Refresh token error:', error);
      const response: ApiResponse = { success: false, error: 'Failed to refresh token' };
      res.status(500).json(response);
    }
  }
}

export const authController = new AuthController();
