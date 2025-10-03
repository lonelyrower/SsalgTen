# 卸载和安装脚本完善修复

## 🐛 发现的问题

用户报告：**卸载后重新安装仍然出现端口冲突错误**

```
Error response from daemon: failed to set up container networking: 
driver failed programming external connectivity on endpoint ssalgten-database: 
failed to listen on TCP socket: address already in use
```

## 🔍 根本原因分析

### 问题 1：卸载脚本清理不完整

**原代码**（第 3890-3902 行）：
```bash
log_info "开始卸载过程..."

# 停止并删除容器
if [[ -d "$APP_DIR" ]]; then
    cd "$APP_DIR"
    
    log_info "停止Docker容器..."
    docker_compose down --remove-orphans --volumes 2>/dev/null || true
    
    log_info "删除Docker镜像..."
    docker images | grep -E "(ssalgten|ghcr.io.*ssalgten)" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
fi
```

**遗漏的清理项**：
- ❌ 没有显式删除可能残留的容器（如果 `docker compose down` 失败）
- ❌ 没有删除 Docker 网络 `ssalgten-network`
- ❌ 没有删除数据卷（虽然用了 `--volumes`，但可能失败）

### 问题 2：安装脚本缺少防御性检查

**原代码**（第 4128-4134 行）：
```bash
log_header "🚀 首次部署（镜像模式）"
log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE (标签: $IMAGE_TAG)"

log_info "拉取 Docker 镜像..."
docker_compose -f "$compose_file" pull

log_info "启动数据库服务..."
docker_compose -f "$compose_file" up -d database
```

**问题**：
- ❌ 直接启动服务，没有检查和清理残留资源
- ❌ 如果之前卸载失败，残留的容器/网络会导致端口冲突
- ❌ `docker compose up -d database` 会因为网络已存在而失败

## ✅ 修复方案

### 修复 1：增强卸载脚本的清理能力

**新代码**（第 3890-3913 行）：
```bash
log_info "开始卸载过程..."

# 停止并删除容器
if [[ -d "$APP_DIR" ]]; then
    cd "$APP_DIR"
    
    log_info "停止Docker容器..."
    docker_compose down --remove-orphans --volumes 2>/dev/null || true
    
    # 额外清理：删除可能残留的容器
    log_info "清理残留容器..."
    docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
                 ssalgten-backend ssalgten-frontend ssalgten-agent \
                 ssalgten-updater 2>/dev/null || true
    
    # 清理网络
    log_info "清理Docker网络..."
    docker network rm ssalgten-network 2>/dev/null || true
    
    # 清理数据卷
    log_info "清理Docker数据卷..."
    docker volume rm ssalgten-postgres-data ssalgten-redis-data 2>/dev/null || true
    
    log_info "删除Docker镜像..."
    docker images | grep -E "(ssalgten|ghcr.io.*ssalgten)" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
fi
```

**改进点**：
- ✅ 显式删除所有可能的容器（包括 `ssalgten-postgres` 旧名称）
- ✅ 删除 Docker 网络 `ssalgten-network`
- ✅ 删除数据卷 `ssalgten-postgres-data` 和 `ssalgten-redis-data`
- ✅ 所有命令都带 `2>/dev/null || true`，不会因失败而中断

### 修复 2：安装前清理残留资源

#### 镜像模式部署（第 4128-4142 行）：

**新代码**：
```bash
log_header "🚀 首次部署（镜像模式）"
log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE (标签: $IMAGE_TAG)"

# 清理可能的残留容器和网络，避免端口冲突
log_info "清理可能的残留资源..."
docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
             ssalgten-backend ssalgten-frontend ssalgten-agent \
             ssalgten-updater 2>/dev/null || true
docker network rm ssalgten-network 2>/dev/null || true

log_info "拉取 Docker 镜像..."
docker_compose -f "$compose_file" pull

log_info "启动数据库服务..."
docker_compose -f "$compose_file" up -d database
```

#### 源码模式部署（第 4164-4174 行）：

**新代码**：
```bash
log_header "🚀 首次部署（源码模式）"

# 清理可能的残留容器和网络，避免端口冲突
log_info "清理可能的残留资源..."
docker rm -f ssalgten-database ssalgten-postgres ssalgten-redis \
             ssalgten-backend ssalgten-frontend ssalgten-agent \
             ssalgten-updater 2>/dev/null || true
docker network rm ssalgten-network 2>/dev/null || true

docker_compose -f "$compose_file" build
docker_compose -f "$compose_file" up -d database
```

