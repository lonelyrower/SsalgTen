# SsalgTen 生产环境回滚计划

## 🎯 回滚策略概述

本文档提供完整的回滚策略，确保在生产环境出现问题时能够快速、安全地回退到上一个稳定版本。

## 🚨 触发回滚的场景

### 立即回滚场景
- 关键功能完全无法使用
- 数据库数据丢失或损坏
- 安全漏洞被发现并被利用
- 服务器资源耗尽导致系统崩溃
- API响应错误率超过50%

### 计划回滚场景
- 新功能存在严重bug但不影响核心功能
- 性能大幅下降但系统仍可使用
- 用户反馈问题较多
- 监控指标异常但未达到紧急阈值

## 🔄 回滚类型和策略

### 1. 代码回滚 (最常见)

#### 1.1 Git版本回滚
```bash
#!/bin/bash
# 文件: scripts/git-rollback.sh

echo "🔄 开始Git代码回滚..."

# 获取当前commit ID
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "当前版本: $CURRENT_COMMIT"

# 获取上一个稳定版本 (假设是HEAD~1)
PREVIOUS_COMMIT=${1:-"HEAD~1"}
echo "回滚到版本: $PREVIOUS_COMMIT"

# 备份当前状态
git tag "backup-before-rollback-$(date +%Y%m%d_%H%M%S)" HEAD

# 执行回滚
git checkout $PREVIOUS_COMMIT

# 如果需要强制回滚到特定commit
# git reset --hard $PREVIOUS_COMMIT

echo "✅ Git回滚完成"
echo "备份标签已创建，可以随时恢复"
```

#### 1.2 Docker镜像回滚
```bash
#!/bin/bash
# 文件: scripts/docker-rollback.sh

echo "🐳 开始Docker镜像回滚..."

# 列出可用的镜像版本
echo "可用的Docker镜像版本："
docker images ssalgten-backend --format "table {{.Tag}}\t{{.CreatedAt}}"

# 回滚到上一个版本
PREVIOUS_TAG=${1:-"previous"}

echo "回滚到镜像标签: $PREVIOUS_TAG"

# 更新docker-compose文件中的镜像标签
sed -i.backup "s/ssalgten-backend:latest/ssalgten-backend:$PREVIOUS_TAG/" docker-compose.yml
sed -i.backup "s/ssalgten-frontend:latest/ssalgten-frontend:$PREVIOUS_TAG/" docker-compose.yml

# 重启服务
docker-compose down
docker-compose up -d

echo "✅ Docker镜像回滚完成"
```

### 2. 数据库回滚

#### 2.1 数据库备份回滚
```bash
#!/bin/bash
# 文件: scripts/database-rollback.sh

set -e

BACKUP_FILE=$1
DB_NAME="ssalgten"
DB_USER="ssalgten"

if [[ -z "$BACKUP_FILE" ]]; then
    echo "❌ 请指定备份文件路径"
    echo "用法: $0 /path/to/backup.sql"
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "❌ 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "🗄️ 开始数据库回滚..."
echo "备份文件: $BACKUP_FILE"

# 创建当前状态的紧急备份
echo "📦 创建当前数据库的紧急备份..."
EMERGENCY_BACKUP="emergency_backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec postgres pg_dump -U $DB_USER $DB_NAME > $EMERGENCY_BACKUP
echo "紧急备份已保存: $EMERGENCY_BACKUP"

# 停止应用服务（保留数据库运行）
echo "⏸️ 停止应用服务..."
docker-compose stop backend frontend agent

# 恢复数据库
echo "🔄 恢复数据库..."
docker-compose exec -T postgres psql -U $DB_USER -c "DROP DATABASE IF EXISTS ${DB_NAME}_temp;"
docker-compose exec -T postgres psql -U $DB_USER -c "CREATE DATABASE ${DB_NAME}_temp;"
docker-compose exec -T postgres psql -U $DB_USER $DB_NAME_temp < $BACKUP_FILE

# 切换数据库
echo "🔄 切换数据库..."
docker-compose exec -T postgres psql -U $DB_USER -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"
docker-compose exec -T postgres psql -U $DB_USER -c "ALTER DATABASE ${DB_NAME}_temp RENAME TO $DB_NAME;"

# 重启应用服务
echo "🚀 重启应用服务..."
docker-compose start backend frontend agent

# 验证恢复
sleep 10
if curl -f http://localhost/api/health >/dev/null 2>&1; then
    echo "✅ 数据库回滚成功"
    echo "旧数据库已重命名为: ${DB_NAME}_old"
    echo "如确认无问题，可手动删除: DROP DATABASE ${DB_NAME}_old;"
else
    echo "❌ 数据库回滚后服务异常，请检查日志"
    docker-compose logs backend
fi
```

