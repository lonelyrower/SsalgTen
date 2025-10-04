# 系统设置问题排查和修复指南

## 问题现象

系统设置页面显示"暂无系统配置"，即使是全新安装。

## 可能原因

1. **数据库 seed 脚本未执行**
2. **API 返回格式不匹配**（已修复）
3. **数据库迁移未完成**

## 排查步骤

### 1. 检查数据库中是否有设置

```bash
# 进入后端容器
docker compose exec backend sh

# 连接数据库并查询
npx prisma studio
# 或者使用 SQL
npx prisma db execute --stdin <<EOF
SELECT * FROM settings;
EOF
```

### 2. 检查后端日志

```bash
# 查看后端启动日志
docker compose logs backend | grep -i seed

# 应该看到类似输出：
# [startup] Seeding admin user & settings...
# ⚙️  Seeding system settings...
# ✅ System settings configured
```

### 3. 手动运行 seed 脚本

如果发现数据库中没有设置，手动运行 seed：

```bash
# 方法 1：在容器内运行
docker compose exec backend npm run db:seed

# 方法 2：重启服务触发自动 seed
docker compose restart backend
```

## 已知问题修复

### 修复 1: API 返回格式（已提交）

**问题**：`getAllConfigs` 返回嵌套对象而不是数组

**修复**：修改 `SystemConfigController.ts`
```typescript
// 修复前
data: { configs: {...}, total: 6 }

// 修复后  
data: [{ id, key, value, category, description, createdAt, updatedAt }]
```

**提交**：`55ea614`

### 修复 2: GitHub Actions 构建失败（本次提交）

**问题**：QEMU 模拟器在跨平台构建时崩溃
```
ERROR: failed to build: process "/dev/.buildkit_qemu_emulator /bin/sh -c npm ci" 
did not complete successfully: exit code: 132
```

**修复**：暂时禁用 ARM64 构建，只构建 AMD64
```yaml
platforms: linux/amd64  # 之前: linux/amd64,linux/arm64
```

## 完整修复流程

### 在远程服务器上执行：

```bash
# 1. 更新代码
cd /opt/ssalgten
git pull origin main

# 2. 检查数据库设置
docker compose exec backend sh -c "
  npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) as count FROM settings;
EOF
"

# 3. 如果 count = 0，手动运行 seed
docker compose exec backend npm run db:seed

# 4. 重启后端应用修复
docker compose restart backend

# 5. 验证系统设置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/admin/configs

# 应该返回包含 map.provider 和 map.api_key 的数组
```

## 验证修复

### 1. 系统设置页面

访问 `http://your-server:3000/admin` → 系统配置

应该看到：
- 🤖 Agent 配置（heartbeat_interval, offline_threshold）
- 🗺️ 地图配置（map.provider, map.api_key）
- 🔧 维护配置（cleanup_retention_days）
- 🩺 诊断配置（max_concurrent_diagnostics）

### 2. API 测试

```bash
# 获取所有配置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/admin/configs

# 预期响应
{
  "success": true,
  "data": [
    {
      "id": "...",
      "key": "heartbeat_interval",
      "value": "30000",
      "category": "agent",
      "description": "Agent heartbeat interval in milliseconds",
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "id": "...",
      "key": "map.provider",
      "value": "\"carto\"",
      "category": "map",
      "description": "Map tile provider (carto, openstreetmap, mapbox)",
      "createdAt": "...",
      "updatedAt": "..."
    },
    // ... 更多配置
  ],
  "message": "Found 6 configuration items"
}
```

### 3. 前端测试

1. 登录管理后台
2. 进入"系统配置"页面
3. 搜索 "map"
4. 应该能看到两个配置：
   - `map.provider` - 地图提供商
   - `map.api_key` - 地图 API 密钥

## 数据库 Schema

### settings 表结构

```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 默认配置（来自 seed.ts）

| key | value | category | description |
|-----|-------|----------|-------------|
| heartbeat_interval | "30000" | agent | Agent heartbeat interval in milliseconds |
| offline_threshold | "120000" | agent | Time in ms before marking agent as offline |
| cleanup_retention_days | "30" | maintenance | Days to retain diagnostic and heartbeat records |
| max_concurrent_diagnostics | "5" | diagnostics | Maximum concurrent diagnostic tests per agent |
| map.provider | "\"carto\"" | map | Map tile provider (carto, openstreetmap, mapbox) |
| map.api_key | "\"\"" | map | Map API key (required for mapbox) |

**注意**：`value` 字段存储的是 JSON 字符串，所以字符串值会被双重引号包裹。

## 常见问题

### Q1: 为什么 map.provider 的值是 `"\"carto\""`？

A: 因为 seed.ts 中使用了 `JSON.stringify("carto")`，这会产生一个 JSON 字符串 `"\"carto\""`。前端在解析时需要先 `JSON.parse()` 才能得到实际的字符串值 `"carto"`。

### Q2: 如何添加新的系统配置？

A: 有两种方式：

1. **通过 API**（推荐）：
```bash
curl -X POST http://localhost:3001/api/admin/configs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new.config",
    "value": "\"value\"",
    "category": "custom",
    "description": "My custom config"
  }'
```

2. **修改 seed.ts**：
在 `backend/src/utils/seed.ts` 的 `defaultSettings` 数组中添加新配置，然后重新运行 seed。

### Q3: seed 脚本运行失败怎么办？

A: 查看详细错误日志：

```bash
# 查看后端日志
docker compose logs backend --tail=100

# 手动运行 seed 查看错误
docker compose exec backend sh -c "
  NODE_ENV=production node dist/utils/seed.js
"
```

常见错误：
- 数据库连接失败 → 检查 `DATABASE_URL`
- 唯一约束冲突 → 配置已存在，这是正常的
- Prisma 客户端未生成 → 运行 `npx prisma generate`

## 紧急修复

如果系统设置完全无法加载，可以直接在数据库中插入配置：

```sql
-- 直接插入地图配置
INSERT INTO settings (id, key, value, category, description, created_at, updated_at)
VALUES 
  ('map_provider', 'map.provider', '"carto"', 'map', 'Map tile provider (carto, openstreetmap, mapbox)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('map_api_key', 'map.api_key', '""', 'map', 'Map API key (required for mapbox)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
```

执行：
```bash
docker compose exec backend sh -c "
  npx prisma db execute --stdin <<'EOF'
INSERT INTO settings (id, key, value, category, description, created_at, updated_at)
VALUES 
  ('map_provider', 'map.provider', '\"carto\"', 'map', 'Map tile provider (carto, openstreetmap, mapbox)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('map_api_key', 'map.api_key', '\"\"', 'map', 'Map API key (required for mapbox)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
EOF
"
```

## 相关文件

- `backend/src/utils/seed.ts` - 数据库初始化脚本
- `backend/src/controllers/SystemConfigController.ts` - 系统配置控制器
- `backend/docker-start.sh` - 容器启动脚本（自动运行 seed）
- `frontend/src/components/admin/SystemSettings.tsx` - 前端设置页面

## 修复历史

- `55ea614` - fix: 修复系统设置 API 返回格式不匹配问题
- `89b1f0a` - fix: 修复 3D 地球闪动、Cesium Ion 401 错误和访客统计 500 错误
- 本次提交 - fix: 禁用 ARM64 构建修复 GitHub Actions 失败

---

**最后更新**: 2025-10-04
