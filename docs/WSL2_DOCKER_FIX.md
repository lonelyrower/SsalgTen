# WSL2 Docker 配置指南

本项目在 Windows + WSL2 环境下运行 Docker / Docker Compose 时，常见问题是 WSL 发行版未正确接入 Docker Desktop，或 `docker` 命令可用但无法访问 Docker Engine。

## 快速自检

在 WSL 里执行：

```bash
./scripts/check-wsl2-docker.sh
```

如果你是通过 `curl | bash` 方式运行脚本，也可以直接运行：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/check-wsl2-docker.sh | bash
```

## 推荐修复步骤（Docker Desktop）

1. 安装并启动 Docker Desktop（Windows）。
2. Docker Desktop -> Settings -> Resources -> WSL Integration。
3. 勾选你的 WSL 发行版（例如 Ubuntu），点击 Apply & Restart。
4. 回到 WSL 终端，确认：

```bash
docker version
docker compose version
docker ps
```

如果 `docker ps` 报权限/连接错误，通常是集成未生效或 Docker Desktop 未启动。

## 常见问题

### 1) `Cannot connect to the Docker daemon`

检查 Docker Desktop 是否正在运行，并确认 WSL Integration 已为当前发行版开启。

### 2) WSL 版本过旧

在 Windows PowerShell（管理员）里执行：

```powershell
wsl --update
```

更新后重启 Docker Desktop 和 WSL 终端。

### 3) 端口/代理/企业网络问题

企业代理或安全软件可能拦截 Docker 拉取镜像。可尝试：

- 在 Docker Desktop 配置代理
- 或改用可访问的镜像源/网络环境

