# SsalgTen v2.1.0 安全监控 - 部署检查清单

## ✅ 部署前检查

### 1. 环境准备
- [ ] Docker 已安装 (`docker --version`)
- [ ] Docker Compose 已安装 (`docker-compose --version`)
- [ ] Node.js 18+ 已安装 (`node --version`)
- [ ] 项目已克隆到本地
- [ ] 当前在项目根目录

### 2. 文件完整性
- [ ] `agent/src/services/ProcessMonitor.ts` 存在 (324行)
- [ ] `agent/src/services/NetworkMonitor.ts` 存在 (436行)
- [ ] `agent/src/services/FileMonitor.ts` 存在 (347行)
- [ ] `agent/src/services/EmailAlertService.ts` 存在 (243行)
- [ ] `agent/src/services/RegistrationService.ts` 已更新
- [ ] `backend/src/controllers/NodeController.ts` 已更新
- [ ] `agent/package.json` 包含nodemailer依赖

### 3. 配置文件
- [ ] `agent/.env.example` 已更新安全监控配置
- [ ] `docker-compose.yml` 包含安全监控环境变量
- [ ] `docker-compose.yml` 包含主机路径挂载

---

## 🚀 部署步骤

### 方式A: 自动部署（推荐）

```bash
# 一键部署
bash scripts/deploy-security-monitoring.sh
```

**脚本执行流程**:
1. ✅ 检查项目目录
2. ✅ 安装Agent依赖 (nodemailer)
3. ✅ 交互式配置环境变量
4. ✅ 更新docker-compose.yml
5. ✅ 构建Docker镜像
6. ✅ 启动服务
7. ✅ 验证部署状态

---

### 方式B: 手动部署

#### Step 1: 安装依赖
```bash
cd agent
npm install nodemailer @types/nodemailer
cd ..
```

#### Step 2: 配置环境变量
```bash
# 复制示例配置
cp agent/.env.example agent/.env

# 编辑配置文件
nano agent/.env
```

**必填配置**:
```bash
# 基础配置
MASTER_URL=http://backend:3000
MASTER_API_KEY=your-api-key

# 安全监控
SSH_MONITOR_ENABLED=true
PROCESS_MONITOR_ENABLED=true
NETWORK_MONITOR_ENABLED=true
FILE_MONITOR_ENABLED=true

# 邮件告警（可选）
EMAIL_ALERTS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_TO=admin@example.com
```

#### Step 3: 更新Docker Compose

编辑 `docker-compose.yml`，在 `agent` 服务中添加：

```yaml
agent:
  build:
    context: .
    dockerfile: Dockerfile.agent
  container_name: ssalgten-agent-1
  environment:
    # 基础配置
    - NODE_ENV=production
    - MASTER_URL=${MASTER_URL}
    - MASTER_API_KEY=${MASTER_API_KEY}
    
    # 安全监控配置
    - SSH_MONITOR_ENABLED=${SSH_MONITOR_ENABLED:-true}
    - SSH_LOG_PATH=${SSH_LOG_PATH:-/host/var/log/auth.log}
    - SSH_MONITOR_WINDOW_MIN=${SSH_MONITOR_WINDOW_MIN:-10}
    - SSH_MONITOR_THRESHOLD=${SSH_MONITOR_THRESHOLD:-5}
    
    - PROCESS_MONITOR_ENABLED=${PROCESS_MONITOR_ENABLED:-true}
    - PROCESS_CPU_THRESHOLD=${PROCESS_CPU_THRESHOLD:-80}
    - PROCESS_MEM_THRESHOLD=${PROCESS_MEM_THRESHOLD:-70}
    - SUSPICIOUS_PATHS=${SUSPICIOUS_PATHS:-/tmp,/dev/shm,/var/tmp}
    - WHITELIST_PROCESSES=${WHITELIST_PROCESSES:-node,systemd,docker}
    
    - NETWORK_MONITOR_ENABLED=${NETWORK_MONITOR_ENABLED:-true}
    - PRIMARY_INTERFACE=${PRIMARY_INTERFACE:-eth0}
    - TRAFFIC_THRESHOLD_MBPS=${TRAFFIC_THRESHOLD_MBPS:-100}
    - CONNECTION_THRESHOLD=${CONNECTION_THRESHOLD:-1000}
    - SYN_FLOOD_THRESHOLD=${SYN_FLOOD_THRESHOLD:-100}
    
    - FILE_MONITOR_ENABLED=${FILE_MONITOR_ENABLED:-true}
    - MONITOR_PATHS=${MONITOR_PATHS:-/etc/passwd,/etc/shadow,/etc/ssh/sshd_config}
    - BASELINE_FILE=${BASELINE_FILE:-/var/lib/ssalgten/file-baseline.json}
    
    - EMAIL_ALERTS_ENABLED=${EMAIL_ALERTS_ENABLED:-false}
    - SMTP_HOST=${SMTP_HOST}
    - SMTP_PORT=${SMTP_PORT:-587}
    - SMTP_USER=${SMTP_USER}
    - SMTP_PASS=${SMTP_PASS}
    - SMTP_FROM=${SMTP_FROM:-SsalgTen Agent <noreply@ssalgten.com>}
    - SMTP_TO=${SMTP_TO}
  
  volumes:
    # 安全监控所需的主机路径挂载
    - /var/log:/host/var/log:ro
    - /etc/passwd:/host/etc/passwd:ro
    - /etc/shadow:/host/etc/shadow:ro
    - /etc/ssh:/host/etc/ssh:ro
    - /etc/crontab:/host/etc/crontab:ro
    - /etc/sudoers:/host/etc/sudoers:ro
    - agent-data:/var/lib/ssalgten
  
  networks:
    - ssalgten-network
  
  restart: unless-stopped

volumes:
  agent-data:
```

