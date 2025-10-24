import { prisma } from "../lib/prisma";
import { NodeStatus, DiagnosticType, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { ipInfoService } from "./IPInfoService";
import type { ASNInfo } from "./IPInfoService";
import crypto from "crypto";
import {
  RecordHeartbeatInput,
  HeartbeatDetail,
  CPUDetail,
  MemoryDetail,
  DiskDetail,
  NetworkInterfaceDetail,
  ProcessInfoDetail,
  VirtualizationDetail,
  ServicesDetail,
} from "../types/heartbeat";
import { eventService } from "./EventService";

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
  nameCustomized?: boolean; // 名称是否被用户自定义过
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
  nameCustomized?: boolean;
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
  // 成本信息
  monthlyCost?: number | null;
  // 占位/资产管理
  isPlaceholder?: boolean;
  // 允许在占位升级时写入真实 agentId
  agentId?: string;
}

const BASE_NODE_SELECT = {
  id: true,
  name: true,
  hostname: true,
  country: true,
  city: true,
  latitude: true,
  longitude: true,
  ipv4: true,
  ipv6: true,
  asnNumber: true,
  asnName: true,
  asnOrg: true,
  asnRoute: true,
  asnType: true,
  provider: true,
  datacenter: true,
  monthlyCost: true,
  nameCustomized: true,
  agentId: true,
  apiKey: true,
  status: true,
  lastSeen: true,
  tags: true,
  description: true,
  osType: true,
  osVersion: true,
  createdAt: true,
  updatedAt: true,
  isPlaceholder: true,
  neverAdopt: true,
  _count: {
    select: {
      diagnosticRecords: true,
      heartbeatLogs: true,
    },
  },
} satisfies Prisma.NodeSelect;

export type ManagedNode = Prisma.NodeGetPayload<{
  select: typeof BASE_NODE_SELECT;
}>;

export type NodeWithStats = ManagedNode & {
  lastHeartbeat?: {
    timestamp: Date;
    status: string;
    uptime: number | null;
  };
  uptime?: number | null;
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  diskUsage?: number | null;
  loadAverage?: number[] | null;
  totalUpload?: bigint | null;
  totalDownload?: bigint | null;
  periodUpload?: bigint | null;
  periodDownload?: bigint | null;
};

type PlaceholderImportItem = {
  ip: string;
  name?: string;
  notes?: string;
  tags?: string[];
  neverAdopt?: boolean;
};

interface AgentNodeInfoPayload {
  name?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  ipv4?: string | null;
  ipv6?: string | null;
}

interface AgentSystemInfoPayload {
  platform?: string;
  version?: string;
  [key: string]: unknown;
}

type DiagnosticRecordSummary = {
  id: string;
  type: DiagnosticType;
  target: string | null;
  success: boolean;
  result: string | null;
  error: string | null;
  duration: number | null;
  timestamp: Date;
};

export class NodeService {
  private heartbeatLogCounter: Record<string, number> = {};
  private heartbeatLogInterval = 5; // 每5次详细记录一次

  // 内存缓存，减少频繁数据库访问压力
  private nodesCache: { data: NodeWithStats[]; ts: number } | null = null;
  private statsCache: {
    data: {
      totalNodes: number;
      onlineNodes: number;
      offlineNodes: number;
      totalCountries: number;
      totalProviders: number;
      securityEvents: number;
    };
    ts: number;
  } | null = null;
  private nodesCacheTtlMs = parseInt(process.env.NODES_CACHE_TTL_MS || "2000");
  private statsCacheTtlMs = parseInt(process.env.STATS_CACHE_TTL_MS || "2000");

  // 兼容性：数据库是否已添加占位相关列（isPlaceholder、neverAdopt）
  private placeholderSupport: boolean | null = null;

