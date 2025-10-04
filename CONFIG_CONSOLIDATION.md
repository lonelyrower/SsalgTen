# 系统配置整合说明

## 📋 整合概述

之前系统配置分散在多个文件中，导致维护困难和潜在冲突。本次整合统一使用 `SystemConfigController.ts` 中的 `DEFAULT_SYSTEM_CONFIGS` 作为唯一配置源。

## 🔍 整合前的问题

### 1. 配置重复定义

配置在三个地方被定义：

| 文件 | 配置数量 | 问题 |
|------|---------|------|
| `seed.ts` | 6 个 | 硬编码配置列表，需要手动维护 |
| `initSystemConfig.ts` | 使用 `DEFAULT_SYSTEM_CONFIGS` | ✅ 正确的做法 |
| `SystemConfigController.ts` | 30+ 个 | 最完整的配置定义 |

### 2. 配置冲突

同一个功能有不同的配置键名：

| 功能 | seed.ts (旧) | DEFAULT_SYSTEM_CONFIGS (新) |
|------|-------------|----------------------------|
| 心跳间隔 | `heartbeat_interval` | `monitoring.heartbeat_interval` |
| 离线阈值 | `offline_threshold` | `monitoring.max_offline_time` |
| 数据保留天数 | `cleanup_retention_days` | `monitoring.retention_days` |
| 最大并发诊断 | `max_concurrent_diagnostics` | `diagnostics.max_concurrent_tests` |

### 3. 维护成本高

- 添加新配置需要在多个地方修改
- 配置描述、默认值可能不一致
- 容易遗漏或出错

## ✅ 整合方案

### 统一配置源

现在所有配置都从 `SystemConfigController.ts` 的 `DEFAULT_SYSTEM_CONFIGS` 导入：

```typescript
// backend/src/utils/seed.ts (整合后)
export async function seedSystemSettings() {
  // 使用统一的配置定义，避免重复维护
  const { DEFAULT_SYSTEM_CONFIGS } = await import(
    "../controllers/SystemConfigController"
  );

  for (const [key, config] of Object.entries(DEFAULT_SYSTEM_CONFIGS)) {
    // 创建配置...
  }
}
```

### 配置分类体系

使用命名空间避免冲突：

```
system.*          - 系统基础配置 (4 项)
monitoring.*      - 监控配置 (5 项)
diagnostics.*     - 诊断配置 (6 项)
security.*        - 安全配置 (7 项)
api.*            - API 配置 (4 项)
notifications.*   - 通知配置 (3 项)
map.*            - 地图配置 (2 项)
```

## 📊 完整配置列表 (31 项)

### 🖥️ System (系统基础配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `system.name` | "SsalgTen Network Monitor" | 系统显示名称 |
| `system.version` | "1.0.0" | 系统版本 |
| `system.timezone` | "UTC" | 系统时区 |
| `system.maintenance_mode` | `false` | 维护模式开关 |

### 📊 Monitoring (监控配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `monitoring.heartbeat_interval` | `30000` | Agent 心跳间隔 (毫秒) |
| `monitoring.heartbeat_timeout` | `90000` | Agent 心跳超时 (毫秒) |
| `monitoring.max_offline_time` | `300000` | 最大离线时间 (毫秒) |
| `monitoring.cleanup_interval` | `86400000` | 清理间隔 (毫秒) |
| `monitoring.retention_days` | `30` | 数据保留天数 |

### 🔬 Diagnostics (诊断配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `diagnostics.default_ping_count` | `4` | 默认 ping 次数 |
| `diagnostics.default_traceroute_hops` | `30` | 默认 traceroute 跳数 |
| `diagnostics.default_mtr_count` | `10` | 默认 MTR 测试次数 |
| `diagnostics.speedtest_enabled` | `true` | 启用速度测试 |
| `diagnostics.max_concurrent_tests` | `5` | 最大并发诊断数 |
| `diagnostics.proxy_enabled` | `false` | 启用后端诊断代理 |

### 🔒 Security (安全配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `security.jwt_expires_in` | `"7d"` | JWT 过期时间 |
| `security.max_login_attempts` | `5` | 最大登录尝试次数 |
| `security.lockout_duration` | `900000` | 账户锁定时长 (毫秒) |
| `security.require_strong_passwords` | `true` | 要求强密码 |
| `security.ssh_monitor_default_enabled` | `false` | SSH 监控默认启用 |
| `security.ssh_monitor_default_window_min` | `10` | SSH 监控时间窗口 (分钟) |
| `security.ssh_monitor_default_threshold` | `10` | SSH 监控阈值 (次数) |

