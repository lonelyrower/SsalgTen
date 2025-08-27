# SsalgTen 生产环境更新系统

## 概述

SsalgTen 内置了先进的零停机更新系统，可以在生产环境中安全地进行自动化更新，确保数据安全和服务连续性。

### 核心特性

- ✅ **零停机更新** - 服务仅短暂中断（通常 < 30 秒）
- 🔒 **自动数据备份** - 更新前自动备份数据库和配置
- 🏥 **健康检查验证** - 确保更新后系统正常运行
- 🔄 **失败自动回滚** - 出错时自动回滚到稳定版本
- 📊 **实时更新日志** - Web界面实时显示更新进度
- 🛡️ **权限控制** - 仅管理员可执行系统更新

## 架构原理

```
用户点击"立即更新" 
    ↓
后端API接收请求
    ↓
调用Updater服务
    ↓
Updater服务执行更新脚本
    ↓
1. 创建数据备份
2. 拉取最新代码  
3. 重建Docker镜像
4. 滚动更新容器
5. 健康检查验证
    ↓
更新完成，返回结果
```

## 生产环境部署指南

### 1. 前置要求

确保你的生产服务器满足以下要求：

```bash
# 系统要求
- Docker 20.10+
- Docker Compose 2.0+
- Git 2.20+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

# 网络要求
- 能够访问 GitHub API (api.github.com)
- Docker Hub 或私有镜像仓库访问权限
```

### 2. 初始部署

#### 步骤 1：克隆代码到生产服务器

```bash
# 克隆到生产目录
git clone https://github.com/lonelyrower/SsalgTen.git /opt/ssalgten
cd /opt/ssalgten

# 切换到稳定分支
git checkout main
```

#### 步骤 2：配置生产环境变量

```bash
# 复制并编辑环境配置
cp .env.example .env
nano .env

# 重要：设置以下生产环境变量
UPDATER_TOKEN=your-super-secure-updater-token-here-change-this
JWT_SECRET=your-production-jwt-secret-key-must-be-strong
API_KEY_SECRET=your-production-api-key-secret
DB_PASSWORD=your-strong-database-password
REDIS_PASSWORD=your-strong-redis-password

# GitHub相关（用于版本检查）
REPO_OWNER=lonelyrower
REPO_NAME=SsalgTen  
REPO_BRANCH=main
GITHUB_TOKEN=your-github-token-optional-for-rate-limits
```

#### 步骤 3：启动系统

```bash
# 构建并启动所有服务（包括Updater）
docker-compose up -d

# 验证所有服务正常运行
docker-compose ps
```

#### 步骤 4：验证更新功能

```bash
# 检查Updater服务状态
curl http://localhost:8765/health

# 应该返回: {"ok":true}
```

### 3. 使用更新功能

#### Web界面操作

1. 登录系统管理界面
2. 访问 "系统管理" → "系统概览"
3. 查看"系统更新"卡片
4. 点击"检查并更新"或"立即更新"按钮
5. 确认更新对话框
6. 实时查看更新日志
7. 等待更新完成

#### 命令行操作（可选）

```bash
# 手动触发更新
curl -X POST http://localhost:8765/update \
  -H "X-Updater-Token: your-updater-token" \
  -H "Content-Type: application/json" \
  -d '{"async": true}'

# 查看更新日志
curl http://localhost:8765/jobs/[job-id]
```

### 4. 更新流程详解

#### 阶段 1：准备和备份（1-2分钟）
```
✅ 更新任务已启动
🔍 检查当前运行状态...
💾 开始创建数据备份...
├─ 备份数据库...
├─ 备份配置文件...
└─ 备份Docker卷数据...
✅ 数据备份完成
```

#### 阶段 2：代码更新（30秒-1分钟）
```
📥 拉取最新代码...
📝 本次更新包含的更改:
├─ abc1234 Fix bug in monitoring system
├─ def5678 Update security dependencies  
└─ ghi9012 Improve update system reliability
```

#### 阶段 3：服务更新（1-2分钟）
```
🔄 开始滚动更新...
├─ 更新后端服务...
├─ 更新前端服务...
└─ 更新代理服务...
🏥 执行最终健康检查...
✅ API健康检查通过
✅ 前端健康检查通过
```

#### 阶段 4：完成清理（30秒）
```
🧹 清理旧的Docker镜像...
📊 更新摘要:
├─ 新版本: abc1234
├─ 备份路径: .update/backups/backup_20231201_143022
└─ 日志文件: .update/logs/update_20231201_143022.log
🎉 系统更新成功完成，服务正常运行！
```

## 安全注意事项

