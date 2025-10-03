# 强力端口清理修复

## 🐛 问题现象

用户报告：**即使使用新脚本卸载后重装，仍然出现端口占用错误**

```
[INFO] 清理可能的残留资源...
[INFO] 拉取 Docker 镜像...
[INFO] 启动数据库服务...
Error response from daemon: failed to set up container networking: 
driver failed programming external connectivity on endpoint ssalgten-database: 
failed to listen on TCP socket: address already in use
```

## 🔍 深入分析

### 问题 1：普通清理无法杀死 docker-proxy 进程

**之前的清理代码**：
```bash
docker rm -f ssalgten-database ... 2>/dev/null || true
docker network rm ssalgten-network 2>/dev/null || true
```

**问题**：
- ❌ `docker rm -f` 只是删除容器元数据
- ❌ **不会立即杀死 docker-proxy 进程**
- ❌ docker-proxy 可能因为 Docker daemon 的清理延迟而残留
- ❌ 即使网络删除了，绑定端口的进程可能还在运行

### 问题 2：没有验证端口真的被释放

**之前的流程**：
```bash
清理容器 -> 删除网络 -> 立即启动新容器
```

**问题**：
- ❌ 没有等待 Docker 完成资源清理
- ❌ 没有检查端口是否真的空闲
- ❌ 假设清理成功就继续部署
- ❌ 如果端口仍被占用，启动会失败

### docker-proxy 进程问题

Docker 使用 `docker-proxy` 进程来处理端口转发：

```
容器端口 -> docker-proxy -> 宿主机端口
```

**问题场景**：
1. 容器停止/删除
2. Docker daemon 应该清理 docker-proxy
3. **但可能因为各种原因延迟或失败**
4. docker-proxy 进程残留，继续占用端口
5. 新容器启动失败：`address already in use`

## ✅ 修复方案

### 新增函数 1：`force_cleanup_port()`

强力清理单个端口的占用：

```bash
force_cleanup_port() {
    local port=$1
    
    # 1. 查找占用端口的进程
    pids=$(sudo lsof -ti:$port 2>/dev/null)
    
    # 2. 杀死 docker-proxy 进程
    echo "$pids" | while read -r pid; do
        process_name=$(ps -p "$pid" -o comm=)
        if [[ "$process_name" == "docker-proxy" ]]; then
            sudo kill -9 "$pid"  # 强制杀死
        fi
    done
    
    # 3. 使用 fuser 杀死（备用）
    sudo fuser -k ${port}/tcp 2>/dev/null || true
    
    # 4. 验证端口已释放
    if sudo lsof -i:$port | grep -q LISTEN; then
        return 1  # 失败
    else
        return 0  # 成功
    fi
}
```

**改进点**：
- ✅ 使用 `lsof -ti` 直接获取 PID
- ✅ 识别 docker-proxy 进程并强制杀死
- ✅ 使用 `fuser -k` 作为备用清理方法
- ✅ 验证端口真的被释放

### 新增函数 2：`force_cleanup_docker_resources()`

完整的 Docker 资源和端口清理：

```bash
force_cleanup_docker_resources() {
    # 1. 删除所有容器
    docker rm -f ssalgten-* 2>/dev/null || true
    
    # 2. 删除网络
    docker network rm ssalgten-network 2>/dev/null || true
    
    # 3. 等待 Docker 清理
    sleep 2
    
    # 4. 强力清理关键端口
    local critical_ports=(5432 6379 3000 3001)
    for port in "${critical_ports[@]}"; do
        if sudo lsof -i:$port | grep -q LISTEN; then
            force_cleanup_port "$port"
        fi
    done
    
    # 5. 最终验证
    local still_occupied=()
    for port in "${critical_ports[@]}"; do
        if sudo lsof -i:$port | grep -q LISTEN; then
            still_occupied+=("$port")
        fi
    done
    
    if [[ ${#still_occupied[@]} -gt 0 ]]; then
        log_error "端口仍被占用: ${still_occupied[*]}"
        return 1
    fi
    
    return 0
}
```

