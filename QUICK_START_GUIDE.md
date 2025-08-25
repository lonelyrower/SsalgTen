# SsalgTen 快速部署指南

## 🚀 快速开始

### 方案一：主服务器 + 多个Agent节点

#### 第1步：部署主服务器

1. **准备VPS服务器**
   - 系统：Ubuntu 20.04+
   - 配置：4核8GB内存，50GB存储
   - 网络：独立IP，80/443端口开放

2. **一键部署主服务**
   ```bash
   # 连接到VPS
   ssh your_user@your_server_ip
   
   # 下载并运行部署脚本
   curl -sSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh -o deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **配置过程中需要提供**
   - 您的域名 (如: example.com)
   - SSL证书邮箱
   - 其他配置可选择自动生成

4. **部署完成后**
   - 访问 `https://your-domain.com` 查看前端
   - 访问 `https://your-domain.com/api/health` 检查API
   - 记录Agent密钥用于添加节点

#### 第2步：添加Agent节点

1. **在任意新VPS上运行**
   ```bash
   # 下载安装脚本
   curl -sSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh -o install-agent.sh
   chmod +x install-agent.sh
   ./install-agent.sh
   ```

2. **安装过程中需要提供**
   - 主服务器地址: `https://your-domain.com`
   - Agent API密钥: (从主服务器获得)
   - 节点地理信息: 国家、城市、服务商等

3. **节点要求**
   - 系统：Ubuntu 20.04+
   - 配置：1核2GB内存，10GB存储
   - 网络：独立IP (端口3002可选开放)

## 🎯 完整部署流程

### 主服务器部署详细步骤

```bash
# 1. 登录VPS
ssh your_user@your_server_ip

# 2. 创建工作目录
mkdir -p ~/ssalgten-deploy && cd ~/ssalgten-deploy

# 3. 下载部署脚本
wget https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh
chmod +x deploy-production.sh

# 4. 运行部署
./deploy-production.sh
```

**部署脚本会自动完成：**
- ✅ 系统环境检查
- ✅ Docker安装配置
- ✅ Nginx反向代理设置
- ✅ SSL证书自动申请
- ✅ 数据库初始化
- ✅ 应用服务启动
- ✅ 防火墙配置

### Agent节点部署详细步骤

```bash
# 1. 登录新的Agent VPS
ssh your_user@agent_server_ip

# 2. 下载安装脚本
wget https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh
chmod +x install-agent.sh

# 3. 运行安装
./install-agent.sh
```

**安装脚本会自动完成：**
- ✅ 系统环境检查
- ✅ Docker环境安装
- ✅ Agent服务部署
- ✅ 系统服务配置
- ✅ 防火墙规则配置
- ✅ 健康检查验证

## 🔧 管理和维护

### 主服务器管理

```bash
# 进入应用目录
cd /opt/ssalgten

# 查看服务状态
./manage.sh status

# 重启服务
./manage.sh restart

# 查看日志
./manage.sh logs

# 备份数据库
./manage.sh backup

# 系统监控
./monitor.sh

# 运行生产测试
./scripts/production-test.sh --url https://your-domain.com --verbose
```

### 节点管理工具

```bash
# 在主服务器上批量管理节点
cd /opt/ssalgten

# 添加节点到管理列表
./scripts/node-manager.sh add -n tokyo-01 -h 1.2.3.4 -u root

# 查看所有节点状态
./scripts/node-manager.sh status --all

# 批量重启节点
./scripts/node-manager.sh batch restart --all

# 实时监控所有节点
./scripts/node-manager.sh monitor
```

### 单个Agent节点管理

```bash
# 在Agent节点上
cd /opt/ssalgten-agent

# 使用管理脚本
./manage-agent.sh status    # 查看状态
./manage-agent.sh restart   # 重启服务
./manage-agent.sh logs      # 查看日志

# 或使用Docker命令
docker compose ps           # 查看容器状态
docker compose logs -f      # 查看实时日志
docker compose restart      # 重启服务
```

## 📊 验证部署成功

### 1. 主服务器验证

```bash
# API健康检查
curl https://your-domain.com/api/health

# 预期响应：{"success": true, "message": "API is healthy"}

# 查看节点列表
curl https://your-domain.com/api/nodes

# 访问前端界面
curl -I https://your-domain.com
```

### 2. Agent节点验证

```bash
# 在Agent节点上检查
curl http://localhost:3002/health

# 在主服务器上检查节点是否上线
curl https://your-domain.com/api/nodes | jq '.data[] | select(.name=="your-node-name")'
```

### 3. ASN功能验证

```bash
# 测试访问者信息
curl https://your-domain.com/api/visitor/info

# 测试IP查询功能
curl https://your-domain.com/api/visitor/ip/8.8.8.8
```

## 🌍 扩展网络

### 快速添加多个节点

1. **准备节点列表**
   - 收集各地VPS的IP和登录信息
   - 确保所有VPS满足最低配置要求

2. **批量部署**
   ```bash
   # 在主服务器上使用节点管理工具
   ./scripts/node-manager.sh add -n tokyo-01 -h 1.2.3.4 -u root
   ./scripts/node-manager.sh add -n singapore-01 -h 5.6.7.8 -u root
   ./scripts/node-manager.sh add -n london-01 -h 9.10.11.12 -u root
   
   # 批量部署Agent
   ./scripts/node-manager.sh batch deploy --all
   ```

3. **监控网络状态**
   ```bash
   # 实时监控
   ./scripts/node-manager.sh monitor
   
   # 生成状态报告
   ./scripts/node-manager.sh report
   ```

## 🚨 故障排除

### 常见问题解决

1. **主服务器无法访问**
   ```bash
   # 检查服务状态
   cd /opt/ssalgten && ./manage.sh status
   
   # 检查Nginx状态
   sudo systemctl status nginx
   
   # 检查SSL证书
   sudo certbot certificates
   ```

2. **Agent节点离线**
   ```bash
   # 在Agent节点检查
   cd /opt/ssalgten-agent
   docker compose logs
   
   # 重启Agent服务
   docker compose restart
   ```

3. **数据库连接问题**
   ```bash
   # 检查数据库容器
   docker compose logs postgres
   
   # 重启数据库
   docker compose restart postgres
   ```

## 📈 性能优化建议

### 主服务器优化

1. **资源监控**
   ```bash
   # 定期运行监控脚本
   ./monitor.sh
   
   # 查看资源使用
   htop
   docker stats
   ```

2. **数据库优化**
   ```bash
   # 定期备份
   ./manage.sh backup
   
   # 清理旧日志
   docker system prune
   ```

### 网络扩展策略

1. **地理分布**
   - 选择不同地区的VPS提供商
   - 优先部署在网络节点城市

2. **服务商多样化**
   - 使用多个云服务提供商
   - 避免单点故障

## 💡 小贴士

1. **域名配置**
   - 推荐使用CloudFlare等CDN服务
   - 开启HTTPS和HTTP/2

2. **安全加固**
   - 定期更新系统和依赖
   - 使用强密码和SSH密钥
   - 启用fail2ban防护

3. **监控告警**
   - 集成监控系统 (如Prometheus)
   - 设置关键指标告警
   - 定期检查节点状态

4. **备份策略**
   - 自动化数据库备份
   - 配置文件版本控制
   - 异地备份重要数据

---

**需要帮助？** 
- 查看 [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) 详细部署文档
- 查看 [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) 回滚应急预案
- 运行 `./scripts/production-test.sh --help` 了解测试工具