#### Step 4: 构建镜像
```bash
docker-compose build agent backend
```

#### Step 5: 启动服务
```bash
docker-compose down
docker-compose up -d
```

---

## 🔍 部署验证

### 1. 检查容器状态
```bash
docker-compose ps
```

**期望输出**:
```
NAME                  STATUS
ssalgten-agent-1      Up X seconds (healthy)
ssalgten-backend-1    Up X seconds (healthy)
ssalgten-frontend-1   Up X seconds
```

### 2. 检查Agent日志
```bash
docker-compose logs agent --tail=50
```

**期望看到**:
```
✓ SSH Monitor enabled
✓ Process Monitor enabled (crypto mining detection)
✓ Network Monitor enabled (DDoS detection)
✓ File Monitor enabled (integrity check)
✓ Email Alerts enabled
File integrity baseline initialized: 5 files
Sending heartbeat with security data...
```

### 3. 检查Backend日志
```bash
docker-compose logs backend --tail=50 | grep -i security
```

**期望看到**:
```
Processing security data from agent...
Creating security event: SSH_BRUTEFORCE
Creating security event: MALWARE_DETECTED
Security events stats updated
```

### 4. 验证API响应
```bash
# 检查节点统计
curl http://localhost:3000/api/nodes/stats | jq

# 检查安全事件
curl http://localhost:3000/api/security-events?limit=10 | jq
```

**期望输出**:
```json
{
  "totalNodes": 1,
  "onlineNodes": 1,
  "offlineNodes": 0,
  "securityEvents": {
    "total": 5,
    "critical": 2,
    "sshBruteforce": 1,
    "malwareDetected": 1,
    "ddosAttack": 0,
    "intrusionDetected": 1,
    "anomalyDetected": 2,
    "suspiciousActivity": 0
  }
}
```

### 5. 验证前端显示

访问 `http://localhost:3000`:

#### 首页检查
- [ ] "安全事件" 卡片显示在顶部
- [ ] 卡片显示正确的事件数量
- [ ] 徽章状态正确（有威胁=警惕，无威胁=正常）
- [ ] 点击卡片跳转到威胁监控页面

#### 威胁监控页面检查
- [ ] 最近威胁列表显示
- [ ] 威胁分布饼图显示
- [ ] 时间线趋势图显示
- [ ] 点击威胁项显示详情模态框
- [ ] 模态框包含威胁详情和处理建议

### 6. 测试邮件告警（如果启用）

```bash
# 模拟高CPU进程
docker exec ssalgten-agent-1 node -e "while(true){Math.random();}"
```

等待30秒后：
- [ ] Agent日志显示 "Detected crypto miner"
- [ ] Agent日志显示 "Sending email alert"
- [ ] 收件箱收到告警邮件
- [ ] 邮件包含威胁详情、节点信息、处理建议