**改进点**：
- ✅ 部署前先清理所有可能的残留容器
- ✅ 删除可能残留的网络
- ✅ 确保端口和网络资源完全释放
- ✅ 防御性编程，避免依赖用户手动清理

## 🎯 修复效果

### 修复前的问题场景：

1. 用户执行卸载：`ssalgten uninstall --force`
2. 卸载脚本执行 `docker compose down`
3. 但是网络 `ssalgten-network` 和某些容器残留
4. 用户重新安装
5. 安装脚本尝试创建网络和启动容器
6. **失败**：`address already in use`

### 修复后的正常流程：

1. 用户执行卸载：`ssalgten uninstall --force`
2. 卸载脚本：
   - ✅ 执行 `docker compose down`
   - ✅ 显式删除所有容器（包括旧名称）
   - ✅ 删除网络 `ssalgten-network`
   - ✅ 删除数据卷
3. 用户重新安装
4. 安装脚本：
   - ✅ 先清理可能的残留（防御性）
   - ✅ 拉取镜像
   - ✅ 创建网络和启动容器
5. **成功**！

## 🧪 测试验证

### 测试用例 1：正常卸载重装

```bash
# 1. 卸载
cd /opt/ssalgten
./ssalgten uninstall --force

# 验证：应该没有任何残留
docker ps -a | grep ssalgten          # 无输出
docker network ls | grep ssalgten     # 无输出
docker volume ls | grep ssalgten      # 无输出
sudo lsof -i :5432                    # 无输出

# 2. 重新安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 预期：成功部署，所有服务正常运行
```

### 测试用例 2：卸载失败后重装

```bash
# 1. 模拟卸载失败（手动残留）
docker network create ssalgten-network
docker run -d --name ssalgten-database --network ssalgten-network -p 5432:5432 postgres:16-alpine

# 2. 尝试安装（不先卸载）
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 预期：脚本自动清理残留，成功部署
```

### 测试用例 3：端口被占用的情况

```bash
# 1. 启动一个占用 5432 端口的容器
docker run -d --name test-postgres -p 5432:5432 postgres:16-alpine

# 2. 尝试安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 预期：
# - 脚本检测到端口冲突
# - 提示用户停止 test-postgres 容器
# - 或用户手动停止后重试
```

## 📋 相关修复

本次修复与之前的修复一起，形成完整的解决方案：

1. **脚本挂起修复** (SCRIPT_FIX_INSTALL_HANG.md)
   - 修复 root 环境下的卡死问题

2. **端口冲突检测** (PORT_CONFLICT_FIX.md)
   - 部署前检测端口占用

3. **服务名统一** (SERVICE_NAME_FIX.md, DOCKER_COMPOSE_SERVICE_NAME_UNIFY.md)
   - 统一所有服务名为 `database`

4. **卸载和安装完善** (本文档) ⭐ **NEW**
   - 增强卸载清理能力
   - 安装前防御性清理

## 🚀 使用建议

### 最佳实践：

```bash
# 完全清理并重装（推荐）
cd /opt/ssalgten
./ssalgten uninstall --force
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

### 如果遇到问题：

```bash
# 手动完全清理（万能方案）
docker rm -f $(docker ps -aq --filter "name=ssalgten") 2>/dev/null || true
docker network rm ssalgten-network 2>/dev/null || true
docker volume rm ssalgten-postgres-data ssalgten-redis-data 2>/dev/null || true
docker system prune -f

# 然后重装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

## 📊 影响范围

- **修改文件**：`scripts/ssalgten.sh`
- **修改函数**：
  - `uninstall_system()` - 增强清理逻辑（+14 行）
  - `deploy_flow()` - 镜像模式添加防御性清理（+6 行）
  - `deploy_flow()` - 源码模式添加防御性清理（+6 行）
- **总代码变更**：+26 行
- **向后兼容性**：✅ 完全兼容，只是更加健壮

## ✅ 验证清单

部署前：
- [ ] 所有旧容器已清理
- [ ] 网络已清理
- [ ] 数据卷已清理（如果需要全新安装）
- [ ] 端口 5432, 6379, 3000, 5173 空闲

部署后：
- [ ] 6 个容器全部运行
- [ ] 网络 `ssalgten-network` 存在
- [ ] 服务健康检查通过
- [ ] 日志无错误

卸载后：
- [ ] 无任何 ssalgten 容器残留
- [ ] 无 ssalgten-network 网络
- [ ] 无 ssalgten 数据卷（如使用 --force）
- [ ] 端口全部释放
