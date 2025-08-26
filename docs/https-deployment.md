# 域名 + HTTPS 部署指南

本文档提供了将 SsalgTen 部署到域名并启用 HTTPS 的完整方案。

## 📋 部署方式选择

### 方式一：Docker + Caddy 一键部署（推荐）

**优点**：完全容器化，自动 HTTPS，一键部署，零配置
**适用**：快速部署生产环境

### 方式二：手动 Caddy 配置

**优点**：自动 HTTPS 证书申请和续期，配置简单，零维护
**适用**：自定义配置需求

### 方式三：Nginx + Certbot

**优点**：更灵活的配置，适合复杂场景
**适用**：需要自定义 Nginx 配置的场景

### 方式四：Traefik

**优点**：服务发现，适合多服务环境
**适用**：Docker Swarm 或 Kubernetes 环境

## 🚀 推荐方案：Docker + Caddy 一键部署

### 1. 快速部署

这是最简单的部署方式，使用我们提供的一键部署脚本：

```bash
# 下载项目
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen

# 一键部署 HTTPS
sudo ./scripts/deploy-https.sh --domain your-domain.com --email admin@your-domain.com
```

### 2. 手动部署（如果需要自定义）

```bash
# 1. 配置环境变量
cp .env.example .env
vi .env  # 设置 DOMAIN 和其他配置

# 2. 部署服务
docker-compose -f docker-compose.https.yml up -d

# 3. 检查服务状态
docker-compose -f docker-compose.https.yml ps
```

### 3. 验证部署

```bash
# 检查 SSL 证书
./scripts/check-ssl.sh your-domain.com

# 测试服务端点
curl -I https://your-domain.com/api/health
```

---

## 🛠️ 方案二：手动 Caddy 配置

### 1. 安装 Caddy

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# CentOS/RHEL
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://dl.cloudsmith.io/public/caddy/stable/rpm/caddy-stable.repo
sudo yum install caddy
```

### 2. 配置 Caddy

创建 `/etc/caddy/Caddyfile`：

```caddy
# 替换为你的域名
your-domain.com {
    # 前端应用
    handle_path /* {
        reverse_proxy localhost:80
    }
    
    # API 接口
    handle_path /api/* {
        reverse_proxy localhost:3001
    }
    
    # Socket.IO WebSocket
    handle_path /socket.io/* {
        reverse_proxy localhost:3001
    }
    
    # 健康检查
    handle_path /health {
        reverse_proxy localhost:3001
    }
    
    # 日志
    log {
        output file /var/log/caddy/ssalgten.log {
            roll_size 10MB
            roll_keep 5
        }
    }
}
```

### 3. 配置 SsalgTen 环境变量

修改 `.env` 文件：

```bash
# 域名配置（重要！）
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# API配置使用相对路径
VITE_API_URL=/api
VITE_API_BASE_URL=/api

# 端口保持默认即可（Caddy会反代）
FRONTEND_PORT=80
BACKEND_PORT=3001

# 其他必要配置...
```

### 4. 启动服务

```bash
# 启动 SsalgTen
docker-compose up -d

# 启动 Caddy
sudo systemctl enable caddy
sudo systemctl start caddy

# 检查状态
sudo systemctl status caddy
```

### 5. 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 如果需要直接访问（可选）
sudo ufw allow 3001/tcp  # 后端API
```

## 📱 Agent 安装

使用域名安装 Agent：

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | sudo bash -s -- \
  --master-url https://your-domain.com \
  --agent-port 3002 \
  --name "Agent节点名称"
```

## 🔍 故障排查

### 检查服务状态

```bash
# 检查 Caddy
sudo systemctl status caddy
sudo journalctl -u caddy -f

# 检查 SsalgTen
docker-compose ps
docker-compose logs -f

# 检查端口监听
sudo ss -tlnp | grep -E ':(80|443|3001)'
```

### 常见问题

1. **证书申请失败**
   ```bash
   # 检查域名解析
   dig your-domain.com
   
   # 检查 Caddy 日志
   sudo journalctl -u caddy -n 50
   ```

2. **API 请求失败**
   ```bash
   # 测试后端健康
   curl http://localhost:3001/api/health
   
   # 测试通过 Caddy
   curl https://your-domain.com/api/health
   ```

3. **WebSocket 连接问题**
   - 确保 CORS_ORIGIN 正确配置
   - 检查防火墙是否开放 443 端口

## 🔄 从 IP 迁移到域名

如果你之前使用 IP 访问，现在想切换到域名：

```bash
# 1. 更新环境配置
vi .env
# 修改 DOMAIN, FRONTEND_URL, CORS_ORIGIN

# 2. 重新构建前端（更新API地址）
docker-compose down
docker-compose build frontend
docker-compose up -d

# 3. 更新所有 Agent
# 在每个 Agent 节点上重新运行安装命令，使用新的域名
```

## 🔐 高级配置

### 自定义证书路径

如果你有自己的证书：

```caddy
your-domain.com {
    tls /path/to/cert.pem /path/to/key.pem
    # ... 其他配置
}
```

### 多域名支持

```caddy
your-domain.com, www.your-domain.com {
    # ... 配置
}
```

### 强制 HTTPS 重定向

```caddy
http://your-domain.com {
    redir https://your-domain.com{uri} permanent
}

https://your-domain.com {
    # ... 主要配置
}
```

## 📊 监控和维护

```bash
# 检查证书有效期
curl -vI https://your-domain.com 2>&1 | grep -A 2 -B 2 expire

# 监控 Caddy 性能
sudo systemctl status caddy

# 查看访问日志
sudo tail -f /var/log/caddy/ssalgten.log
```

---

## 📞 支持

如果遇到问题：
1. 检查 [故障排查](#-故障排查) 部分
2. 查看项目 Issues
3. 提交新的 Issue 并附上日志信息