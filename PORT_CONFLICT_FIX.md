# 端口冲突和提示格式修复

## 问题

1. **PostgreSQL 端口冲突**: 端口 5432 已被占用，导致部署失败
2. **提示格式不统一**: 使用了小写 y/n，应统一为大写 Y/N

## 错误信息

```
Error response from daemon: failed to set up container networking: 
driver failed programming external connectivity on endpoint ssalgten-database: 
Bind for 0.0.0.0:5432 failed: port is already allocated
```

## 修复内容

### 1. 增强端口冲突检测 (`check_port_conflicts` 函数)

**新增 PostgreSQL 端口冲突处理**:

- 自动检测端口 5432 是否被占用
- 显示占用进程信息（使用 lsof 或 ss）
- 提供自动停止系统 PostgreSQL 服务的选项
- 支持用户选择是否继续部署

**交互流程**:
```
[WARNING] 端口 5432 (PostgreSQL) 已被占用

解决方案：
1. 停止占用端口的 PostgreSQL 服务
2. 修改 .env 文件中的 DB_PORT（推荐使用 5433）

检测占用进程：
[显示进程信息]

是否自动停止系统 PostgreSQL 服务 [Y/N] (默认: N):
```

**自动修复逻辑**:
- 如果用户选择 Y: 尝试停止 PostgreSQL 服务并验证端口释放
- 如果用户选择 N: 询问是否仍要继续部署
- 如果停止失败: 提示手动处理并询问是否继续

### 2. 统一所有提示格式为大写 Y/N

**修改前**:
- `[Y/n] (默认: Y)` ❌
- `[y/N] (默认: N)` ❌

**修改后（统一格式）**:
- `[Y/N] (默认: Y)` ✅
- `[Y/N] (默认: N)` ✅
- `[Y/N]` ✅（无默认值）

**涉及函数**:
- `prompt_yes_no()` - 主要交互函数
- `confirm()` - 确认函数

**优势**:
- 视觉统一，更专业
- 用户不会混淆大小写
- 所有提示一致性

## 使用示例

### 场景 1: 端口被占用时

```bash
# 运行部署
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 如果端口 5432 被占用，会看到：
[WARNING] 端口 5432 (PostgreSQL) 已被占用

解决方案：
1. 停止占用端口的 PostgreSQL 服务
2. 修改 .env 文件中的 DB_PORT（推荐使用 5433）

检测占用进程：
postgres  1234  postgres  5u  IPv4  12345      0t0  TCP *:5432 (LISTEN)

是否自动停止系统 PostgreSQL 服务 [Y/N] (默认: N): Y

[INFO] 尝试停止 PostgreSQL 服务...
[SUCCESS] 端口 5432 已释放
```

### 场景 2: 手动处理端口冲突

```bash
# 查看占用端口的进程
sudo lsof -i :5432
# 或
sudo ss -tulpn | grep :5432

# 停止系统 PostgreSQL
sudo systemctl stop postgresql
# 或
sudo service postgresql stop

# 验证端口已释放
sudo lsof -i :5432  # 应该没有输出

# 重新运行部署
ssalgten deploy
```

### 场景 3: 修改默认端口

如果不想停止系统 PostgreSQL，可以修改 SsalgTen 使用的端口：

```bash
# 编辑 .env 文件
cd /opt/ssalgten
nano .env

# 修改以下配置
DB_PORT=5433  # 改为其他未占用的端口

# 重新启动
ssalgten restart
```

## 测试结果

✓ 脚本语法检查通过
✓ 端口冲突自动检测
✓ 自动停止服务功能正常
✓ 提示格式统一为大写 Y/N
✓ 用户交互清晰明了

## 相关文件

- `scripts/ssalgten.sh` - 主脚本
- `SCRIPT_FIX_INSTALL_HANG.md` - 之前的修复文档
