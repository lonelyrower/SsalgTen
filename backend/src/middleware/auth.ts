import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AuthTokenPayload } from '../controllers/AuthController';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      const response: ApiResponse = {
        success: false,
        error: 'Access token required'
      };
      res.status(401).json(response);
      return;
    }

    // 验证JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as AuthTokenPayload;

    // 验证用户是否仍然存在且活跃
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        username: true, 
        role: true, 
        active: true 
      }
    });

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      res.status(401).json(response);
      return;
    }

    if (!user.active) {
      const response: ApiResponse = {
        success: false,
        error: 'User account is disabled'
      };
      res.status(401).json(response);
      return;
    }

    // 将用户信息添加到request对象
    req.user = decoded;
    next();

  } catch (error) {
    logger.error('Token authentication error:', error);
    
    let errorMessage = 'Invalid token';
    if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token format';
    } else if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token expired';
    }

    const response: ApiResponse = {
      success: false,
      error: errorMessage
    };
    res.status(401).json(response);
  }
};

// 检查管理员权限的中间件
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication required'
    };
    res.status(401).json(response);
    return;
  }

  if (req.user.role !== 'ADMIN') {
    const response: ApiResponse = {
      success: false,
      error: 'Admin privileges required'
    };
    res.status(403).json(response);
    return;
  }

  next();
};

// 可选的身份验证中间件（不强制要求token）
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as AuthTokenPayload;
    
    // 验证用户是否存在且活跃
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        username: true, 
        role: true, 
        active: true 
      }
    });

    if (user && user.active) {
      req.user = decoded;
    }
  } catch (error) {
    // 忽略错误，继续处理请求（可选认证）
    logger.warn('Optional auth token validation failed:', error);
  }

  next();
};