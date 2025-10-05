# 🔑 重置管理员密码

如果忘记了管理员密码，可以使用此脚本快速重置。

## 使用方法

### 方式 1: 远程一键执行（推荐）⭐

无需下载，直接执行：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/reset-admin-password.sh | bash
```

脚本会自动：
- 🔍 查找 SsalgTen 项目目录
- 🐳 查找运行中的 Docker 容器
- 🔧 执行密码重置

### 方式 2: 在项目目录执行

如果已克隆项目：

```bash
cd /path/to/SsalgTen
bash scripts/reset-admin-password.sh
```

### 方式 3: 指定项目目录

如果项目在非标准位置：

```bash
export SSALGTEN_DIR=/custom/path/to/SsalgTen
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/reset-admin-password.sh | bash
```

### Windows (PowerShell)

```powershell
wsl bash scripts/reset-admin-password.sh
```

或者在 Git Bash 中：

```bash
bash scripts/reset-admin-password.sh
```

## 重置后的默认凭据

```
用户名: admin
密码:   admin123
```

## ⚠️ 安全提醒

重置密码后，请**立即**：

1. 登录系统 (http://localhost:3000 或你的域名)
2. 进入【系统管理】→【用户管理】
3. 编辑 admin 用户
4. 修改为强密码（建议 12+ 字符，包含大小写字母、数字和特殊字符）

## 工作原理

脚本会：

1. 检查 Docker 容器状态
2. 如需要，启动 backend 容器
3. 在容器中执行密码重置命令
4. 将 admin 密码重置为 `admin123`

## 故障排查

如果脚本执行失败：

1. 确保 Docker 已启动
2. 确保在项目根目录执行
3. 检查 `docker-compose.yml` 文件是否存在
4. 查看容器日志：`docker-compose logs backend`

## 备用方案

如果脚本无法工作，可以手动执行：

```bash
docker-compose exec -T backend npm run reset-admin
```

或者直接访问数据库重置（需要数据库访问权限）。
