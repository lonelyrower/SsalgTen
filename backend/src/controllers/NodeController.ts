import { Request, Response } from 'express';
import { nodeService, CreateNodeInput, UpdateNodeInput } from '../services/NodeService';
import { ApiResponse } from '../types';
import { NodeStatus, DiagnosticType } from '@prisma/client';
import { logger } from '../utils/logger';

export class NodeController {

  // 获取所有节点
  async getAllNodes(req: Request, res: Response): Promise<void> {
    try {
      const nodes = await nodeService.getAllNodes();
      
      const response: ApiResponse = {
        success: true,
        data: nodes,
        message: `Found ${nodes.length} nodes`
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get all nodes error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch nodes'
      };
      res.status(500).json(response);
    }
  }

  // 根据ID获取单个节点
  async getNodeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const node = await nodeService.getNodeById(id);
      
      if (!node) {
        const response: ApiResponse = {
          success: false,
          error: 'Node not found'
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        data: node
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get node by ID error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch node'
      };
      res.status(500).json(response);
    }
  }

  // 创建新节点
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const input: CreateNodeInput = req.body;
      
      // 验证必需字段
      if (!input.name || !input.country || !input.city || !input.provider) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing required fields: name, country, city, provider'
        };
        res.status(400).json(response);
        return;
      }

      // 验证地理坐标
      if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number') {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid latitude or longitude'
        };
        res.status(400).json(response);
        return;
      }

      const node = await nodeService.createNode(input);
      
      const response: ApiResponse = {
        success: true,
        data: node,
        message: 'Node created successfully'
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('Create node error:', error);
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create node'
      };
      res.status(500).json(response);
    }
  }

  // 更新节点信息
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const input: UpdateNodeInput = req.body;
      
      const node = await nodeService.updateNode(id, input);
      
      const response: ApiResponse = {
        success: true,
        data: node,
        message: 'Node updated successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Update node error:', error);
      
      if (error instanceof Error && error.message === 'Node not found') {
        const response: ApiResponse = {
          success: false,
          error: 'Node not found'
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update node'
      };
      res.status(500).json(response);
    }
  }

  // 删除节点
  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      await nodeService.deleteNode(id);
      
      const response: ApiResponse = {
        success: true,
        message: 'Node deleted successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Delete node error:', error);
      
      if (error instanceof Error && error.message === 'Node not found') {
        const response: ApiResponse = {
          success: false,
          error: 'Node not found'
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete node'
      };
      res.status(500).json(response);
    }
  }

  // 获取节点统计信息
  async getNodeStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await nodeService.getNodeStats();
      
      const response: ApiResponse = {
        success: true,
        data: stats
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get node stats error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch node statistics'
      };
      res.status(500).json(response);
    }
  }

  // 获取节点诊断历史
  async getNodeDiagnostics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type, limit } = req.query;
      
      const diagnosticType = type as DiagnosticType | undefined;
      const recordLimit = limit ? parseInt(limit as string) : undefined;
      
      const diagnostics = await nodeService.getNodeDiagnostics(
        id,
        diagnosticType,
        recordLimit
      );
      
      const response: ApiResponse = {
        success: true,
        data: diagnostics,
        message: `Found ${diagnostics.length} diagnostic records`
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get node diagnostics error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch node diagnostics'
      };
      res.status(500).json(response);
    }
  }

  // Agent注册端点
  async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, systemInfo } = req.body;
      
      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 查找节点
      const node = await nodeService.getNodeByAgentId(agentId);
      if (!node) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent not registered. Please contact administrator.'
        };
        res.status(404).json(response);
        return;
      }

      // 更新系统信息
      if (systemInfo) {
        await nodeService.updateNode(node.id, {
          osType: systemInfo.platform,
          osVersion: systemInfo.version,
          status: NodeStatus.ONLINE
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          location: `${node.city}, ${node.country}`
        },
        message: 'Agent registered successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Agent registration error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to register agent'
      };
      res.status(500).json(response);
    }
  }

  // Agent心跳端点
  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const heartbeatData = req.body;
      
      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      await nodeService.recordHeartbeat(agentId, heartbeatData);
      
      const response: ApiResponse = {
        success: true,
        message: 'Heartbeat recorded'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Heartbeat error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to record heartbeat'
      };
      res.status(500).json(response);
    }
  }

  // Agent诊断结果上报端点
  async reportDiagnostic(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const diagnosticData = req.body;
      
      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      await nodeService.recordDiagnostic(agentId, diagnosticData);
      
      const response: ApiResponse = {
        success: true,
        message: 'Diagnostic result recorded'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Report diagnostic error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to record diagnostic result'
      };
      res.status(500).json(response);
    }
  }
}

export const nodeController = new NodeController();