# SsalgTen VPS 实际部署指南

## 🌐 部署架构说明

```
主服务器 (Master VPS)                    代理节点 (Agent VPS)
├── 前端 (Frontend)                     ├── Agent 程序
├── 后端API (Backend)                   ├── 系统监控
├── 数据库 (PostgreSQL)                 └── 自动上报
├── Nginx 反向代理
└── SSL 证书

           ↕️ HTTPS通信
    [监控数据] [节点状态] [ASN信息]
```

## 🖥️ VPS 服务器要求

### 主服务器 (Master)
- **最低配置**: 2核CPU, 4GB内存, 40GB存储, 10Mbps带宽
- **推荐配置**: 4核CPU, 8GB内存, 80GB SSD, 100Mbps带宽
- **系统**: Ubuntu 20.04 LTS / CentOS 8+ / Debian 11+
- **端口要求**: 80, 443, 22 对外开放

### 代理节点 (Agent)
- **最低配置**: 1核CPU, 1GB内存, 10GB存储
- **推荐配置**: 2核CPU, 2GB内存, 20GB存储  
- **系统**: Ubuntu 20.04 LTS / CentOS 8+ / Debian 11+
- **端口要求**: 22, 3002 (可选对外开放)

## 🚀 第一步：主服务器部署

### 1.1 服务器初始设置

```bash
# 连接到VPS
ssh root@your-server-ip

# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git vim ufw htop

# 创建应用用户
useradd -m -s /bin/bash ssalgten
usermod -aG sudo ssalgten

# 设置防火墙
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# 切换到应用用户
su - ssalgten
```

### 1.2 安装Docker环境

```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加用户到docker组
sudo usermod -aG docker $USER

# 重新登录以应用组变更
exit
ssh ssalgten@your-server-ip

# 验证安装
docker --version
docker-compose --version
```

### 1.3 部署SsalgTen主服务

```bash
# 克隆项目
cd ~
git clone https://github.com/lonelyrower/SsalgTen.git
cd SsalgTen

# 创建生产环境配置
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 1.4 配置环境变量

**编辑 backend/.env**
```bash
nano backend/.env
```

```env
# 生产环境配置
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置 (使用强密码)
DATABASE_URL="postgresql://ssalgten:YOUR_STRONG_DB_PASSWORD@postgres:5432/ssalgten?schema=public"

# 安全配置 (生成强密钥)
JWT_SECRET=your-super-secure-jwt-secret-at-least-64-characters-long
API_KEY_SECRET=your-strong-api-key-secret-32-chars-minimum

# CORS配置 (替换为你的域名)
CORS_ORIGIN=https://your-domain.com

# IP信息服务 (建议注册获取token)
IPINFO_TOKEN=your-ipinfo-token-optional

# 节点管理
DEFAULT_AGENT_API_KEY=your-production-agent-key-change-this
```

**编辑 frontend/.env**
```bash
nano frontend/.env
```

```env
# API配置 (替换为你的域名)
VITE_API_URL=https://your-domain.com/api

# 生产环境
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false
```

### 1.5 启动服务

```bash
# 构建和启动服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 🌍 第二步：域名和SSL配置

### 2.1 域名配置

在你的域名提供商处设置DNS记录：
```
类型    名称    值
A       @       your-server-ip
A       www     your-server-ip
```

### 2.2 安装Nginx和SSL

```bash
# 安装Nginx
sudo apt install nginx

# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 配置Nginx
sudo nano /etc/nginx/sites-available/ssalgten
```

**Nginx配置文件内容:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# 启用站点配置
sudo ln -s /etc/nginx/sites-available/ssalgten /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试SSL自动续期
sudo certbot renew --dry-run
```

## 📱 第三步：创建代理节点一键安装脚本

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "\u521b\u5efaVPS\u4e3b\u670d\u52a1\u5668\u90e8\u7f72\u6307\u5357", "status": "completed", "id": "1"}, {"content": "\u521b\u5efa\u4ee3\u7406\u8282\u70b9\u4e00\u952e\u5b89\u88c5\u811a\u672c", "status": "in_progress", "id": "2"}, {"content": "\u521b\u8282\u70b9\u7ba1\u7406\u5de5\u5177", "status": "pending", "id": "3"}, {"content": "\u521b\u5efa\u90e8\u7f72\u9a8c\u8bc1\u548c\u76d1\u63a7\u811a\u672c", "status": "pending", "id": "4"}]