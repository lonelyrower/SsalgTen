/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import {
  nodeService,
  CreateNodeInput,
  UpdateNodeInput,
} from "../services/NodeService";
import { apiKeyService } from "../services/ApiKeyService";
import { ApiResponse } from "../types";
import { NodeStatus, DiagnosticType } from "@prisma/client";
import { logger } from "../utils/logger";
import { eventService } from "../services/EventService";
import { ipInfoService } from "../services/IPInfoService";
import { sanitizeNode, sanitizeNodes } from "../utils/serialize";
import { prisma } from "../lib/prisma";
import { isIP } from "node:net";

// ---- Broadcast throttling helpers ----
const BROADCAST_MIN_INTERVAL_MS = parseInt(
  process.env.BROADCAST_MIN_INTERVAL_MS || "2000",
);
const NODE_DETAIL_BROADCAST_MIN_INTERVAL_MS = parseInt(
  process.env.NODE_DETAIL_BROADCAST_MIN_INTERVAL_MS || "3000",
);

let lastNodesBroadcastAt = 0;
let pendingNodesBroadcast = false;
const lastNodeDetailBroadcast: Map<string, number> = new Map(); // nodeId -> last ts

async function doNodesBroadcast(io: any) {
  try {
    const nodes = await (
      await import("../services/NodeService")
    ).nodeService.getAllNodes();
    const safeNodes = sanitizeNodes(nodes as any[]);
    const stats = await (
      await import("../services/NodeService")
    ).NodeService.calculateStats(nodes as any);
    io.to("nodes_updates").emit("nodes_status_update", {
      nodes: safeNodes,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.debug("Nodes broadcast failed", error);
  }
}

function scheduleNodesBroadcast(io: any) {
  if (!io) return;
  const now = Date.now();
  const since = now - lastNodesBroadcastAt;
  if (pendingNodesBroadcast) return;
  const delay = Math.max(0, BROADCAST_MIN_INTERVAL_MS - since);
  pendingNodesBroadcast = true;
  setTimeout(async () => {
    try {
      await doNodesBroadcast(io);
    } finally {
      lastNodesBroadcastAt = Date.now();
      pendingNodesBroadcast = false;
    }
  }, delay);
}

async function scheduleNodeDetailBroadcastByAgent(agentId: string, io: any) {
  if (!io) return;
  try {
    const node = await (
      await import("../services/NodeService")
    ).nodeService.getNodeByAgentId(agentId);
    if (!node) return;
    const last = lastNodeDetailBroadcast.get(node.id) || 0;
    const now = Date.now();
    if (now - last < NODE_DETAIL_BROADCAST_MIN_INTERVAL_MS) return;
    lastNodeDetailBroadcast.set(node.id, now);
    const detail = await (
      await import("../services/NodeService")
    ).nodeService.getLatestHeartbeatData(node.id);
    io.to(`node_heartbeat_${node.id}`).emit("node_heartbeat", {
      nodeId: node.id,
      data: detail,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // 非致命
  }
}

export class NodeController {
  // 规范化 IPv6：裁剪空白、去掉 scope id，并确保格式有效
  private normalizeIPv6(v?: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const [base] = trimmed.split("%");
    return isIP(base) === 6 ? base : undefined;
  }

  private isLikelyIPv6(v?: unknown): v is string {
    return Boolean(this.normalizeIPv6(v));
  }

  // 获取所有节点
  async getAllNodes(req: Request, res: Response): Promise<void> {
    try {
      const nodes = await nodeService.getAllNodes();

      const response: ApiResponse = {
        success: true,
        data: sanitizeNodes(nodes as any[]),
        message: `Found ${nodes.length} nodes`,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get all nodes error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch nodes",
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
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      // 获取节点最近的安全事件（最近24小时）
      // 使用EventLog表，筛选type包含SECURITY、SSH、MALWARE、DDOS、INTRUSION、ANOMALY的事件
      const securityEvents = await prisma.eventLog.findMany({
        where: {
          nodeId: id,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          type: {
            in: [
              "SSH_BRUTEFORCE",
              "MALWARE_DETECTED",
              "DDOS_ATTACK",
              "INTRUSION_DETECTED",
              "ANOMALY_DETECTED",
              "SUSPICIOUS_ACTIVITY",
            ],
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 20,
        select: {
          id: true,
          type: true,
          message: true,
          details: true,
          timestamp: true,
        },
      });

      // 格式化安全事件以匹配前端接口
      const formattedSecurityEvents = securityEvents.map((event) => ({
        id: event.id,
        type: event.type,
        severity:
          event.type === "MALWARE_DETECTED" ||
          event.type === "DDOS_ATTACK" ||
          event.type === "INTRUSION_DETECTED"
            ? "critical"
            : "warning",
        description: event.message || "",
        timestamp: event.timestamp.toISOString(),
        metadata: event.details as Record<string, unknown> | undefined,
      }));

      const response: ApiResponse = {
        success: true,
        data: {
          ...sanitizeNode(node),
          securityEvents: formattedSecurityEvents,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Get node by ID error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch node",
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
          error: "Missing required fields: name, country, city, provider",
        };
        res.status(400).json(response);
        return;
      }

      // 验证地理坐标
      if (
        typeof input.latitude !== "number" ||
        typeof input.longitude !== "number"
      ) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid latitude or longitude",
        };
        res.status(400).json(response);
        return;
      }

      const node = await nodeService.createNode(input);

      const response: ApiResponse = {
        success: true,
        data: node,
        message: "Node created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error("Create node error:", error);
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create node",
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
        message: "Node updated successfully",
      };

      res.json(response);
    } catch (error) {
      logger.error("Update node error:", error);

      if (error instanceof Error && error.message === "Node not found") {
        const response: ApiResponse = {
          success: false,
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: "Failed to update node",
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
        message: "Node deleted successfully",
      };

      res.json(response);
    } catch (error) {
      logger.error("Delete node error:", error);

      if (error instanceof Error && error.message === "Node not found") {
        const response: ApiResponse = {
          success: false,
          error: "Node not found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: "Failed to delete node",
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
        data: stats,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get node stats error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch node statistics",
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
        recordLimit,
      );

      const response: ApiResponse = {
        success: true,
        data: diagnostics,
        message: `Found ${diagnostics.length} diagnostic records`,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get node diagnostics error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch node diagnostics",
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
          error: "No heartbeat data found for this node",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: heartbeatData,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get node heartbeat data error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch node heartbeat data",
      };
      res.status(500).json(response);
    }
  }

  // 获取节点事件列表
  async getNodeEvents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rawLimit = req.query.limit
        ? parseInt(req.query.limit as string)
        : 100;
      const limit = Math.max(1, Math.min(rawLimit, 500));
      const events = await (
        await import("../services/EventService")
      ).eventService.getEvents(id, limit);
      const response: ApiResponse = {
        success: true,
        data: events,
      };
      res.json(response);
    } catch (error) {
      logger.error("Get node events error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch node events",
      };
      res.status(500).json(response);
    }
  }

  // Agent注册端点
  async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, nodeInfo, systemInfo } = req.body;
      const headerApiKey = req.headers["x-api-key"] as string;
      const bodyApiKey = req.body.apiKey;
      const apiKey = headerApiKey || bodyApiKey;
      const ts = (req.headers["x-timestamp"] as string) || undefined;
      const sig = (req.headers["x-signature"] as string) || undefined;
      const nonce = (req.headers["x-nonce"] as string) || undefined;

      logger.info(`[NodeController] Agent注册请求 - AgentId: ${agentId}`);
      logger.debug(
        `[NodeController] Header API Key: ${headerApiKey ? headerApiKey.substring(0, 4) + "..." : "null"}`,
      );
      logger.debug(
        `[NodeController] Body API Key: ${bodyApiKey ? bodyApiKey.substring(0, 4) + "..." : "null"}`,
      );
      logger.debug(
        `[NodeController] Final API Key: ${apiKey ? apiKey.substring(0, 4) + "..." : "null"}`,
      );

      // 验证API密钥
      if (!apiKey) {
        logger.debug(`[NodeController] API密钥缺失`);
        const response: ApiResponse = {
          success: false,
          error: "API key is required",
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
          error: "Invalid API key",
        };
        res.status(401).json(response);
        return;
      }

      // 可选：签名校验（通过环境变量强制或自愿）
      const signCheck = await apiKeyService.validateSignedRequest({
        providedApiKey: apiKey,
        timestamp: ts,
        signature: sig,
        nonce,
        body: req.body,
      });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 签名校验失败: ${signCheck.reason}`);
        // 若强制要求签名，返回401；否则继续
        if (
          (process.env.AGENT_REQUIRE_SIGNATURE || "false").toLowerCase() ===
          "true"
        ) {
          const response: ApiResponse = {
            success: false,
            error: "Invalid signature",
          };
          res.status(401).json(response);
          return;
        }
      }

      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: "Agent ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 查找现有节点
      let node = await nodeService.getNodeByAgentId(agentId);

      if (!node) {
        // 如果节点不存在，尝试将Agent“收编”到同IP的占位节点
        if (nodeInfo && (nodeInfo.ipv4 || nodeInfo.ipv6)) {
          // 清洗 IPv6：忽略与 IPv4 相同或非 IPv6 格式的值
          if (nodeInfo.ipv6) {
            const normalizedV6 = this.normalizeIPv6(nodeInfo.ipv6);
            nodeInfo.ipv6 =
              normalizedV6 && normalizedV6 !== nodeInfo.ipv4
                ? normalizedV6
                : undefined;
          }
          const adopted = await nodeService.tryAdoptAgentToPlaceholder(
            agentId,
            nodeInfo.ipv4 || nodeInfo.ipv6,
            nodeInfo,
            systemInfo,
          );
          if (adopted) {
            node = adopted;
          }
        }

        // 若仍不存在且提供了节点信息，自动创建新节点
        if (!node && nodeInfo) {
          logger.info(`Creating new node for agent: ${agentId}`);

          const normalizedIPv6 = this.normalizeIPv6(nodeInfo.ipv6);

          node = await nodeService.createNode({
            agentId,
            name: nodeInfo.name || `Node-${agentId.substring(0, 8)}`,
            country: nodeInfo.country || "Unknown",
            city: nodeInfo.city || "Unknown",
            latitude: nodeInfo.latitude || 0,
            longitude: nodeInfo.longitude || 0,
            provider: nodeInfo.provider || "Unknown",
            ipv4: nodeInfo.ipv4,
            ipv6:
              normalizedIPv6 && normalizedIPv6 !== nodeInfo.ipv4
                ? normalizedIPv6
                : undefined,
            osType: systemInfo?.platform || "Unknown",
            osVersion: systemInfo?.version || "Unknown",
            status: NodeStatus.ONLINE,
            nameCustomized: false, // 新创建的节点名称未被用户自定义
          });

          logger.info(`New node created: ${node.name} (${node.id})`);
        } else if (!node) {
          const response: ApiResponse = {
            success: false,
            error:
              "Agent not registered and insufficient information to auto-register. Please contact administrator.",
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
            lastSeen: new Date(),
          });
        }

        // 如果提供了新的节点信息，也更新位置信息
        if (nodeInfo) {
          // 清洗 IPv6：忽略与 IPv4 相同或非 IPv6 格式的值
          if (nodeInfo.ipv6) {
            const normalizedV6 = this.normalizeIPv6(nodeInfo.ipv6);
            nodeInfo.ipv6 =
              normalizedV6 && normalizedV6 !== nodeInfo.ipv4
                ? normalizedV6
                : undefined;
          }
          const updateData: any = {
            country: nodeInfo.country || node.country,
            city: nodeInfo.city || node.city,
            latitude: nodeInfo.latitude || node.latitude,
            longitude: nodeInfo.longitude || node.longitude,
            provider: nodeInfo.provider || node.provider,
            ipv4: nodeInfo.ipv4 || node.ipv4,
            ipv6: nodeInfo.ipv6 || node.ipv6,
          };

          const nodeHasCustomName = Boolean(
            (node as { nameCustomized?: boolean | null }).nameCustomized,
          );

          // 只有在名称未被用户自定义时，才允许Agent更新名称
          if (!nodeHasCustomName && nodeInfo.name) {
            updateData.name = nodeInfo.name;
          }

          await nodeService.updateNode(node.id, updateData);
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
            logger.debug("更新节点ASN信息失败（注册阶段可忽略）:", asnErr);
          }
        }

        logger.info(`Existing node updated: ${node.name} (${node.id})`);
        // 记录Agent注册/重连事件
        await eventService.createEvent(
          node.id,
          "AGENT_REGISTERED",
          `Agent ${agentId} registered successfully`,
          {
            agentId,
            systemInfo: systemInfo
              ? { platform: systemInfo.platform, hostname: systemInfo.hostname }
              : null,
          },
        );
      }

      const response: ApiResponse = {
        success: true,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          location: `${node.city}, ${node.country}`,
        },
        message: "Agent registered successfully",
      };

      // 异步节流广播，避免阻塞请求
      const io = req.app.get("io");
      scheduleNodesBroadcast(io);

      res.json(response);
    } catch (error) {
      logger.error("Agent registration error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to register agent",
      };
      res.status(500).json(response);
    }
  }

  // Agent心跳端点
  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const heartbeatData = req.body;
      const headerApiKey = req.headers["x-api-key"] as string;
      const bodyApiKey = req.body.apiKey;
      const apiKey = headerApiKey || bodyApiKey;
      const ts = (req.headers["x-timestamp"] as string) || undefined;
      const sig = (req.headers["x-signature"] as string) || undefined;
      const nonce = (req.headers["x-nonce"] as string) || undefined;

      logger.debug(`[NodeController] Agent心跳请求 - AgentId: ${agentId}`);
      logger.debug(
        `[NodeController] Header API Key: ${headerApiKey ? headerApiKey.substring(0, 4) + "..." : "null"}`,
      );
      logger.debug(
        `[NodeController] Body API Key: ${bodyApiKey ? bodyApiKey.substring(0, 4) + "..." : "null"}`,
      );

      // 验证API密钥
      if (!apiKey) {
        logger.debug(`[NodeController] 心跳API密钥缺失`);
        const response: ApiResponse = {
          success: false,
          error: "API key is required",
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
          error: "Invalid API key",
        };
        res.status(401).json(response);
        return;
      }

      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: "Agent ID is required",
        };
        res.status(400).json(response);
        return;
      }

      // 如果上报了公网IP，尝试更新节点记录（变更检测）
      try {
        if (
          heartbeatData?.nodeIPs &&
          (heartbeatData.nodeIPs.ipv4 || heartbeatData.nodeIPs.ipv6)
        ) {
          const node = await nodeService.getNodeByAgentId(agentId);
          if (node) {
            const updates: any = {};
            if (
              heartbeatData.nodeIPs.ipv4 &&
              heartbeatData.nodeIPs.ipv4 !== node.ipv4
            ) {
              updates.ipv4 = heartbeatData.nodeIPs.ipv4;
            }
            const hbV6Raw = heartbeatData.nodeIPs.ipv6;
            const hbV6 = this.normalizeIPv6(hbV6Raw);
            const hbV4 = heartbeatData.nodeIPs.ipv4;
            if (hbV6 && hbV6 !== hbV4 && hbV6 !== node.ipv6) {
              updates.ipv6 = hbV6;
            }
            if (Object.keys(updates).length > 0) {
              await nodeService.updateNode(node.id, updates);
              logger.info(`Node ${node.name} (${node.id}) IP updated`, updates);
              await eventService.createEvent(
                node.id,
                "IP_CHANGED",
                "节点公网IP已更新",
                {
                  previous: { ipv4: node.ipv4, ipv6: node.ipv6 },
                  current: updates,
                },
              );
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
                  logger.debug("刷新ASN信息失败（心跳阶段可忽略）:", e);
                }
              }
            }
          }
        }
      } catch (e) {
        logger.debug("Optional node IP update during heartbeat failed:", e);
      }
      const signCheck = await apiKeyService.validateSignedRequest({
        providedApiKey: apiKey,
        timestamp: ts,
        signature: sig,
        nonce,
        body: req.body,
      });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 心跳签名校验失败: ${signCheck.reason}`);
        // 仅当强制要求签名时才拒绝；否则放行（即使客户端带了签名也不拒绝）
        if (
          (process.env.AGENT_REQUIRE_SIGNATURE || "false").toLowerCase() ===
          "true"
        ) {
          const response: ApiResponse = {
            success: false,
            error: "Invalid signature",
          };
          res.status(401).json(response);
          return;
        }
      }

      await nodeService.recordHeartbeat(agentId, heartbeatData);

      // 从心跳中解析安全告警并写入事件
      try {
        const node = await nodeService.getNodeByAgentId(agentId);
        if (!node) {
          logger.warn(`Node not found for agent ${agentId}`);
        } else {
          const security = (heartbeatData as any)?.security;

          // SSH暴力破解监控
          if (security?.ssh?.alerts?.length) {
            for (const alert of security.ssh.alerts) {
              await eventService.createEvent(
                node.id,
                "SSH_BRUTEFORCE",
                `SSH brute force detected from ${alert.ip}`,
                {
                  ip: alert.ip,
                  count: alert.count,
                  windowMinutes: alert.windowMinutes,
                },
              );
            }
            logger.info(
              `Recorded ${security.ssh.alerts.length} SSH brute force alerts for node ${node.name}`,
            );
          }
        }
      } catch (e) {
        logger.error("Security alerts handling failed:", e);
      }

      const response: ApiResponse = {
        success: true,
        message: "Heartbeat recorded",
      };

      // 异步节流广播，避免阻塞请求
      const io = req.app.get("io");
      scheduleNodesBroadcast(io);
      scheduleNodeDetailBroadcastByAgent(agentId, io);

      res.json(response);
    } catch (error) {
      logger.error("Heartbeat error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to record heartbeat",
      };
      res.status(500).json(response);
    }
  }

  // Agent诊断结果上报端点
  async reportDiagnostic(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const diagnosticData = req.body;
      const apiKey = (req.headers["x-api-key"] as string) || req.body.apiKey;
      const ts = (req.headers["x-timestamp"] as string) || undefined;
      const sig = (req.headers["x-signature"] as string) || undefined;
      const nonce = (req.headers["x-nonce"] as string) || undefined;

      // 验证API密钥
      if (!apiKey) {
        const response: ApiResponse = {
          success: false,
          error: "API key is required",
        };
        res.status(401).json(response);
        return;
      }

      const isValidApiKey = await apiKeyService.validateApiKey(apiKey);
      if (!isValidApiKey) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid API key",
        };
        res.status(401).json(response);
        return;
      }

      const signCheck = await apiKeyService.validateSignedRequest({
        providedApiKey: apiKey,
        timestamp: ts,
        signature: sig,
        nonce,
        body: req.body,
      });
      if (!signCheck.ok) {
        logger.warn(`[NodeController] 诊断签名校验失败: ${signCheck.reason}`);
        if (
          (process.env.AGENT_REQUIRE_SIGNATURE || "false").toLowerCase() ===
          "true"
        ) {
          const response: ApiResponse = {
            success: false,
            error: "Invalid signature",
          };
          res.status(401).json(response);
          return;
        }
      }

      if (!agentId) {
        const response: ApiResponse = {
          success: false,
          error: "Agent ID is required",
        };
        res.status(400).json(response);
        return;
      }

      await nodeService.recordDiagnostic(agentId, diagnosticData);

      const response: ApiResponse = {
        success: true,
        message: "Diagnostic result recorded",
      };

      res.json(response);
    } catch (error) {
      logger.error("Report diagnostic error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to record diagnostic result",
      };
      res.status(500).json(response);
    }
  }

  // 获取Agent安装脚本 - 重定向到GitHub
  async getInstallScript(req: Request, res: Response): Promise<void> {
    try {
      // 获取服务器对外可访问的基础URL
      const backendPort = `${process.env.PORT || "3001"}`;
      const rawOrigin = (
        process.env.FRONTEND_URL ||
        process.env.CORS_ORIGIN ||
        ""
      ).replace(/\/$/, "");

      // 1) 优先从请求头推断（反向代理会设置 X-Forwarded-*）
      const deriveFromRequest = (): string => {
        const proto =
          (req.headers["x-forwarded-proto"] as string) ||
          req.protocol ||
          "http";
        const hostHdr = (
          (req.headers["x-forwarded-host"] as string) ||
          req.get("host") ||
          ""
        ).trim();
        if (!hostHdr) return "";
        const hostname = hostHdr.split(":")[0].toLowerCase();
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1"
        ) {
          return "";
        }
        // 保留转发的端口（如有），不强加 3001
        return `${proto}://${hostHdr}`;
      };

      // 2) 其次使用环境变量（当其不是本地域名时）
      const normalizeEnvUrl = (url: string): string => {
        if (!url) return "";
        try {
          const u = new URL(url);
          const hn = u.hostname.toLowerCase();
          if (hn === "localhost" || hn === "127.0.0.1" || hn === "::1")
            return "";
          // 返回规范化的 origin（包含端口如果已指定）
          return `${u.protocol}//${u.host}`;
        } catch {
          return "";
        }
      };

      const serverUrl =
        deriveFromRequest() ||
        normalizeEnvUrl(rawOrigin) ||
        `http://localhost:${backendPort}`;
      let apiKey: string;
      try {
        apiKey = await apiKeyService.getSystemApiKey();
      } catch (error) {
        logger.error(
          "Failed to load secure agent API key for install script:",
          error,
        );
        const response: ApiResponse = {
          success: false,
          error:
            "Agent API key is not configured yet. Please contact an administrator.",
        };
        res.status(500).json(response);
        return;
      }

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
      res.setHeader("Content-Type", "application/x-sh");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="install-agent.sh"',
      );
      res.setHeader("Cache-Control", "no-cache");

      // 发送脚本内容
      res.send(installScript);

      logger.info(
        `Agent install script generated for server ${serverUrl} from ${req.ip}`,
      );
    } catch (error) {
      logger.error("Get install script error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get install script",
      };
      res.status(500).json(response);
    }
  }

  // 获取Agent安装命令数据（JSON格式）
  async getInstallCommand(req: Request, res: Response): Promise<void> {
    try {
      // 获取服务器对外可访问的基础URL
      const backendPort = `${process.env.PORT || "3001"}`;
      const rawOrigin = (
        process.env.FRONTEND_URL ||
        process.env.CORS_ORIGIN ||
        ""
      ).replace(/\/$/, "");

      // 1) 优先从请求头推断（反向代理会设置 X-Forwarded-*）
      const deriveFromRequest = (): string => {
        const proto =
          (req.headers["x-forwarded-proto"] as string) ||
          req.protocol ||
          "http";
        const hostHdr = (
          (req.headers["x-forwarded-host"] as string) ||
          req.get("host") ||
          ""
        ).trim();
        if (!hostHdr) return "";
        const hostname = hostHdr.split(":")[0].toLowerCase();
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1"
        ) {
          return "";
        }

        // 检查是否已包含端口号，如果没有则添加默认端口（针对IP地址）
        const hasPort = hostHdr.includes(":");
        if (!hasPort) {
          // 如果是IP地址且没有端口，添加前端端口
          const frontendPort = process.env.FRONTEND_PORT || "3000";
          return `${proto}://${hostHdr}:${frontendPort}`;
        }

        return `${proto}://${hostHdr}`;
      };

      // 2) 其次使用环境变量（当其不是本地域名时）
      const normalizeEnvUrl = (url: string): string => {
        if (!url) return "";
        try {
          const u = new URL(url);
          const hn = u.hostname.toLowerCase();
          if (hn === "localhost" || hn === "127.0.0.1" || hn === "::1")
            return "";
          return `${u.protocol}//${u.host}`;
        } catch {
          return "";
        }
      };

      const serverUrl =
        normalizeEnvUrl(process.env.PUBLIC_URL || "") ||
        deriveFromRequest() ||
        normalizeEnvUrl(rawOrigin) ||
        `http://localhost:${backendPort}`;

      const apiKey = await apiKeyService.getSystemApiKey();

      // 检查API密钥安全性
      const securityCheck = await apiKeyService.checkApiKeySecurity();

      if (!securityCheck.isSecure) {
        logger.warn(
          `API密钥安全检查失败: ${securityCheck.warnings.join(", ")}`,
        );
      }

      // 生成快速安装命令（自动配置）
      const quickCommand = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --auto-config --force-root --master-url "${serverUrl}" --api-key "${apiKey}"`;

      // 生成交互式安装命令（无参数，脚本内可选择 安装/卸载/退出）
      const interactiveCommand = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s`;

      // 生成快速卸载命令（仅卸载Agent节点，不影响主服务）
      const quickUninstallCommand = `curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- --uninstall`;

      const response: ApiResponse = {
        success: true,
        data: {
          masterUrl: serverUrl,
          apiKey: apiKey,
          quickCommand: quickCommand,
          interactiveCommand: interactiveCommand,
          quickUninstallCommand: quickUninstallCommand,
          command: interactiveCommand, // 保持向后兼容
          security: {
            isSecure: securityCheck.isSecure,
            warnings: securityCheck.warnings,
            recommendations: securityCheck.recommendations,
          },
        },
      };

      res.json(response);

      logger.info(
        `Agent install command generated for server ${serverUrl} from ${req.ip}`,
      );
    } catch (error) {
      logger.error("Get install command error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get install command",
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
          security: securityCheck,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Get API key info error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to get API key info",
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
          newApiKey: newApiKey,
        },
        message: "API密钥重新生成成功，请更新所有Agent配置",
      };

      res.json(response);

      logger.info(`API key regenerated by admin from ${req.ip}`);
    } catch (error) {
      logger.error("Regenerate API key error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to regenerate API key",
      };
      res.status(500).json(response);
    }
  }

  // 导出节点数据（管理员）
  async exportNodes(req: Request, res: Response): Promise<void> {
    try {
      const format = ((req.query.format as string) || "csv").toLowerCase();
      const rawNodes = await nodeService.getAllNodes();
      const parsedNodes = (rawNodes as any[]).map((node) => {
        const { apiKey, ...rest } = node;
        void apiKey;

        const parseTags = (value: unknown): string[] => {
          if (!value) {
            return [];
          }
          if (Array.isArray(value)) {
            return value.map((v) => String(v));
          }
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return parsed.map((v: unknown) => String(v));
              }
              if (parsed) {
                return [String(parsed)];
              }
            } catch {
              // ignore json parse errors and fall back to raw
            }
            return value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return [String(value)];
        };

        const toIso = (value?: Date | string | null) => {
          if (!value) {
            return "";
          }
          const dt = typeof value === "string" ? new Date(value) : value;
          return Number.isNaN(dt?.getTime?.()) ? "" : dt.toISOString();
        };

        const safeNumber = (value: unknown) =>
          value === null || value === undefined ? "" : value;

        const tags = parseTags(rest.tags);
        return {
          id: rest.id,
          name: rest.name,
          agentId: rest.agentId,
          status: rest.status,
          country: rest.country,
          city: rest.city,
          latitude: rest.latitude,
          longitude: rest.longitude,
          provider: rest.provider,
          datacenter: rest.datacenter || "",
          ipv4: rest.ipv4 || "",
          ipv6: rest.ipv6 || "",
          asnNumber: rest.asnNumber || "",
          asnName: rest.asnName || "",
          asnOrg: rest.asnOrg || "",
          asnRoute: rest.asnRoute || "",
          asnType: rest.asnType || "",
          osType: rest.osType || "",
          osVersion: rest.osVersion || "",
          description: rest.description || "",
          lastSeen: toIso(rest.lastSeen),
          lastHeartbeatStatus: rest.lastHeartbeat?.status || "",
          lastHeartbeatAt: toIso(rest.lastHeartbeat?.timestamp),
          cpuUsage: safeNumber(rest.cpuUsage),
          memoryUsage: safeNumber(rest.memoryUsage),
          diskUsage: safeNumber(rest.diskUsage),
          tags,
          createdAt: toIso(rest.createdAt),
          updatedAt: toIso(rest.updatedAt),
        };
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      if (format === "csv") {
        const headers = [
          "id",
          "name",
          "agentId",
          "status",
          "country",
          "city",
          "latitude",
          "longitude",
          "provider",
          "datacenter",
          "ipv4",
          "ipv6",
          "asnNumber",
          "asnName",
          "asnOrg",
          "asnRoute",
          "asnType",
          "osType",
          "osVersion",
          "description",
          "lastSeen",
          "lastHeartbeatStatus",
          "lastHeartbeatAt",
          "cpuUsage",
          "memoryUsage",
          "diskUsage",
          "tags",
          "createdAt",
          "updatedAt",
        ];

        const escapeCsv = (value: any) => {
          if (Array.isArray(value)) {
            return escapeCsv(value.join(";"));
          }
          const str =
            value === null || value === undefined ? "" : String(value);
          if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const rows = parsedNodes.map((node) =>
          headers
            .map((key) => escapeCsv((node as Record<string, unknown>)[key]))
            .join(","),
        );

        const csv = [headers.join(","), ...rows].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="ssalgten-nodes-${timestamp}.csv"`,
        );
        res.status(200).send(`\ufeff${csv}`);
        return;
      }

      if (format === "markdown") {
        const headers = [
          "ID",
          "Name",
          "Country",
          "City",
          "Status",
          "Provider",
          "IPv4",
          "IPv6",
          "Last Seen",
          "Created At",
        ];

        const mdHeader = `| ${headers.join(" | ")} |\n`;
        const mdSeparator = `|${headers.map(() => "---").join("|")}|\n`;
        const mdRows = parsedNodes
          .map((n) =>
            [
              n.id,
              n.name,
              n.country,
              n.city,
              n.status,
              n.provider,
              n.ipv4 || "",
              n.ipv6 || "",
              n.lastSeen || "",
              n.createdAt || "",
            ]
              .map((v) => String(v ?? "").replaceAll("|", "\\|"))
              .join(" | "),
          )
          .join("\n");

        const content = `# Nodes Export\n\n${mdHeader}${mdSeparator}${mdRows}`;
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="ssalgten-nodes-${timestamp}.md"`,
        );
        res.status(200).send(content);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: parsedNodes,
        message: `Exported ${parsedNodes.length} nodes`,
      };

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ssalgten-nodes-${timestamp}.json"`,
      );
      res.json(response);
    } catch (error) {
      logger.error("Export nodes error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to export nodes",
      };
      res.status(500).json(response);
    }
  }
  // 获取全局活动日志
  async getGlobalActivities(req: Request, res: Response): Promise<void> {
    try {
      const rawLimit = req.query.limit
        ? parseInt(req.query.limit as string)
        : 50;
      const limit = Math.max(1, Math.min(rawLimit, 200));
      const activities = await (
        await import("../services/EventService")
      ).eventService.getGlobalActivities(limit);

      const response: ApiResponse = {
        success: true,
        data: activities,
      };
      res.json(response);
    } catch (error) {
      logger.error("Get global activities error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch global activities",
      };
      res.status(500).json(response);
    }
  }
}

export const nodeController = new NodeController();