  private async ensurePlaceholderSupport(): Promise<boolean> {
    if (this.placeholderSupport !== null) return this.placeholderSupport;
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'nodes'
             AND column_name IN ('isPlaceholder','neverAdopt')
         ) AS exists`,
      );
      this.placeholderSupport = !!rows?.[0]?.exists;
    } catch {
      this.placeholderSupport = false;
    }
    return this.placeholderSupport;
  }

  // 创建新节点
  async createNode(input: CreateNodeInput): Promise<ManagedNode> {
    try {
      // 使用提供的agentId或生成新的
      const agentId = input.agentId || crypto.randomUUID();
      const apiKey = crypto.randomBytes(32).toString("hex");

      // 如果提供了IP地址但没有ASN信息，自动查询ASN
      let asnInfo = {
        asnNumber: input.asnNumber,
        asnName: input.asnName,
        asnOrg: input.asnOrg,
        asnRoute: input.asnRoute,
        asnType: input.asnType,
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
              asnType: ipInfo.asn.type,
            };

            logger.info(
              `自动获取ASN信息: ${targetIP} -> ${ipInfo.asn.asn} (${ipInfo.asn.name})`,
            );
          }
        } catch (asnError) {
          logger.warn(
            `Failed to fetch ASN info for IP ${input.ipv4 || input.ipv6}:`,
            asnError,
          );
        }
      }

      const node = await prisma.node.create({
        select: BASE_NODE_SELECT,
        data: {
          ...input,
          ...asnInfo,
          agentId,
          apiKey,
          status: input.status || NodeStatus.OFFLINE,
        },
      });

      // 记录节点创建事件
      const eventService = (await import("./EventService")).eventService;
      await eventService.createEvent(
        node.id,
        "NODE_CREATED",
        `节点创建: ${node.name}`,
        {
          city: node.city,
          country: node.country,
          provider: node.provider,
          asnNumber: asnInfo.asnNumber,
        },
      );

      logger.info(
        `Node created: ${node.name} (${node.id}) with ASN: ${asnInfo.asnNumber}`,
      );
      return this.withPreferredProvider(node);
    } catch (error) {
      logger.error("Failed to create node:", error);
      throw new Error("Failed to create node");
    }
  }

  // 获取所有节点
  async getAllNodes(): Promise<NodeWithStats[]> {
    try {
      // 命中缓存
      if (
        this.nodesCache &&
        Date.now() - this.nodesCache.ts < this.nodesCacheTtlMs
      ) {
        return this.nodesCache.data;
      }

      // 添加查询超时保护
      const queryTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Query timeout")), 30000); // 30秒超时
      });

      const nodesQuery = (async () => {
        // 1) 一次性取所有节点（按创建时间倒序），限制字段
        const nodes = await prisma.node.findMany({
          select: BASE_NODE_SELECT,
          orderBy: { createdAt: "desc" },
        });

        if (nodes.length === 0) return [];

        // 2) 使用原生SQL一次性获取每个节点的最新心跳（避免 N+1 查询）
        // 优化：只获取最近7天的心跳数据，进一步减少查询负载
        const latestRows = await prisma.$queryRawUnsafe<
          Array<{
            nodeId: string;
            timestamp: Date;
            status: string;
            uptime: number | null;
            cpuUsage: number | null;
            memoryUsage: number | null;
            diskUsage: number | null;
            loadAverage: unknown | null;
          }>
        >(`
          SELECT DISTINCT ON ("nodeId")
            "nodeId",
            "timestamp",
            "status",
            "uptime",
            "cpuUsage",
            "memoryUsage",
            "diskUsage",
            "loadAverage"
          FROM "heartbeat_logs"
          WHERE "timestamp" > NOW() - INTERVAL '7 days'
          ORDER BY "nodeId", "timestamp" DESC
        `);

        const latestMap = new Map<string, (typeof latestRows)[number]>();
        for (const r of latestRows) {
          latestMap.set(r.nodeId, r);
        }

        // 3) 获取所有节点的流量统计
        const trafficStatsService = await import("./TrafficStatsService");
        const trafficStatsMap =
          await trafficStatsService.trafficStatsService.getAllTrafficStats();

        // 4) 组装返回（不再 include 关系，显著降低查询负载）
        const result = nodes.map((node): NodeWithStats => {
          const lh = latestMap.get(node.id);
          const traffic = trafficStatsMap.get(node.id);

          // Parse loadAverage from JSON if it exists
          let loadAverage: number[] | null = null;
          if (lh?.loadAverage) {
            try {
              const parsed = Array.isArray(lh.loadAverage)
                ? lh.loadAverage
                : JSON.parse(lh.loadAverage as string);
              if (
                Array.isArray(parsed) &&
                parsed.every((v) => typeof v === "number")
              ) {
                loadAverage = parsed as number[];
              }
            } catch {
              // Ignore parsing errors
            }
          }

          return {
            ...node,
            provider: node.asnName || node.provider,
            lastHeartbeat: lh
              ? {
                  timestamp: lh.timestamp,
                  status: lh.status,
                  uptime: lh.uptime ?? null,
                }
              : undefined,
            uptime: lh?.uptime ?? null,
            cpuUsage: lh?.cpuUsage ?? null,
            memoryUsage: lh?.memoryUsage ?? null,
            diskUsage: lh?.diskUsage ?? null,
            loadAverage,
            totalUpload: traffic?.totalUpload ?? null,
            totalDownload: traffic?.totalDownload ?? null,
            periodUpload: traffic?.periodUpload ?? null,
            periodDownload: traffic?.periodDownload ?? null,
          };
        });
        return result;
      })();

      // 使用Promise.race实现超时控制
      const result = await Promise.race([nodesQuery, queryTimeout]);
      this.nodesCache = { data: result, ts: Date.now() };
      return result;
    } catch (error) {
      logger.error("Failed to fetch nodes:", error);
      // 如果缓存存在，返回缓存数据而不是抛错
      if (this.nodesCache && this.nodesCache.data.length > 0) {
        logger.warn("Returning stale cache due to query error");
        return this.nodesCache.data;
      }
      throw new Error("Failed to fetch nodes");
    }
  }

  // 根据ID获取节点
  async getNodeById(id: string): Promise<ManagedNode | null> {
    try {
      const node = await prisma.node.findUnique({
        where: { id },
        select: BASE_NODE_SELECT,
      });

      if (!node) return null;

      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return this.withPreferredProvider(node);
    } catch (error) {
      logger.error(`Failed to fetch node ${id}:`, error);
      throw new Error("Failed to fetch node");
    }
  }

  // 根据agentId获取节点
  async getNodeByAgentId(agentId: string): Promise<ManagedNode | null> {
    try {
      const node = await prisma.node.findUnique({
        where: { agentId },
        select: BASE_NODE_SELECT,
      });

      if (!node) return null;

      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return this.withPreferredProvider(node);
    } catch (error) {
      logger.error(`Failed to fetch node by agentId ${agentId}:`, error);
      throw new Error("Failed to fetch node");
    }
  }

  // 更新节点信息
  async updateNode(id: string, input: UpdateNodeInput): Promise<ManagedNode> {
    try {
      // 获取更新前的节点信息，用于比对重要变更
      const oldNode = await prisma.node.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      const node = await prisma.node.update({
        where: { id },
        data: {
          ...input,
          updatedAt: new Date(),
        },
        select: BASE_NODE_SELECT,
      });

      // 记录节点名称更新事件
      if (oldNode && input.name && input.name !== oldNode.name) {
        try {
          const eventService = (await import("./EventService")).eventService;
          await eventService.createEvent(
            node.id,
            "NODE_UPDATED",
            `节点名称更新: ${oldNode.name} -> ${input.name}`,
            { oldName: oldNode.name, newName: input.name },
          );
        } catch (eventError) {
          logger.warn("Failed to create update event:", eventError);
        }
      }

      logger.info(`Node updated: ${node.name} (${node.id})`);

      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return this.withPreferredProvider(node);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Node not found");
      }
      logger.error(`Failed to update node ${id}:`, error);
      throw new Error("Failed to update node");
    }
  }

  // 删除节点
  async deleteNode(id: string): Promise<void> {
    try {
      // 先获取节点信息用于记录事件
      const node = await prisma.node.findUnique({
        where: { id },
        select: { id: true, name: true, city: true, country: true },
      });

      if (!node) {
        throw new Error("Node not found");
      }

      // 记录删除事件（在删除前记录，因为删除后节点就不存在了）
      try {
        const eventService = (await import("./EventService")).eventService;
        await eventService.createEvent(
          node.id,
          "NODE_DELETED",
          `节点删除: ${node.name}`,
          {
            city: node.city,
            country: node.country,
          },
        );
      } catch (eventError) {
        logger.warn("Failed to create delete event:", eventError);
      }

      await prisma.node.delete({
        where: { id },
        select: { id: true },
      });
      logger.info(`Node deleted: ${id}`);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Node not found");
      }
      logger.error(`Failed to delete node ${id}:`, error);
      throw new Error("Failed to delete node");
    }
  }

  // 基于IP创建占位节点（未安装Agent的VPS资产）
  async createPlaceholderFromIP(
    ip: string,
    options?: {
      name?: string;
      notes?: string;
      tags?: string[];
      neverAdopt?: boolean;
    },
  ): Promise<ManagedNode> {
    if (!(await this.ensurePlaceholderSupport())) {
      throw new Error(
        "Placeholder feature not available: please apply database migrations",
      );
    }
    const isIPv6 = ip.includes(":");
    try {
      // 先查找是否已有同IP的节点
      const orConds: Prisma.NodeWhereInput[] = [];
      if (!isIPv6) orConds.push({ ipv4: ip });
      else orConds.push({ ipv6: ip });

      const existing = await prisma.node.findFirst({
        where: { OR: orConds },
        select: BASE_NODE_SELECT,
      });
      if (existing) {
        if (existing.isPlaceholder) {
          // 更新占位信息（名称/标签/描述）
          const updated = await prisma.node.update({
            where: { id: existing.id },
            data: {
              name: options?.name || existing.name,
              description: options?.notes ?? existing.description,
              tags: options?.tags
                ? JSON.stringify(options.tags)
                : existing.tags,
              ...(typeof options?.neverAdopt === "boolean"
                ? { neverAdopt: options.neverAdopt }
                : {}),
            },
            select: BASE_NODE_SELECT,
          });
          return this.withPreferredProvider(updated);
        }
        // 已存在非占位节点，直接返回（不覆盖）
        return this.withPreferredProvider(existing);
      }

      // 查询IP信息，填充地理/ASN
      let country = "Unknown";
      let city = "Unknown";
      let latitude = 0;
      let longitude = 0;
      let provider = "Unknown";
      let asn: Partial<ASNInfo> = {};
      try {
        const info = await ipInfoService.getIPInfo(ip);
        if (info) {
          country = info.country || country;
          city = info.city || city;
          if (info.loc && info.loc.includes(",")) {
            const [lat, lon] = info.loc.split(",");
            latitude = parseFloat(lat) || 0;
            longitude = parseFloat(lon) || 0;
          }
          const providerCandidate = info.asn?.name ?? info.company?.name;
          if (providerCandidate) {
            provider = providerCandidate;
          }
          asn = info.asn ?? {};
        }
      } catch {
        // noop: best-effort IP info enrichment during placeholder creation
      }

      const placeholderAgentId = `placeholder_${crypto.createHash("sha1").update(ip).digest("hex").slice(0, 12)}`;
      const apiKey = crypto.randomBytes(32).toString("hex");

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
          neverAdopt: options?.neverAdopt === true,
          asnNumber: asn.asn ?? null,
          asnName: asn.name ?? null,
          asnOrg: asn.org ?? null,
          asnRoute: asn.route ?? null,
          asnType: asn.type ?? null,
        },
        select: BASE_NODE_SELECT,
      });
      return this.withPreferredProvider(node);
    } catch (error) {
      logger.error("Failed to create placeholder node:", error);
      throw new Error("Failed to create placeholder node");
    }
  }

  async createPlaceholdersFromIPs(items: PlaceholderImportItem[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
    results: ManagedNode[];
  }> {
    if (!(await this.ensurePlaceholderSupport())) {
      throw new Error(
        "Placeholder feature not available: please apply database migrations",
      );
    }
    let created = 0,
      updated = 0,
      skipped = 0;
    const results: ManagedNode[] = [];
    for (const item of items) {
      const ip = (item.ip || "").trim();
      if (!ip) {
        skipped++;
        continue;
      }
      try {
        // 试着调用创建（内部会处理已存在时的更新/返回）
        const before = await prisma.node.findFirst({
          where: { OR: ip.includes(":") ? [{ ipv6: ip }] : [{ ipv4: ip }] },
          select: BASE_NODE_SELECT,
        });
        const n = await this.createPlaceholderFromIP(ip, {
          name: item.name,
          notes: item.notes,
          tags: item.tags,
          neverAdopt: item.neverAdopt,
        });
        const after = await prisma.node.findUnique({
          where: { id: n.id },
          select: BASE_NODE_SELECT,
        });
        if (!before && after) created++;
        else if (before && before.isPlaceholder) updated++;
        else skipped++;
        results.push(n);
        // 避免外部数据源限频
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        logger.warn("Placeholder import failed for ip:", item.ip, e);
        skipped++;
      }
    }
    return { created, updated, skipped, results };
  }

  // 尝试将真实 Agent 绑定到占位节点（按IP匹配），并升级为正式节点
  async tryAdoptAgentToPlaceholder(
    agentId: string,
    ip?: string | null,
    nodeInfo?: AgentNodeInfoPayload | null,
    systemInfo?: AgentSystemInfoPayload | null,
  ): Promise<ManagedNode | null> {
    if (!(await this.ensurePlaceholderSupport())) return null;
    if (!ip) return null;
    const isIPv6 = ip.includes(":");
    const orConds: Prisma.NodeWhereInput[] = [];
    if (isIPv6) orConds.push({ ipv6: ip });
    else orConds.push({ ipv4: ip });
    const placeholder = await prisma.node.findFirst({
      where: { AND: [{ isPlaceholder: true }, { OR: orConds }] },
      select: BASE_NODE_SELECT,
    });
    if (!placeholder) return null;
    if (placeholder.neverAdopt) {
      // 纪念/冻结占位：不自动收编
      return null;
    }
    // 升级为正式节点
    const updated = await prisma.node.update({
      where: { id: placeholder.id },
      data: {
        agentId,
        isPlaceholder: false,
        status: NodeStatus.ONLINE,
        lastSeen: new Date(),
        name: nodeInfo?.name || placeholder.name,
        ipv4: isIPv6 ? placeholder.ipv4 : ip || placeholder.ipv4,
        ipv6: isIPv6 ? ip || placeholder.ipv6 : placeholder.ipv6,
        osType: systemInfo?.platform || placeholder.osType,
        osVersion: systemInfo?.version || placeholder.osVersion,
      },
      select: BASE_NODE_SELECT,
    });
    logger.info(
      `Adopted agent ${agentId} into placeholder node ${placeholder.id} (${placeholder.name})`,
    );
    return this.withPreferredProvider(updated);
  }

  // 更新节点状态
  async updateNodeStatus(
    agentId: string,
    status: NodeStatus,
  ): Promise<ManagedNode> {
    try {
      // 读取旧状态
      const old = await prisma.node.findUnique({
        where: { agentId },
        select: BASE_NODE_SELECT,
      });
      if (!old) {
        throw new Error(`Node with agentId ${agentId} not found`);
      }

      const node = await prisma.node.update({
        where: { agentId },
        data: {
          status,
          lastSeen: new Date(),
        },
        select: BASE_NODE_SELECT,
      });

      // 增强日志输出，记录所有状态更新（包括相同状态的刷新）
      const statusChanged = old.status !== status;
      if (statusChanged) {
        logger.info(
          `Node status changed: ${node.name} (${agentId}) ${old.status} -> ${status}`,
        );
        // 记录状态变更事件
        await eventService.createEvent(
          node.id,
          "STATUS_CHANGED",
          `${old.status} -> ${status}`,
          {
            from: old.status,
            to: status,
            lastSeen: old.lastSeen,
            newLastSeen: node.lastSeen,
          },
        );
      } else {
        logger.debug(
          `Node heartbeat: ${node.name} (${agentId}) remains ${status}, lastSeen updated`,
        );
      }

      // 清理相关缓存，确保前端能获取最新状态
      this.nodesCache = null;
      this.statsCache = null;

      // 实时广播状态变化（即使状态未变化也刷新 lastSeen 的前端显示）
      try {
        const { getIO } = await import("../sockets/ioRegistry");
        const io = getIO();
        if (io) {
          io.to("nodes_updates").emit("node_status_changed", {
            nodeId: node.id,
            status: String(status).toLowerCase(),
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // noop: broadcasting failures should not block state update
      }

      // 如果存在ASN名称，使用ASN名称作为服务商显示
      return {
        ...node,
        provider: node.asnName || node.provider,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Node not found");
      }
      logger.error(`Failed to update node status ${agentId}:`, error);
      throw new Error("Failed to update node status");
    }
  }

  // 记录心跳
  async recordHeartbeat(
    agentId: string,
    heartbeatData: RecordHeartbeatInput,
  ): Promise<void> {
    try {
      // 首先更新节点状态并获取节点信息
      const node = await this.updateNodeStatus(agentId, NodeStatus.ONLINE);

      // 准备心跳日志数据
      const logData: Prisma.HeartbeatLogUncheckedCreateInput = {
        nodeId: node.id,
        status: heartbeatData.status,
        uptime: heartbeatData.uptime,
        cpuUsage: heartbeatData.cpuUsage,
        memoryUsage: heartbeatData.memoryUsage,
        diskUsage: heartbeatData.diskUsage,
        timestamp: new Date(),
      };

      if (typeof heartbeatData.connectivity !== "undefined") {
        logData.connectivity =
          heartbeatData.connectivity as Prisma.InputJsonValue;
      }

      // 如果包含详细系统信息，添加到日志数据中
      if (heartbeatData.systemInfo) {
        const sysInfo = heartbeatData.systemInfo;

        // 存储详细信息为JSON
        if (sysInfo.cpu) {
          logData.cpuInfo = sysInfo.cpu as Prisma.InputJsonValue;
          // 更新兼容性字段
          if (
            logData.cpuUsage == null &&
            typeof sysInfo.cpu.usage === "number"
          ) {
            logData.cpuUsage = sysInfo.cpu.usage;
          }
        }

        if (sysInfo.memory) {
          logData.memoryInfo = sysInfo.memory as Prisma.InputJsonValue;
          // 更新兼容性字段
          if (
            logData.memoryUsage == null &&
            typeof sysInfo.memory.usage === "number"
          ) {
            logData.memoryUsage = sysInfo.memory.usage;
          }
        }

        if (sysInfo.disk) {
          logData.diskInfo = sysInfo.disk as Prisma.InputJsonValue;
          // 更新兼容性字段
          if (
            logData.diskUsage == null &&
            typeof sysInfo.disk.usage === "number"
          ) {
            logData.diskUsage = sysInfo.disk.usage;
          }
        }

        if (Array.isArray(sysInfo.network)) {
          logData.networkInfo = sysInfo.network as Prisma.InputJsonValue;
        }

        if (sysInfo.processes) {
          logData.processInfo = sysInfo.processes as Prisma.InputJsonValue;
        }

        if (sysInfo.virtualization) {
          logData.virtualization =
            sysInfo.virtualization as Prisma.InputJsonValue;
        }

        if (sysInfo.services) {
          logData.services = sysInfo.services as Prisma.InputJsonValue;
        }

        if (Array.isArray(sysInfo.loadAverage)) {
          logData.loadAverage = sysInfo.loadAverage as Prisma.InputJsonValue;
        }
      }

      // 记录心跳日志
      await prisma.$transaction(async (tx) => {
        await tx.heartbeatLog.deleteMany({
          where: { nodeId: node.id },
        });
        await tx.heartbeatLog.create({
          data: logData,
        });
      });

      // 更新流量统计
      if (heartbeatData.systemInfo?.network) {
        const trafficStatsService = await import("./TrafficStatsService");
        await trafficStatsService.trafficStatsService.updateTrafficStats(
          node.id,
          heartbeatData.systemInfo.network,
        );
      }

      // 心跳日志降噪：仅每 N 次输出一次详细字段
      this.heartbeatLogCounter[agentId] =
        (this.heartbeatLogCounter[agentId] || 0) + 1;
      const detailed =
        this.heartbeatLogCounter[agentId] % this.heartbeatLogInterval === 0;
      const logPayload = {
        hasCpuInfo: Boolean(logData.cpuInfo),
        hasMemoryInfo: Boolean(logData.memoryInfo),
        hasDiskInfo: Boolean(logData.diskInfo),
        hasNetworkInfo: Boolean(logData.networkInfo),
        hasProcessInfo: Boolean(logData.processInfo),
        hasVirtualization: Boolean(logData.virtualization),
        hasServices: Boolean(logData.services),
      };
      if (detailed) {
        logger.debug(
          `Enhanced heartbeat recorded for agent: ${agentId}`,
          logPayload,
        );
      }
    } catch (error) {
      logger.error(`Failed to record heartbeat for ${agentId}:`, error);
      throw new Error("Failed to record heartbeat");
    }
  }

  // 记录诊断结果
  async recordDiagnostic(
    agentId: string,
    diagnosticData: {
      type: DiagnosticType;
      target?: string;
      success: boolean;
      result: unknown;
      error?: string;
      duration?: number;
    },
  ): Promise<void> {
    try {
      // 获取节点信息
      const node = await this.getNodeByAgentId(agentId);
      if (!node) {
        throw new Error(`Node with agentId ${agentId} not found`);
      }

      await prisma.diagnosticRecord.create({
        data: {
          node: {
            connect: { agentId },
          },
          type: diagnosticData.type,
          target: diagnosticData.target,
          success: diagnosticData.success,
          result: JSON.stringify(diagnosticData.result),
          error: diagnosticData.error,
          duration: diagnosticData.duration,
          timestamp: new Date(),
        },
      });

      // 记录诊断事件
      const eventService = (await import("./EventService")).eventService;
      const statusText = diagnosticData.success ? "成功" : "失败";
      const targetText = diagnosticData.target
        ? ` -> ${diagnosticData.target}`
        : "";
      await eventService.createEvent(
        node.id,
        "DIAGNOSTIC_TEST",
        `${diagnosticData.type} ${statusText}${targetText}`,
        {
          type: diagnosticData.type,
          target: diagnosticData.target,
          success: diagnosticData.success,
          duration: diagnosticData.duration,
          error: diagnosticData.error,
        },
      );

      logger.debug(
        `Diagnostic recorded for agent: ${agentId}, type: ${diagnosticData.type}`,
      );
    } catch (error) {
      logger.error(`Failed to record diagnostic for ${agentId}:`, error);
      throw new Error("Failed to record diagnostic");
    }
  }

  // 获取节点统计信息
  async getNodeStats(): Promise<{
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalCountries: number;
    totalProviders: number;
    securityEvents: number;
  }> {
    try {
      if (
        this.statsCache &&
        Date.now() - this.statsCache.ts < this.statsCacheTtlMs
      ) {
        return this.statsCache.data;
      }

      // 统计最近24小时的安全事件
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [
        totalNodes,
        statusCounts,
        countries,
        providers,
        securityEventsCount,
      ] = await Promise.all([
        prisma.node.count(),
        prisma.node.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.node.findMany({
          distinct: ["country"],
          select: { country: true },
        }),
        prisma.node.findMany({
          distinct: ["provider"],
          select: { provider: true },
        }),
        prisma.eventLog.count({
          where: {
            timestamp: { gte: last24Hours },
            type: {
              in: [
                "SSH_BRUTEFORCE",
                "INTRUSION_DETECTED",
                "MALWARE_DETECTED",
                "DDOS_ATTACK",
                "ANOMALY_DETECTED",
                "SECURITY_ALERT",
              ],
            },
          },
        }),
      ]);

      const statusMap = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      );

      const data = {
        totalNodes,
        onlineNodes: statusMap[NodeStatus.ONLINE] || 0,
        offlineNodes: statusMap[NodeStatus.OFFLINE] || 0,
        totalCountries: countries.length,
        totalProviders: providers.length,
        securityEvents: securityEventsCount,
      };
      this.statsCache = { data, ts: Date.now() };
      return data;
    } catch (error) {
      logger.error("Failed to fetch node stats:", error);
      throw new Error("Failed to fetch node stats");
    }
  }

  // 获取节点的诊断历史
  async getNodeDiagnostics(
    nodeId: string,
    type?: DiagnosticType,
    limit = 100,
  ): Promise<DiagnosticRecordSummary[]> {
    try {
      const whereClause: Prisma.DiagnosticRecordWhereInput = { nodeId };
      if (type) {
        whereClause.type = type;
      }

      const records = await prisma.diagnosticRecord.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          target: true,
          success: true,
          result: true,
          error: true,
          duration: true,
          timestamp: true,
        },
      });

      return records;
    } catch (error) {
      logger.error(`Failed to fetch diagnostics for node ${nodeId}:`, error);
      throw new Error("Failed to fetch node diagnostics");
    }
  }

  // 获取节点最新的详细心跳数据
  async getLatestHeartbeatData(
    nodeId: string,
  ): Promise<HeartbeatDetail | null> {
    try {
      const heartbeats = await prisma.heartbeatLog.findMany({
        where: { nodeId },
        orderBy: { timestamp: "desc" },
        take: 2,
      });

      if (heartbeats.length === 0) {
        return null;
      }

      const latest = heartbeats[0];
      const previous = heartbeats[1];

      let networkInfo = this.parseNetworkInterfaces(latest.networkInfo);
      const previousNetwork = previous
        ? this.parseNetworkInterfaces(previous.networkInfo)
        : null;

      if (networkInfo && previousNetwork && previous) {
        const prevMap = new Map<string, NetworkInterfaceDetail>();
        previousNetwork.forEach((iface) => {
          if (iface && iface.interface) {
            prevMap.set(iface.interface, iface);
          }
        });
        const dt = Math.max(
          1,
          (latest.timestamp.getTime() - previous.timestamp.getTime()) / 1000,
        );
        networkInfo = networkInfo.map((iface) => {
          const prev = prevMap.get(iface.interface);
          if (
            prev &&
            typeof iface.bytesReceived === "number" &&
            typeof iface.bytesSent === "number" &&
            typeof prev.bytesReceived === "number" &&
            typeof prev.bytesSent === "number"
          ) {
            const rx = iface.bytesReceived - prev.bytesReceived;
            const tx = iface.bytesSent - prev.bytesSent;
            const rxBps = rx >= 0 ? Math.round((rx * 8) / dt) : undefined;
            const txBps = tx >= 0 ? Math.round((tx * 8) / dt) : undefined;
            return { ...iface, rxBps, txBps };
          }
          return iface;
        });
      }

      const detail: HeartbeatDetail = {
        timestamp: latest.timestamp,
        status: latest.status,
        uptime: latest.uptime,
        cpuUsage: latest.cpuUsage,
        memoryUsage: latest.memoryUsage,
        diskUsage: latest.diskUsage,
        connectivity: latest.connectivity ?? null,
        cpuInfo: this.parseJsonObject<CPUDetail>(latest.cpuInfo),
        memoryInfo: this.parseJsonObject<MemoryDetail>(latest.memoryInfo),
        diskInfo: this.parseJsonObject<DiskDetail>(latest.diskInfo),
        networkInfo: networkInfo ?? null,
        processInfo: this.parseJsonObject<ProcessInfoDetail>(
          latest.processInfo,
        ),
        virtualization: this.parseJsonObject<VirtualizationDetail>(
          latest.virtualization,
        ),
        services: this.parseJsonObject<ServicesDetail>(latest.services),
        loadAverage: this.parseNumberArray(latest.loadAverage),
      };
      return detail;
    } catch (error) {
      logger.error(
        `Failed to fetch latest heartbeat data for node ${nodeId}:`,
        error,
      );
      throw new Error("Failed to fetch heartbeat data");
    }
  }

  // 批量更新节点ASN信息
  private withPreferredProvider<
    T extends { provider: string | null; asnName: string | null },
  >(node: T): T {
    return {
      ...node,
      provider: node.asnName || node.provider,
    };
  }

  private parseJsonObject<T extends Record<string, unknown>>(
    value: Prisma.JsonValue | null,
  ): T | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as T;
  }

  private parseNetworkInterfaces(
    value: Prisma.JsonValue | null,
  ): NetworkInterfaceDetail[] | null {
    if (!value || !Array.isArray(value)) {
      return null;
    }

    const interfaces: NetworkInterfaceDetail[] = [];
    for (const entry of value) {
      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        "interface" in entry &&
        typeof (entry as { interface?: unknown }).interface === "string"
      ) {
        interfaces.push(entry as NetworkInterfaceDetail);
      }
    }

    return interfaces;
  }

  private parseNumberArray(value: Prisma.JsonValue | null): number[] | null {
    if (!value || !Array.isArray(value)) {
      return null;
    }

    const numbers = value.filter(
      (item): item is number => typeof item === "number",
    );
    return numbers;
  }

  async updateNodesASN(): Promise<void> {
    try {
      const nodes = await prisma.node.findMany({
        where: {
          AND: [
            {
              OR: [{ asnNumber: null }, { asnNumber: "" }],
            },
            {
              OR: [{ ipv4: { not: null } }, { ipv6: { not: null } }],
            },
          ],
        },
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
              asnType: ipInfo.asn.type,
            });

            logger.info(
              `Updated ASN for node ${node.name}: ${ipInfo.asn.asn} (${ipInfo.asn.name})`,
            );
          }

          // 避免API限制，每次请求间隔500ms
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          logger.warn(`Failed to update ASN for node ${node.name}:`, error);
        }
      }
    } catch (error) {
      logger.error("Failed to update nodes ASN:", error);
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
          status: NodeStatus.OFFLINE,
        },
        select: {
          id: true,
          agentId: true,
          name: true,
          status: true,
          lastSeen: true,
        },
      });

      if (offlineNodes.length === 0) {
        logger.debug("No offline nodes found for recovery check");
        return;
      }

      // 检查这些节点最近是否有心跳
      for (const node of offlineNodes) {
        try {
          const recentHeartbeat = await prisma.heartbeatLog.findFirst({
            where: {
              nodeId: node.id,
              timestamp: {
                gte: recentThreshold,
              },
            },
            orderBy: {
              timestamp: "desc",
            },
          });

          if (recentHeartbeat) {
            // 节点最近有心跳但状态是离线，恢复为在线
            await prisma.node.update({
              where: { id: node.id },
              data: {
                status: NodeStatus.ONLINE,
                lastSeen: recentHeartbeat.timestamp,
              },
              select: { id: true },
            });

            await eventService.createEvent(
              node.id,
              "STATUS_CHANGED",
              `${NodeStatus.OFFLINE} -> ${NodeStatus.ONLINE}`,
              {
                from: NodeStatus.OFFLINE,
                to: NodeStatus.ONLINE,
                reason:
                  "Recovered: Recent heartbeat detected while marked offline",
                heartbeatTimestamp: recentHeartbeat.timestamp,
              },
            );

            logger.info(
              `Recovered node to online: ${node.name} (${node.agentId}) - recent heartbeat: ${recentHeartbeat.timestamp}`,
            );

            // 广播单节点状态变更，确保前端及时刷新
            try {
              const { getIO } = await import("../sockets/ioRegistry");
              const io = getIO();
              if (io) {
                io.to("nodes_updates").emit("node_status_changed", {
                  nodeId: node.id,
                  status: "online",
                  timestamp: new Date().toISOString(),
                });
              }
            } catch {
              // noop: broadcasting failures should not block recovery flow
            }
          }
        } catch (error) {
          logger.error(
            `Failed to check recovery for node ${node.name}:`,
            error,
          );
        }
      }

      // 清理缓存
      this.nodesCache = null;
      this.statsCache = null;
    } catch (error) {
      logger.error("Failed to recover online nodes:", error);
    }
  }

  // 检查并更新长时间未发送心跳的节点状态
  async checkOfflineNodes(offlineThresholdMinutes = 30): Promise<void> {
    try {
      const thresholdTime = new Date();
      thresholdTime.setMinutes(
        thresholdTime.getMinutes() - offlineThresholdMinutes,
      );

      // 查找所有状态为ONLINE但lastSeen时间超过阈值的节点
      const onlineNodes = await prisma.node.findMany({
        where: {
          status: NodeStatus.ONLINE,
          lastSeen: {
            lt: thresholdTime,
          },
        },
        select: {
          id: true,
          agentId: true,
          name: true,
          lastSeen: true,
          status: true,
        },
      });

      if (onlineNodes.length > 0) {
        logger.info(
          `Found ${onlineNodes.length} nodes to mark as offline (no heartbeat for ${offlineThresholdMinutes} minutes)`,
        );

        // 批量更新节点状态为OFFLINE
        for (const node of onlineNodes) {
          try {
            const oldStatus = node.status;
            await prisma.node.update({
              where: { id: node.id },
              data: { status: NodeStatus.OFFLINE },
              select: { id: true },
            });

            // 记录状态变更事件
            await eventService.createEvent(
              node.id,
              "STATUS_CHANGED",
              `${oldStatus} -> ${NodeStatus.OFFLINE}`,
              {
                from: oldStatus,
                to: NodeStatus.OFFLINE,
                reason: `No heartbeat for ${offlineThresholdMinutes} minutes`,
                lastSeen: node.lastSeen,
              },
            );

            logger.info(
              `Node marked as offline: ${node.name} (${node.agentId}) - last seen: ${node.lastSeen}`,
            );

            // 广播单节点状态变更，确保前端及时刷新
            try {
              const { getIO } = await import("../sockets/ioRegistry");
              const io = getIO();
              if (io) {
                io.to("nodes_updates").emit("node_status_changed", {
                  nodeId: node.id,
                  status: "offline",
                  timestamp: new Date().toISOString(),
                });
              }
            } catch {
              // noop: broadcasting failures should not block offline marking
            }
          } catch (error) {
            logger.error(`Failed to mark node ${node.name} as offline:`, error);
          }
        }

        // 清理缓存，确保前端能获取最新状态
        this.nodesCache = null;
        this.statsCache = null;

        logger.info(
          `Successfully marked ${onlineNodes.length} nodes as offline`,
        );
      }
    } catch (error) {
      logger.error("Failed to check offline nodes:", error);
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
              lt: cutoffDate,
            },
          },
        }),
        prisma.diagnosticRecord.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate,
            },
          },
        }),
      ]);

      logger.info(
        `Cleaned up old records: ${deletedHeartbeats.count} heartbeats, ${deletedDiagnostics.count} diagnostics`,
      );
    } catch (error) {
      logger.error("Failed to cleanup old records:", error);
    }
  }

  // 静态方法：计算节点统计信息
  static async calculateStats(nodes: ManagedNode[]): Promise<{
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalCountries: number;
    totalProviders: number;
    totalTraffic: {
      upload: number;
      download: number;
      total: number;
    };
  }> {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(
      (node) => node.status === NodeStatus.ONLINE,
    ).length;
    const offlineNodes = totalNodes - onlineNodes;
    const countries = new Set(nodes.map((node) => node.country));
    const providers = new Set(nodes.map((node) => node.provider));

    // Prefer persisted traffic totals when calculating global usage
    let totalUpload = 0;
    let totalDownload = 0;
    const nodeIds = nodes.map((node) => node.id);

    try {
      if (nodeIds.length > 0) {
        const aggregated = await prisma.trafficStats.aggregate({
          where: { nodeId: { in: nodeIds } },
          _sum: {
            totalUpload: true,
            totalDownload: true,
          },
        });

        const aggregatedUpload = aggregated._sum?.totalUpload;
        const aggregatedDownload = aggregated._sum?.totalDownload;
        const hasPersistentTraffic =
          (aggregatedUpload !== null && aggregatedUpload !== undefined) ||
          (aggregatedDownload !== null && aggregatedDownload !== undefined);

        if (hasPersistentTraffic) {
          totalUpload = Number(aggregatedUpload ?? BigInt(0));
          totalDownload = Number(aggregatedDownload ?? BigInt(0));
        } else {
          const latestHeartbeats = await prisma.heartbeatLog.findMany({
            where: {
              nodeId: { in: nodeIds },
              networkInfo: { not: Prisma.DbNull },
            },
            orderBy: { timestamp: "desc" },
            distinct: ["nodeId"],
            select: {
              nodeId: true,
              networkInfo: true,
            },
          });

          for (const heartbeat of latestHeartbeats) {
            if (
              heartbeat.networkInfo &&
              typeof heartbeat.networkInfo === "object"
            ) {
              const networkData = heartbeat.networkInfo as unknown;

              if (Array.isArray(networkData)) {
                for (const iface of networkData) {
                  if (
                    iface &&
                    typeof iface === "object" &&
                    "bytesReceived" in iface &&
                    "bytesSent" in iface
                  ) {
                    if (typeof iface.bytesReceived === "number") {
                      totalDownload += iface.bytesReceived;
                    }
                    if (typeof iface.bytesSent === "number") {
                      totalUpload += iface.bytesSent;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error("Failed to calculate traffic stats:", error);
      // ����ʱ����0
      totalUpload = 0;
      totalDownload = 0;
    }
    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalCountries: countries.size,
      totalProviders: providers.size,
      totalTraffic: {
        upload: totalUpload,
        download: totalDownload,
        total: totalUpload + totalDownload,
      },
    };
  }
}

export const nodeService = new NodeService();
