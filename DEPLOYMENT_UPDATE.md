# 一键部署更新说明

## 自动数据库迁移

本项目已配置自动数据库迁移，当你拉取最新代码并重新部署时，数据库迁移会**自动运行**，无需手动执行任何迁移命令。

## 生产环境更新步骤

### 方式一：使用部署脚本（推荐）

```bash
# 拉取最新代码
git pull origin main

# 运行生产部署脚本（会自动执行数据库迁移）
bash scripts/deploy-production.sh
```

部署脚本会自动执行以下步骤：
1. 构建最新的 Docker 镜像
2. **自动运行数据库迁移** (`npx prisma migrate deploy`)
3. 运行数据库种子脚本
4. 启动所有服务

### 方式二：Docker Compose 手动更新

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动服务
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# 运行数据库迁移（如果部署脚本没有自动运行）
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy

# 重新生成 Prisma 客户端（如果需要）
docker-compose -f docker-compose.production.yml run --rm backend npx prisma generate
```

### 方式三：使用 npm 脚本（开发环境）

```bash
# 进入 backend 目录
cd backend

# 安装依赖
npm install

# 运行生产环境迁移
npm run db:migrate:deploy

# 或者重新生成 Prisma 客户端
npm run db:generate
```

## 本次更新包含的数据库迁移

### Migration: `20250121000000_add_traffic_stats`

**新增表**: `traffic_stats`

此迁移添加了流量统计持久化功能，包含以下字段：
- `totalUpload` - 总上传流量（永久累计）
- `totalDownload` - 总下载流量（永久累计）
- `periodUpload` - 周期上传流量（可重置）
- `periodDownload` - 周期下载流量（可重置）
- `lastRxBytes` / `lastTxBytes` - 用于计算增量

**特性**：
- ✅ 流量数据持久化，服务重启不丢失
- ✅ 自动处理网络接口计数器重置
- ✅ 支持流量排行功能
- ✅ 自动在每次心跳时更新

## 验证迁移状态

### 查看迁移历史

```bash
# Docker 环境
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate status

# 本地环境
cd backend && npx prisma migrate status
```

### 检查数据库表

```bash
# 连接到 PostgreSQL
docker exec -it ssalgten-postgres psql -U ssalgten -d ssalgten

# 查看表
\dt

# 查看 traffic_stats 表结构
\d traffic_stats

# 退出
\q
```

## 迁移工作原理

### `prisma migrate deploy` vs `prisma migrate dev`

- **`migrate deploy`** (生产环境)：
  - ✅ 只运行待执行的迁移
  - ✅ 不会提示用户输入
  - ✅ 不会重置数据库
  - ✅ 适合 CI/CD 和生产环境
  - ✅ 幂等操作（多次运行安全）

- **`migrate dev`** (开发环境)：
  - ⚠️ 会提示用户输入迁移名称
  - ⚠️ 可能会重置数据库
  - ⚠️ 仅适合开发环境
  - ❌ 不适合自动化部署

### 迁移文件位置

所有迁移文件位于：`backend/prisma/migrations/`

```
backend/prisma/migrations/
├── migration_lock.toml          # 迁移锁文件
└── 20250121000000_add_traffic_stats/
    └── migration.sql            # SQL 迁移脚本
```

## 安全性说明

1. **幂等性**: `prisma migrate deploy` 可以安全地多次运行，已执行的迁移不会重复执行
2. **回滚**: 如果迁移失败，Prisma 会自动回滚事务
3. **备份**: 建议在生产环境更新前备份数据库

## 故障排除

### 迁移失败

如果迁移失败，检查：

```bash
# 查看 Prisma 迁移状态
npx prisma migrate status

# 查看 PostgreSQL 日志
docker logs ssalgten-postgres

# 手动修复后，重新运行迁移
npx prisma migrate deploy
```

### 迁移表不存在

如果 `_prisma_migrations` 表不存在：

```bash
# 这表示数据库从未运行过迁移，运行 deploy 会自动创建
npx prisma migrate deploy
```

### 手动验证迁移

```sql
-- 查看已运行的迁移
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;

-- 检查 traffic_stats 表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'traffic_stats';
```

## 后续更新

未来所有数据库schema更改都会通过迁移文件进行，只需：

1. 拉取最新代码
2. 运行部署脚本或 `npm run db:migrate:deploy`
3. 迁移会自动应用，无需手动干预

## 更多信息

- Prisma 迁移文档: https://www.prisma.io/docs/concepts/components/prisma-migrate
- 项目迁移指南: [backend/MIGRATION_GUIDE.md](backend/MIGRATION_GUIDE.md)
