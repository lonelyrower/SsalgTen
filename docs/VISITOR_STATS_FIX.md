# 访问统计问题修复说明

## 修复日期
2025年10月6日

## 修复的问题

### 1. 访问统计显示Unknown的问题

**问题描述：**
- 在系统管理页面的访问统计中，ASN和国家字段显示为"Unknown"
- 管理后台的访问也被计入统计，导致数据不准确

**根本原因：**
1. 系统没有配置 `IPINFO_TOKEN` 环境变量，导致IP地理位置查询限制
2. 所有访问（包括管理后台）都被记录到访问日志
3. 统计查询没有过滤掉"Unknown"的记录

**修复方案：**

#### 1.1 过滤管理后台访问
修改 `backend/src/controllers/VisitorController.ts` 的 `getVisitorInfo` 方法：

```typescript
// 只记录前台访问，不记录管理后台访问（/api/admin/**）
const isAdminEndpoint = req.originalUrl.includes("/api/admin");

if (!isAdminEndpoint) {
  // 记录访问日志
}
```

**效果：** 管理后台的访问不再被记录到访问统计中，只统计真实的前台访问者。

#### 1.2 过滤Unknown记录
修改 `getVisitorStats` 方法的查询条件：

```typescript
// 访问量最多的国家（排除Unknown）
prisma.visitorLog.groupBy({
  by: ["country"],
  where: {
    createdAt: { gte: cutoffDate },
    country: { not: null },
    AND: [{ country: { not: "Unknown" } }, { country: { not: "" } }],
  },
  // ...
})

// 访问量最多的ASN（排除Unknown）
prisma.visitorLog.groupBy({
  by: ["asnName"],
  where: {
    createdAt: { gte: cutoffDate },
    asnName: { not: null },
    AND: [{ asnName: { not: "Unknown" } }, { asnName: { not: "" } }],
  },
  // ...
})
```

**效果：** 统计结果中不再显示"Unknown"的国家和ASN，使数据更加清晰准确。

### 2. 实时活动卡片空白问题

**问题描述：**
- 实时活动卡片下方有大段空白区域
- 这是之前其他栏目残留导致的视觉问题

**修复方案：**

修改 `frontend/src/components/dashboard/ActivityLog.tsx`：

```typescript
// 将最大高度从600px调整为500px
<div className="max-h-[500px] overflow-y-auto">
```

**效果：** 减少了活动列表的最大高度，消除了多余的空白区域，使界面更加紧凑。

## 建议的后续优化

### 配置IPInfo Token

为了获得更准确的IP地理位置和ASN信息，建议配置 `IPINFO_TOKEN`：

1. 访问 [ipinfo.io](https://ipinfo.io/) 注册免费账号
2. 获取 API Token
3. 在 `.env` 文件中添加：
   ```
   IPINFO_TOKEN=your_token_here
   ```
4. 重启后端服务

**免费额度：** 每月50,000次查询
**好处：**
- 更准确的国家、城市信息
- 完整的ASN信息（包括ASN号、名称、组织）
- 更高的查询成功率

### 清理历史数据

如果需要清理之前包含管理后台访问的历史数据：

```sql
-- 删除所有管理后台访问记录
DELETE FROM VisitorLog WHERE endpoint LIKE '%/api/admin%';

-- 或者清空所有访问记录（谨慎操作）
DELETE FROM VisitorLog;
```

也可以在系统管理界面使用"清空记录"按钮。

## 影响范围

**修改的文件：**
1. `backend/src/controllers/VisitorController.ts` - 访问统计控制器
2. `frontend/src/components/dashboard/ActivityLog.tsx` - 实时活动组件

**影响的功能：**
- ✅ 访问统计现在只统计前台访问
- ✅ 国家和ASN统计不再显示Unknown
- ✅ 实时活动卡片布局更加紧凑

**向后兼容性：**
- ✅ 完全兼容，不影响现有功能
- ✅ 历史数据保持不变（可选择清理）

## 测试建议

1. **访问统计测试：**
   - 从前台访问系统，查看访问统计是否正确记录
   - 从管理后台操作，确认不会被记录到访问统计
   - 验证国家和ASN统计是否准确

2. **实时活动测试：**
   - 检查活动日志卡片是否有多余空白
   - 验证活动记录显示正常

3. **性能测试：**
   - 观察访问日志记录是否正常
   - 检查统计查询性能

## 相关文档

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - 环境变量配置
- [api.md](./api.md) - API接口文档
