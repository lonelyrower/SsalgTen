import { z } from "zod";

export const AgentRegisterSchema = z
  .object({
    agentId: z.string().min(1),
    apiKey: z.string().optional(),
    nodeInfo: z
      .object({
        name: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        provider: z.string().optional(),
        ipv4: z.string().optional(),
        ipv6: z.string().optional(),
      })
      .partial()
      .optional(),
    systemInfo: z
      .object({
        platform: z.string().optional(),
        version: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .strict();

export const AgentHeartbeatSchema = z
  .object({
    status: z.string().min(1),
    uptime: z.number().optional(),
    cpuUsage: z.number().min(0).max(100).optional(),
    memoryUsage: z.number().min(0).max(100).optional(),
    diskUsage: z.number().min(0).max(100).optional(),
    connectivity: z.any().optional(),
    systemInfo: z
      .object({
        cpu: z.any().optional(),
        memory: z.any().optional(),
        disk: z.any().optional(),
        network: z.any().optional(),
        processes: z.any().optional(),
        virtualization: z.any().optional(),
        services: z.any().optional(),
        loadAverage: z.any().optional(),
      })
      .partial()
      .optional(),
    nodeIPs: z
      .object({ ipv4: z.string().optional(), ipv6: z.string().optional() })
      .partial()
      .optional(),
  })
  .strict();

export const AgentDiagnosticSchema = z
  .object({
    type: z.enum(["PING", "TRACEROUTE", "MTR", "SPEEDTEST", "LATENCY_TEST"]),
    target: z.string().optional(),
    success: z.boolean(),
    result: z.any(),
    error: z.string().optional(),
    duration: z.number().optional(),
  })
  .strict();
