# 504超时问题修复 & 节点安全事件集成

## 📋 问题描述

1. **504超时问题**: 系统管理 → 节点管理子页面出现 `HTTP error! status: 504`
2. **节点安全事件**: 需要在节点详情的事件区块中显示安全威胁事件

---

## 🔧 修复内容

### 1. 504超时问题修复

#### 问题根因
- `getAllNodes()` 查询所有heartbeat_logs数据，数据量大时导致查询超时
- 前端API请求没有超时控制，长时间等待导致504网关超时

#### 修复方案

**Backend优化** (`backend/src/services/NodeService.ts`):

1. **添加查询超时保护**:
   ```typescript
   const queryTimeout = new Promise<never>((_, reject) => {
     setTimeout(() => reject(new Error("Query timeout")), 30000); // 30秒超时
   });
   const result = await Promise.race([nodesQuery, queryTimeout]);
   ```

2. **优化SQL查询**:
   ```sql
   -- 只查询最近7天的心跳数据，而不是全部
   WHERE "timestamp" > NOW() - INTERVAL '7 days'
   ```

3. **智能降级**:
   ```typescript
   // 查询失败时返回缓存数据而不是抛错
   if (this.nodesCache && this.nodesCache.data.length > 0) {
     logger.warn("Returning stale cache due to query error");
     return this.nodesCache.data;
   }
   ```

**Frontend优化** (`frontend/src/services/api.ts`):