#### 2.2 数据库迁移回滚
```bash
#!/bin/bash
# 文件: scripts/migration-rollback.sh

echo "🔄 开始数据库迁移回滚..."

# 显示当前迁移状态
echo "📊 当前迁移状态："
docker-compose exec backend npx prisma migrate status

# 回滚指定数量的迁移
ROLLBACK_COUNT=${1:-1}
echo "回滚最近 $ROLLBACK_COUNT 个迁移"

# 注意：Prisma不直接支持迁移回滚
# 这里提供手动回滚的指导

echo "⚠️ Prisma不支持自动回滚，请按以下步骤手动操作："
echo "1. 检查migration文件夹中的迁移历史"
echo "2. 手动编写回滚SQL"
echo "3. 在数据库中执行回滚SQL"
echo "4. 删除或重命名对应的迁移文件"

# 显示最近的迁移文件
echo "📋 最近的迁移文件："
ls -la backend/prisma/migrations/ | tail -5
```

### 3. 配置回滚

#### 3.1 环境变量回滚
```bash
#!/bin/bash
# 文件: scripts/config-rollback.sh

echo "⚙️ 开始配置文件回滚..."

# 恢复配置文件备份
for config_file in .env backend/.env frontend/.env agent/.env; do
    if [[ -f "$config_file.backup" ]]; then
        echo "恢复配置文件: $config_file"
        cp "$config_file.backup" "$config_file"
    else
        echo "警告: 未找到备份文件 $config_file.backup"
    fi
done

# 重启服务以应用配置
docker-compose restart

echo "✅ 配置文件回滚完成"
```

## 🚀 一键回滚脚本

### 完整回滚流程
```bash
#!/bin/bash
# 文件: scripts/emergency-rollback.sh

set -e

echo "🚨 紧急回滚流程启动"
echo "================================"

# 参数验证
ROLLBACK_TARGET=${1:-"HEAD~1"}
BACKUP_FILE=$2

echo "回滚目标: $ROLLBACK_TARGET"
echo "数据库备份: ${BACKUP_FILE:-"自动选择最新备份"}"

# 确认操作
read -p "⚠️ 确认要执行紧急回滚吗？(yes/no): " confirmation
if [[ "$confirmation" != "yes" ]]; then
    echo "❌ 回滚操作已取消"
    exit 0
fi

echo "🔄 开始紧急回滚流程..."

# Step 1: 创建当前状态备份
echo "📦 Step 1: 创建当前状态备份..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 备份代码
git tag "emergency-backup-$TIMESTAMP" HEAD
echo "代码备份标签: emergency-backup-$TIMESTAMP"

# 备份数据库
EMERGENCY_DB_BACKUP="emergency_db_backup_$TIMESTAMP.sql"
docker-compose exec postgres pg_dump -U ssalgten ssalgten > "$EMERGENCY_DB_BACKUP"
echo "数据库备份: $EMERGENCY_DB_BACKUP"

# 备份配置文件
cp .env ".env.emergency.$TIMESTAMP"
cp backend/.env "backend/.env.emergency.$TIMESTAMP"
cp frontend/.env "frontend/.env.emergency.$TIMESTAMP"
cp agent/.env "agent/.env.emergency.$TIMESTAMP"

# Step 2: 停止所有服务
echo "⏸️ Step 2: 停止所有服务..."
docker-compose down

# Step 3: 代码回滚
echo "🔄 Step 3: 代码回滚..."
git checkout $ROLLBACK_TARGET

# Step 4: 数据库回滚（如果指定了备份文件）
if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    echo "🗄️ Step 4: 数据库回滚..."
    docker-compose up -d postgres
    sleep 10
    
    # 恢复数据库
    docker-compose exec -T postgres psql -U ssalgten -c "DROP DATABASE IF EXISTS ssalgten_temp;"
    docker-compose exec -T postgres psql -U ssalgten -c "CREATE DATABASE ssalgten_temp;"
    docker-compose exec -T postgres psql -U ssalgten ssalgten_temp < "$BACKUP_FILE"
    
    # 切换数据库
    docker-compose exec -T postgres psql -U ssalgten -c "ALTER DATABASE ssalgten RENAME TO ssalgten_old_$TIMESTAMP;"
    docker-compose exec -T postgres psql -U ssalgten -c "ALTER DATABASE ssalgten_temp RENAME TO ssalgten;"
fi

# Step 5: 重建和启动服务
echo "🚀 Step 5: 重建和启动服务..."
docker-compose build --no-cache
docker-compose up -d

# Step 6: 等待服务启动
echo "⏳ Step 6: 等待服务启动..."
sleep 30

# Step 7: 健康检查
echo "🔍 Step 7: 健康检查..."
MAX_ATTEMPTS=10
ATTEMPT=1

while [[ $ATTEMPT -le $MAX_ATTEMPTS ]]; do
    if curl -f http://localhost/api/health >/dev/null 2>&1; then
        echo "✅ 健康检查通过"
        break
    else
        echo "尝试 $ATTEMPT/$MAX_ATTEMPTS: 健康检查失败，等待10秒..."
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [[ $ATTEMPT -gt $MAX_ATTEMPTS ]]; then
    echo "❌ 回滚后服务仍然异常"
    echo "📋 查看服务日志："
    docker-compose logs --tail=20
    echo ""
    echo "🔄 恢复操作："
    echo "1. 代码恢复: git checkout emergency-backup-$TIMESTAMP"
    echo "2. 数据库恢复: 使用 $EMERGENCY_DB_BACKUP"
    exit 1
fi

# Step 8: 运行基础测试
echo "🧪 Step 8: 运行基础测试..."
if ./scripts/production-test.sh --url http://localhost >/dev/null 2>&1; then
    echo "✅ 基础测试通过"
else
    echo "⚠️ 基础测试失败，但服务已启动"
fi

echo ""
echo "🎉 紧急回滚完成！"
echo "================================"
echo "📊 回滚信息："
echo "- 回滚版本: $ROLLBACK_TARGET"
echo "- 备份标签: emergency-backup-$TIMESTAMP"
echo "- 数据库备份: $EMERGENCY_DB_BACKUP"
echo "- 配置备份: *.emergency.$TIMESTAMP"
echo ""
echo "📝 后续操作："
echo "1. 检查服务功能是否正常"
echo "2. 分析回滚原因"
echo "3. 准备修复方案"
echo "4. 清理备份文件（确认稳定后）"
```

