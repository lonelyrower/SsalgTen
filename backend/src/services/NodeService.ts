import { prisma } from '../lib/prisma';
import { Node, NodeStatus, DiagnosticType, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { ipInfoService } from './IPInfoService';
import crypto from 'crypto';
import { RecordHeartbeatInput, HeartbeatDetail } from '../types/heartbeat';
import { eventService } from './EventService';

export interface CreateNodeInput {
  agentId?: string; // 允许指定agentId，用于Agent自动注册
  name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  provider: string;
  ipv4?: string;
  ipv6?: string;
  hostname?: string;
  datacenter?: string;
  tags?: string;
  description?: string;
  osType?: string;
  osVersion?: string;
  status?: NodeStatus; // 允许指定初始状态
  // ASN信息（可选，如果不提供将自动查询）
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  asnRoute?: string;
  asnType?: string;
}

export interface UpdateNodeInput {
  name?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  ipv4?: string;
  ipv6?: string;
  hostname?: string;
  datacenter?: string;
  tags?: string;
  description?: string;
  osType?: string;
  osVersion?: string;
  status?: NodeStatus;
  lastSeen?: Date;
  // ASN信息
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  asnRoute?: string;
  asnType?: string;
  // 占位/资产管理
  isPlaceholder?: boolean;
  // 允许在占位升级时写入真实 agentId
  agentId?: string;
}

export interface NodeWithStats extends Node {
  _count: {
    diagnosticRecords: number;
    heartbeatLogs: number;
  };
  lastHeartbeat?: {
    timestamp: Date;
    status: string;
    uptime: number | null;
  };
  // 新增：最近一次心跳的资源占用（用于前端概览展示）
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  diskUsage?: number | null;
}

export class NodeService {
  private heartbeatLogCounter: Record<string, number> = {};
  private heartbeatLogInterval = 5; // 每5次详细记录一次
  
  // 简易内存缓存，降低高频请求带来的数据库压力
  private nodesCache: { data: NodeWithStats[]; ts: number } | null = null;
  private statsCache: { data: { totalNodes: number; onlineNodes: number; offlineNodes: number; unknownNodes: number; totalCountries: number; totalProviders: number; }; ts: number } | null = null;
  private nodesCacheTtlMs = parseInt(process.env.NODES_CACHE_TTL_MS || '2000');
  private statsCacheTtlMs = parseInt(process.env.STATS_CACHE_TTL_MS || '2000');
  
  // 创建新节点
  async createNode(input: CreateNodeInput): Promise<Node> {
    try {
      // 使用提供的agentId或生成新的
      const agentId = input.agentId || crypto.randomUUID();
      const apiKey = crypto.randomBytes(32).toString('hex');

      // 如果提供了IP地址但没有ASN信息，自动查询ASN
      let asnInfo = {
        asnNumber: input.asnNumber,
        asnName: input.asnName,
        asnOrg: input.asnOrg,
        asnRoute: input.asnRoute,
        asnType: input.asnType
      };

      if ((input.ipv4 || input.ipv6) && !input.asnNumber) {
        try {
          const targetIP = input.ipv4 || input.ipv6;
          const ipInfo = await ipInfoService.getIPInfo(targetIP!);
          
          if (ipInfo && ipInfo.asn) {
            asnInfo = {
              asnNumber: ipInfo.asn.asn,
              asnName: ipInfo.asn.name,
              asnOrg: ipInfo.asn.org,
              asnRoute: ipInfo.asn.route,
              asnType: ipInfo.asn.type
            };
            
            logger.info(`自动获取ASN信息: ${targetIP} -> ${ipInfo.asn.asn} (${ipInfo.asn.name})`);
          }
        } catch (asnError) {
          logger.warn(`Failed to fetch ASN info for IP ${input.ipv4 || input.ipv6}:`, asnError);
        }
      }

      const node = await prisma.node.create({
        data: {
          ...input,
          ...asnInfo,
          agentId,
          apiKey,
          status: input.status || NodeStatus.UNKNOWN
        }
      });

      logger.info(`Node created: ${node.name} (${node.id}) with ASN: ${asnInfo.asnNumber}`);
      return node;
    } catch (error) {
      logger.error('Failed to create node:', error);
      throw new Error('Failed to create node');
    }
  }

  // 获取所有节点
  async getAllNodes(): Promise<NodeWithStats[]> {
    try {
      // 命中缓存
      if (this.nodesCache && Date.now() - this.nodesCache.ts < this.nodesCacheTtlMs) {
        return this.nodesCache.data;
      }
      // 1) 一次性取所有节点（按创建时间倒序）
      const nodes = await prisma.node.findMany({
        orderBy: { createdAt: 'desc' }
      });

      if (nodes.length === 0) return [] as unknown as NodeWithStats[];

      // 2) 使用原生SQL一次性获取每个节点的最新心跳（避免 N+1 查询）
      // 注意：列名为 camelCase，需使用双引号；表名为映射后的 heartbeat_logs
      const latestRows = await prisma.$queryRawUnsafe<Array<{
        nodeId: string;
        timestamp: Date;
        status: string;
        uptime: number | null;
        cpuUsage: number | null;
        memoryUsage: number | null;
        diskUsage: number | null;
      }>>(`
        SELECT DISTINCT ON ("nodeId")
          "nodeId",
          "timestamp",
          "status",
          "uptime",
          "cpuUsage",
          "memoryUsage",
          "diskUsage"
        FROM "heartbeat_logs"
        ORDER BY "nodeId", "timestamp" DESC
      `);

      const latestMap = new Map<string, typeof latestRows[number]>();
      for (const r of latestRows) {
        latestMap.set(r.nodeId, r);
      }

      // 3) 组装返回（不再 include 关系，显著降低查询负载）
      const result = nodes.map((node) => {
        const lh = latestMap.get(node.id);
        const out: any = {
          ...node,
          provider: node.asnName || node.provider,
          lastHeartbeat: lh
            ? { timestamp: lh.timestamp, status: lh.status, uptime: lh.uptime ?? null }
            : undefined,
          cpuUsage: lh?.cpuUsage ?? null,
          memoryUsage: lh?.memoryUsage ?? null,
          diskUsage: lh?.diskUsage ?? null,
        };
        return out as NodeWithStats;
      });
      this.nodesCache = { data: result, ts: Date.now() };
      return result;
    } catch (error) {
      logger.error('Failed to fetch nodes:', error);
      throw new Error('Failed to fetch nodes');
    }
  }

  // 根据ID获取节点
  async getNodeById(id: string): Promise<Node | null> {
    try {
      const node = await prisma.node.findUnique({
        where: { id }
      });
      
      if (!node) return null;
      
      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return {
        ...node,
        provider: node.asnName || node.provider
      };
    } catch (error) {
      logger.error(`Failed to fetch node ${id}:`, error);
      throw new Error('Failed to fetch node');
    }
  }

  // 根据agentId获取节点
  async getNodeByAgentId(agentId: string): Promise<Node | null> {
    try {
      const node = await prisma.node.findUnique({
        where: { agentId }
      });
      
      if (!node) return null;
      
      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return {
        ...node,
        provider: node.asnName || node.provider
      };
    } catch (error) {
      logger.error(`Failed to fetch node by agentId ${agentId}:`, error);
      throw new Error('Failed to fetch node');
    }
  }

  // 更新节点信息
  async updateNode(id: string, input: UpdateNodeInput): Promise<Node> {
    try {
      const node = await prisma.node.update({
        where: { id },
        data: {
          ...input,
          updatedAt: new Date()
        }
      });

      logger.info(`Node updated: ${node.name} (${node.id})`);
      
      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return {
        ...node,
        provider: node.asnName || node.provider
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to update node ${id}:`, error);
      throw new Error('Failed to update node');
    }
  }

  // 删除节点
  async deleteNode(id: string): Promise<void> {
    try {
      await prisma.node.delete({
        where: { id }
      });
      logger.info(`Node deleted: ${id}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to delete node ${id}:`, error);
      throw new Error('Failed to delete node');
    }
  }

  // 基于IP创建占位节点（未安装Agent的VPS资产）
  async createPlaceholderFromIP(ip: string, options?: { name?: string; notes?: string; tags?: string[] }): Promise<Node> {
    const isIPv6 = ip.includes(':');
    try {
      // 先查找是否已有同IP的节点
      const orConds: any[] = [];
      if (!isIPv6) orConds.push({ ipv4: ip });
      else orConds.push({ ipv6: ip });

      const existing = await prisma.node.findFirst({ where: { OR: orConds } });
      if (existing) {
        if (existing as any && (existing as any).isPlaceholder) {
          // 更新占位信息（名称/标签/描述）
          const updated = await prisma.node.update({
            where: { id: existing.id },
            data: {
              name: options?.name || existing.name,
              description: options?.notes ?? existing.description,
              tags: options?.tags ? JSON.stringify(options.tags) : existing.tags,
            }
          });
          return { ...updated, provider: (updated as any).asnName || updated.provider } as any;
        }
        // 已存在非占位节点，直接返回（不覆盖）
        return { ...existing, provider: (existing as any).asnName || existing.provider } as any;
      }

      // 查询IP信息，填充地理/ASN
      let country = 'Unknown';
      let city = 'Unknown';
      let latitude = 0;
      let longitude = 0;
      let provider = 'Unknown';
      let asn: { asn?: string; name?: string; org?: string; route?: string; type?: string } = {};
      try {
        const info = await ipInfoService.getIPInfo(ip);
        if (info) {
          country = info.country || country;
          city = info.city || city;
          if (info.loc && info.loc.includes(',')) {
            const [lat, lon] = info.loc.split(',');
            latitude = parseFloat(lat) || 0;
            longitude = parseFloat(lon) || 0;
          }
          provider = (info.asn?.name || info.company?.name || provider) as string;
          asn = info.asn || {};
        }
      } catch {}

      const placeholderAgentId = `placeholder_${crypto.createHash('sha1').update(ip).digest('hex').slice(0, 12)}`;
      const apiKey = crypto.randomBytes(32).toString('hex');

      const node = await prisma.node.create({
        data: {
          name: options?.name || `Expired VPS ${ip}`,
          country,
          city,
          latitude,
          longitude,
          ipv4: isIPv6 ? null : ip,
          ipv6: isIPv6 ? ip : null,
          provider,
          agentId: placeholderAgentId,
          apiKey,
          status: NodeStatus.OFFLINE,
          description: options?.notes || null,
          tags: options?.tags ? JSON.stringify(options.tags) : null,
          isPlaceholder: true,
          asnNumber: (asn.asn as string) || null,
          asnName: (asn.name as string) || null,
          asnOrg: (asn.org as string) || null,
          asnRoute: (asn.route as string) || null,
          asnType: (asn.type as string) || null,
        }
      });
      return { ...node, provider: (node as any).asnName || node.provider } as any;
    } catch (error) {
      logger.error('Failed to create placeholder node:', error);
      throw new Error('Failed to create placeholder node');
    }
  }

  async createPlaceholdersFromIPs(items: Array<{ ip: string; name?: string; notes?: string; tags?: string[] }>): Promise<{ created: number; updated: number; skipped: number; results: Node[] }>{
    let created = 0, updated = 0, skipped = 0;
    const results: Node[] = [] as any;
    for (const item of items) {
      const ip = (item.ip || '').trim();
      if (!ip) { skipped++; continue; }
      try {
        // 试着调用创建（内部会处理已存在时的更新/返回）
        const before = await prisma.node.findFirst({ where: { OR: ip.includes(':') ? [{ ipv6: ip }] : [{ ipv4: ip }] } });
        const n = await this.createPlaceholderFromIP(ip, { name: item.name, notes: item.notes, tags: item.tags });
        const after = await prisma.node.findUnique({ where: { id: (n as any).id } });
        if (!before && after) created++; else if (before && (before as any).isPlaceholder) updated++; else skipped++;
        results.push(n);
        // 避免外部数据源限频
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        logger.warn('Placeholder import failed for ip:', item.ip, e);
        skipped++;
      }
    }
    return { created, updated, skipped, results };
  }

  // 尝试将真实 Agent 绑定到占位节点（按IP匹配），并升级为正式节点
  async tryAdoptAgentToPlaceholder(agentId: string, ip?: string | null, nodeInfo?: any, systemInfo?: any): Promise<Node | null> {
    if (!ip) return null;
    const isIPv6 = ip.includes(':');
    const orConds: any[] = [];
    if (isIPv6) orConds.push({ ipv6: ip }); else orConds.push({ ipv4: ip });
    const placeholder = await prisma.node.findFirst({ where: { AND: [{ isPlaceholder: true }, { OR: orConds }] } });
    if (!placeholder) return null;
    // 升级为正式节点
    const updated = await prisma.node.update({
      where: { id: placeholder.id },
      data: {
        agentId,
        isPlaceholder: false,
        status: NodeStatus.ONLINE,
        lastSeen: new Date(),
        name: nodeInfo?.name || placeholder.name,
        ipv4: isIPv6 ? placeholder.ipv4 : (ip || placeholder.ipv4),
        ipv6: isIPv6 ? (ip || placeholder.ipv6) : placeholder.ipv6,
        osType: systemInfo?.platform || placeholder.osType,
        osVersion: systemInfo?.version || placeholder.osVersion,
      }
    });
    logger.info(`Adopted agent ${agentId} into placeholder node ${placeholder.id} (${placeholder.name})`);
    return { ...updated, provider: (updated as any).asnName || updated.provider } as any;
  }

  // 更新节点状态
  async updateNodeStatus(agentId: string, status: NodeStatus): Promise<Node> {
    try {
      // 读取旧状态
      const old = await prisma.node.findUnique({ where: { agentId } });
      if (!old) {
        throw new Error(`Node with agentId ${agentId} not found`);
      }

      const node = await prisma.node.update({
        where: { agentId },
        data: {
          status,
          lastSeen: new Date()
        }
      });

      // 增强日志输出，记录所有状态更新（包括相同状态的刷新）
      const statusChanged = old.status !== status;
      if (statusChanged) {
        logger.info(`Node status changed: ${node.name} (${agentId}) ${old.status} -> ${status}`);
        // 记录状态变更事件
        await eventService.createEvent(node.id, 'STATUS_CHANGED', `${old.status} -> ${status}`, { 
          from: old.status, 
          to: status,
          lastSeen: old.lastSeen,
          newLastSeen: node.lastSeen
        });
      } else {
        logger.debug(`Node heartbeat: ${node.name} (${agentId}) remains ${status}, lastSeen updated`);
      }
      
      // 清理相关缓存，确保前端能获取最新状态
      this.nodesCache = null;
      this.statsCache = null;

      // 实时广播状态变化（即使状态未变化也刷新 lastSeen 的前端显示）
      try {
        const { getIO } = await import('../sockets/ioRegistry');
        const io = getIO();
        if (io) {
          io.to('nodes_updates').emit('node_status_changed', {
            nodeId: node.id,
            status: String(status).toLowerCase(),
            timestamp: new Date().toISOString()
          });
        }
      } catch {}

      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return {
        ...node,
        provider: node.asnName || node.provider
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Node not found');
      }
      logger.error(`Failed to update node status ${agentId}:`, error);
      throw new Error('Failed to update node status');
    }
  }

  // 记录心跳
  async recordHeartbeat(agentId: string, heartbeatData: RecordHeartbeatInput): Promise<void> {
    try {
      // 首先更新节点状态并获取节点信息
      const node = await this.updateNodeStatus(agentId, NodeStatus.ONLINE);

      // 准备心跳日志数据
  const logData: any = {
        nodeId: node.id,
        status: heartbeatData.status,
        uptime: heartbeatData.uptime,
        cpuUsage: heartbeatData.cpuUsage,
        memoryUsage: heartbeatData.memoryUsage,
        diskUsage: heartbeatData.diskUsage,
        connectivity: heartbeatData.connectivity,
        timestamp: new Date()
      };

      // 如果包含详细系统信息，添加到日志数据中
      if (heartbeatData.systemInfo) {
        const sysInfo = heartbeatData.systemInfo;
        
        // 存储详细信息为JSON
        if (sysInfo.cpu) {
          logData.cpuInfo = sysInfo.cpu;
          // 更新兼容性字段
          if (!logData.cpuUsage && sysInfo.cpu.usage) {
            logData.cpuUsage = sysInfo.cpu.usage;
          }
        }
        
        if (sysInfo.memory) {
          logData.memoryInfo = sysInfo.memory;
          // 更新兼容性字段
          if (!logData.memoryUsage && sysInfo.memory.usage) {
            logData.memoryUsage = sysInfo.memory.usage;
          }
        }
        
        if (sysInfo.disk) {
          logData.diskInfo = sysInfo.disk;
          // 更新兼容性字段
          if (!logData.diskUsage && sysInfo.disk.usage) {
            logData.diskUsage = sysInfo.disk.usage;
          }
        }
        
        if (sysInfo.network && Array.isArray(sysInfo.network)) {
          logData.networkInfo = sysInfo.network;
        }
        
        if (sysInfo.processes) {
          logData.processInfo = sysInfo.processes;
        }
        
        if (sysInfo.virtualization) {
          logData.virtualization = sysInfo.virtualization;
        }
        
        if (sysInfo.services) {
          logData.services = sysInfo.services;
        }
        
        if (sysInfo.loadAverage && Array.isArray(sysInfo.loadAverage)) {
          logData.loadAverage = sysInfo.loadAverage;
        }
      }

      // 记录心跳日志
      await prisma.heartbeatLog.create({
        data: logData
      });

      // 心跳日志降噪：仅每 N 次输出一次详细字段
      this.heartbeatLogCounter[agentId] = (this.heartbeatLogCounter[agentId] || 0) + 1;
      const detailed = this.heartbeatLogCounter[agentId] % this.heartbeatLogInterval === 0;
      const logPayload = {
        hasCpuInfo: !!logData.cpuInfo,
        hasMemoryInfo: !!logData.memoryInfo,
        hasDiskInfo: !!logData.diskInfo,
        hasNetworkInfo: !!logData.networkInfo,
        hasProcessInfo: !!logData.processInfo,
        hasVirtualization: !!logData.virtualization,
        hasServices: !!logData.services
      };
      if (detailed) {
        logger.debug(`Enhanced heartbeat recorded for agent: ${agentId}`, logPayload);
      }
    } catch (error) {
      logger.error(`Failed to record heartbeat for ${agentId}:`, error);
      throw new Error('Failed to record heartbeat');
    }
  }

  // 记录诊断结果
  async recordDiagnostic(agentId: string, diagnosticData: {
    type: DiagnosticType;
    target?: string;
    success: boolean;
    result: any;
    error?: string;
    duration?: number;
  }): Promise<void> {
    try {
      await prisma.diagnosticRecord.create({
        data: {
          node: {
            connect: { agentId }
          },
          type: diagnosticData.type,
          target: diagnosticData.target,
          success: diagnosticData.success,
          result: JSON.stringify(diagnosticData.result),
          error: diagnosticData.error,
          duration: diagnosticData.duration,
          timestamp: new Date()
        }
      });

      logger.debug(`Diagnostic recorded for agent: ${agentId}, type: ${diagnosticData.type}`);
    } catch (error) {
      logger.error(`Failed to record diagnostic for ${agentId}:`, error);
      throw new Error('Failed to record diagnostic');
    }
  }

  // 获取节点统计信息
  async getNodeStats(): Promise<{
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    unknownNodes: number;
    totalCountries: number;
    totalProviders: number;
  }> {
    try {
      if (this.statsCache && Date.now() - this.statsCache.ts < this.statsCacheTtlMs) {
        return this.statsCache.data;
      }
      const [
        totalNodes,
        statusCounts,
        countries,
        providers
      ] = await Promise.all([
        prisma.node.count(),
        prisma.node.groupBy({
          by: ['status'],
          _count: true
        }),
        prisma.node.findMany({
          distinct: ['country'],
          select: { country: true }
        }),
        prisma.node.findMany({
          distinct: ['provider'],
          select: { provider: true }
        })
      ]);

      const statusMap = statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      const data = {
        totalNodes,
        onlineNodes: statusMap[NodeStatus.ONLINE] || 0,
        offlineNodes: statusMap[NodeStatus.OFFLINE] || 0,
        unknownNodes: statusMap[NodeStatus.UNKNOWN] || 0,
        totalCountries: countries.length,
        totalProviders: providers.length
      };
      this.statsCache = { data, ts: Date.now() };
      return data;
    } catch (error) {
      logger.error('Failed to fetch node stats:', error);
      throw new Error('Failed to fetch node stats');
    }
  }

  // 获取节点的诊断历史
  async getNodeDiagnostics(nodeId: string, type?: DiagnosticType, limit = 100): Promise<any[]> {
    try {
      const whereClause: any = { nodeId };
      if (type) {
        whereClause.type = type;
      }

      return await prisma.diagnosticRecord.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          target: true,
          success: true,
          result: true,
          error: true,
          duration: true,
          timestamp: true
        }
      });
    } catch (error) {
      logger.error(`Failed to fetch diagnostics for node ${nodeId}:`, error);
      throw new Error('Failed to fetch node diagnostics');
    }
  }

  // 获取节点最新的详细心跳数据
  async getLatestHeartbeatData(nodeId: string): Promise<HeartbeatDetail | null> {
    try {
      const heartbeats = await prisma.heartbeatLog.findMany({
        where: { nodeId },
        orderBy: { timestamp: 'desc' },
        take: 2
      });

      if (heartbeats.length === 0) {
        return null;
      }

      const latest: any = heartbeats[0] as any;
      const previous: any | undefined = heartbeats[1] as any | undefined;

      // 复制 networkInfo 并基于上一次心跳计算速率（bps）
      let networkInfo = latest.networkInfo || null;
      if (networkInfo && previous?.networkInfo && previous?.timestamp) {
        try {
          const prevMap = new Map<string, any>();
          for (const n of (previous.networkInfo as any[])) {
            if (n && n.interface) prevMap.set(n.interface, n);
          }
          const dt = Math.max(1, (latest.timestamp.getTime() - new Date(previous.timestamp).getTime()) / 1000); // seconds
          networkInfo = (latest.networkInfo as any[]).map((n: any) => {
            const prev = prevMap.get(n.interface);
            if (prev && typeof n.bytesReceived === 'number' && typeof n.bytesSent === 'number' && typeof prev.bytesReceived === 'number' && typeof prev.bytesSent === 'number') {
              const rx = n.bytesReceived - prev.bytesReceived;
              const tx = n.bytesSent - prev.bytesSent;
              const rxBps = rx >= 0 ? Math.round((rx * 8) / dt) : undefined;
              const txBps = tx >= 0 ? Math.round((tx * 8) / dt) : undefined;
              return { ...n, rxBps, txBps };
            }
            return n;
          });
        } catch {}
      }

      const detail: HeartbeatDetail = {
        timestamp: latest.timestamp,
        status: latest.status,
        uptime: latest.uptime,
        cpuUsage: latest.cpuUsage,
        memoryUsage: latest.memoryUsage,
        diskUsage: latest.diskUsage,
        connectivity: latest.connectivity,
        cpuInfo: latest.cpuInfo || null,
        memoryInfo: latest.memoryInfo || null,
        diskInfo: latest.diskInfo || null,
        networkInfo: networkInfo,
        processInfo: latest.processInfo || null,
        virtualization: latest.virtualization || null,
        services: latest.services || null,
        loadAverage: latest.loadAverage || null
      };
      return detail;
    } catch (error) {
      logger.error(`Failed to fetch latest heartbeat data for node ${nodeId}:`, error);
      throw new Error('Failed to fetch heartbeat data');
    }
  }

  // 批量更新节点ASN信息
  async updateNodesASN(): Promise<void> {
    try {
      const nodes = await prisma.node.findMany({
        where: {
          AND: [
            {
              OR: [
                { asnNumber: null },
                { asnNumber: '' }
              ]
            },
            {
              OR: [
                { ipv4: { not: null } },
                { ipv6: { not: null } }
              ]
            }
          ]
        }
      });

      logger.info(`Found ${nodes.length} nodes without ASN information`);

      for (const node of nodes) {
        try {
          const targetIP = node.ipv4 || node.ipv6;
          if (!targetIP) continue;

          const ipInfo = await ipInfoService.getIPInfo(targetIP);
          
          if (ipInfo && ipInfo.asn) {
            await this.updateNode(node.id, {
              asnNumber: ipInfo.asn.asn,
              asnName: ipInfo.asn.name,
              asnOrg: ipInfo.asn.org,
              asnRoute: ipInfo.asn.route,
              asnType: ipInfo.asn.type
            });

            logger.info(`Updated ASN for node ${node.name}: ${ipInfo.asn.asn} (${ipInfo.asn.name})`);
          }

          // 避免API限制，每次请求间隔500ms
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.warn(`Failed to update ASN for node ${node.name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to update nodes ASN:', error);
    }
  }

  // 手动恢复节点在线状态（用于修复卡在离线状态的节点）
  async forceRecoveryOnlineNodes(): Promise<void> {
    try {
      const currentTime = new Date();
      const recentThreshold = new Date(currentTime.getTime() - 5 * 60 * 1000); // 5分钟内有心跳的节点

      // 查找状态为OFFLINE但最近有心跳记录的节点
      const offlineNodes = await prisma.node.findMany({
        where: {
          status: NodeStatus.OFFLINE
        },
        select: {
          id: true,
          agentId: true,
          name: true,
          status: true,
          lastSeen: true
        }
      });

      if (offlineNodes.length === 0) {
        logger.debug('No offline nodes found for recovery check');
        return;
      }

      // 检查这些节点最近是否有心跳
      for (const node of offlineNodes) {
        try {
          const recentHeartbeat = await prisma.heartbeatLog.findFirst({
            where: {
              nodeId: node.id,
              timestamp: {
                gte: recentThreshold
              }
            },
            orderBy: {
              timestamp: 'desc'
            }
          });

          if (recentHeartbeat) {
            // 节点最近有心跳但状态是离线，恢复为在线
            await prisma.node.update({
              where: { id: node.id },
              data: { 
                status: NodeStatus.ONLINE,
                lastSeen: recentHeartbeat.timestamp
              }
            });

            await eventService.createEvent(node.id, 'STATUS_CHANGED', `${NodeStatus.OFFLINE} -> ${NodeStatus.ONLINE}`, {
              from: NodeStatus.OFFLINE,
              to: NodeStatus.ONLINE,
              reason: 'Recovered: Recent heartbeat detected while marked offline',
              heartbeatTimestamp: recentHeartbeat.timestamp
            });

            logger.info(`Recovered node to online: ${node.name} (${node.agentId}) - recent heartbeat: ${recentHeartbeat.timestamp}`);

            // 广播单节点状态变更，确保前端及时刷新
            try {
              const { getIO } = await import('../sockets/ioRegistry');
              const io = getIO();
              if (io) {
                io.to('nodes_updates').emit('node_status_changed', {
                  nodeId: node.id,
                  status: 'online',
                  timestamp: new Date().toISOString()
                });
              }
            } catch {}
          }
        } catch (error) {
          logger.error(`Failed to check recovery for node ${node.name}:`, error);
        }
      }

      // 清理缓存
      this.nodesCache = null;
      this.statsCache = null;
    } catch (error) {
      logger.error('Failed to recover online nodes:', error);
    }
  }

  // 检查并更新长时间未发送心跳的节点状态
  async checkOfflineNodes(offlineThresholdMinutes = 30): Promise<void> {
    try {
      const thresholdTime = new Date();
      thresholdTime.setMinutes(thresholdTime.getMinutes() - offlineThresholdMinutes);

      // 查找所有状态为ONLINE但lastSeen时间超过阈值的节点
      const onlineNodes = await prisma.node.findMany({
        where: {
          status: NodeStatus.ONLINE,
          lastSeen: {
            lt: thresholdTime
          }
        },
        select: {
          id: true,
          agentId: true,
          name: true,
          lastSeen: true,
          status: true
        }
      });

      if (onlineNodes.length > 0) {
        logger.info(`Found ${onlineNodes.length} nodes to mark as offline (no heartbeat for ${offlineThresholdMinutes} minutes)`);

        // 批量更新节点状态为OFFLINE
        for (const node of onlineNodes) {
          try {
            const oldStatus = node.status;
            await prisma.node.update({
              where: { id: node.id },
              data: { status: NodeStatus.OFFLINE }
            });

            // 记录状态变更事件
            await eventService.createEvent(node.id, 'STATUS_CHANGED', `${oldStatus} -> ${NodeStatus.OFFLINE}`, { 
              from: oldStatus, 
              to: NodeStatus.OFFLINE,
              reason: `No heartbeat for ${offlineThresholdMinutes} minutes`,
              lastSeen: node.lastSeen
            });

            logger.info(`Node marked as offline: ${node.name} (${node.agentId}) - last seen: ${node.lastSeen}`);

            // 广播单节点状态变更，确保前端及时刷新
            try {
              const { getIO } = await import('../sockets/ioRegistry');
              const io = getIO();
              if (io) {
                io.to('nodes_updates').emit('node_status_changed', {
                  nodeId: node.id,
                  status: 'offline',
                  timestamp: new Date().toISOString()
                });
              }
            } catch {}
          } catch (error) {
            logger.error(`Failed to mark node ${node.name} as offline:`, error);
          }
        }

        // 清理缓存，确保前端能获取最新状态
        this.nodesCache = null;
        this.statsCache = null;

        logger.info(`Successfully marked ${onlineNodes.length} nodes as offline`);
      }
    } catch (error) {
      logger.error('Failed to check offline nodes:', error);
    }
  }

  // 清理旧的心跳和诊断记录
  async cleanupOldRecords(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const [deletedHeartbeats, deletedDiagnostics] = await Promise.all([
        prisma.heartbeatLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        }),
        prisma.diagnosticRecord.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        })
      ]);

      logger.info(`Cleaned up old records: ${deletedHeartbeats.count} heartbeats, ${deletedDiagnostics.count} diagnostics`);
    } catch (error) {
      logger.error('Failed to cleanup old records:', error);
    }
  }

  // 静态方法：计算节点统计信息
  static calculateStats(nodes: Node[]): {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    unknownNodes: number;
    totalCountries: number;
    totalProviders: number;
  } {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(node => node.status === NodeStatus.ONLINE).length;
    const unknownNodes = nodes.filter(node => node.status === NodeStatus.UNKNOWN).length;
    const offlineNodes = Math.max(0, totalNodes - onlineNodes - unknownNodes);
    const countries = new Set(nodes.map(node => node.country));
    const providers = new Set(nodes.map(node => node.provider));

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      unknownNodes,
      totalCountries: countries.size,
      totalProviders: providers.size
    };
  }
}

export const nodeService = new NodeService();