**停止测试进程**:
```bash
docker exec ssalgten-agent-1 pkill -f "Math.random"
```

---

## 🧪 功能测试

### 运行自动化测试
```bash
bash scripts/test-security-monitoring.sh
```

**测试覆盖**:
- ✅ 环境变量配置
- ✅ Agent服务健康检查
- ✅ 安全模块初始化
- ✅ 进程监控功能
- ✅ 网络监控功能
- ✅ 文件监控功能
- ✅ 后端事件创建
- ✅ 前端API响应
- ✅ SMTP配置（如启用）
- ✅ 性能指标

### 手动触发测试

#### 1. SSH暴力破解检测
```bash
# 模拟失败登录（在宿主机执行）
for i in {1..6}; do
  echo "Failed password for invalid" | sudo tee -a /var/log/auth.log
done

# 等待30秒后检查
docker-compose logs backend | grep SSH_BRUTEFORCE
```

#### 2. 进程监控（挖矿检测）
```bash
# 模拟高CPU进程
docker exec ssalgten-agent-1 bash -c "
yes > /dev/null &
PID=\$!
sleep 35
kill \$PID
"

# 检查检测结果
docker-compose logs agent | grep -i "high cpu\|crypto"
```

#### 3. 网络流量监控
```bash
# 查看当前网络统计
docker exec ssalgten-agent-1 cat /proc/net/dev

# 模拟流量（需要实际网络活动）
# 或直接查看Agent收集的数据
docker-compose logs agent | grep "Network stats"
```

#### 4. 文件完整性监控
```bash
# 模拟文件修改
docker exec ssalgten-agent-1 sh -c "
echo '# test change' >> /host/etc/crontab
"

# 等待30秒后检查
docker-compose logs backend | grep INTRUSION_DETECTED

# 恢复文件
docker exec ssalgten-agent-1 sh -c "
sed -i '\$ d' /host/etc/crontab
"
```

---

## 📊 性能检查

### 1. 资源占用
```bash
# 查看容器资源占用
docker stats --no-stream

# 检查Agent内存
docker exec ssalgten-agent-1 free -h

# 检查Agent CPU
docker exec ssalgten-agent-1 top -b -n 1
```

**期望范围**:
- Agent CPU: < 5%
- Agent Memory: < 200MB
- Backend CPU: < 10%
- Backend Memory: < 300MB

### 2. 心跳性能
```bash
# 查看心跳发送时间
docker-compose logs agent | grep "Heartbeat sent" | tail -10
```

**期望**:
- 心跳间隔: 30秒 ± 2秒
- 心跳数据大小: < 10KB
- 发送耗时: < 1秒

### 3. 数据库性能
```bash
# 检查安全事件表大小
docker exec ssalgten-backend-1 sqlite3 /app/backend/dev.db \
  "SELECT COUNT(*) FROM security_events;"

# 检查最新事件
docker exec ssalgten-backend-1 sqlite3 /app/backend/dev.db \
  "SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 5;"
```

---

## 🔧 故障排查

### 问题1: Agent容器无法启动

**症状**: `docker-compose ps` 显示 agent 状态为 Exited

**排查步骤**:
```bash
# 查看启动日志
docker-compose logs agent --tail=100

# 检查环境变量
docker-compose config | grep -A 50 agent

# 检查依赖安装
docker exec ssalgten-agent-1 ls node_modules/nodemailer 2>/dev/null
```

**常见原因**:
- nodemailer未安装 → 重新执行 `cd agent && npm install`
- 环境变量缺失 → 检查 `.env` 文件
- TypeScript编译错误 → 检查 `agent/src/services/` 下的文件

---

### 问题2: 无法读取系统日志

**症状**: Agent日志显示 `Error reading SSH log: ENOENT`

**排查步骤**:
```bash
# 检查宿主机日志文件
ls -l /var/log/auth.log

# 检查容器内挂载
docker exec ssalgten-agent-1 ls -l /host/var/log/auth.log

# 检查挂载配置
docker inspect ssalgten-agent-1 | grep -A 10 Mounts
```

**解决方案**:
```yaml
# 确保docker-compose.yml包含正确的挂载
volumes:
  - /var/log:/host/var/log:ro
```

