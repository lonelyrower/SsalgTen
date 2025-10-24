import { Prisma } from "@prisma/client";

// Helpers for shaping safe responses

// ���幫����ͼ�Ľڵ����ͣ��Ƴ������ֶΣ�
export function sanitizeNode(
  node: Record<string, unknown>,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _apiKey, agentId: _agentId, ...rest } = node || {};

  // Convert BigInt/Decimal fields to JSON-friendly primitives
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === "bigint") {
      result[key] = value.toString();
    } else if (value instanceof Prisma.Decimal) {
      result[key] = value.toNumber();
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function sanitizeNodes(
  nodes: Record<string, unknown>[],
): Record<string, unknown>[] {
  return nodes.map(sanitizeNode);
}
