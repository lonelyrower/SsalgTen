import { Request, Response } from 'express';
import { nodeService, CreateNodeInput, UpdateNodeInput } from '../services/NodeService';
import { apiKeyService } from '../services/ApiKeyService';
import { ApiResponse } from '../types';
import { NodeStatus, DiagnosticType } from '@prisma/client';
import { logger } from '../utils/logger';
import { eventService } from '../services/EventService';
import { ipInfoService } from '../services/IPInfoService';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeNode, sanitizeNodes } from '../utils/serialize';

export class NodeController {

  // 获取所有节点
  async getAllNodes(req: Request, res: Response): Promise<void> {
    try {
      const nodes = await nodeService.getAllNodes();
      
      const response: ApiResponse = {
        success: true,
        data: sanitizeNodes(nodes as any[]),
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
        data: sanitizeNode(node)
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
      const parsed = limit ? parseInt(limit as string) : undefined;
      const recordLimit = Math.max(1, Math.min(parsed || 100, 500));
      
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

  // 获取节点详细心跳数据
  async getNodeHeartbeatData(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const heartbeatData = await nodeService.getLatestHeartbeatData(id);
      
      if (!heartbeatData) {
        const response: ApiResponse = {
          success: false,
          error: 'No heartbeat data found for this node'
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        data: heartbeatData
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get node heartbeat data error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch node heartbeat data'
      };
      res.status(500).json(response);
    }
  }

  // 获取节点事件列表
  async getNodeEvents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const limit = Math.max(1, Math.min(rawLimit, 500));
      const events = await (await import('../services/EventService')).eventService.getEvents(id, limit);
      const response: ApiResponse = {
        success: true,
        data: events,
      };
      res.json(response);
    } catch (error) {
      logger.error('Get node events error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch node events'
      };
      res.status(500).json(response);
    }
  }

  // Agent注册端点
  async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, nodeInfo, systemInfo } = req.body;
      const headerApiKey = req.headers['x-api-key'] as string;
      const bodyApiKey = req.body.apiKey;
      const apiKey = headerApiKey || bodyApiKey;
      const ts = (req.headers['x-timestamp'] as string) || undefined;
      const sig = (req.headers['x-signature'] as string) || undefined;
      const nonce = (req.headers['x-nonce'] as string) || undefined;
      
  logger.info(`[NodeController] Agent注册请求 - AgentId: ${agentId}`);
  logger.debug(`[NodeController] Header API Key: ${headerApiKey ? headerApiKey.substring(0, 4) + '...' : 'null'}`);
  logger.debug(`[NodeController] Body API Key: ${bodyApiKey ? bodyApiKey.substring(0, 4) + '...' : 'null'}`);
  logger.debug(`[NodeController] Final API Key: ${apiKey ? apiKey.substring(0, 4) + '...' : 'null'}`);
      
      // 验证API密钥
      if (!apiKey) {
    logger.debug(`[NodeController] API密钥缺失`);
        const response: ApiResponse = {
          success: false,
          error: 'API key is required'
        };
        res.status(401).json(response);
        return;
      }

  logger.debug(`[NodeController] 开始验证API密钥`);
      const isValidApiKey = await apiKeyService.validateApiKey(apiKey);
      logger.debug(`[NodeController] API密钥验证结果: ${isValidApiKey}`);
      
      if (!isValidApiKey) {
        logger.info(`[NodeController] API密钥验证失败，返回401`);
        const response: ApiResponse = {
          success: false,
          error: 'Invalid API key'
        };
        res.status(401).json(response);
        return;
      }