1. **添加60秒超时控制**:
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 60000);
   
   const response = await fetch(url, {
     ...options,
     signal: controller.signal,
   });
   ```

2. **超时错误友好提示**:
   ```typescript
   if (error instanceof Error && error.name === 'AbortError') {
     return {
       success: false,
       error: '请求超时，请刷新页面重试'
     };
   }
   ```

---

### 2. 节点安全事件集成

#### 实现方案

**数据模型**:
- 使用现有的 `EventLog` 表存储安全事件
- 通过 `type` 字段区分安全事件类型：
  - `SSH_BRUTEFORCE` - SSH暴力破解
  - `MALWARE_DETECTED` - 恶意软件检测
  - `DDOS_ATTACK` - DDoS攻击
  - `INTRUSION_DETECTED` - 入侵检测
  - `ANOMALY_DETECTED` - 异常检测
  - `SUSPICIOUS_ACTIVITY` - 可疑活动

**Backend API** (`backend/src/controllers/NodeController.ts`):

1. **修改 `getNodeById` API**:
   ```typescript
   // 获取节点最近24小时的安全事件
   const securityEvents = await prisma.eventLog.findMany({
     where: {
       nodeId: id,
       timestamp: {
         gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
       },
       type: {
         in: [
           "SSH_BRUTEFORCE",
           "MALWARE_DETECTED",
           "DDOS_ATTACK",
           "INTRUSION_DETECTED",
           "ANOMALY_DETECTED",
           "SUSPICIOUS_ACTIVITY",
         ],
       },
     },
     orderBy: { timestamp: "desc" },
     take: 20,
   });
   ```

2. **格式化安全事件**:
   ```typescript
   const formattedSecurityEvents = securityEvents.map((event) => ({
     id: event.id,
     type: event.type,
     severity:
       event.type === "MALWARE_DETECTED" ||
       event.type === "DDOS_ATTACK" ||
       event.type === "INTRUSION_DETECTED"
         ? "critical"
         : "warning",
     description: event.message || "",
     timestamp: event.timestamp.toISOString(),
     metadata: event.details as Record<string, unknown> | undefined,
   }));
   ```

**Frontend界面** (`frontend/src/pages/NodesPage.tsx`):

1. **扩展事件类型标签**:
   ```typescript
   const eventTypeLabel = (type: string) => {
     const map: Record<string, string> = {
       // ... 原有类型
       SSH_BRUTEFORCE: 'SSH暴力破解',
       MALWARE_DETECTED: '恶意软件检测',
       DDOS_ATTACK: 'DDoS攻击',
       INTRUSION_DETECTED: '入侵检测',
       ANOMALY_DETECTED: '异常检测',
       SUSPICIOUS_ACTIVITY: '可疑活动',
     };
     return map[type] || type;
   };
   ```

2. **安全事件专属显示区域**:
   ```tsx
   {/* 安全威胁事件 - 红色高亮显示 */}
   {selectedNode?.securityEvents && selectedNode.securityEvents.length > 0 && (
     <div className="mb-4">
       <h5 className="text-sm font-semibold text-red-600 mb-2 flex items-center">
         <span className="mr-2">🛡️</span>
         安全威胁 ({selectedNode.securityEvents.length})
       </h5>
       <ul className="divide-y divide-red-100">
         {selectedNode.securityEvents.map((event) => (
           <li key={event.id} className="py-2">
             <span className={`px-2 py-0.5 rounded text-xs ${
               event.severity === 'critical' 
                 ? 'bg-red-100 text-red-800' 
                 : 'bg-yellow-100 text-yellow-800'
             }`}>
               {eventTypeLabel(event.type)}
             </span>
             <span className="text-sm">{event.description}</span>
           </li>
         ))}
       </ul>
     </div>
   )}
   
   {/* 常规事件列表 */}
   <div>
     <h5 className="text-sm font-semibold text-gray-600 mb-2">常规事件</h5>
     {/* ... */}
   </div>
   ```

**类型定义** (`frontend/src/services/api.ts`):

```typescript
export interface NodeData {
  // ... 原有字段
  securityEvents?: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

---

## 📊 实现效果

### 节点详情页面

#### 事件区块布局
```
┌─────────────────────────────────────────┐
│ 事件                         [筛选: 全部] │
├─────────────────────────────────────────┤
│ 🛡️ 安全威胁 (3)                         │
│ ┌─────────────────────────────────────┐ │
│ │ [恶意软件检测] 检测到挖矿程序: XMRig │ │
│ │                      2024-10-04 12:00│ │
│ ├─────────────────────────────────────┤ │
│ │ [DDoS攻击] SYN Flood攻击              │ │
│ │                      2024-10-04 11:30│ │
│ ├─────────────────────────────────────┤ │
│ │ [SSH暴力破解] 来自192.168.1.100       │ │
│ │                      2024-10-04 10:15│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 常规事件                                 │
│ ┌─────────────────────────────────────┐ │
│ │ [IP变更] IPv4从1.2.3.4变更为5.6.7.8  │ │
│ │                      2024-10-04 09:00│ │
│ ├─────────────────────────────────────┤ │
│ │ [状态变更] 从offline变更为online      │ │
│ │                      2024-10-04 08:00│ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### 颜色方案
- **Critical安全事件**: 红色背景 (`bg-red-100 text-red-800`)
- **Warning安全事件**: 黄色背景 (`bg-yellow-100 text-yellow-800`)
- **常规事件**: 蓝色/紫色/灰色背景

---

## 🧪 测试验证

### 1. 504超时修复验证

```bash
# 1. 启动服务
docker-compose up -d

# 2. 访问节点管理页面
# http://localhost:3000/admin
# → 点击"节点管理"子页面

# 预期结果:
# - 页面在60秒内加载完成
# - 如果后端查询超过30秒，使用缓存数据
# - 不再出现504错误
```

### 2. 安全事件显示验证

```bash
# 1. 模拟创建安全事件（在backend数据库中）
docker exec -it ssalgten-backend-1 npx prisma studio

# 2. 在event_logs表中创建测试数据:
# - nodeId: [选择一个节点ID]
# - type: "MALWARE_DETECTED"
# - message: "检测到挖矿程序: XMRig"
# - details: {"process": {"name": "xmrig", "cpu": 95}}
# - timestamp: [当前时间]

# 3. 刷新前端节点详情页面

# 预期结果:
# - 事件区块顶部显示"🛡️ 安全威胁 (1)"
# - 显示红色高亮的安全事件
# - 事件描述正确显示
# - 时间戳正确显示
```

### 3. 性能测试

```bash
# 测试大量节点场景
# 1. 检查查询时间
time curl http://localhost:3000/api/nodes

# 2. 检查是否触发缓存
# 第一次请求: 查询数据库
# 第二次请求: 命中缓存（如在缓存TTL内）

# 3. 监控日志
docker-compose logs -f backend | grep -E "getAllNodes|Query timeout|cache"
```

---

## 📝 注意事项

### 1. 数据库优化建议

如果节点数量超过100个或heartbeat_logs数据量超大，建议：

```sql
-- 1. 为heartbeat_logs添加复合索引
CREATE INDEX idx_heartbeat_logs_node_timestamp 
ON heartbeat_logs(nodeId, timestamp DESC);

-- 2. 定期清理旧数据
DELETE FROM heartbeat_logs 
WHERE timestamp < NOW() - INTERVAL '30 days';

-- 3. 为event_logs添加索引
CREATE INDEX idx_event_logs_node_type_timestamp
ON event_logs(nodeId, type, timestamp DESC);
```

### 2. 缓存配置

当前缓存TTL为5秒（`backend/src/services/NodeService.ts`）:

```typescript
// 如需调整缓存时间
private nodesCacheTtlMs = 5000; // 改为10000 = 10秒
```

### 3. 安全事件数据来源

当前安全事件需要Agent发送，确保Agent端已集成：
- ProcessMonitor (挖矿检测)
- NetworkMonitor (DDoS检测)
- FileMonitor (入侵检测)
- SSHMonitor (暴力破解检测)

参考文档: `INTEGRATION_COMPLETE_REPORT.md`

---

## ✅ 修改文件清单

### Backend
1. ✅ `backend/src/services/NodeService.ts`
   - 添加查询超时保护（30秒）
   - 优化SQL查询（仅查询7天数据）
   - 智能降级返回缓存

2. ✅ `backend/src/controllers/NodeController.ts`
   - 添加prisma导入
   - 修改getNodeById返回安全事件
   - 格式化安全事件数据

### Frontend
3. ✅ `frontend/src/services/api.ts`
   - 添加60秒超时控制
   - 添加AbortController
   - 超时错误友好提示
   - NodeData添加securityEvents字段

4. ✅ `frontend/src/pages/NodesPage.tsx`
   - 扩展事件类型标签映射
   - 添加安全事件专属显示区域
   - 区分安全事件和常规事件
   - 添加颜色标识（红色/黄色）

---

## 🚀 部署步骤

```bash
# 1. 拉取最新代码
cd /path/to/SsalgTen
git pull origin main

# 2. 重新构建
docker-compose build backend frontend

# 3. 重启服务
docker-compose restart backend frontend

# 4. 验证
# 访问 http://localhost:3000/admin
# 检查节点管理页面是否正常加载
# 检查节点详情是否显示安全事件
```

---

## 📚 相关文档

- **安全监控实现**: `INTEGRATION_COMPLETE_REPORT.md`
- **Agent安全模块**: `SECURITY_UPGRADE_GUIDE.md`
- **快速开始**: `SECURITY_QUICK_START.md`
- **部署清单**: `DEPLOYMENT_CHECKLIST.md`

---

**修复完成时间**: 2024-10-04  
**版本**: SsalgTen v2.1.0  
**状态**: ✅ 已完成，等待VPS部署测试
