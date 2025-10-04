# 安全事件卡片实现总结

## 📋 变更概述

将首页的"网络检测"卡片替换为"安全事件"卡片，显示最近24小时内检测到的安全威胁事件数量。

## 🎯 变更原因

1. **网络检测卡片无用**：
   - 该卡片始终显示 0，没有实际功能
   - 用户已确认网络测试功能存在（客户端到节点的延迟测试），但与此卡片无关
   
2. **安全事件更有价值**：
   - 威胁监控页面（ThreatVisualization.tsx）已经完整实现
   - 可以展示 SSH 暴力破解、入侵检测等真实安全数据
   - 提供更实用的安全态势感知

## 🔧 技术实现

### 前端修改

#### 1. StatsCards.tsx
**文件**: `frontend/src/components/layout/StatsCards.tsx`

**关键变更**:
```tsx
// 更新 props 接口
interface StatsCardsProps {
  totalNodes: number;
  onlineNodes: number;
  securityEvents: number;  // 替换 totalTests
}

// 更新卡片定义
{
  title: '安全事件',
  value: securityEvents > 0 ? securityEvents.toLocaleString() : '0',
  subtitle: securityEvents > 0 ? '检测到威胁' : '系统安全',
  icon: <Shield className="h-6 w-6 text-orange-400" />,
  badge: securityEvents > 0 ? '警惕' : '正常',
  gradient: 'from-orange-500 to-red-500'  // 橙红色渐变
}
```

**图标变更**:
- 移除: `Activity` 图标
- 新增: `Shield` 图标

#### 2. HomePage.tsx
**文件**: `frontend/src/pages/HomePage.tsx`

**关键变更**:
```tsx
const memoizedStats = useMemo(
  () => ({
    totalNodes: stats.totalNodes,
    onlineNodes: stats.onlineNodes,
    securityEvents: stats.securityEvents || 0  // 替换 totalTests
  }),
  [stats]
);
```

#### 3. api.ts
**文件**: `frontend/src/services/api.ts`

**类型定义更新**:
```tsx
export interface NodeStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  totalCountries: number;
  totalProviders: number;
  securityEvents?: number;  // 新增字段
}
```

### 后端修改

#### NodeService.ts
**文件**: `backend/src/services/NodeService.ts`

**关键变更**:

1. **更新返回类型**:
```typescript
async getNodeStats(): Promise<{
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  totalCountries: number;
  totalProviders: number;
  securityEvents: number;  // 新增
}>
```

2. **添加安全事件查询**:
```typescript
// 统计最近24小时的安全事件
const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

const [..., securityEventsCount] = await Promise.all([
  // ... 其他查询
  prisma.eventLog.count({
    where: {
      timestamp: { gte: last24Hours },
      type: {
        in: [
          "SSH_BRUTEFORCE",       // SSH暴力破解
          "INTRUSION_DETECTED",   // 入侵检测
          "MALWARE_DETECTED",     // 恶意软件
          "DDOS_ATTACK",          // DDoS攻击
          "ANOMALY_DETECTED",     // 异常检测
          "SECURITY_ALERT",       // 安全警报
        ],
      },
    },
  }),
]);
```

3. **更新返回数据**:
```typescript
const data = {
  totalNodes,
  onlineNodes: statusMap[NodeStatus.ONLINE] || 0,
  offlineNodes: statusMap[NodeStatus.OFFLINE] || 0,
  unknownNodes: statusMap[NodeStatus.UNKNOWN] || 0,
  totalCountries: countries.length,
  totalProviders: providers.length,
  securityEvents: securityEventsCount,  // 新增
};
```

4. **更新缓存类型**:
```typescript
private statsCache: {
  data: {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    unknownNodes: number;
    totalCountries: number;
    totalProviders: number;
    securityEvents: number;  // 新增
  };
  ts: number;
} | null = null;
```

## 📊 安全事件类型

系统监控以下安全事件类型：