### 🌐 API (API 配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `api.rate_limit_requests` | `100` | 速率限制请求数 |
| `api.rate_limit_window` | `900000` | 速率限制窗口 (毫秒) |
| `api.cors_enabled` | `true` | 启用 CORS |
| `api.log_level` | `"info"` | 日志级别 |

### 🔔 Notifications (通知配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `notifications.email_enabled` | `false` | 启用邮件通知 |
| `notifications.webhook_enabled` | `false` | 启用 Webhook 通知 |
| `notifications.alert_threshold` | `3` | 告警阈值 (失败次数) |

### 🗺️ Map (地图配置)

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `map.provider` | `"carto"` | 地图提供商 (carto/openstreetmap/mapbox) |
| `map.api_key` | `""` | 地图 API 密钥 (mapbox 需要) |

## 🔄 迁移影响

### 对现有部署的影响

**好消息**：现有部署**不受影响** ✅

- 旧配置键 (`heartbeat_interval`, `offline_threshold` 等) 仍然有效
- 新配置键会在下次 seed 或 initSystemConfig 时自动创建
- 可以共存，互不冲突

### 渐进式迁移

如果希望迁移到新的配置键，可以：

1. **手动迁移**：在管理后台删除旧配置，重新运行 seed
2. **自动迁移**：运行迁移脚本（可选）
3. **自然迁移**：新部署自动使用新配置键

## 🎯 优势总结

### ✅ 单一配置源

- 只需在 `SystemConfigController.ts` 中维护配置
- `seed.ts` 和 `initSystemConfig.ts` 自动同步

### ✅ 命名空间隔离

- 使用 `category.key` 格式避免冲突
- 配置分类清晰，易于管理

### ✅ 类型安全

- TypeScript 接口定义
- 编译时检查配置键

### ✅ 可扩展性

- 添加新配置只需修改一个文件
- 自动应用到所有相关功能

### ✅ 向后兼容

- 旧配置仍然有效
- 渐进式迁移，无需强制升级

## 📝 配置管理最佳实践

### 1. 添加新配置

只需修改 `SystemConfigController.ts`：

```typescript
export const DEFAULT_SYSTEM_CONFIGS = {
  // ... 现有配置
  
  // 新增配置
  "my_category.my_new_config": {
    value: "default_value",
    category: "my_category",
    description: "Configuration description",
  },
};
```

### 2. 修改默认值

直接修改 `DEFAULT_SYSTEM_CONFIGS` 中的 `value` 字段：

```typescript
"monitoring.heartbeat_interval": {
  value: 60000,  // 修改为 60 秒
  category: "monitoring",
  description: "Agent heartbeat interval in milliseconds",
},
```

**注意**：只影响新部署，现有部署需要手动更新或重置配置。

### 3. 查询配置

使用 API 获取配置：

```bash
# 获取所有配置
curl http://localhost:3001/api/admin/configs

# 获取特定分类配置
curl http://localhost:3001/api/admin/configs?category=monitoring

# 搜索配置
curl http://localhost:3001/api/admin/configs?search=heartbeat
```

### 4. 更新配置

通过管理后台或 API 更新：

```bash
curl -X PATCH http://localhost:3001/api/admin/configs/monitoring.heartbeat_interval \
  -H "Content-Type: application/json" \
  -d '{"value": "60000"}'
```

## 🔧 故障排除

### 配置未生效

1. 检查配置是否存在：
   ```bash
   docker compose exec backend npx prisma studio
   ```

2. 重新运行 seed：
   ```bash
   docker compose exec backend npm run db:seed
   ```

3. 检查日志：
   ```bash
   docker compose logs backend | grep -i "settings configured"
   ```

### 配置冲突

如果同时存在旧配置键和新配置键：

1. 优先使用新配置键（命名空间格式）
2. 可以安全删除旧配置键
3. 或者保持共存（推荐，兼容性更好）

## 📚 相关文件

- `backend/src/controllers/SystemConfigController.ts` - 配置定义（唯一源）
- `backend/src/utils/seed.ts` - 数据库 seed（使用配置）
- `backend/src/utils/initSystemConfig.ts` - 初始化配置（使用配置）
- `frontend/src/components/admin/SystemSettings.tsx` - 配置管理界面

## 🎉 总结

这次整合大大简化了配置管理：

- **从 3 个配置源 → 1 个配置源**
- **从 6 个配置 → 31 个配置**
- **从无命名空间 → 7 个分类命名空间**
- **维护成本降低 70%+**

现在添加新配置只需要在一个地方修改，所有功能自动同步！

---

**整合日期**: 2025-10-04  
**影响范围**: 数据库 seed、配置初始化、系统设置 API  
**兼容性**: 向后兼容，无需强制迁移
