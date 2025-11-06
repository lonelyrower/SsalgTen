import type { NodeService } from "@/types/services";

const BASIC_SERVICE_EXACT = ["docker", "containerd"];
const BASIC_SERVICE_CONTAINS = ["ssalgten agent", "ssalgten-agent", "ssalgten_agent"];

const SHARE_LINK_PREFIXES = [
  "vmess://",
  "vless://",
  "trojan://",
  "ss://",
  "ssr://",
  "socks://",
  "hy://",
  "hysteria://",
  "http://",
  "https://",
];

const SHARE_LINK_CANDIDATE_KEYS = [
  "shareLink",
  "sharelink",
  "share_link",
  "shareLinks",
  "links",
  "link",
  "url",
  "urls",
  "subscription",
  "subscribe",
];

const PROTOCOL_SEPARATOR_REGEX = /[,\s|/，]+/;
const SHARE_LINK_SCHEME_REGEX = /^([a-z0-9+.-]+):\/\//i;

type DetailsRecord = Record<string, unknown>;

const asRecord = (value?: Record<string, unknown>): DetailsRecord | undefined =>
  value && typeof value === "object" ? value : undefined;

const collectStrings = (value: unknown, target: Set<string>) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      target.add(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, target));
  }
};

const looksLikeShareLink = (value: string): boolean => {
  const lower = value.toLowerCase();
  return SHARE_LINK_PREFIXES.some((prefix) => lower.startsWith(prefix)) || lower.includes("://");
};

const addProtocolCandidate = (value: string, target: Set<string>) => {
  value
    .split(PROTOCOL_SEPARATOR_REGEX)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => target.add(item.toLowerCase()));
};

function collectShareLinks(service: NodeService): string[] {
  const details = asRecord(service.details);
  if (!details) {
    return [];
  }

  const values = new Set<string>();

  SHARE_LINK_CANDIDATE_KEYS.forEach((key) => {
    if (key in details) {
      collectStrings(details[key], values);
    }
  });

  Object.values(details).forEach((value) => collectStrings(value, values));

  return Array.from(values).filter(looksLikeShareLink);
}

export const isBaseService = (service: NodeService): boolean => {
  const name = (service.name || "").toLowerCase().trim();
  if (!name) return false;

  // 检查精确匹配
  if (BASIC_SERVICE_EXACT.includes(name)) return true;

  // 检查包含匹配
  if (BASIC_SERVICE_CONTAINS.some((pattern) => name.includes(pattern))) return true;

  // 检查 agent 容器
  if (name === "agent" && service.type === "container") return true;

  // 检查容器镜像名称
  if (service.containerInfo && typeof service.containerInfo === "object") {
    const info = service.containerInfo as DetailsRecord;
    const image = typeof info.image === "string" ? info.image.toLowerCase() : "";
    if (image.includes("ssalgten-agent") || image.includes("ssalgten_agent")) {
      return true;
    }
  }

  // 检查服务类型为 CONTAINER 且名称匹配基础服务
  if (service.type === "container") {
    // Docker 容器本身
    if (name.includes("docker") || name.includes("containerd")) {
      return true;
    }
  }

  // 检查数据库服务
  if (service.type === "database") {
    return true;
  }

  return false;
};

export const getServiceProtocols = (service: NodeService): string[] => {
  const candidates = new Set<string>();

  const addIfString = (value?: string) => {
    if (typeof value === "string" && value.trim().length > 0) {
      addProtocolCandidate(value, candidates);
    }
  };

  addIfString(service.protocol);
  addIfString(service.access?.protocol);

  const details = asRecord(service.details);
  if (details) {
    const directKeys = ["protocol", "type", "transport", "network"];
    directKeys.forEach((key) => {
      const value = details[key];
      if (typeof value === "string" && value.trim().length > 0) {
        addProtocolCandidate(value, candidates);
      }
    });

    const transport = details.transport;
    if (transport && typeof transport === "object" && !Array.isArray(transport)) {
      const transportRecord = transport as DetailsRecord;
      const transportType = transportRecord.type;
      if (typeof transportType === "string" && transportType.trim().length > 0) {
        addProtocolCandidate(transportType, candidates);
      }
    }
  }

  collectShareLinks(service).forEach((link) => {
    const match = SHARE_LINK_SCHEME_REGEX.exec(link.trim());
    if (match && match[1]) {
      addProtocolCandidate(match[1], candidates);
    }
  });

  return Array.from(candidates);
};

export const getServiceProtocol = (service: NodeService): string | undefined => {
  const [first] = getServiceProtocols(service);
  return first;
};

export const getServicePort = (service: NodeService): number | undefined =>
  service.port ?? service.access?.port ?? undefined;

// 获取服务的所有端口（用于有多个配置的场景，如Xray多端口）
export const getAllServicePorts = (service: NodeService): number[] => {
  const ports = new Set<number>();

  // 添加主端口
  if (service.port) {
    ports.add(service.port);
  }

  if (service.access?.port) {
    ports.add(service.access.port);
  }

  // 从 details 中提取端口
  const details = asRecord(service.details);
  if (details) {
    // 查找常见的端口字段
    const portKeys = ['port', 'ports', 'listen', 'listenPort', 'inbound', 'inbounds'];

    portKeys.forEach((key) => {
      const value = details[key];
      if (typeof value === 'number' && value > 0 && value <= 65535) {
        ports.add(value);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'number' && item > 0 && item <= 65535) {
            ports.add(item);
          } else if (typeof item === 'object' && item !== null) {
            const itemPort = (item as Record<string, unknown>).port;
            if (typeof itemPort === 'number' && itemPort > 0 && itemPort <= 65535) {
              ports.add(itemPort);
            }
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        const objPort = (value as Record<string, unknown>).port;
        if (typeof objPort === 'number' && objPort > 0 && objPort <= 65535) {
          ports.add(objPort);
        }
      }
    });
  }

  return Array.from(ports).sort((a, b) => a - b);
};

export const getServiceDomains = (service: NodeService): string[] => {
  const domains = new Set<string>();

  if (Array.isArray(service.domains)) {
    service.domains
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .forEach((domain) => domains.add(domain.trim()));
  }

  if (typeof service.access?.domain === "string" && service.access.domain.trim().length > 0) {
    domains.add(service.access.domain.trim());
  }

  return Array.from(domains);
};

export const getPrimaryDomain = (service: NodeService): string | undefined => {
  const [primary] = getServiceDomains(service);
  return primary;
};

export const getServiceShareLinks = (service: NodeService): string[] =>
  collectShareLinks(service);
