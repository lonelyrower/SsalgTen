# 🔧 节点未上线问题排查指南

## ⚡ 快速诊断步骤

### 第一步：检查Agent服务状态

在安装节点的VPS上执行以下命令：

```bash
# 1. 检查安装目录
cd /opt/ssalgten-agent
ls -la

# 2. 检查容器状态
docker-compose ps

# 3. 查看容器日志
docker-compose logs -f agent
```

### 第二步：检查网络连接

```bash
# 测试到主服务器的连接
curl -v http://158.51.78.137:3001/api/health

# 检查端口是否开放
nc -zv 158.51.78.137 3001

# 检查本地Agent健康状态
curl http://localhost:3002/health
```

### 第三步：检查配置文件

```bash
# 查看环境变量配置
cd /opt/ssalgten-agent
cat .env

# 检查关键配置项：
# - MASTER_URL=http://158.51.78.137:3001
# - AGENT_API_KEY=ssalgten_menv1ppc_aasykh9c
# - NODE_NAME, NODE_COUNTRY, NODE_CITY 等
```

---

## 🐛 常见问题和解决方案

### 问题1: Agent容器启动失败

**现象：** `docker-compose ps` 显示容器状态为 `Exit` 或 `Restarting`

**解决方案：**
```bash
# 查看详细错误日志
docker-compose logs agent

# 常见错误和解决方案：
# - "AGENT_API_KEY 未设置或仍为默认值" 
#   → 检查 .env 文件中的 AGENT_API_KEY 配置
# - "Port already in use"
#   → 检查端口3002是否被占用
# - "Cannot connect to Docker daemon"
#   → 检查Docker服务是否运行
```

### 问题2: Agent启动但无法注册

**现象：** 容器运行正常，但前端看不到节点

**检查步骤：**
```bash
# 1. 查看Agent注册日志
docker-compose logs agent | grep -i "register\|registration"

# 2. 测试API连接
curl -X POST http://158.51.78.137:3001/api/agents/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ssalgten_menv1ppc_aasykh9c" \
  -d '{
    "agentId": "test-agent",
    "nodeInfo": {
      "name": "Test Node",
      "country": "Test Country",
      "city": "Test City"
    }
  }'

# 3. 检查主服务器响应
curl http://158.51.78.137:3001/api/nodes
```

**常见错误和解决：**
- `API key is required` → 检查API密钥配置
- `Invalid API key` → 确认API密钥正确
- `Connection refused` → 检查主服务器是否运行
- `404 Not Found` → 检查URL路径是否正确

### 问题3: 注册成功但心跳失败

**现象：** 注册成功但节点显示离线状态

**排查方法：**
```bash
# 查看心跳日志
docker-compose logs agent | grep -i heartbeat

# 检查心跳API
curl -X POST http://158.51.78.137:3001/api/agents/your-agent-id/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ssalgten_menv1ppc_aasykh9c" \
  -d '{
    "status": "healthy",
    "uptime": 100
  }'
```

### 问题4: 防火墙问题

**现象：** 网络连接被阻断

**解决方案：**
```bash
# Ubuntu/Debian
sudo ufw allow 3002/tcp
sudo ufw allow out 3001/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=3002/tcp --permanent
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload

# 云服务器安全组
# 在云服务器控制台添加以下规则：
# 入站: 允许 3002/tcp (Agent端口)
# 出站: 允许 3001/tcp (主服务器端口)
```

### 问题5: DNS解析问题

**现象：** 域名无法解析

**解决方案：**
```bash
# 测试DNS解析
nslookup your-domain.com
dig your-domain.com

# 如果使用IP地址，确保格式正确：
# ✅ 正确: http://158.51.78.137:3001
# ❌ 错误: 158.51.78.137 (缺少协议)
# ❌ 错误: https://158.51.78.137 (协议错误，应该是http)
```

---

## 🚀 快速修复命令

### 重启Agent服务
```bash
cd /opt/ssalgten-agent
docker-compose restart
```

### 完全重建Agent
```bash
cd /opt/ssalgten-agent
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 重新安装Agent
```bash
# 1. 停止并删除现有服务
cd /opt/ssalgten-agent
docker-compose down
cd /
sudo rm -rf /opt/ssalgten-agent

# 2. 重新执行安装命令
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/install-agent.sh | bash -s -- \
  --master-url "http://158.51.78.137:3001" \
  --api-key "ssalgten_menv1ppc_aasykh9c"
```

---

## 📊 诊断脚本

我已经创建了一个自动诊断脚本，可以运行：

```bash
# 下载并运行诊断脚本
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/diagnose-node-offline.sh | bash
```

---

## 🔍 日志分析关键词

在查看日志时，注意这些关键信息：

**成功标志：**
- `✅ Registration successful!`
- `Heartbeat sent successfully`
- `Agent started successfully`

**错误标志：**
- `❌ Registration failed`
- `ECONNREFUSED`
- `Invalid API key`
- `404 Not Found`
- `Heartbeat error`

---

## 📞 获取支持

如果以上步骤都无法解决问题，请提供以下信息：

1. **Agent容器日志：**
   ```bash
   cd /opt/ssalgten-agent
   docker-compose logs agent > agent.log
   ```

2. **网络连接测试结果：**
   ```bash
   curl -v http://158.51.78.137:3001/api/health
   ```

3. **配置信息：**
   ```bash
   cat /opt/ssalgten-agent/.env | sed 's/API_KEY=.*/API_KEY=[隐藏]/'
   ```

4. **系统信息：**
   - 操作系统版本
   - Docker版本
   - 是否使用云服务器（哪个厂商）
   - 网络环境（是否有代理/防火墙）