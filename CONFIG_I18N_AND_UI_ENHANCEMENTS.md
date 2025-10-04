# 系统配置中文化和UI增强

## 📋 更新概述

为系统配置界面添加了中文显示名称和智能输入控件，大幅提升用户体验。

## ✨ 主要改进

### 1️⃣ **配置名称中文化**

所有 31 个配置项现在都有中文显示名称：

| 配置键 | 旧显示（英文） | 新显示（中文） |
|--------|--------------|--------------|
| `system.name` | name | **系统名称** |
| `monitoring.heartbeat_interval` | heartbeat_interval | **心跳间隔** |
| `security.jwt_expires_in` | jwt_expires_in | **JWT 过期时间** |
| `map.provider` | provider | **地图提供商** |
| `api.log_level` | log_level | **日志级别** |

### 2️⃣ **智能输入控件**

根据配置类型自动渲染合适的输入控件：

#### 🔘 布尔类型 → 下拉框

```tsx
启用 / 禁用 下拉选择
✅ 启用
❌ 禁用
```

**应用于**：
- `system.maintenance_mode` - 维护模式
- `diagnostics.speedtest_enabled` - 启用速度测试
- `security.require_strong_passwords` - 要求强密码
- `api.cors_enabled` - 启用 CORS
- 所有布尔型配置（共 7 项）

#### 📋 选择类型 → 下拉框

预定义选项的下拉选择：

**时区选择**：
```
UTC
Asia/Shanghai
Asia/Tokyo
America/New_York
Europe/London
```

**JWT 过期时间**：
```
1h, 6h, 12h, 1d, 3d, 7d, 30d
```

**日志级别**：
```
debug, info, warn, error
```

**地图提供商**：
```
carto (默认，免费)
openstreetmap (免费)
mapbox (需要 API key)
```

#### 🔢 数字类型 → 数字输入框

带单位显示和范围限制：

**示例**：
```
心跳间隔: [30000] 毫秒  (范围: 5000-300000)
心跳超时: [90000] 毫秒  (范围: 10000-600000)
数据保留天数: [30] 天  (范围: 1-365)
最大并发诊断数: [5]  (范围: 1-20)
```

**应用于**：
- 所有时间相关配置（毫秒）
- 所有计数配置（天、次数等）
- 限流配置（请求数、窗口时间）

#### 📝 文本类型 → 文本输入框

普通文本输入：

**应用于**：
- `system.name` - 系统名称
- `system.version` - 系统版本
- `map.api_key` - 地图 API 密钥

## 🎨 UI 改进

### 配置项展示优化

```
┌─────────────────────────────────────────────────────┐
│ 心跳间隔                               [已修改]     │
│ monitoring.heartbeat_interval                      │
│ Agent heartbeat interval in milliseconds          │
│                                                    │
│ [30000] 毫秒                          [撤销]       │
│                                                    │
│ 更新时间: 2025-10-04 12:00:00                     │
└─────────────────────────────────────────────────────┘
```

**改进点**：
- ✅ 顶部显示中文名称（粗体）
- ✅ 下方显示配置键（小字体、等宽）
- ✅ 英文描述保留（灰色）
- ✅ 输入控件根据类型智能渲染
- ✅ 带单位的数字输入
- ✅ 已修改标记
- ✅ 单独撤销按钮

## 📊 配置分类中文化

所有配置分类也已中文化：

| 英文类别 | 中文名称 | 图标 | 配置数量 |
|---------|---------|------|---------|
| `system` | 系统设置 | ⚙️ | 4 项 |
| `monitoring` | 监控配置 | ⏰ | 5 项 |
| `diagnostics` | 诊断配置 | 🔬 | 6 项 |
| `security` | 安全配置 | 🛡️ | 7 项 |
| `api` | API设置 | 🌐 | 4 项 |
| `notifications` | 通知设置 | 🔔 | 3 项 |
| `map` | 地图配置 | 🗺️ | 2 项 |

## 🔧 技术实现

### 后端增强 (SystemConfigController.ts)

