// Helpers for shaping safe responses

// 定义公共视图的节点类型（移除敏感字段）
export function sanitizeNode(node: any): any {
  const { apiKey, agentId, ...rest } = node || {};
  return rest;
}

export function sanitizeNodes(nodes: any[]): any[] {
  return nodes.map(sanitizeNode);
}