## 📋 回滚检查清单

### 回滚前检查
- [ ] 确认回滚原因和影响范围
- [ ] 确认回滚目标版本
- [ ] 备份当前状态（代码、数据库、配置）
- [ ] 通知相关人员
- [ ] 准备回滚后的测试计划

### 回滚过程检查
- [ ] 创建紧急备份
- [ ] 停止相关服务
- [ ] 执行代码回滚
- [ ] 执行数据库回滚（如需要）
- [ ] 恢复配置文件
- [ ] 重启服务

### 回滚后验证
- [ ] 健康检查通过
- [ ] 核心功能正常
- [ ] 数据完整性检查
- [ ] 性能指标正常
- [ ] 用户访问正常

## 🔍 回滚后分析

### 分析步骤
1. **收集回滚相关信息**
   - 回滚原因
   - 回滚时间点
   - 影响范围
   - 恢复时长

2. **问题根因分析**
   - 技术原因分析
   - 流程问题分析
   - 预防措施制定

3. **改进措施**
   - 测试流程优化
   - 监控告警完善
   - 部署流程改进

### 分析报告模板
```markdown
# 回滚事件分析报告

## 基本信息
- 事件时间: 
- 回滚原因: 
- 影响时长: 
- 回滚版本: 

## 问题描述


## 回滚过程


## 根因分析


## 改进措施


## 预防方案

```

## 🛡️ 风险控制

### 降低回滚风险的措施

1. **蓝绿部署**
   ```bash
   # 保持两个完全相同的生产环境
   # 切换时只需要更改负载均衡配置
   ```

2. **灰度发布**
   ```bash
   # 逐步将流量切换到新版本
   # 发现问题时快速切回
   ```

3. **自动监控告警**
   ```bash
   # 设置关键指标监控
   # 异常时自动触发告警
   ```

4. **定期备份**
   ```bash
   # 每日自动备份数据库
   # 保留多个版本的备份
   ```

## 📞 紧急联系人

在执行回滚操作时，请及时通知以下人员：

- **技术负责人**: [联系方式]
- **运维工程师**: [联系方式]  
- **产品负责人**: [联系方式]
- **客户服务**: [联系方式]

## 📚 相关文档

- [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) - 生产部署指南
- [scripts/production-test.sh](./scripts/production-test.sh) - 生产测试脚本
- [scripts/health-check.sh](./scripts/health-check.sh) - 健康检查脚本

---

*最后更新: $(date '+%Y-%m-%d %H:%M:%S')*