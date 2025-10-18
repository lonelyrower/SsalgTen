import { Request, Response } from "express";
import axios from "axios";
import { nodeService } from "../services/NodeService";
import { logger } from "../utils/logger";
import { getSystemConfig } from "../utils/initSystemConfig";

const envProxyEnabled =
  (process.env.DIAGNOSTICS_PROXY_ENABLED ?? "true").toLowerCase() === "true";

// Basic target validation similar to agent
const isValidTarget = (target: string): boolean => {
  if (!target) return false;
  if (/[;|&`$<>\\\s]/.test(target)) return false;
  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 regex - supports all valid IPv6 formats including compressed notation
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  const domainRegex =
    /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
  return (
    ipv4Regex.test(target) || ipv6Regex.test(target) || domainRegex.test(target)
  );
};

const ensureEnabled = async (res: Response): Promise<boolean> => {
  try {
    const flag = await getSystemConfig<boolean>(
      "diagnostics.proxy_enabled",
      true, // 默认启用诊断代理
    );
    if (!flag) {
      res.status(403).json({
        success: false,
        error: "Diagnostics proxy is disabled by server configuration",
      });
      return false;
    }
    return true;
  } catch (error) {
    // 读取配置失败时，使用环境变量或默认启用
    logger.warn(
      "Failed to read diagnostics.proxy_enabled config, using fallback:",
      error,
    );
    // 环境变量默认也是 true，所以这里基本上总是启用
    if (!envProxyEnabled) {
      res
        .status(403)
        .json({ success: false, error: "Diagnostics proxy is disabled" });
      return false;
    }
    return true;
  }
};

const buildAgentEndpoint = (node: {
  ipv4?: string | null;
  ipv6?: string | null;
}): string | null => {
  const host = node?.ipv4 || node?.ipv6;
  if (!host) return null;
  const formattedHost = host.includes(":") ? `[${host}]` : host;
  return `http://${formattedHost}:3002`;
};

export class DiagnosticsProxyController {
  async ping(req: Request, res: Response): Promise<void> {
    try {
      if (!(await ensureEnabled(res))) return;
      const { id } = req.params; // nodeId
      const { target, count } = req.query as {
        target?: string;
        count?: string;
      };
      if (!target || !isValidTarget(String(target))) {
        res.status(400).json({ success: false, error: "Invalid target" });
        return;
      }
      const node = await nodeService.getNodeById(id);
      if (!node) {
        res.status(404).json({ success: false, error: "Node not found" });
        return;
      }
      const endpoint = buildAgentEndpoint(node);
      if (!endpoint) {
        res
          .status(400)
          .json({ success: false, error: "Node has no reachable IP" });
        return;
      }
      const url = `${endpoint}/api/ping/${encodeURIComponent(String(target))}${count ? `?count=${encodeURIComponent(String(count))}` : ""}`;
      const r = await axios.get(url, { timeout: 60000 });
      res.status(r.status).json(r.data);
    } catch (e) {
      logger.error("Proxy ping failed:", e);
      res.status(500).json({ success: false, error: "Proxy ping failed" });
    }
  }

  async traceroute(req: Request, res: Response): Promise<void> {
    try {
      if (!(await ensureEnabled(res))) return;
      const { id } = req.params;
      const { target, maxHops } = req.query as {
        target?: string;
        maxHops?: string;
      };
      if (!target || !isValidTarget(String(target))) {
        res.status(400).json({ success: false, error: "Invalid target" });
        return;
      }
      const node = await nodeService.getNodeById(id);
      if (!node) {
        res.status(404).json({ success: false, error: "Node not found" });
        return;
      }
      const endpoint = buildAgentEndpoint(node);
      if (!endpoint) {
        res
          .status(400)
          .json({ success: false, error: "Node has no reachable IP" });
        return;
      }
      const qp = maxHops
        ? `?maxHops=${encodeURIComponent(String(maxHops))}`
        : "";
      const url = `${endpoint}/api/traceroute/${encodeURIComponent(String(target))}${qp}`;
      const r = await axios.get(url, { timeout: 60000 });
      res.status(r.status).json(r.data);
    } catch (e) {
      logger.error("Proxy traceroute failed:", e);
      res
        .status(500)
        .json({ success: false, error: "Proxy traceroute failed" });
    }
  }

  async mtr(req: Request, res: Response): Promise<void> {
    try {
      if (!(await ensureEnabled(res))) return;
      const { id } = req.params;
      const { target, count } = req.query as {
        target?: string;
        count?: string;
      };
      if (!target || !isValidTarget(String(target))) {
        res.status(400).json({ success: false, error: "Invalid target" });
        return;
      }
      const node = await nodeService.getNodeById(id);
      if (!node) {
        res.status(404).json({ success: false, error: "Node not found" });
        return;
      }
      const endpoint = buildAgentEndpoint(node);
      if (!endpoint) {
        res
          .status(400)
          .json({ success: false, error: "Node has no reachable IP" });
        return;
      }
      const qp = count ? `?count=${encodeURIComponent(String(count))}` : "";
      const url = `${endpoint}/api/mtr/${encodeURIComponent(String(target))}${qp}`;
      const r = await axios.get(url, { timeout: 120000 });
      res.status(r.status).json(r.data);
    } catch (e) {
      logger.error("Proxy mtr failed:", e);
      res.status(500).json({ success: false, error: "Proxy mtr failed" });
    }
  }

  async speedtest(req: Request, res: Response): Promise<void> {
    try {
      if (!(await ensureEnabled(res))) return;
      const { id } = req.params;
      const node = await nodeService.getNodeById(id);
      if (!node) {
        res.status(404).json({ success: false, error: "Node not found" });
        return;
      }
      const endpoint = buildAgentEndpoint(node);
      if (!endpoint) {
        res
          .status(400)
          .json({ success: false, error: "Node has no reachable IP" });
        return;
      }
      const url = `${endpoint}/api/speedtest`;
      const r = await axios.get(url, { timeout: 180000 });
      res.status(r.status).json(r.data);
    } catch (e) {
      logger.error("Proxy speedtest failed:", e);
      res.status(500).json({ success: false, error: "Proxy speedtest failed" });
    }
  }

  async latencyTest(req: Request, res: Response): Promise<void> {
    try {
      if (!(await ensureEnabled(res))) return;
      const { id } = req.params;
      const { testType } = req.query as { testType?: string };
      const node = await nodeService.getNodeById(id);
      if (!node) {
        res.status(404).json({ success: false, error: "Node not found" });
        return;
      }
      const endpoint = buildAgentEndpoint(node);
      if (!endpoint) {
        res
          .status(400)
          .json({ success: false, error: "Node has no reachable IP" });
        return;
      }
      const qp = testType
        ? `?testType=${encodeURIComponent(String(testType))}`
        : "";
      const url = `${endpoint}/api/latency-test${qp}`;
      const r = await axios.get(url, { timeout: 60000 });
      res.status(r.status).json(r.data);
    } catch (e) {
      logger.error("Proxy latency test failed:", e);
      res
        .status(500)
        .json({ success: false, error: "Proxy latency test failed" });
    }
  }
}

export const diagnosticsProxyController = new DiagnosticsProxyController();
