import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { authenticateSocket } from './socketAuth';
import { NodeService, nodeService } from '../services/NodeService';
import { sanitizeNodes } from '../utils/serialize';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export function setupSocketHandlers(io: Server) {
  // 认证中间件
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    logger.info(`用户已连接: ${user?.username} (${user?.role})`);

    // 加入基于角色的房间
    if (user?.role) {
      socket.join(`role_${user.role.toLowerCase()}`);
      socket.join(`user_${user.id}`);
    }

    // 节点状态订阅
    socket.on('subscribe_nodes', () => {
      socket.join('nodes_updates');
      logger.info(`用户 ${user?.username} 订阅节点更新`);
    });

    // 取消节点状态订阅
    socket.on('unsubscribe_nodes', () => {
      socket.leave('nodes_updates');
      logger.info(`用户 ${user?.username} 取消订阅节点更新`);
    });

    // 实时诊断订阅
    socket.on('subscribe_diagnostics', (nodeId: string) => {
      socket.join(`diagnostics_${nodeId}`);
      logger.info(`用户 ${user?.username} 订阅节点 ${nodeId} 的诊断更新`);
    });

    // 取消实时诊断订阅
    socket.on('unsubscribe_diagnostics', (nodeId: string) => {
      socket.leave(`diagnostics_${nodeId}`);
      logger.info(`用户 ${user?.username} 取消订阅节点 ${nodeId} 的诊断更新`);
    });

    // 请求实时节点数据
    socket.on('get_realtime_nodes', async () => {
      try {
        const nodes = await nodeService.getAllNodes();
        const safeNodes = sanitizeNodes(nodes as any[]);
        socket.emit('realtime_nodes', {
          success: true,
          data: safeNodes,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('realtime_nodes', {
          success: false,
          error: 'Failed to fetch nodes data'
        });
      }
    });

    // 断线处理
    socket.on('disconnect', (reason) => {
      logger.info(`用户已断开连接: ${user?.username}, 原因: ${reason}`);
    });

    // 错误处理
    socket.on('error', (error) => {
      logger.error(`Socket错误 (${user?.username}):`, error);
    });
  });

  // 定期广播系统状态更新（降低频率以减少闪跳）
  let lastBroadcastData: any = null;
  
  setInterval(async () => {
    try {
      const nodes = await nodeService.getAllNodes();
      const safeNodes = sanitizeNodes(nodes as any[]);
      const stats = NodeService.calculateStats(nodes);
      
      // 简单比较，只有数据真正变化时才广播
      const currentData = { nodes: safeNodes, stats };
      const dataChanged = !lastBroadcastData || 
        JSON.stringify(lastBroadcastData.stats) !== JSON.stringify(stats) ||
        safeNodes.length !== lastBroadcastData.nodes.length;
      
      if (dataChanged) {
        io.to('nodes_updates').emit('nodes_status_update', {
          nodes: safeNodes,
          stats,
          timestamp: new Date().toISOString()
        });
        lastBroadcastData = currentData;
        logger.debug(`广播节点状态更新: ${nodes.length} 个节点`);
      }
    } catch (error) {
      logger.error('广播节点状态更新失败:', error);
    }
  }, 15000); // 每15秒检查一次，减少频率

  logger.info('Socket.IO handlers 已设置完成');
}

// 辅助函数：向特定用户发送消息
export function emitToUser(io: Server, userId: string, event: string, data: any) {
  io.to(`user_${userId}`).emit(event, data);
}

// 辅助函数：向特定角色发送消息
export function emitToRole(io: Server, role: string, event: string, data: any) {
  io.to(`role_${role.toLowerCase()}`).emit(event, data);
}

// 辅助函数：广播节点状态变化
export function broadcastNodeStatusChange(io: Server, nodeId: string, status: any) {
  io.to('nodes_updates').emit('node_status_changed', {
    nodeId,
    status,
    timestamp: new Date().toISOString()
  });
}
