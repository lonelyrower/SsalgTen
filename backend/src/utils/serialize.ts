// Helpers for shaping safe responses

// 定义公共视图的节点类型（移除敏感字段）
export function sanitizeNode(
  node: Record<string, unknown>,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _apiKey, agentId: _agentId, ...rest } = node || {};
  return rest;
}

export function sanitizeNodes(
  nodes: Record<string, unknown>[],
): Record<string, unknown>[] {
  return nodes.map(sanitizeNode);
}
