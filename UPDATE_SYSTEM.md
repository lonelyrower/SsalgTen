# 🚀 SsalgTen 自动更新系统

## 快速开始

SsalgTen 现在支持一键自动更新！你可以通过Web界面安全地更新到最新版本，无需手动操作。

### ✨ 核心特性

- **零停机更新** - 服务仅短暂中断（< 30秒）
- **自动备份** - 更新前自动备份数据和配置
- **失败回滚** - 出错时自动回滚到稳定版本  
- **实时日志** - Web界面实时显示更新进度
- **安全可靠** - 经过完整测试，生产环境安全

## 🎯 使用方法

### 方法一：Web界面更新（推荐）

1. 登录系统：访问 `http://你的域名/admin`
2. 进入系统管理：点击"系统概览"标签
3. 查看更新状态：在"系统更新"卡片中查看版本信息
4. 执行更新：点击"立即更新"按钮
5. 确认操作：在弹出对话框中确认更新
6. 实时监控：查看更新日志，等待完成

### 方法二：命令行测试（开发用）

```bash
# 测试更新系统是否就绪
./scripts/test-update-system.sh

# 手动触发更新（需要UPDATER_TOKEN）
curl -X POST http://localhost:8765/update \
  -H "X-Updater-Token: your-token" \
  -H "Content-Type: application/json"
```

## 🔧 初次设置

如果这是你第一次部署，需要进行一次性设置：

```bash
# 1. 更新配置文件
cp .env .env.backup  # 备份现有配置
nano .env

# 2. 设置安全的Token（重要！）
UPDATER_TOKEN=your-super-secure-token-change-this

# 3. 启动所有服务（包括Updater）
docker-compose up -d

# 4. 验证更新系统
./scripts/test-update-system.sh
```

## 🛡️ 安全保障

- **数据安全** - 更新前自动备份数据库和配置
- **服务连续** - 滚动更新，最小化服务中断
- **错误恢复** - 失败时自动回滚到上一个稳定版本
- **权限控制** - 仅管理员可执行更新操作

## 📊 更新流程

```
用户点击"立即更新"
    ↓
自动备份数据和配置  
    ↓
拉取最新代码
    ↓
重建Docker镜像
    ↓  
滚动更新服务
    ↓
健康检查验证
    ↓
更新完成 🎉
```

## 🔍 故障排除

### 常见问题

**问题1：更新按钮显示"Updater service not reachable"**
```bash
# 检查Updater服务
docker-compose ps updater
docker-compose restart updater
```

**问题2：更新过程中服务异常**
```bash
# 查看可用备份
ls -la .update/backups/

# 执行回滚
./scripts/rollback.sh BACKUP_ID
```

**问题3：磁盘空间不足**
```bash
# 清理旧备份（保留最近7个）
find .update/backups/ -name "backup_*" | sort -r | tail -n +8 | xargs rm -rf

# 清理Docker资源
docker system prune -f
```

## 📚 详细文档

- **部署指南**: [docs/PRODUCTION_UPDATE.md](docs/PRODUCTION_UPDATE.md)
- **故障排除**: [docs/PRODUCTION_UPDATE.md#故障排除](docs/PRODUCTION_UPDATE.md#故障排除)
- **高级配置**: [docs/PRODUCTION_UPDATE.md#高级配置](docs/PRODUCTION_UPDATE.md#高级配置)

## 💡 最佳实践

1. **定期备份** - 虽然更新会自动备份，但建议定期手动备份重要数据
2. **低峰更新** - 选择访问量较低的时间进行更新
3. **测试验证** - 更新后验证所有功能是否正常
4. **监控日志** - 关注更新日志，及时发现问题

---

**现在你可以享受一键更新的便利了！** 🎉

有问题请查看 [详细文档](docs/PRODUCTION_UPDATE.md) 或检查更新日志。