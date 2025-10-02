# WSL2 Docker Desktop 集成问题修复指南

## 问题描述

在 WSL2 环境中运行 SsalgTen 安装脚本时出现以下错误：

```
[ERROR] Docker Compose 不可用
```

或者提示：

```
It looks like you have tried to invoke the docker CLI from the docker-desktop WSL2 distribution.
This is not supported.
```

## 根本原因

这是因为 **Docker Desktop 的 WSL2 集成未启用或未配置**。Docker Desktop 需要显式地为每个 WSL2 发行版启用集成。

## 解决方案

### 方案 1: 启用 Docker Desktop WSL2 集成（推荐）

#### 步骤 1: 确保 Docker Desktop 正在运行
1. 在 Windows 任务栏查看 Docker Desktop 图标
2. 如果没有运行，从开始菜单启动 **Docker Desktop**
3. 等待 Docker 完全启动（图标变为静止状态）

#### 步骤 2: 配置 WSL2 集成
1. 打开 **Docker Desktop**
2. 点击右上角的 **设置图标** ⚙️
3. 导航到 **Resources** → **WSL Integration**
4. 确保以下选项已启用：
   - ✅ **Enable integration with my default WSL distro**
   - ✅ 在列表中找到你的 WSL 发行版（如 Ubuntu），并启用开关
5. 点击 **Apply & Restart**
6. 等待 Docker Desktop 重启完成

#### 步骤 3: 验证配置
在 WSL2 终端中运行：

```bash
# 验证 Docker 可用
docker version

# 验证 Docker Compose 可用  
docker compose version

# 验证 Docker 守护进程
docker info
```

如果都能正常输出，说明配置成功！

#### 步骤 4: 重新运行安装脚本
```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

---

### 方案 2: 在原生 Linux 环境中安装（替代方案）

如果你更倾向于使用原生 Docker（而非 Docker Desktop），可以：

#### 选项 A: 使用原生 Linux 服务器
在真实的 Linux 服务器（非 WSL）上部署 SsalgTen，脚本会自动安装 Docker：

```bash
# 在 Ubuntu/Debian 服务器上
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install

# 在 CentOS/RHEL 服务器上  
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

#### 选项 B: 在 WSL2 中安装原生 Docker（高级）
⚠️ **注意**: 此方法与 Docker Desktop 不兼容，选择前请三思！

1. **完全卸载 Docker Desktop**（如果已安装）
2. 在 WSL2 中安装原生 Docker：

```bash
# 安装依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker 服务
sudo service docker start

# 添加用户到 docker 组（避免每次都用 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker version
docker compose version
```

3. 配置 Docker 自动启动（可选）：

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加：
if ! service docker status > /dev/null 2>&1; then
    sudo service docker start
fi
```

---

## 脚本自动检测功能

最新版本的 `ssalgten.sh` 脚本已添加 WSL2 自动检测功能，会：

1. ✅ 自动识别 WSL2 环境
2. ✅ 检测 Docker Desktop 集成状态
3. ✅ 提供详细的配置指导
4. ✅ 给出可操作的错误提示

## 常见问题

### Q1: 为什么不能直接在 WSL2 中使用 Docker？
**A**: 可以使用！但需要先配置 Docker Desktop 的 WSL2 集成。这是 Docker Desktop 的设计要求。

### Q2: 我已经启用了集成，但还是报错？
**A**: 尝试以下步骤：
1. 完全退出 Docker Desktop（右键托盘图标 → Quit）
2. 重启 Docker Desktop
3. 等待 1-2 分钟让服务完全启动
4. 在 WSL2 中重新测试 `docker version`

### Q3: 能否同时使用 Docker Desktop 和原生 Docker？
**A**: **不能**！这会导致冲突。请选择其中一种方式。

### Q4: 如何判断我使用的是 Docker Desktop 还是原生 Docker？
**A**: 运行以下命令：

```bash
docker context ls
```

- 如果看到 `desktop-linux` 上下文 → 使用的是 Docker Desktop
- 如果看到 `default` 上下文且没有 `desktop-*` → 使用的是原生 Docker

### Q5: WSL2 中原生 Docker 的性能如何？
**A**: 通常情况下，原生 Docker 在 WSL2 中的性能略好于 Docker Desktop，但配置和维护更复杂。对于大多数用户，**推荐使用 Docker Desktop**。

---

## 推荐配置

### 对于开发环境
✅ **Docker Desktop + WSL2 集成**
- 简单易用
- 图形化管理界面
- 自动更新
- 开箱即用

### 对于生产环境  
✅ **原生 Linux 服务器 + 原生 Docker**
- 最佳性能
- 完全控制
- 无 Windows 依赖
- 适合自动化部署

---

## 相关链接

- [Docker Desktop WSL2 后端官方文档](https://docs.docker.com/desktop/wsl/)
- [Docker Desktop 下载](https://www.docker.com/products/docker-desktop/)
- [WSL2 安装指南](https://docs.microsoft.com/en-us/windows/wsl/install)
- [SsalgTen 部署文档](../README.md)

---

## 脚本更新日志

### v1.1 (2024-10-02)
- ✅ 新增 WSL2 环境自动检测
- ✅ 添加 Docker Desktop 集成检查
- ✅ 提供详细的配置指导信息
- ✅ 改进错误提示的可操作性

---

**需要帮助？** 请在 [GitHub Issues](https://github.com/lonelyrower/SsalgTen/issues) 中提问。
