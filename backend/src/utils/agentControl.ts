import crypto from "crypto";
import { URL } from "node:url";
import { env } from "../config/env";
import { apiKeyService } from "../services/ApiKeyService";
import { logger } from "./logger";

const AGENT_CONTROL_PROTOCOL = env.AGENT_CONTROL_PROTOCOL || "http";
const AGENT_CONTROL_PORT = env.AGENT_CONTROL_PORT || 3002;
const FALLBACK_AGENT_CONTROL_API_KEY =
  env.AGENT_CONTROL_API_KEY || env.DEFAULT_AGENT_API_KEY;

export type AgentApiKeySource = "system" | "fallback" | "node";

export const buildAgentBaseUrl = (node: {
  ipv4?: string | null;
  ipv6?: string | null;
}): string | null => {
  if (node.ipv4 && node.ipv4.trim().length > 0) {
    return `${AGENT_CONTROL_PROTOCOL}://${node.ipv4}:${AGENT_CONTROL_PORT}`;
  }
  if (node.ipv6 && node.ipv6.trim().length > 0) {
    return `${AGENT_CONTROL_PROTOCOL}://[${node.ipv6}]:${AGENT_CONTROL_PORT}`;
  }
  return null;
};

export const resolveAgentControlApiKey = async (): Promise<{
  key: string;
  source: AgentApiKeySource;
} | null> => {
  try {
    const key = await apiKeyService.getSystemApiKey();
    if (key && key.trim().length > 0) {
      return { key: key.trim(), source: "system" };
    }
  } catch (error) {
    logger.error(
      "[agentControl] Failed to resolve system agent API key:",
      error,
    );
  }

  const fallback = FALLBACK_AGENT_CONTROL_API_KEY?.trim();
  if (fallback) {
    if (!apiKeyService.isSecureAgentApiKey(fallback)) {
      logger.error(
        "[agentControl] Environment agent API key is not secure. Refusing to use fallback value.",
      );
      return null;
    }
    logger.warn(
      "[agentControl] Falling back to environment agent API key. Verify system API key configuration if issues persist.",
    );
    return { key: fallback, source: "fallback" };
  }

  return null;
};

export const resolveAgentApiKeyForNode = async (node: {
  apiKey?: string | null;
}): Promise<{ key: string; source: AgentApiKeySource } | null> => {
  const resolved = await resolveAgentControlApiKey();
  if (resolved) {
    return resolved;
  }

  if (node.apiKey && node.apiKey.trim().length > 0) {
    logger.warn("[agentControl] Using node-specific API key as fallback.");
    return { key: node.apiKey.trim(), source: "node" };
  }

  logger.error("[agentControl] Unable to resolve agent API key.");
  return null;
};

const buildRequestPath = (requestUrl: string): string => {
  const parsed = new URL(requestUrl);
  return `${parsed.pathname}${parsed.search}`;
};

const buildControlSignature = (
  apiKey: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body?: unknown,
): string => {
  const payload = `${timestamp}.${method.toUpperCase()}.${requestPath}.${JSON.stringify(body ?? {})}`;
  return crypto.createHmac("sha256", apiKey).update(payload).digest("hex");
};

export const buildSignedAgentHeaders = (
  apiKey: string,
  method: string,
  requestUrl: string,
  body?: unknown,
): Record<string, string> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString("hex");
  const requestPath = buildRequestPath(requestUrl);

  return {
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": buildControlSignature(
      apiKey,
      timestamp,
      method,
      requestPath,
      body,
    ),
  };
};
