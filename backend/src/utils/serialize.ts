export type NodeVisibility = "public" | "authenticated";

const PUBLIC_HIDDEN_FIELDS = new Set([
  "agentId",
  "hostname",
  "ipv4",
  "ipv6",
  "asnNumber",
  "asnName",
  "asnOrg",
  "asnRoute",
  "asnType",
  "datacenter",
  "monthlyCost",
  "nameCustomized",
  "tags",
  "description",
  "osType",
  "osVersion",
  "createdAt",
  "updatedAt",
  "_count",
  "lastHeartbeat",
  "uptime",
  "cpuUsage",
  "memoryUsage",
  "diskUsage",
  "loadAverage",
  "totalUpload",
  "totalDownload",
  "periodUpload",
  "periodDownload",
  "isPlaceholder",
  "neverAdopt",
]);

function isDecimalLike(value: unknown): value is { toNumber: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  );
}

export function sanitizeNode(
  node: Record<string, unknown>,
  visibility: NodeVisibility = "authenticated",
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _apiKey, ...rest } = node || {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (visibility === "public" && PUBLIC_HIDDEN_FIELDS.has(key)) {
      continue;
    }
    if (typeof value === "bigint") {
      result[key] = value.toString();
    } else if (isDecimalLike(value)) {
      result[key] = value.toNumber();
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function sanitizeNodes(
  nodes: Record<string, unknown>[],
  visibility: NodeVisibility = "authenticated",
): Record<string, unknown>[] {
  return nodes.map((node) => sanitizeNode(node, visibility));
}