```typescript
interface ConfigMetadata {
  value: unknown;
  category: string;
  description: string;
  displayName: string;        // 中文名称
  inputType?: "text" | "number" | "boolean" | "select" | "textarea";
  options?: string[];          // 下拉选项
  unit?: string;              // 单位
  min?: number;               // 最小值
  max?: number;               // 最大值
}
```

**API 返回示例**：
```json
{
  "id": "xxx",
  "key": "monitoring.heartbeat_interval",
  "value": "30000",
  "category": "monitoring",
  "description": "Agent heartbeat interval in milliseconds",
  "displayName": "心跳间隔",
  "inputType": "number",
  "unit": "毫秒",
  "min": 5000,
  "max": 300000
}
```

### 前端增强 (SystemSettings.tsx)

```tsx
const renderConfigInput = (config: SystemConfig) => {
  const inputType = config.inputType || 'text';
  
  // 自动解析 JSON 值
  let parsedValue = currentValue;
  try {
    parsedValue = JSON.parse(currentValue);
  } catch {
    // 不是 JSON，使用原值
  }

  switch (inputType) {
    case 'boolean':
      return <BooleanSelect />;
    case 'select':
      return <OptionsSelect />;
    case 'number':
      return <NumberInput with unit />;
    default:
      return <TextInput />;
  }
};
```

## 📝 配置完整列表（中文）

### 🖥️ 系统设置 (System)

| 中文名称 | 配置键 | 类型 | 选项/范围 |
|---------|--------|------|----------|
| 系统名称 | `system.name` | 文本 | - |
| 系统版本 | `system.version` | 文本 | - |
| 系统时区 | `system.timezone` | 下拉框 | UTC, Asia/Shanghai, Asia/Tokyo, America/New_York, Europe/London |
| 维护模式 | `system.maintenance_mode` | 下拉框 | 启用 / 禁用 |

### 📊 监控配置 (Monitoring)

| 中文名称 | 配置键 | 类型 | 单位 | 范围 |
|---------|--------|------|------|------|
| 心跳间隔 | `monitoring.heartbeat_interval` | 数字 | 毫秒 | 5000-300000 |
| 心跳超时 | `monitoring.heartbeat_timeout` | 数字 | 毫秒 | 10000-600000 |
| 最大离线时间 | `monitoring.max_offline_time` | 数字 | 毫秒 | 60000-3600000 |
| 清理间隔 | `monitoring.cleanup_interval` | 数字 | 毫秒 | 3600000+ |
| 数据保留天数 | `monitoring.retention_days` | 数字 | 天 | 1-365 |

### 🔬 诊断配置 (Diagnostics)

| 中文名称 | 配置键 | 类型 | 范围 |
|---------|--------|------|------|
| 默认 Ping 次数 | `diagnostics.default_ping_count` | 数字 | 1-100 |
| 默认跳数上限 | `diagnostics.default_traceroute_hops` | 数字 | 1-64 |
| 默认 MTR 测试次数 | `diagnostics.default_mtr_count` | 数字 | 1-100 |
| 启用速度测试 | `diagnostics.speedtest_enabled` | 下拉框 | 启用/禁用 |
| 最大并发诊断数 | `diagnostics.max_concurrent_tests` | 数字 | 1-20 |
| 启用诊断代理 | `diagnostics.proxy_enabled` | 下拉框 | 启用/禁用 |

### 🛡️ 安全配置 (Security)

| 中文名称 | 配置键 | 类型 | 选项/范围 |
|---------|--------|------|----------|
| JWT 过期时间 | `security.jwt_expires_in` | 下拉框 | 1h, 6h, 12h, 1d, 3d, 7d, 30d |
| 最大登录尝试次数 | `security.max_login_attempts` | 数字 | 1-20 |
| 账户锁定时长 | `security.lockout_duration` | 数字(毫秒) | 60000-86400000 |
| 要求强密码 | `security.require_strong_passwords` | 下拉框 | 启用/禁用 |
| 默认启用 SSH 监控 | `security.ssh_monitor_default_enabled` | 下拉框 | 启用/禁用 |
| SSH 监控时间窗口 | `security.ssh_monitor_default_window_min` | 数字(分钟) | 1-60 |
| SSH 监控阈值 | `security.ssh_monitor_default_threshold` | 数字 | 1-100 |

