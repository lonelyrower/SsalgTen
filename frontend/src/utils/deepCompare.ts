// 深度比较两个对象是否相等
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true;
  }

  if (obj1 == null || obj2 == null) {
    return obj1 === obj2;
  }

  if (typeof obj1 !== typeof obj2) {
    return false;
  }

  if (typeof obj1 !== 'object') {
    return obj1 === obj2;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }

    if (!deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

// 比较两个节点数组是否相等（用于避免不必要的渲染）
export function compareNodes(nodes1: any[], nodes2: any[]): boolean {
  if (nodes1.length !== nodes2.length) {
    return false;
  }

  return nodes1.every((node1, index) => {
    const node2 = nodes2[index];
    // 只比较关键字段，忽略时间戳等可能频繁变化的字段
    return (
      node1.id === node2.id &&
      node1.status === node2.status &&
      node1.name === node2.name &&
      node1.country === node2.country &&
      node1.city === node2.city &&
      node1.provider === node2.provider
    );
  });
}

// 比较统计数据是否相等
export function compareStats(stats1: any, stats2: any): boolean {
  if (!stats1 || !stats2) {
    return stats1 === stats2;
  }

  return (
    stats1.totalNodes === stats2.totalNodes &&
    stats1.onlineNodes === stats2.onlineNodes &&
    stats1.offlineNodes === stats2.offlineNodes &&
    stats1.unknownNodes === stats2.unknownNodes &&
    stats1.totalCountries === stats2.totalCountries &&
    stats1.totalProviders === stats2.totalProviders
  );
}