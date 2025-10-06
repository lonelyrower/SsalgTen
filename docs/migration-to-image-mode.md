# 生产环境迁移指南：从本地构建模式到镜像模式

## 概述

本指南帮助你将现有的生产环境从**本地构建模式**（`docker-compose.yml`）迁移到**镜像模式**（`docker-compose.ghcr.yml`），以便后续通过 GHCR (GitHub Container Registry) 拉取预构建镜像进行快速更新。

## 迁移优势

1. **更新速度快**：无需在服务器上编译代码，直接拉取预构建镜像
2. **节省资源**：不占用服务器 CPU/内存进行构建
3. **回滚简单**：通过切换镜像标签快速回滚到任意版本
4. **版本一致性**：所有节点使用完全相同的镜像版本

## 前置条件

- ✅ 生产服务器已安装 Docker 和 Docker Compose
- ✅ 已有正常运行的 SsalgTen 实例（使用 `docker-compose.yml`）
- ✅ 数据库中已有节点数据（418 节点）
- ✅ GitHub Actions CI/CD 已配置并成功构建镜像推送到 GHCR

## 迁移步骤

### 1. 备份当前环境

在迁移前，务必先备份：

```bash
# 进入项目目录
cd /opt/ssalgten

# 备份 .env 文件
cp .env .env.backup-$(date +%Y%m%d)

# 备份数据库（可选但强烈推荐）
docker compose exec -T database pg_dump -U ssalgten ssalgten | gzip > backup-$(date +%Y%m%d).sql.gz
```

### 2. 确认 GHCR 镜像可用

检查 GitHub Container Registry 是否有可用的镜像：

```bash
# 查看可用镜像标签
# 访问: https://github.com/lonelyrower/SsalgTen/pkgs/container/ssalgten%2Fbackend
# 或使用 docker pull 测试
docker pull ghcr.io/lonelyrower/ssalgten/backend:latest
docker pull ghcr.io/lonelyrower/ssalgten/frontend:latest
docker pull ghcr.io/lonelyrower/ssalgten/agent:latest
docker pull ghcr.io/lonelyrower/ssalgten/updater:latest
```

### 3. 验证 docker-compose.ghcr.yml 配置

确认 `docker-compose.ghcr.yml` 已包含所有必要的优化配置：

```bash
cd /opt/ssalgten

# 查看配置文件
cat docker-compose.ghcr.yml | grep -E "(max_connections|connection_limit|HEARTBEAT_INTERVAL|RETENTION_DAYS)"
```

应该看到：
- `max_connections=200`
- `connection_limit=100`
- `HEARTBEAT_INTERVAL: ${HEARTBEAT_INTERVAL:-300000}` (5分钟)
- `HEARTBEAT_RETENTION_DAYS: ${HEARTBEAT_RETENTION_DAYS:-1}` (1天)

### 4. 停止当前服务

```bash
cd /opt/ssalgten

# 使用当前的 docker-compose.yml 停止服务（但保留数据卷）
docker compose down

# 确认服务已停止
docker compose ps
```

**⚠️ 重要**：不要使用 `--volumes` 参数，否则会删除数据库数据！

### 5. 切换到镜像模式

方式一：通过环境变量指定（推荐）

```bash
# 导出环境变量
export COMPOSE_FILE=docker-compose.ghcr.yml

# 或添加到 .bashrc 永久生效
echo 'export COMPOSE_FILE=docker-compose.ghcr.yml' >> ~/.bashrc
source ~/.bashrc
```

方式二：使用 `-f` 参数指定文件

```bash
# 后续所有命令都需要加 -f 参数
docker compose -f docker-compose.ghcr.yml up -d
```

### 6. 拉取镜像并启动

```bash
cd /opt/ssalgten

# 拉取最新镜像
docker compose -f docker-compose.ghcr.yml pull

# 启动数据库（等待数据库就绪）
docker compose -f docker-compose.ghcr.yml up -d database

# 等待 30 秒确保数据库完全启动
sleep 30

# 运行数据库迁移（如果有新的迁移）
docker compose -f docker-compose.ghcr.yml run --rm backend npx prisma migrate deploy

# 启动所有服务
docker compose -f docker-compose.ghcr.yml up -d --remove-orphans
```

### 7. 验证迁移成功

```bash
# 检查服务状态
docker compose -f docker-compose.ghcr.yml ps

# 查看日志
docker compose -f docker-compose.ghcr.yml logs -f --tail=50

# 测试后端 API
curl http://localhost:3001/api/health

# 测试前端
curl http://localhost:80/
```

检查数据：
- 访问前端页面
- 确认 418 个节点数据完整
- 查看在线节点数量是否正常
- 测试节点诊断功能

