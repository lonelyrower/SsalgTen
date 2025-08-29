# SsalgTen Scripts 脚本说明

SsalgTen 网络监控系统的核心管理脚本集合。

## 🚀 快速开始

### 主要部署和管理方式

#### 1. **系统部署** (生产环境)
```bash
wget https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh -O deploy-production.sh
chmod +x deploy-production.sh
./deploy-production.sh
```

#### 2. **节点Agent安装**
```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s
```

#### 3. **系统管理控制台** (交互式)
```bash
./scripts/ssalgten.sh
```
一个命令进入完整的交互式系统管理界面，包含：
- 🚀 启动/停止/重启系统
- ⚡ 一键更新（停止→拉取代码→重新构建→启动）
- 📊 系统状态监控
- 📋 日志查看
- 🧹 系统清理
- 🔧 维护工具

## 📁 核心脚本说明

### 系统管理脚本
- `ssalgten.sh` - **交互式系统控制台** (主要管理工具)
- `deploy-production.sh` - **生产环境部署脚本**
- `install-agent.sh` - **Agent节点安装脚本**

### 数据管理脚本  
- `backup-db.sh` - 数据库备份工具
- `restore-db.sh` - 数据库恢复工具
- `rollback.sh` - 系统版本回滚工具

### 更新系统脚本
- `test-update-system.sh` - 更新系统验证
- `updater-server.mjs` - 更新服务器实现

### 配置文件
- `VERSION` - 版本追踪文件
- `README.md` - 本说明文件

## 💡 使用建议

### 日常操作流程

1. **系统管理** - 使用交互式控制台:
   ```bash
   ./scripts/ssalgten.sh
   ```

2. **快速更新系统**:
   - 在交互式界面选择 "4. ⚡ 更新系统"
   - 或者手动: 停止系统 → `git pull` → 启动系统

3. **添加新节点**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s
   ```

### 紧急情况处理

1. **系统完全停止**:
   ```bash
   ./scripts/ssalgten.sh  # 选择 "1. 🚀 启动系统"
   ```

2. **回滚到之前版本**:
   ```bash
   ./rollback.sh [BACKUP_ID]
   ```

3. **数据库问题**:
   ```bash
   ./backup-db.sh     # 先备份
   ./restore-db.sh    # 恢复到备份点
   ```

## 🔧 高级功能

### 维护模式
交互式控制台提供完整的维护工具：
- 系统完整性检查
- 数据备份
- 容器重建
- 诊断报告生成

### 自定义配置
可以通过环境变量自定义脚本行为：
```bash
# 自定义端口
export BACKEND_PORT=3001
export FRONTEND_PORT=3000

# 自定义更新源
export GIT_REMOTE=origin
export GIT_BRANCH=main
```

## 📝 版本历史

- **v2.0** - 引入交互式系统控制台，简化日常操作
- **v1.0** - 基础脚本集合，支持基本部署和管理

## 🆘 故障排除

常见问题及解决方案：

1. **端口被占用**:
   ```bash
   ./scripts/ssalgten.sh  # 选择 "2. 🛑 停止系统" 清理端口
   ```

2. **Docker构建失败**:
   ```bash
   ./scripts/ssalgten.sh  # 选择 "8. 🧹 清理系统"
   ```

3. **系统状态异常**:
   ```bash
   ./scripts/ssalgten.sh  # 选择 "9. 🔧 维护模式" → "检查系统完整性"
   ```

---

如有问题，请查看项目主要文档或创建Issue。