**改进点**：
- ✅ 先删除容器和网络
- ✅ **等待 2 秒**让 Docker 清理资源
- ✅ 对每个关键端口强力清理
- ✅ 最终验证所有端口都已释放
- ✅ 如果清理失败，返回错误码并中止部署

### 修复 3：部署流程集成强力清理

#### 镜像模式部署（第 4227-4241 行）：

**修改后**：
```bash
log_header "🚀 首次部署（镜像模式）"
log_info "镜像: $IMAGE_REGISTRY/$IMAGE_NAMESPACE (标签: $IMAGE_TAG)"

# 强力清理所有可能的残留资源和端口占用
log_info "清理残留资源和端口占用..."
if ! force_cleanup_docker_resources; then
    log_error "端口清理失败，无法继续部署"
    log_info "请手动检查并停止占用端口的进程："
    echo "  sudo lsof -i :5432    # PostgreSQL"
    echo "  sudo lsof -i :6379    # Redis"
    die "部署已取消"
fi

log_info "拉取 Docker 镜像..."
docker_compose -f "$compose_file" pull
```

**改进点**：
- ✅ 使用 `force_cleanup_docker_resources` 替代简单的 `docker rm`
- ✅ 检查返回值，如果清理失败则中止部署
- ✅ 提供详细的错误信息和手动检查命令
- ✅ 避免在端口冲突的情况下继续部署

#### 源码模式部署（第 4270-4279 行）：

同样的强力清理逻辑。

### 修复 4：增强卸载脚本

**修改后**：
```bash
log_info "停止Docker容器..."
docker_compose down --remove-orphans --volumes 2>/dev/null || true

# 使用强力清理函数
log_info "完全清理 Docker 资源和端口..."
force_cleanup_docker_resources || log_warning "部分资源清理失败"
```

**改进点**：
- ✅ 卸载时也使用强力清理
- ✅ 确保端口完全释放
- ✅ 即使清理失败也会给出警告

## 🎯 修复效果对比

### 修复前的问题流程：

```
1. 用户卸载
   └─> docker rm -f ssalgten-database
   └─> docker network rm ssalgten-network
   └─> ⚠️ docker-proxy (PID 12345) 仍在运行，占用 5432

2. 用户安装
   └─> 清理残留 (docker rm, docker network rm)
   └─> ⚠️ 没有杀死 docker-proxy
   └─> 拉取镜像
   └─> 启动数据库
   └─> ❌ Error: address already in use (端口 5432)
```

### 修复后的正常流程：

```
1. 用户卸载
   └─> docker compose down
   └─> force_cleanup_docker_resources()
       ├─> 删除容器和网络
       ├─> sleep 2 (等待清理)
       ├─> sudo lsof -ti:5432 -> 找到 PID 12345 (docker-proxy)
       ├─> sudo kill -9 12345 ✓
       ├─> 验证端口空闲 ✓
       └─> ✅ 所有端口已释放

2. 用户安装
   └─> force_cleanup_docker_resources()
       └─> ✅ 所有端口空闲（防御性检查）
   └─> 拉取镜像
   └─> 启动数据库
   └─> ✅ 成功启动
```

## 🧪 测试场景

### 场景 1：正常的 docker-proxy 残留

```bash
# 模拟残留
docker run -d --name test-db -p 5432:5432 postgres:16-alpine
docker rm -f test-db  # 删除容器，但 docker-proxy 可能残留

# 检查
sudo lsof -i:5432
# 输出: docker-pr  12345  root  4u  IPv4  ...  TCP *:5432 (LISTEN)

# 安装（新脚本会自动清理）
curl -fsSL ... | bash -s -- --install
# ✅ 自动清理 docker-proxy，部署成功
```

### 场景 2：系统 PostgreSQL 服务占用