      // 可选：签名校验（通过环境变量强制或自愿）
      const signCheck = await apiKeyService.validateSignedRequest({ providedApiKey: apiKey, timestamp: ts, signature: sig, nonce, body: req.body });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 签名校验失败: ${signCheck.reason}`);
        // 若强制要求签名，返回401；否则继续
        if ((process.env.AGENT_REQUIRE_SIGNATURE || 'false').toLowerCase() === 'true') {
          const response: ApiResponse = { success: false, error: 'Invalid signature' };
          res.status(401).json(response);
          return;
        }
      }
      
      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 查找现有节点
      let node = await nodeService.getNodeByAgentId(agentId);
      
      if (!node) {
        // 如果节点不存在且提供了节点信息，自动创建新节点
        if (nodeInfo) {
          logger.info(`Creating new node for agent: ${agentId}`);
          
          node = await nodeService.createNode({
            agentId,
            name: nodeInfo.name || `Node-${agentId.substring(0, 8)}`,
            country: nodeInfo.country || 'Unknown',
            city: nodeInfo.city || 'Unknown',
            latitude: nodeInfo.latitude || 0,
            longitude: nodeInfo.longitude || 0,
            provider: nodeInfo.provider || 'Unknown',
            ipv4: nodeInfo.ipv4,
            ipv6: nodeInfo.ipv6,
            osType: systemInfo?.platform || 'Unknown',
            osVersion: systemInfo?.version || 'Unknown',
            status: NodeStatus.ONLINE
          });
          
          logger.info(`New node created: ${node.name} (${node.id})`);
        } else {
          const response: ApiResponse = {
            success: false,
            error: 'Agent not registered and insufficient information to auto-register. Please contact administrator.'
          };
          res.status(404).json(response);
          return;
        }
      } else {
        // 更新现有节点的系统信息
        if (systemInfo) {
          await nodeService.updateNode(node.id, {
            osType: systemInfo.platform,
            osVersion: systemInfo.version,
            status: NodeStatus.ONLINE,
            lastSeen: new Date()
          });
        }
        
        // 如果提供了新的节点信息，也更新位置信息
        if (nodeInfo) {
          await nodeService.updateNode(node.id, {
            name: nodeInfo.name || node.name,
            country: nodeInfo.country || node.country,
            city: nodeInfo.city || node.city,
            latitude: nodeInfo.latitude || node.latitude,
            longitude: nodeInfo.longitude || node.longitude,
            provider: nodeInfo.provider || node.provider,
            ipv4: nodeInfo.ipv4 || node.ipv4,
            ipv6: nodeInfo.ipv6 || node.ipv6
          });
          // 如包含新的公网IP，尝试更新ASN信息
          try {
            const targetIP = nodeInfo.ipv4 || nodeInfo.ipv6;
            if (targetIP) {
              const ipInfo = await ipInfoService.getIPInfo(targetIP);
              if (ipInfo && ipInfo.asn) {
                await nodeService.updateNode(node.id, {
                  asnNumber: ipInfo.asn.asn,
                  asnName: ipInfo.asn.name,
                  asnOrg: ipInfo.asn.org,
                  asnRoute: ipInfo.asn.route,
                  asnType: ipInfo.asn.type,
                });
              }
            }
          } catch (asnErr) {
            logger.debug('更新节点ASN信息失败（注册阶段可忽略）:', asnErr);
          }
        }
        
        logger.info(`Existing node updated: ${node.name} (${node.id})`);
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
      const headerApiKey = req.headers['x-api-key'] as string;
      const bodyApiKey = req.body.apiKey;
      const apiKey = headerApiKey || bodyApiKey;
      const ts = (req.headers['x-timestamp'] as string) || undefined;
      const sig = (req.headers['x-signature'] as string) || undefined;
      const nonce = (req.headers['x-nonce'] as string) || undefined;
      
  logger.info(`[NodeController] Agent心跳请求 - AgentId: ${agentId}`);
  logger.debug(`[NodeController] Header API Key: ${headerApiKey ? headerApiKey.substring(0, 4) + '...' : 'null'}`);
  logger.debug(`[NodeController] Body API Key: ${bodyApiKey ? bodyApiKey.substring(0, 4) + '...' : 'null'}`);
      
      // 验证API密钥
      if (!apiKey) {
  logger.debug(`[NodeController] 心跳API密钥缺失`);
        const response: ApiResponse = {
          success: false,
          error: 'API key is required'
        };
        res.status(401).json(response);
        return;
      }

  logger.debug(`[NodeController] 开始验证心跳API密钥`);
      const isValidApiKey = await apiKeyService.validateApiKey(apiKey);
  logger.debug(`[NodeController] 心跳API密钥验证结果: ${isValidApiKey}`);
      
      if (!isValidApiKey) {
        logger.info(`[NodeController] 心跳API密钥验证失败，返回401`);
        const response: ApiResponse = {
          success: false,
          error: 'Invalid API key'
        };
        res.status(401).json(response);
        return;
      }
      
      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      // 如果上报了公网IP，尝试更新节点记录（变更检测）
      try {
        if (heartbeatData?.nodeIPs && (heartbeatData.nodeIPs.ipv4 || heartbeatData.nodeIPs.ipv6)) {
          const node = await nodeService.getNodeByAgentId(agentId);
          if (node) {
            const updates: any = {};
            if (heartbeatData.nodeIPs.ipv4 && heartbeatData.nodeIPs.ipv4 !== node.ipv4) {
              updates.ipv4 = heartbeatData.nodeIPs.ipv4;
            }
            if (heartbeatData.nodeIPs.ipv6 && heartbeatData.nodeIPs.ipv6 !== node.ipv6) {
              updates.ipv6 = heartbeatData.nodeIPs.ipv6;
            }
            if (Object.keys(updates).length > 0) {
              await nodeService.updateNode(node.id, updates);
              logger.info(`Node ${node.name} (${node.id}) IP updated`, updates);
              await eventService.createEvent(node.id, 'IP_CHANGED', '节点公网IP已更新', { previous: { ipv4: node.ipv4, ipv6: node.ipv6 }, current: updates });
              // 同步刷新ASN信息
              const targetIP = updates.ipv4 || updates.ipv6;
              if (targetIP) {
                try {
                  const ipInfo = await ipInfoService.getIPInfo(targetIP);
                  if (ipInfo && ipInfo.asn) {
                    await nodeService.updateNode(node.id, {
                      asnNumber: ipInfo.asn.asn,
                      asnName: ipInfo.asn.name,
                      asnOrg: ipInfo.asn.org,
                      asnRoute: ipInfo.asn.route,
                      asnType: ipInfo.asn.type,
                    });
                  }
                } catch (e) {
                  logger.debug('刷新ASN信息失败（心跳阶段可忽略）:', e);
                }
              }
            }
          }
        }
      } catch (e) {
        logger.debug('Optional node IP update during heartbeat failed:', e);
      }
      const signCheck = await apiKeyService.validateSignedRequest({ providedApiKey: apiKey, timestamp: ts, signature: sig, nonce, body: req.body });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 心跳签名校验失败: ${signCheck.reason}`);
        if ((process.env.AGENT_REQUIRE_SIGNATURE || 'false').toLowerCase() === 'true') {
          const response: ApiResponse = { success: false, error: 'Invalid signature' };
          res.status(401).json(response);
          return;
        }
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
      const apiKey = req.headers['x-api-key'] as string || req.body.apiKey;
      const ts = (req.headers['x-timestamp'] as string) || undefined;
      const sig = (req.headers['x-signature'] as string) || undefined;
      const nonce = (req.headers['x-nonce'] as string) || undefined;
      
      // 验证API密钥
      if (!apiKey) {
        const response: ApiResponse = {
          success: false,
          error: 'API key is required'
        };
        res.status(401).json(response);
        return;
      }

      const isValidApiKey = await apiKeyService.validateApiKey(apiKey);
      if (!isValidApiKey) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid API key'
        };
        res.status(401).json(response);
        return;
      }

      const signCheck = await apiKeyService.validateSignedRequest({ providedApiKey: apiKey, timestamp: ts, signature: sig, nonce, body: req.body });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 诊断签名校验失败: ${signCheck.reason}`);
        if ((process.env.AGENT_REQUIRE_SIGNATURE || 'false').toLowerCase() === 'true') {
          const response: ApiResponse = { success: false, error: 'Invalid signature' };
          res.status(401).json(response);
          return;
        }
      }
      
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

  // 获取Agent安装脚本 - 重定向到GitHub
  async getInstallScript(req: Request, res: Response): Promise<void> {
    try {
      // 获取服务器信息
      const serverUrl = `${req.protocol}://${req.get('host')}`;
      const apiKey = process.env.DEFAULT_AGENT_API_KEY || 'default-agent-api-key';
      
      // 生成带参数的安装命令脚本
      const installScript = `#!/bin/bash
# SsalgTen Agent 自动安装脚本
# 生成时间: ${new Date().toISOString()}
# 主服务器: ${serverUrl}

set -e

echo "🚀 正在从GitHub获取最新安装脚本..."
echo "📡 主服务器: ${serverUrl}"
echo ""

# 下载并执行安装脚本，传递服务器参数
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \\
  --master-url "${serverUrl}" \\
  --api-key "${apiKey}" \\
  --auto-config

echo ""
echo "✅ 安装完成！探针已连接到主服务器: ${serverUrl}"
`;
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/x-sh');
      res.setHeader('Content-Disposition', 'attachment; filename="install-agent.sh"');
      res.setHeader('Cache-Control', 'no-cache');
      
      // 发送脚本内容
      res.send(installScript);
      
      logger.info(`Agent install script generated for server ${serverUrl} from ${req.ip}`);
    } catch (error) {
      logger.error('Get install script error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get install script'
      };
      res.status(500).json(response);
    }
  }

  // 获取Agent安装命令数据（JSON格式）
  async getInstallCommand(req: Request, res: Response): Promise<void> {
    try {
      // 获取服务器信息
      const serverUrl = `${req.protocol}://${req.get('host')}`;
      const apiKey = await apiKeyService.getSystemApiKey();
      
      // 检查API密钥安全性
      const securityCheck = await apiKeyService.checkApiKeySecurity();
      
      if (!securityCheck.isSecure) {
        logger.warn(`API密钥安全检查失败: ${securityCheck.warnings.join(', ')}`);
      }
      
      // 生成快速安装命令（自动配置）
      const quickCommand = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --auto-config --force-root --master-url "${serverUrl}" --api-key "${apiKey}"`;
      
  // 生成交互式安装命令（显示菜单：1.安装 2.卸载 0.退出）
      const interactiveCommand = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash`;
      
      const response: ApiResponse = {
        success: true,
        data: {
          masterUrl: serverUrl,
          apiKey: apiKey,
          quickCommand: quickCommand,
          command: interactiveCommand,
          security: {
            isSecure: securityCheck.isSecure,
            warnings: securityCheck.warnings,
            recommendations: securityCheck.recommendations
          }
        }
      };
      
      res.json(response);
      
      logger.info(`Agent install command generated for server ${serverUrl} from ${req.ip}`);
    } catch (error) {
      logger.error('Get install command error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get install command'
      };
      res.status(500).json(response);
    }
  }

  // 获取API密钥信息（管理员接口）
  async getApiKeyInfo(req: Request, res: Response): Promise<void> {
    try {
      const apiKeyInfo = await apiKeyService.getApiKeyInfo();
      const securityCheck = await apiKeyService.checkApiKeySecurity();
      
      const response: ApiResponse = {
        success: true,
        data: {
          ...apiKeyInfo,
          security: securityCheck
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Get API key info error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get API key info'
      };
      res.status(500).json(response);
    }
  }

  // 重新生成API密钥（管理员接口）
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const newApiKey = await apiKeyService.regenerateSystemApiKey();
      
      const response: ApiResponse = {
        success: true,
        data: {
          newApiKey: newApiKey
        },
        message: 'API密钥重新生成成功，请更新所有Agent配置'
      };
      
      res.json(response);
      
      logger.info(`API key regenerated by admin from ${req.ip}`);
    } catch (error) {
      logger.error('Regenerate API key error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to regenerate API key'
      };
      res.status(500).json(response);
    }
  }
}

export const nodeController = new NodeController();
