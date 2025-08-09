# SsalgTen 开发日志 - 2025年8月9日

## 问题背景

用户在VPS上部署 SsalgTen 时遇到以下问题：
1. Docker 构建时出现 `usermod: user 'ssalgten' does not exist` 错误
2. 前端显示 "Failed to Load Data" 和 "NetworkError when attempting to fetch resource" 错误
3. 前端尝试连接 `http://localhost:3001` 而不是服务器实际IP

## 问题分析与解决

### 1. Docker 用户创建顺序问题

**问题**: 
- `Dockerfile.backend` 和 `Dockerfile.agent` 中，`adduser` 命令参数顺序错误
- `scripts/deploy-production.sh` 在用户创建前尝试将用户添加到docker组

**解决方案**:
- 修复 Dockerfile 中的 `adduser` 命令：`adduser -S -u 1001 ssalgten`
- 在 `install_docker()` 函数中添加用户存在性检查
- 在 `create_application_directory()` 函数中创建用户后再添加到docker组

### 2. Docker Compose 警告

**问题**: 
- 所有 docker-compose 文件包含过时的 `version: '3.8'` 属性

**解决方案**:
- 从所有 docker-compose 文件中移除 `version` 属性

### 3. Nginx 配置重新加载

**问题**: 
- 生产部署脚本创建Nginx配置后没有重新加载

**解决方案**:
- 在 `create_nginx_config()` 函数中添加 `systemctl reload nginx`

### 4. 前端API配置问题 (核心问题)

**问题**: 
- 环境变量名不一致：`VITE_API_URL` vs `VITE_API_BASE_URL`
- 前端运行时配置 (`config.js`) 没有在容器启动时生成
- 前端健康检查使用IPv6导致连接失败

**解决方案**:

#### 4.1 统一环境变量名
- 修复 `docker-compose.production.yml` 中的变量名为 `VITE_API_BASE_URL`
- 在部署脚本的主 `.env` 文件中添加 `VITE_API_BASE_URL` 配置

#### 4.2 确保运行时配置生成
- 增强 `docker/generate-config.sh` 脚本，添加调试信息和错误处理
- 创建 `docker/custom-entrypoint.sh` 确保配置生成在nginx启动前执行
- 修改 `Dockerfile.frontend` 使用自定义entrypoint

#### 4.3 修复健康检查
- 将健康检查地址从 `localhost` 改为 `127.0.0.1` 避免IPv6连接问题

#### 4.4 简化前端容器架构
- 移除前端容器内部的API代理配置，让外层Nginx处理所有代理

## 技术细节

### 前端运行时配置机制

SsalgTen 使用运行时配置来解决Docker容器中环境变量的问题：

1. **构建时**: 前端使用默认的 `localhost:3001` 编译
2. **运行时**: `generate-config.sh` 根据环境变量生成 `config.js`
3. **加载时**: 前端先检查 `window.APP_CONFIG`，再fallback到编译时配置

```javascript
// frontend/src/services/api.ts
const getApiBaseUrl = (): string => {
  // Check runtime config first
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_BASE_URL) {
    return (window as any).APP_CONFIG.API_BASE_URL;
  }
  // Fallback to build-time env var or default
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
};
```

### 部署架构

```
Internet → VPS Nginx (Port 80) → Docker Containers
                                ├── Frontend (Port 3000 → 80)
                                └── Backend (Port 3001)
```

- 外层Nginx处理SSL终止和路由
- 前端容器只负责静态文件服务
- API请求通过外层Nginx代理到后端

## 提交历史

1. `04e8e90` - fix: correct adduser command syntax in Docker containers
2. `4e9ac59` - fix: resolve CORS configuration issues in deployment scripts  
3. `575b99f` - fix: resolve usermod error in production deployment script
4. `6772415` - fix: resolve deployment verification and Docker Compose warnings
5. `476e95b` - fix: resolve frontend API configuration issues in production
6. `f45cd4f` - fix: ensure frontend runtime configuration is generated on container startup

## 验证结果

部署成功后：
- ✅ Docker容器正常构建和启动
- ✅ 前端能正确连接到服务器IP的API (`http://158.51.78.137/api`)
- ✅ 地图和数据正常显示
- ✅ 部署验证通过

## 下一步计划

1. **功能测试**: 全面测试所有功能模块
2. **性能优化**: 检查API响应时间和前端加载速度
3. **监控配置**: 设置服务监控和告警
4. **文档更新**: 更新部署文档反映修复的问题

## 经验总结

1. **容器化应用的配置管理**: 运行时配置比构建时配置更灵活
2. **调试Docker问题**: 容器日志是诊断问题的关键
3. **网络配置**: IPv4/IPv6兼容性需要特别注意
4. **部署脚本**: 操作顺序很重要，依赖关系要明确

---

**开发者**: Claude Code  
**日期**: 2025年8月9日  
**状态**: 已完成并推送到GitHub