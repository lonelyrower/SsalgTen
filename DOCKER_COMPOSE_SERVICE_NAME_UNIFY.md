# Docker Compose 文件服务名统一修复

## 问题描述

即使修复了脚本中的服务名，部署时仍然出现 `ssalgten-postgres` 容器和端口冲突：

```
✔ Container ssalgten-database   Running
✔ Container ssalgten-postgres   Created    # 不应该存在！
⠸ Container ssalgten-postgres   Starting
Error: Bind for 127.0.0.1:5432 failed: port is already allocated
```

## 根本原因

**多个 docker-compose 文件中服务名不一致**：

| 文件 | 服务名 | 容器名 |
|------|--------|--------|
| `docker-compose.yml` | `database` ✓ | `ssalgten-database` ✓ |
| `docker-compose.ghcr.yml` | `postgres` ❌ | `ssalgten-postgres` ❌ |
| `docker-compose.production.yml` | `postgres` ❌ | `ssalgten-postgres` ❌ |

**导致的问题**：
- 脚本使用 `docker-compose.ghcr.yml` 部署
- 该文件中服务名是 `postgres`
- 即使脚本命令改为 `up -d database`，也会因为文件中定义的是 `postgres` 而创建错误的容器

## 修复方案

**统一所有 docker-compose 文件中的服务名为 `database`**

### 修改的文件

#### 1. docker-compose.ghcr.yml

**修改前**：
```yaml
services:
  postgres:                          # ❌ 服务名
    container_name: ssalgten-postgres  # ❌ 容器名
    depends_on:
      postgres:                       # ❌ 依赖
    environment:
      DATABASE_URL: ...@postgres:5432... # ❌ 主机名
```

**修改后**：
```yaml
services:
  database:                          # ✓ 服务名
    container_name: ssalgten-database  # ✓ 容器名
    depends_on:
      database:                       # ✓ 依赖
    environment:
      DATABASE_URL: ...@database:5432... # ✓ 主机名
```

#### 2. docker-compose.production.yml

同样的修改：
- `postgres:` → `database:`
- `ssalgten-postgres` → `ssalgten-database`
- `@postgres:5432` → `@database:5432`

### 验证命令

```bash
# 检查所有 compose 文件中的服务定义
grep -n "postgres:" docker-compose*.yml | grep -v "image: postgres"

# 应该没有输出，表示所有服务名都已改为 database

# 检查 DATABASE_URL 主机名
grep -n "@postgres:" docker-compose*.yml

# 应该没有输出，表示所有连接字符串都已改为 @database:
```

## 部署前清理

**重要**：修复后必须清理旧容器，否则仍会冲突

```bash
# 1. 停止所有容器
cd /opt/ssalgten
docker compose down
docker compose -f docker-compose.ghcr.yml down

# 2. 删除旧的 postgres 容器（如果存在）
docker rm -f ssalgten-postgres 2>/dev/null || true

# 3. 确认没有容器占用端口
sudo lsof -i :5432  # 应该没有输出

# 4. 清理未使用的资源
docker system prune -f
```

## 重新部署

```bash
# 使用修复后的脚本
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

## 验证成功

```bash
# 查看运行的容器
docker ps | grep ssalgten

# 应该只看到 ssalgten-database，没有 ssalgten-postgres
```

**正确的容器列表**：
```
ssalgten-database    # ✓ 数据库
ssalgten-redis       # ✓ Redis
ssalgten-backend     # ✓ 后端
ssalgten-frontend    # ✓ 前端
ssalgten-agent       # ✓ Agent
ssalgten-updater     # ✓ 更新器
```

**不应该出现**：
```
ssalgten-postgres    # ❌ 不应该存在
```

## 相关文件

- `docker-compose.yml` - 默认配置（已正确）
- `docker-compose.ghcr.yml` - GHCR 镜像配置（已修复）
- `docker-compose.production.yml` - 生产环境配置（已修复）
- `scripts/ssalgten.sh` - 部署脚本（已修复）
- `SERVICE_NAME_FIX.md` - 脚本服务名修复文档

## 测试结果

✓ 所有 docker-compose 文件已统一
✓ 服务名统一为 `database`
✓ 容器名统一为 `ssalgten-database`
✓ DATABASE_URL 主机名统一为 `@database:`
✓ 不再创建 `ssalgten-postgres` 容器
