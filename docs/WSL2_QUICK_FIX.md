# SsalgTen WSL2 安装问题快速修复指南

## 🔴 错误信息

```
[ERROR] Docker Compose 不可用
```

或者：

```
It looks like you have tried to invoke the docker CLI from the docker-desktop WSL2 distribution.
This is not supported.
```

---

## ✅ 原因分析

您在 **WSL2 (Windows Subsystem for Linux)** 环境中运行安装脚本，但 **Docker Desktop 的 WSL2 集成未启用**。

---

## 🚀 快速修复步骤（3分钟）

### 步骤 1: 启动 Docker Desktop

1. 检查 Windows 任务栏右下角是否有 Docker 图标
2. 如果没有，从 Windows 开始菜单启动 **Docker Desktop**
3. 等待图标变为静止状态（表示已启动完成）

### 步骤 2: 启用 WSL2 集成

1. 打开 **Docker Desktop** 窗口
2. 点击右上角的 **齿轮图标** ⚙️（Settings）
3. 左侧导航选择：**Resources** → **WSL Integration**
4. 确保勾选：
   - ✅ **Enable integration with my default WSL distro**
   - ✅ 在下方列表中找到你的发行版（如 Ubuntu-20.04），打开开关
5. 点击右下角的 **Apply & Restart** 按钮
6. 等待 Docker Desktop 重启完成（约 30 秒）

### 步骤 3: 验证配置

在 WSL2 终端中运行以下命令：

```bash
# 验证 Docker 可用
docker version

# 验证 Docker Compose 可用
docker compose version

# 运行测试容器
docker run --rm hello-world
```

如果以上命令都能成功执行，说明配置成功！

### 步骤 4: 重新运行安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

---

## 🔧 自动检测工具

我们提供了一个自动检测脚本，可以快速诊断您的环境：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/check-wsl2-docker.sh | bash
```

这个脚本会：
- ✅ 检测是否在 WSL2 环境
- ✅ 验证 Docker 命令是否可用
- ✅ 检查 Docker 守护进程状态
- ✅ 验证 Docker Compose 版本
- ✅ 运行简单的容器测试
- ✅ 给出详细的修复建议

---

## 📋 脚本已自动修复的功能

最新版本的 `ssalgten.sh` 安装脚本已经包含：

✅ **WSL2 自动检测**
- 自动识别 WSL2 环境
- 检测 `/proc/version` 中的 Microsoft 标识
- 检查 `WSL_DISTRO_NAME` 环境变量

✅ **友好的错误提示**
- 清晰说明问题原因
- 提供详细的修复步骤
- 给出相关文档链接

✅ **智能环境判断**
- WSL2: 要求 Docker Desktop 集成
- 原生 Linux: 自动安装 Docker CE
- 分别提供对应的配置指导

---

## ❓ 常见问题

### Q: 为什么不能在 WSL2 中直接安装 Docker？

**A:** 可以！但有两种方式：

1. **Docker Desktop + WSL2 集成（推荐）**
   - ✅ 简单易用，图形化管理
   - ✅ 自动更新，开箱即用
   - ✅ Windows 和 WSL2 共享 Docker

2. **原生 Docker CE（高级）**
   - ⚠️ 需要手动安装和配置
   - ⚠️ 与 Docker Desktop 不兼容
   - ⚠️ 需要手动管理服务启动

对于大多数用户，**强烈推荐使用 Docker Desktop**。

### Q: 已经启用了集成，还是报错怎么办？

**A:** 尝试以下步骤：

```bash
# 1. 完全退出 Docker Desktop
# （右键任务栏图标 → Quit Docker Desktop）

# 2. 等待 5 秒

# 3. 重新启动 Docker Desktop

# 4. 等待 1-2 分钟让服务完全启动

# 5. 在 WSL2 中测试
docker version
```

### Q: 如何判断当前使用的是什么类型的 Docker？

**A:** 运行以下命令：

```bash
docker context ls
```

- 如果看到 `desktop-linux` → 使用 Docker Desktop
- 如果只有 `default` → 使用原生 Docker

### Q: 能否在不安装 Docker Desktop 的情况下使用 WSL2？

**A:** 可以，但需要在 WSL2 中安装原生 Docker：

```bash
# ⚠️ 注意：此方法与 Docker Desktop 不兼容

# 安装 Docker CE
curl -fsSL https://get.docker.com | sudo sh

# 启动 Docker 服务
sudo service docker start

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
newgrp docker

# 配置自动启动（添加到 ~/.bashrc）
echo 'if ! service docker status > /dev/null 2>&1; then sudo service docker start; fi' >> ~/.bashrc
```

---

## 📚 相关文档

- [完整 WSL2 Docker 配置指南](./WSL2_DOCKER_FIX.md)
- [Docker Desktop WSL2 官方文档](https://docs.docker.com/desktop/wsl/)
- [SsalgTen 部署文档](../README.md#-快速开始)
- [安装脚本源码](../scripts/ssalgten.sh)

---

## 📞 获取帮助

如果按照以上步骤仍无法解决问题：

1. **检查 Docker Desktop 版本**
   - 最低要求：Docker Desktop 3.0+
   - 推荐：Docker Desktop 4.x 最新版

2. **查看 Docker Desktop 日志**
   - Docker Desktop → Troubleshoot → View logs

3. **重新安装 Docker Desktop**
   - 完全卸载旧版本
   - 下载最新版：https://www.docker.com/products/docker-desktop/

4. **提交 Issue**
   - 仓库：https://github.com/lonelyrower/SsalgTen/issues
   - 附上：系统版本、Docker 版本、完整错误日志

---

## ✅ 修复完成后

配置成功后，您将可以：

- ✅ 一键部署 SsalgTen 系统
- ✅ 使用 Docker Compose 管理服务
- ✅ 在 WSL2 中无缝使用 Docker 命令
- ✅ 享受 Windows 和 Linux 的双重便利

开始部署：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

---

**祝您部署顺利！** 🚀
