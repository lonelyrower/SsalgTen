import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '@/types';

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    } as ApiResponse);
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid token.'
    } as ApiResponse);
  }
};

export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key is required.'
    } as ApiResponse);
    return;
  }

  // TODO: 验证 API Key 是否有效
  // 这里需要与数据库中的节点 API Key 进行比较
  
  next();
};