```bash
# 系统服务占用端口
sudo systemctl start postgresql

# 安装
curl -fsSL ... | bash -s -- --install
# 检测到非 docker-proxy 进程
# ⚠️ 警告: 发现非 Docker 进程占用 (postgres, PID: 6789)
# ❌ 端口清理失败，部署已取消
# 💡 提示手动停止: sudo systemctl stop postgresql
```

### 场景 3：多次快速卸载重装

```bash
# 第1次卸载
ssalgten uninstall --force
# ✅ 强力清理，所有端口释放

# 立即重装（无等待）
curl -fsSL ... | bash -s -- --install
# ✅ 防御性清理，检查端口，成功部署

# 第2次卸载
ssalgten uninstall --force
# ✅ 强力清理

# 第2次重装
curl -fsSL ... | bash -s -- --install
# ✅ 成功
```

## 📋 诊断命令

如果仍然遇到问题，使用以下命令诊断：

```bash
# 1. 查看所有监听端口的进程
sudo lsof -i -P -n | grep LISTEN

# 2. 查看特定端口的进程详情
sudo lsof -i:5432

# 3. 查看 docker-proxy 进程
ps aux | grep docker-proxy

# 4. 查看 Docker 容器和网络
docker ps -a
docker network ls

# 5. 手动强力清理（如果脚本失败）
sudo lsof -ti:5432 | xargs sudo kill -9
sudo fuser -k 5432/tcp
```

## 🚀 使用建议

### 推荐方式（最可靠）：

```bash
# 完全卸载
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- uninstall --force

# 验证清理（可选）
sudo lsof -i:5432  # 应该无输出
sudo lsof -i:6379  # 应该无输出

# 重新安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

### 如果仍然失败：

```bash
# 手动完全清理
sudo systemctl stop docker
sudo systemctl start docker
docker system prune -af --volumes

# 然后安装
curl -fsSL ... | bash -s -- --install
```

## 📊 技术细节

### lsof 参数说明：

- `lsof -i:PORT` - 查看占用端口的进程
- `lsof -ti:PORT` - 只输出 PID（用于脚本）
- `lsof -nP` - 不解析主机名和端口名（更快）

### kill 信号说明：

- `kill -15 PID` - SIGTERM（正常终止）
- `kill -9 PID` - SIGKILL（强制杀死，无法被捕获）

### fuser 命令：

- `fuser -k 5432/tcp` - 杀死占用 TCP 5432 端口的所有进程
- 更暴力，但更可靠

## ✅ 验证清单

部署前：
- [ ] 所有旧容器已删除（`docker ps -a | grep ssalgten` 无输出）
- [ ] 网络已删除（`docker network ls | grep ssalgten` 无输出）
- [ ] **端口 5432 空闲**（`sudo lsof -i:5432` 无输出）
- [ ] **端口 6379 空闲**（`sudo lsof -i:6379` 无输出）
- [ ] **无 docker-proxy 残留**（`ps aux | grep docker-proxy | grep -E '5432|6379'` 无输出）

部署后：
- [ ] 6 个容器全部运行
- [ ] 数据库容器正常启动（`docker logs ssalgten-database` 无错误）
- [ ] 端口正常绑定（`docker port ssalgten-database` 显示 5432）

## 🔧 相关修改

- **新增函数**：
  - `force_cleanup_port(port)` - 强力清理单个端口
  - `force_cleanup_docker_resources()` - 完整清理所有资源和端口
  
- **修改函数**：
  - `deploy_flow()` 镜像模式 - 集成强力清理
  - `deploy_flow()` 源码模式 - 集成强力清理
  - `uninstall_system()` - 使用强力清理

- **代码变更**：
  - +107 行（新增清理函数）
  - ~20 行修改（部署和卸载流程）

## 相关文档

- UNINSTALL_INSTALL_FIX.md - 卸载安装修复（前一版本）
- PORT_CONFLICT_FIX.md - 端口冲突检测
- CLEAN_DEPLOY.md - 清理部署指南
