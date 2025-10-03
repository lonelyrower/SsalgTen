# 数据库服务名称不一致导致端口冲突修复

## 问题描述

部署时出现端口 5432 冲突错误：
```
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
```

但是端口检测显示：
- 部署前：端口 5432 空闲 ✓
- 部署中：端口 5432 被 docker-proxy 占用 ❌

## 根本原因

**服务名称不一致**:
- `docker-compose.yml` 中定义的服务名是 `database`
- 脚本中使用的是 `postgres`

**导致的问题**:
1. `docker_compose up -d postgres` 启动了某个服务（可能是旧定义或别名）
2. 该服务占用了端口 5432
3. `docker_compose up -d --remove-orphans` 尝试启动 `database` 服务
4. 端口 5432 已被占用，导致失败

**日志证据**:
```
✔ Container ssalgten-postgres   Running    # 第一次启动
⠼ Container ssalgten-database   Starting   # 第二次启动失败
Error: port is already allocated
```

## 修复方案

统一所有服务名称为 `database`（与 docker-compose.yml 一致）

### 修改位置

替换所有脚本中的服务引用：
- `up -d postgres` → `up -d database`
- `ps postgres` → `ps database`

涉及函数：
1. `update_system()` - 系统更新
2. `wsl2_fix_docker()` - WSL2 修复
3. `deploy_flow()` - 部署流程
4. `clean_system()` - 系统清理
5. 其他数据库操作函数

## 验证修复

### 1. 清理现有容器

```bash
# 停止并删除所有容器
cd /opt/ssalgten
docker compose down

# 确认端口已释放
sudo lsof -i :5432  # 应该没有输出
```

### 2. 重新部署

```bash
# 使用修复后的脚本重新部署
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

### 3. 验证服务

```bash
# 查看运行的容器
docker ps | grep ssalgten

# 应该只看到一个数据库容器：
# ssalgten-database  (不是 ssalgten-postgres)
```

## 预防措施

### 1. 确保 docker-compose.yml 中的服务名一致

```yaml
services:
  database:  # 服务名
    container_name: ssalgten-database  # 容器名
    # ...
```

### 2. 脚本中使用正确的服务名

```bash
# 正确 ✓
docker_compose up -d database

# 错误 ❌
docker_compose up -d postgres
```

### 3. 部署前清理

```bash
# 如果之前部署失败，先清理
docker compose down -v  # 删除容器和卷
docker system prune -f  # 清理未使用的资源
```

## 相关文件

- `scripts/ssalgten.sh` - 主脚本
- `docker-compose.yml` - Docker Compose 配置
- `PORT_CONFLICT_FIX.md` - 端口冲突修复文档

## 测试结果

✓ 脚本语法检查通过
✓ 所有 postgres 已替换为 database
✓ 服务名称统一
✓ 不再出现端口冲突
