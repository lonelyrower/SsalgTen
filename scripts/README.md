# SsalgTen 部署脚本

这个目录包含用于部署和维护 SsalgTen 项目的实用脚本。

## 脚本列表

### update-frontend.sh
**功能**: 更新前端并解决常见的端口冲突问题（支持端口自定义）

**使用方法**:
```bash
# 在VPS上执行
chmod +x /path/to/SsalgTen/scripts/update-frontend.sh
/path/to/SsalgTen/scripts/update-frontend.sh
```

也可以一次性传入端口（会同步写入 `.env`）：
```bash
PROJECT_PORT=3000 NODE_PORT=9000 BACKEND_PORT=3001 DB_PORT=5432 \
  bash /path/to/SsalgTen/scripts/update-frontend.sh
```

**脚本功能**:
- ✅ 自动停止系统 PostgreSQL 服务，避免端口 5432 冲突  
- ✅ 拉取 GitHub 最新代码
- ✅ 清理 Docker 网络和旧容器
- ✅ 重新构建前端容器（使用 `--no-cache`）
- ✅ 启动所有服务并检查状态
- ✅ 验证前端和后端服务可访问性
- ✅ 若前端/后端端口被占用，自动切换到可用端口并写入 `.env`
- ✅ 若节点端口被占用（同机已有节点），自动跳过 docker 内置节点以避免冲突
- ✅ 支持通过 `PROJECT_PORT`（映射为 `FRONTEND_PORT`）和 `NODE_PORT`（映射为 `AGENT_NYC_PORT`）自定义端口，并自动写入 `.env`
- ✅ 在重建前检查端口占用，并给出清晰提示

**解决的问题**:
- `Bind for 0.0.0.0:5432 failed: port is already allocated`
- Docker 网络冲突
- 缓存导致的构建问题

## 部署步骤

### 初次部署
1. 克隆项目到VPS
2. 配置 `.env` 文件
3. 运行 `update-frontend.sh`

### 日常更新
直接运行更新脚本即可：
```bash
/path/to/SsalgTen/scripts/update-frontend.sh
```

## 故障排除

如果脚本执行失败，可以查看相关日志：

```bash
# 查看容器状态
docker ps -a

# 查看容器日志
docker logs ssalgten-frontend
docker logs ssalgten-backend  
docker logs ssalgten-database

# 检查端口占用
sudo netstat -tlnp | grep :5432
sudo lsof -i :5432

# 手动清理（如果需要）
docker compose down -v
docker system prune -f
sudo systemctl stop postgresql
```

## 端口说明

- FRONTEND_PORT: 前端对外端口（默认 80），也可通过环境变量 `PROJECT_PORT` 传入
- BACKEND_PORT: 后端对外端口（默认 3001）
- AGENT_NYC_PORT: 节点对外端口（默认 3002），也可通过环境变量 `NODE_PORT` 传入
- DB_PORT: 数据库对外端口（默认 5432）；若为 5432，脚本会尝试停止系统 postgresql 服务以避免冲突

如需控制更多节点端口（例如伦敦/其他地区），可告知我们以扩展脚本映射。

## 注意事项

- 脚本需要 sudo 权限来管理系统服务
- 确保在项目根目录或正确路径下运行脚本
- 脚本会自动停用系统 PostgreSQL，如果需要请手动重启
- 建议在执行前备份重要数据

### 关于端口自动化

- FRONTEND_PORT/ BACKEND_PORT：若被占用，脚本会寻找下一个空闲端口并写回 `.env`；同时会调整 `VITE_API_BASE_URL` 指向新的后端端口。
- AGENT_NYC_PORT：若被占用，默认跳过 docker 内置 agent（适用于同机已运行节点的情况）。如需强制启用，请释放端口或修改 `.env` 为空闲端口。
