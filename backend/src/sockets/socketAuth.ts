import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { AuthenticatedSocket } from './socketHandlers';

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    // 从握手认证或查询参数中获取token
    const token = socket.handshake.auth.token || socket.handshake.query.token as string;
    
    if (!token) {
      logger.warn('Socket连接缺少认证token');
      return next(new Error('未提供认证token'));
    }

    // 验证JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET 环境变量未设置');
      return next(new Error('服务器配置错误'));
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // 将用户信息添加到socket对象
    (socket as AuthenticatedSocket).user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };

    logger.info(`Socket认证成功: ${decoded.username} (${decoded.role})`);
    next();
  } catch (error) {
    logger.warn('Socket认证失败:', error);
    next(new Error('认证失败'));
  }
}