### 1. 访问控制

```bash
# 确保只有管理员可以访问更新功能
# 在防火墙中限制8765端口访问（可选）
iptables -A INPUT -p tcp --dport 8765 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 8765 -j DROP

# 使用强密码作为UPDATER_TOKEN
UPDATER_TOKEN=$(openssl rand -base64 32)
```

### 2. 数据保护

```bash
# 定期检查备份文件
ls -la .update/backups/

# 设置备份清理计划（保留最近30天）
find .update/backups/ -name "backup_*" -mtime +30 -delete
```

### 3. 监控建议

```bash
# 监控更新日志
tail -f .update/logs/update_*.log

# 监控磁盘空间（备份会占用空间）
df -h

# 监控Docker资源使用
docker stats
```

## 故障排除

### 常见问题

#### 1. 更新失败：Updater服务无法访问

**症状：**
```
❌ 更新启动失败: Updater service not reachable
```

**解决方案：**
```bash
# 检查Updater服务状态
docker-compose ps updater
docker-compose logs updater

# 重启Updater服务
docker-compose restart updater
```

#### 2. 更新失败：Git权限问题

**症状：**
```
ERROR Git拉取失败
```

**解决方案：**
```bash
# 检查Git配置
cd /opt/ssalgten
git remote -v
git status

# 重置到远程分支
git fetch origin
git reset --hard origin/main
```

#### 3. 更新失败：Docker资源不足

**症状：**
```
ERROR 服务构建失败
```

**解决方案：**
```bash
# 清理Docker资源
docker system prune -f
docker volume prune -f

# 检查可用空间
df -h
docker system df
```

#### 4. 更新后服务异常

**解决方案：使用回滚功能**

```bash
# 查看可用备份
ls -la .update/backups/

# 执行回滚（替换为实际的备份ID）
./scripts/rollback.sh 20231201_143022
```

### 手动回滚

如果Web界面无法访问，可以手动回滚：

```bash
# 进入项目目录
cd /opt/ssalgten

# 停止所有服务
docker-compose down

# 查找最新备份
LATEST_BACKUP=$(ls -1t .update/backups/ | head -1)
echo "最新备份: $LATEST_BACKUP"

# 执行回滚
./scripts/rollback.sh ${LATEST_BACKUP#backup_}

# 验证服务状态
docker-compose ps
curl http://localhost:3001/api/health
```

## 高级配置

### 1. 自定义更新策略

编辑 `scripts/update-production.sh` 来自定义更新行为：

```bash
# 修改健康检查超时
MAX_HEALTH_ATTEMPTS=20  # 默认30次

# 修改备份保留策略  
BACKUP_RETENTION_DAYS=14  # 默认30天

# 添加自定义检查
custom_health_check() {
    # 你的自定义健康检查逻辑
    return 0
}
```

### 2. 集成外部监控

```bash
# Webhook通知（可选）
WEBHOOK_URL="https://your-webhook-url.com/notifications"

# 在更新脚本中添加通知
notify_webhook() {
    curl -X POST "$WEBHOOK_URL" \
         -H "Content-Type: application/json" \
         -d "{\"message\":\"$1\",\"status\":\"$2\"}"
}
```

### 3. 多环境配置

```bash
# 不同环境使用不同配置
cp .env .env.production
cp .env .env.staging

# 使用环境特定配置
docker-compose --env-file .env.production up -d
```

## 最佳实践

### 1. 更新前检查清单

- [ ] 确认系统负载较低
- [ ] 验证磁盘空间充足（> 5GB）
- [ ] 检查备份目录可写
- [ ] 通知相关用户计划更新时间

### 2. 定期维护

```bash
# 每周清理脚本
#!/bin/bash
# 清理旧备份（保留最近7个）
cd /opt/ssalgten
find .update/backups/ -name "backup_*" -type d | sort -r | tail -n +8 | xargs rm -rf

# 清理旧日志（保留最近30天）
find .update/logs/ -name "*.log" -mtime +30 -delete

# 清理Docker资源
docker image prune -f
docker system prune -f
```

### 3. 监控建议

- 设置磁盘空间监控告警（< 2GB）
- 监控Docker服务健康状态
- 定期测试回滚功能
- 记录更新操作日志

---

## 联系支持

如遇到更新相关问题：

1. 查看更新日志：`.update/logs/`
2. 查看Docker日志：`docker-compose logs`
3. 查看系统状态：`docker-compose ps`
4. 尝试回滚操作：`./scripts/rollback.sh`

**记住：更新功能设计为安全优先，遇到问题时会自动停止并保护数据完整性。**