---

### 问题3: 邮件发送失败

**症状**: Agent日志显示 `Failed to send email`

**排查步骤**:
```bash
# 测试SMTP连接
docker exec ssalgten-agent-1 node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.verify()
  .then(() => console.log('✓ SMTP connection successful'))
  .catch(err => console.error('✗ SMTP error:', err.message));
"
```

**常见问题**:
1. Gmail未启用应用专用密码
   - 解决: https://myaccount.google.com/apppasswords
2. SMTP端口被防火墙拦截
   - 解决: 检查 `iptables -L` 或云服务商安全组
3. 邮箱密码错误
   - 解决: 重新生成应用专用密码

---

### 问题4: 前端无数据显示

**症状**: 威胁监控页面显示"暂无威胁数据"

**排查步骤**:
```bash
# 1. 检查后端API
curl http://localhost:3000/api/security-events | jq

# 2. 检查数据库
docker exec ssalgten-backend-1 sqlite3 /app/backend/dev.db \
  "SELECT COUNT(*) FROM security_events;"

# 3. 检查Agent心跳
docker-compose logs agent | grep "Sending heartbeat"

# 4. 检查Backend接收
docker-compose logs backend | grep "security event"
```

**常见原因**:
- Agent未发送安全数据 → 检查安全模块是否启用
- Backend未解析数据 → 检查 NodeController.ts 逻辑
- 数据库连接失败 → 检查 Prisma 配置

---

### 问题5: 文件基线初始化失败

**症状**: `Failed to initialize file integrity baseline`

**排查步骤**:
```bash
# 检查监控文件权限
docker exec ssalgten-agent-1 ls -l /host/etc/passwd
docker exec ssalgten-agent-1 ls -l /host/etc/shadow

# 检查基线文件目录
docker exec ssalgten-agent-1 ls -ld /var/lib/ssalgten

# 检查写入权限
docker exec ssalgten-agent-1 touch /var/lib/ssalgten/test.txt
```

**解决方案**:
```yaml
# 确保volumes配置正确
volumes:
  - agent-data:/var/lib/ssalgten  # 持久化基线数据
  - /etc/passwd:/host/etc/passwd:ro
  - /etc/shadow:/host/etc/shadow:ro
```

---

## 📋 部署后清单

### 立即完成
- [ ] 所有容器运行正常
- [ ] Agent日志显示安全模块已初始化
- [ ] Backend接收到心跳数据
- [ ] 前端显示"安全事件"卡片
- [ ] 威胁监控页面可访问

### 24小时内
- [ ] 收集到真实的安全数据
- [ ] 邮件告警测试成功（如启用）
- [ ] 无异常错误日志
- [ ] 性能指标正常

### 一周内
- [ ] 调整阈值以减少误报
- [ ] 更新进程白名单
- [ ] 根据实际情况优化配置
- [ ] 定期审查安全事件趋势

---

## 📚 相关文档

- **[SECURITY_QUICK_START.md](./SECURITY_QUICK_START.md)** - 快速开始指南
- **[SECURITY_UPGRADE_GUIDE.md](./SECURITY_UPGRADE_GUIDE.md)** - 完整升级指南
- **[SECURITY_MONITORING_IMPLEMENTATION.md](./SECURITY_MONITORING_IMPLEMENTATION.md)** - 实施细节
- **[AGENT_CAPABILITIES_ANALYSIS.md](./AGENT_CAPABILITIES_ANALYSIS.md)** - Agent功能分析

---

## 🎯 成功标准

部署成功的标志:

1. ✅ **服务健康**
   - 所有容器状态为 "Up"
   - 健康检查通过

2. ✅ **功能正常**
   - 4个安全模块已初始化
   - 心跳数据包含security字段
   - Backend成功创建安全事件

3. ✅ **前端可用**
   - 安全事件卡片显示数据
   - 威胁监控页面可视化正常

4. ✅ **告警有效**（如启用）
   - SMTP连接成功
   - Critical事件触发邮件

5. ✅ **性能达标**
   - Agent CPU < 5%
   - Agent Memory < 200MB
   - 心跳间隔稳定在30秒

---

**版本**: SsalgTen v2.1.0  
**部署类型**: 安全监控升级版  
**最后更新**: 2024
