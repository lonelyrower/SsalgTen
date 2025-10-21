# 快速更新指南 🚀

## 方式一：使用交互式脚本（最简单）

在生产服务器上执行：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash
```

然后选择：
- **选项 2** - 更新系统
- 进入子菜单后选择：
  - **选项 1** - 🚀 镜像快速更新（推荐，1-2分钟）
  - **选项 2** - 🔧 源码完整更新（10-30分钟）
  - **选项 3** - 📦 归档包更新（无需Git，10-30分钟）

**所有更新模式都会自动运行数据库迁移！** ✨

## 方式二：使用部署脚本

在项目目录执行：

```bash
git pull origin main && bash scripts/deploy-production.sh
```

**就这么简单！** 🎉

脚本会自动：
- ✅ 构建最新代码
- ✅ 运行数据库迁移
- ✅ 重启服务
- ✅ 验证部署

## 更新内容

### 本次更新（2025-01-21）

#### 前端新功能
- 🎯 监控中心新增6个信息区块
  - 系统资源概览（含CPU/内存/磁盘/负载/健康度）
  - 地理分布
  - 服务商分布
  - 流量排行
  - 正常运行时间排行
  - 节点健康度排行
- 📊 系统负载实时显示（从 loadAverage 读取真实数据）
- 💾 流量统计持久化（服务重启不丢失数据）

#### 后端增强
- 🔄 TrafficStatsService - 流量统计服务
- 📈 实时负载平均值采集和展示
- 💽 流量数据持久化到 PostgreSQL
- 🔧 自动处理网络接口计数器重置

#### 数据库变更
- 新增 `traffic_stats` 表（自动迁移）

## 验证更新

更新完成后，访问监控中心页面，应该能看到：

1. **系统资源概览** - 显示真实的系统负载数据
2. **流量排行** - 显示节点流量统计（如果有数据）
3. **正常运行时间排行** - 显示运行时间最长的节点
4. **节点健康度排行** - 显示健康评分最高的节点

## 检查迁移状态

```bash
# 查看数据库迁移状态
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate status

# 检查新表是否创建成功
docker exec -it ssalgten-postgres psql -U ssalgten -d ssalgten -c "\d traffic_stats"
```

## 如果遇到问题

### 迁移失败
```bash
# 查看日志
docker logs ssalgten-backend

# 手动运行迁移
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy
```

### 服务无法启动
```bash
# 重启所有服务
docker-compose -f docker-compose.production.yml restart

# 查看服务状态
docker-compose -f docker-compose.production.yml ps
```

## 回滚（如果需要）

```bash
# 回滚到上一个版本
git log --oneline -5  # 查看最近的提交
git checkout <previous-commit-hash>
bash scripts/deploy-production.sh
```

## 详细文档

- [完整部署更新说明](DEPLOYMENT_UPDATE.md)
- [后端迁移指南](backend/MIGRATION_GUIDE.md)

---

**提示**: 首次更新后，Agent 需要上报几次心跳数据后，流量统计才会开始显示。
