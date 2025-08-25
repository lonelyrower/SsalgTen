# SsalgTen 部署脚本

这个目录包含用于部署和维护 SsalgTen 项目的实用脚本。

## 脚本列表

### update-frontend.sh
**功能**: 更新前端并解决常见的端口冲突问题

**使用方法**:
```bash
# 在VPS上执行
chmod +x /path/to/SsalgTen/scripts/update-frontend.sh
/path/to/SsalgTen/scripts/update-frontend.sh
```

**脚本功能**:
- ✅ 自动停止系统 PostgreSQL 服务，避免端口 5432 冲突  
- ✅ 拉取 GitHub 最新代码
- ✅ 清理 Docker 网络和旧容器
- ✅ 重新构建前端容器（使用 `--no-cache`）
- ✅ 启动所有服务并检查状态
- ✅ 验证前端和后端服务可访问性

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

## 注意事项

- 脚本需要 sudo 权限来管理系统服务
- 确保在项目根目录或正确路径下运行脚本
- 脚本会自动停用系统 PostgreSQL，如果需要请手动重启
- 建议在执行前备份重要数据