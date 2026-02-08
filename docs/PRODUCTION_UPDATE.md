# 生产环境更新指南

SsalgTen 支持通过独立的 Updater 服务实现一键更新与日志查看。

本仓库中的关键组件：

- `scripts/update-production.sh`: Updater 实际执行的更新入口（非交互式，默认镜像更新）
- `scripts/updater-server.mjs`: Updater HTTP 服务（`/update` 触发更新，`/jobs/:id` 查看日志）
- `Dockerfile.updater`: Updater 镜像构建文件
- `docker-compose.yml`: 默认包含 `updater` 服务（建议仅绑定到 `127.0.0.1`）

## 1. 必要配置

生产环境必须设置以下环境变量（见 `.env.example`）：

- `JWT_SECRET`: 强随机字符串（>= 32 chars）
- `API_KEY_SECRET`: 强随机字符串（>= 32 chars）
- `DEFAULT_AGENT_API_KEY`: 强随机字符串（Agent 与后端共享）
- `UPDATER_TOKEN`: 强随机字符串（保护 updater 的更新/日志接口）

## 2. 启动 Updater 服务

使用 `docker-compose.yml`：

```bash
docker compose up -d updater
```

默认配置建议仅本机访问：

- `127.0.0.1:8765 -> updater:8765`

## 3. 触发更新

Updater 提供接口：

- `POST /update`
  - Header: `X-Updater-Token: <UPDATER_TOKEN>`（如果配置了 token）
  - Body: `{"forceAgent": true}` 可选

后端会通过 `UPDATER_URL` 触发更新（见 `backend/src/controllers/UpdateController.ts`）。

## 4. 查看更新日志

- `GET /jobs/:id?tail=500`
  - Header: `X-Updater-Token: <UPDATER_TOKEN>`（如果配置了 token）

## 5. 故障排除

- Updater 无法拉取/管理容器：
  - 确认 Updater 挂载了 Docker Socket：`/var/run/docker.sock`
- 更新脚本不存在：
  - 确认工作目录挂载了项目源码：`- .:/workspace`
  - 确认 `scripts/update-production.sh` 存在
- 401 Unauthorized：
  - 确认请求包含 `X-Updater-Token`，且与 `UPDATER_TOKEN` 一致