### 8. 配置 systemd 自启动（可选）

如果你使用 systemd 管理服务，需要更新配置：

```bash
# 编辑 systemd 服务文件
sudo nano /etc/systemd/system/ssalgten.service
```

更新 `ExecStart` 和 `ExecStop` 行：

```ini
[Service]
Type=oneshot
RemainAfterExit=yes
User=your-user
Group=your-user
WorkingDirectory=/opt/ssalgten
Environment="COMPOSE_FILE=docker-compose.ghcr.yml"
ExecStart=/usr/bin/docker compose -f docker-compose.ghcr.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.ghcr.yml down
TimeoutStartSec=0
Restart=on-failure
RestartSec=10
```

重新加载并启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable ssalgten.service
```

## 后续更新流程

迁移到镜像模式后，更新变得非常简单：

### 方式一：使用 ssalgten.sh 脚本（推荐）

```bash
cd /opt/ssalgten

# 自动拉取最新镜像并更新
./ssalgten.sh update --image
```

### 方式二：手动更新

```bash
cd /opt/ssalgten

# 拉取最新镜像
docker compose -f docker-compose.ghcr.yml pull

# 重启服务
docker compose -f docker-compose.ghcr.yml up -d --remove-orphans
```

### 方式三：指定版本更新

```bash
cd /opt/ssalgten

# 更新到特定版本
export IMAGE_TAG=v1.2.3
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d --remove-orphans
```

## 回滚到本地构建模式

如果迁移后遇到问题，可以快速回滚：

```bash
cd /opt/ssalgten

# 停止镜像模式服务
docker compose -f docker-compose.ghcr.yml down

# 切换回本地构建模式
docker compose -f docker-compose.yml up -d
```

## 常见问题

### Q1: 迁移后数据会丢失吗？

**A**: 不会。数据存储在 Docker volumes 中，切换 compose 文件不会影响数据卷。只要不使用 `--volumes` 参数，数据就是安全的。

### Q2: 镜像模式和本地构建模式可以共存吗？

**A**: 可以，但不建议同时运行。你可以保留两个 compose 文件，根据需要切换使用。

### Q3: 如何确认使用的是哪个 compose 文件？

```bash
echo $COMPOSE_FILE
# 或
docker compose config --services
```

### Q4: GHCR 镜像拉取失败怎么办？

```bash
# 检查是否需要认证（私有仓库）
docker login ghcr.io -u your-github-username

# 或使用 PAT (Personal Access Token)
echo $GITHUB_TOKEN | docker login ghcr.io -u your-github-username --password-stdin
```

### Q5: 镜像更新频率是多少？

- **main 分支**：每次推送到 main 分支会自动构建 `latest` 标签
- **release 版本**：每次创建 release 会构建对应版本标签（如 `v1.0.0`）

### Q6: 如何验证镜像完整性？

```bash
# 查看镜像详细信息
docker inspect ghcr.io/lonelyrower/ssalgten/backend:latest

# 检查镜像构建时间
docker images | grep ssalgten
```

## 性能优化建议

迁移到镜像模式后，建议保持以下配置（已在 `docker-compose.ghcr.yml` 中配置）：

1. **数据库连接池**：`connection_limit=100`, `max_connections=200`
2. **心跳间隔**：5 分钟（300000ms）
3. **数据保留**：1 天（避免 heartbeat_logs 表过大）
4. **清理频率**：每小时清理一次旧数据

## 监控和维护

迁移后，定期检查：

```bash
# 查看容器资源使用
docker stats

# 查看数据库连接数
docker compose -f docker-compose.ghcr.yml exec database \
  psql -U ssalgten -d ssalgten -c "SELECT count(*) FROM pg_stat_activity;"

# 查看 heartbeat_logs 表大小
docker compose -f docker-compose.ghcr.yml exec database \
  psql -U ssalgten -d ssalgten -c "SELECT pg_size_pretty(pg_total_relation_size('heartbeat_logs'));"
```

## 技术支持

如果迁移过程中遇到问题：

1. 查看日志：`docker compose -f docker-compose.ghcr.yml logs -f`
2. 检查 GitHub Issues: https://github.com/lonelyrower/SsalgTen/issues
3. 查看 CI/CD 构建状态: https://github.com/lonelyrower/SsalgTen/actions

## 总结

- ✅ 迁移前备份 `.env` 和数据库
- ✅ 确认 GHCR 镜像可用
- ✅ 使用 `docker-compose.ghcr.yml` 启动
- ✅ 验证数据完整性
- ✅ 后续更新使用 `./ssalgten.sh update --image`

迁移成功后，你将享受到更快的更新速度和更简单的版本管理！