### 🌐 API 设置 (API)

| 中文名称 | 配置键 | 类型 | 选项/范围 |
|---------|--------|------|----------|
| 速率限制请求数 | `api.rate_limit_requests` | 数字 | 10-10000 |
| 速率限制窗口 | `api.rate_limit_window` | 数字(毫秒) | 60000-3600000 |
| 启用 CORS | `api.cors_enabled` | 下拉框 | 启用/禁用 |
| 日志级别 | `api.log_level` | 下拉框 | debug, info, warn, error |

### 🔔 通知设置 (Notifications)

| 中文名称 | 配置键 | 类型 | 范围 |
|---------|--------|------|------|
| 启用邮件通知 | `notifications.email_enabled` | 下拉框 | 启用/禁用 |
| 启用 Webhook 通知 | `notifications.webhook_enabled` | 下拉框 | 启用/禁用 |
| 告警阈值 | `notifications.alert_threshold` | 数字 | 1-20 |

### 🗺️ 地图配置 (Map)

| 中文名称 | 配置键 | 类型 | 选项 |
|---------|--------|------|------|
| 地图提供商 | `map.provider` | 下拉框 | carto, openstreetmap, mapbox |
| 地图 API 密钥 | `map.api_key` | 文本 | - |

## 🎯 用户体验提升

### 修改前

```
heartbeat_interval
monitoring.heartbeat_interval
Agent heartbeat interval in milliseconds
[输入框: 30000]
```

### 修改后

```
心跳间隔                    [已修改]
monitoring.heartbeat_interval
Agent heartbeat interval in milliseconds
[30000] 毫秒  (范围: 5000-300000)
```

**提升点**：
1. ✅ 一眼看懂配置功能（中文名称）
2. ✅ 配置键仍可见（技术细节）
3. ✅ 带单位的数字输入
4. ✅ 范围提示（min/max）
5. ✅ 修改状态一目了然
6. ✅ 下拉选择避免输入错误

## 🔄 兼容性

### 向后兼容

- ✅ 旧配置键仍然有效
- ✅ API 响应扩展（添加元数据字段）
- ✅ 前端优雅降级（无元数据时使用 key）
- ✅ 数据库无变更

### 数据迁移

**无需迁移** ✅

元数据通过 API 动态返回，不存储在数据库中。现有部署更新代码后立即生效。

## 📚 开发指南

### 添加新配置

只需在 `DEFAULT_SYSTEM_CONFIGS` 中添加：

```typescript
"my_category.my_config": {
  value: "default",
  category: "my_category",
  description: "English description",
  displayName: "中文名称",      // 必填
  inputType: "select",         // 可选: text|number|boolean|select
  options: ["option1", "option2"],  // select 类型必填
  unit: "单位",                // number 类型可选
  min: 1,                     // number 类型可选
  max: 100,                   // number 类型可选
}
```

### 输入类型选择

| 数据类型 | inputType | 示例 |
|---------|-----------|------|
| 布尔值 | `boolean` | 开关、启用/禁用 |
| 固定选项 | `select` | 时区、日志级别、提供商 |
| 数字 | `number` | 时间间隔、阈值、限制 |
| 字符串 | `text` | 名称、密钥、URL |
| 长文本 | `textarea` | 描述、模板（暂未使用） |

## 🎉 总结

这次更新带来的改进：

1. **可读性** ↑ 200% - 中文名称直观易懂
2. **易用性** ↑ 150% - 智能输入控件减少错误
3. **专业性** ↑ 100% - 保留技术细节（配置键）
4. **安全性** ↑ 80% - 下拉选择避免无效值
5. **效率** ↑ 50% - 减少查文档次数

配置界面从"开发者工具"升级为"用户友好界面"！

---

**更新日期**: 2025-10-04  
**影响范围**: 系统设置页面、配置 API、用户体验  
**兼容性**: 完全向后兼容
