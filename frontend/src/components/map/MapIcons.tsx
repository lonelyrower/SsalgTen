import { DivIcon } from "leaflet";
import { Activity, AlertTriangle, Clock, Server } from "lucide-react";

const ICON_CACHE = new Map<string, DivIcon>();

// 状态对应的颜色和图标
export const getNodeStyle = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "online":
      return {
        color: "#22c55e",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        icon: Activity,
        pulse: true,
      };
    case "offline":
      return {
        color: "#ef4444",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        icon: AlertTriangle,
        pulse: false,
      };
    case "maintenance":
      return {
        color: "#f59e0b",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        icon: Clock,
        pulse: false,
      };
    default:
      return {
        color: "#6b7280",
        bgColor: "bg-gray-50",
        textColor: "text-gray-700",
        icon: Server,
        pulse: false,
      };
  }
};

// 创建增强的自定义图标
export const createEnhancedIcon = (status: string, isSelected: boolean = false) => {
  const normalizedStatus = (status || "unknown").toLowerCase();
  const cacheKey = `${normalizedStatus}-${isSelected ? "selected" : "default"}`;
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const style = getNodeStyle(normalizedStatus);
  const size = isSelected ? 24 : 18;
  const pulseClass = style.pulse ? "animate-pulse" : "";
  const selectedClass = isSelected ? "transform scale-125" : "";

  const icon = new DivIcon({
    html: `
      <div class="flex items-center justify-center ${selectedClass} ${pulseClass}"
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center"
             style="background-color: ${style.color};">
          <div class="rounded-full" style="width: 6px; height: 6px; background-color: #ffffff;"></div>
        </div>
      </div>
    `,
    className: "custom-enhanced-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

// 创建访客位置图标
export const createVisitorIcon = (isMatchingNode: boolean = false) => {
  const cacheKey = `visitor-${isMatchingNode ? "matching" : "default"}`;
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const size = 28;
  const color = isMatchingNode ? "#8b5cf6" : "#ec4899"; // 紫色（匹配）或粉色（默认）

  const icon = new DivIcon({
    html: `
      <div class="flex items-center justify-center animate-pulse"
           style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full border-3 border-white shadow-2xl flex items-center justify-center"
             style="background: linear-gradient(135deg, ${color}, ${color}DD);">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-visitor-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

// 创建聚合节点图标（基于 supercluster 返回的统计）
export const createClusterIcon = (
  count: number,
  offline: number = 0,
  online: number = 0,
) => {
  // 调整聚合点大小，使其更接近常规点大小
  // 基础大小22px，根据节点数量略微增大，最大不超过32px
  const size = Math.min(22 + Math.log2(count + 1) * 2, 32);

  // 根据在线/离线状态确定颜色 - 简化的3色方案
  let primaryColor: string;
  if (offline === 0) {
    // 全部在线：绿色
    primaryColor = "#22c55e";
  } else if (online === 0) {
    // 全部离线：红色
    primaryColor = "#ef4444";
  } else {
    // 混合状态（有在线有离线）：蓝色
    primaryColor = "#2563eb";
  }

  const fontSize = Math.max(10, size / 2.8);
  return new DivIcon({
    html: `
      <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full shadow-md flex items-center justify-center text-white font-semibold"
             style="background: radial-gradient(100% 100% at 50% 0%, ${primaryColor}, ${primaryColor}CC); border: 2px solid rgba(255,255,255,0.8); font-size: ${fontSize}px;">
          ${count}
        </div>
      </div>
    `,
    className: "custom-cluster-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};