| 事件类型 | 描述 | 数据源 |
|---------|------|--------|
| SSH_BRUTEFORCE | SSH暴力破解攻击 | 心跳数据中的SSH告警 |
| INTRUSION_DETECTED | 入侵检测 | 安全监控模块 |
| MALWARE_DETECTED | 恶意软件检测 | 文件扫描 |
| DDOS_ATTACK | DDoS攻击 | 流量分析 |
| ANOMALY_DETECTED | 异常行为检测 | 行为分析 |
| SECURITY_ALERT | 通用安全警报 | 各模块告警 |

## 🎨 UI 设计

### 视觉效果
- **颜色**: 橙红色渐变 (`from-orange-500 to-red-500`)
- **图标**: Shield（盾牌）图标，橙色
- **状态徽章**:
  - 有威胁时：显示"警惕"（红色）
  - 无威胁时：显示"正常"（绿色）

### 显示逻辑
```typescript
// 有安全事件
安全事件: 5
检测到威胁
[警惕]

// 无安全事件
安全事件: 0
系统安全
[正常]
```

## 📈 数据统计周期

- **时间范围**: 最近 24 小时
- **实时性**: 通过缓存机制，2秒更新一次
- **数据来源**: `event_logs` 表

## 🔗 关联功能

### 威胁监控页面
**文件**: `frontend/src/components/security/ThreatVisualization.tsx`

该页面提供详细的威胁监控功能：
- 实时威胁列表
- 威胁类型过滤（DDoS/暴力破解/恶意软件/入侵/异常）
- 威胁状态统计（活跃/严重/已阻止/调查中）
- 5秒自动刷新
- 详细威胁分析面板

### 数据流程
```
Agent心跳 → EventLog记录 → 后端统计 → 前端展示
     ↓
ThreatVisualization详细分析
```

## ✅ 测试要点

1. **前端显示**:
   - [ ] 卡片标题显示"安全事件"
   - [ ] 图标为盾牌（Shield）
   - [ ] 渐变色为橙红色
   - [ ] 有事件时显示"警惕"徽章
   - [ ] 无事件时显示"正常"徽章

2. **后端数据**:
   - [ ] API 返回 `securityEvents` 字段
   - [ ] 统计最近24小时事件
   - [ ] 包含所有6种安全事件类型
   - [ ] 缓存机制正常工作

3. **集成测试**:
   - [ ] 模拟SSH暴力破解，卡片数字增加
   - [ ] 24小时后事件不再计入统计
   - [ ] 威胁监控页面数据一致

## 📝 文件清单

### 修改的文件
1. `frontend/src/components/layout/StatsCards.tsx` - 卡片组件
2. `frontend/src/pages/HomePage.tsx` - 首页集成
3. `frontend/src/services/api.ts` - API类型定义
4. `backend/src/services/NodeService.ts` - 后端统计逻辑

### 创建的文件
1. `SECURITY_EVENTS_CARD.md` - 本文档

## 🚀 部署说明

### 数据库
无需迁移，使用现有 `event_logs` 表。

### 环境变量
无需新增配置。

### 兼容性
- 向后兼容：`securityEvents` 字段为可选
- 优雅降级：前端默认值为 0

## 🎉 总结

成功将无用的"网络检测"卡片替换为实用的"安全事件"卡片：

✅ **前端**:
- 3个文件修改完成
- TypeScript类型完全一致
- UI设计清晰醒目

✅ **后端**:
- 1个文件修改完成
- 高效查询（24小时窗口）
- 缓存机制优化性能

✅ **数据源**:
- 利用现有EventLog系统
- 6种安全事件类型
- 与威胁监控页面数据一致

**关键优势**:
1. 提供真实有用的安全态势数据
2. 与现有威胁监控功能完美集成
3. 性能优化（缓存 + 24小时窗口）
4. UI醒目（橙红警示色 + 状态徽章）

---

**完成时间**: 2024
**版本**: v2.0.0
**作者**: GitHub Copilot
