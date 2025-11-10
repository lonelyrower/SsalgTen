import type { NodeData } from "@/services/api";

// 扩展节点数据类型，支持微调坐标
export interface ExtendedNodeData extends NodeData {
  _originalLat?: number;
  _originalLng?: number;
}

// 处理相同坐标的节点重叠问题：坐标微调(jittering)
export const jitterCoordinates = (nodes: NodeData[]): ExtendedNodeData[] => {
  const coordinateGroups = new Map<string, NodeData[]>();

  // 按坐标分组
  nodes.forEach((node) => {
    const key = `${node.latitude.toFixed(6)},${node.longitude.toFixed(6)}`;
    if (!coordinateGroups.has(key)) {
      coordinateGroups.set(key, []);
    }
    coordinateGroups.get(key)!.push(node);
  });

  // 为重叠节点添加微调
  const jitteredNodes: ExtendedNodeData[] = [];
  coordinateGroups.forEach((groupNodes) => {
    if (groupNodes.length === 1) {
      // 单个节点直接添加
      jitteredNodes.push(groupNodes[0]);
    } else {
      // 多个节点需要微调坐标
      groupNodes.forEach((node, index) => {
        const jitterRadius = 0.001; // 扩大微调半径到约100米，减少聚合重叠
        const angle = (index * 2 * Math.PI) / groupNodes.length; // 均匀分布角度
        const distance =
          jitterRadius * (0.5 + 0.5 * (index / groupNodes.length)); // 渐变距离

        const latOffset = distance * Math.cos(angle);
        const lngOffset = distance * Math.sin(angle);

        jitteredNodes.push({
          ...node,
          // 保存原始坐标用于显示
          _originalLat: node.latitude,
          _originalLng: node.longitude,
          // 使用微调后的坐标用于地图显示
          latitude: node.latitude + latOffset,
          longitude: node.longitude + lngOffset,
        });
      });
    }
  });

  return jitteredNodes;
};
