# SsalgTen 安全监控 - 快速开始

## 🚀 一键部署

```bash
# 在项目根目录执行
bash scripts/deploy-security-monitoring.sh
```

脚本将自动完成：
- ✅ 安装nodemailer依赖
- ✅ 配置环境变量
- ✅ 构建Docker镜像
- ✅ 启动服务
- ✅ 验证部署状态

---

## 📋 功能概览

### 1️⃣ SSH暴力破解监控
**功能**: 检测频繁的SSH登录失败
- 监控日志: `/var/log/auth.log`
- 默认阈值: 10分钟内5次失败
- 告警级别: ⚠️ Warning
- 事件类型: `SSH_BRUTEFORCE`

**触发示例**:
```bash
# 模拟SSH暴力破解
for i in {1..6}; do ssh invalid@localhost; done
```

### 2️⃣ 挖矿程序检测
**功能**: 检测XMRig、Minerd等挖矿程序
- 检测方式: 进程名、命令行、高CPU占用
- CPU阈值: 80%
- 内存阈值: 70%
- 告警级别: 🚨 **Critical** (立即发送邮件)
- 事件类型: `MALWARE_DETECTED`

**检测的挖矿程序**:
- XMRig, Minerd, ccminer, ethminer
- xmr-stak, cryptonight, randomx
- poolminer, stratum

**触发示例**:
```bash
# 模拟高CPU进程（测试用）
yes > /dev/null &
# 记得杀掉: killall yes
```

### 3️⃣ DDoS攻击检测
**功能**: 检测SYN Flood等DDoS攻击
- 监控指标: 
  - 网络流量速率 (默认阈值: 100 Mbps)
  - 连接数 (默认阈值: 1000)
  - SYN_RECV状态连接 (默认阈值: 100)
- 告警级别: 🚨 **Critical** (立即发送邮件)
- 事件类型: `DDOS_ATTACK`

**触发示例**:
```bash
# 查看当前连接状态
ss -s
netstat -an | grep SYN_RECV | wc -l
```

### 4️⃣ 文件完整性监控
**功能**: 检测关键系统文件的篡改
- 监控文件:
  - `/etc/passwd` - 用户账户
  - `/etc/shadow` - 密码哈希
  - `/etc/ssh/sshd_config` - SSH配置
  - `/etc/crontab` - 定时任务
  - `/etc/sudoers` - 权限配置
- 检测方式: SHA256哈希对比
- 告警级别: 🚨 **Critical** (立即发送邮件)
- 事件类型: `INTRUSION_DETECTED`

**触发示例**:
```bash
# 模拟文件篡改（需root）
sudo echo "# test" >> /etc/crontab
```

---

## ⚙️ 配置说明

### 方式1: 使用部署脚本（推荐）
```bash
bash scripts/deploy-security-monitoring.sh
```
脚本会交互式引导您完成所有配置。

### 方式2: 手动配置

#### Step 1: 复制配置文件
```bash
cp agent/.env.example agent/.env
```

#### Step 2: 编辑配置
```bash
nano agent/.env
```

**必填项**:
```bash
# 基础配置
MASTER_URL=http://your-backend-server:3000
MASTER_API_KEY=your-api-key

# 启用安全监控
SSH_MONITOR_ENABLED=true
PROCESS_MONITOR_ENABLED=true
NETWORK_MONITOR_ENABLED=true
FILE_MONITOR_ENABLED=true
```

**可选 - 邮件告警**:
```bash
EMAIL_ALERTS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Gmail需使用应用专用密码
SMTP_TO=admin@example.com,security@example.com
```

#### Step 3: 更新Docker Compose
在`docker-compose.yml`的`agent`服务中添加：

```yaml
agent:
  environment:
    # 安全监控
    - SSH_MONITOR_ENABLED=${SSH_MONITOR_ENABLED:-true}
    - PROCESS_MONITOR_ENABLED=${PROCESS_MONITOR_ENABLED:-true}
    - NETWORK_MONITOR_ENABLED=${NETWORK_ENABLED:-true}
    - FILE_MONITOR_ENABLED=${FILE_MONITOR_ENABLED:-true}
    - EMAIL_ALERTS_ENABLED=${EMAIL_ALERTS_ENABLED:-false}
    - SMTP_HOST=${SMTP_HOST}
    - SMTP_PORT=${SMTP_PORT}
    - SMTP_USER=${SMTP_USER}
    - SMTP_PASS=${SMTP_PASS}
    - SMTP_TO=${SMTP_TO}
  volumes:
    - /var/log:/host/var/log:ro
    - /etc/passwd:/host/etc/passwd:ro
    - /etc/shadow:/host/etc/shadow:ro
    - /etc/ssh:/host/etc/ssh:ro
    - /etc/crontab:/host/etc/crontab:ro
```

#### Step 4: 安装依赖
```bash
cd agent
npm install nodemailer @types/nodemailer
```

#### Step 5: 构建并启动
```bash
docker-compose build agent backend
docker-compose up -d
```

---

## 📧 Gmail邮件配置

### 启用应用专用密码

1. 访问 https://myaccount.google.com/security
2. 启用"两步验证"
3. 访问 https://myaccount.google.com/apppasswords
4. 创建"应用专用密码"
5. 将密码填入`SMTP_PASS`

### 配置示例
```bash
EMAIL_ALERTS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # 应用专用密码
SMTP_FROM=SsalgTen Agent <noreply@ssalgten.com>
SMTP_TO=admin@example.com
```

---

## 🧪 测试验证

### 自动化测试
```bash
bash scripts/test-security-monitoring.sh
```

测试项目包括：
- ✅ 环境变量检查
- ✅ Agent服务状态
- ✅ 安全模块初始化
- ✅ 进程监控
- ✅ 网络监控
- ✅ 文件监控
- ✅ 后端事件接收
- ✅ 前端API响应
- ✅ SMTP配置
- ✅ 性能检查

### 手动测试

#### 1. 查看Agent日志
```bash
docker-compose logs -f agent | grep -E "(SSH|Process|Network|File|Email)"
```

**期望输出**:
```
agent    | ✓ SSH Monitor enabled
agent    | ✓ Process Monitor enabled (crypto mining detection)
agent    | ✓ Network Monitor enabled (DDoS detection)
agent    | ✓ File Monitor enabled (integrity check)
agent    | ✓ Email Alerts enabled
agent    | File integrity baseline initialized: 5 files
```

#### 2. 检查心跳数据
```bash
# 查看最近的心跳日志
docker-compose logs agent --tail=100 | grep "Sending heartbeat"
```

**期望输出**:
```json
{
  "security": {
    "ssh": { "failedLogins": [...] },
    "processes": { "highCpu": [...], "cryptoMiners": [...] },
    "network": { "trafficRateMbps": 5.2, "connections": 234 },
    "files": { "baseline": 5, "changes": [] }
  }
}
```

#### 3. 验证前端显示
访问 `http://localhost:3000`：

**首页 - 安全事件卡片**:
- 显示最近24小时的安全事件数量
- 有威胁显示"警惕"徽章（红色）
- 无威胁显示"正常"徽章（绿色）

**威胁监控页面**:
- 实时威胁列表
- 威胁分布饼图
- 时间线趋势图
- 事件详情模态框

#### 4. 测试邮件告警
```bash
# 模拟挖矿程序（触发Critical告警）
docker exec ssalgten-agent-1 node -e "
const cpu = require('os').cpus();
while(true) { Math.random(); }
"
```

**期望结果**:
- Agent日志显示"Sending email alert for MALWARE_DETECTED"
- 收件箱收到告警邮件
- 邮件包含威胁详情、节点信息、处理建议

---

## 📊 监控指标

### CPU & 内存阈值
```bash
PROCESS_CPU_THRESHOLD=80  # 单进程CPU占用超过80%
PROCESS_MEM_THRESHOLD=70  # 单进程内存占用超过70%
```

### 网络流量阈值
```bash
TRAFFIC_THRESHOLD_MBPS=100    # 流量速率超过100 Mbps
CONNECTION_THRESHOLD=1000      # 连接数超过1000
SYN_FLOOD_THRESHOLD=100        # SYN_RECV状态超过100
```

### SSH监控阈值
```bash
SSH_MONITOR_WINDOW_MIN=10  # 时间窗口10分钟
SSH_MONITOR_THRESHOLD=5    # 失败次数阈值5次
```

---

## 🔧 故障排查

### 问题1: Agent启动失败
```bash
# 查看详细日志
docker-compose logs agent --tail=100

# 检查环境变量
docker exec ssalgten-agent-1 env | grep MONITOR
```

**常见原因**:
- nodemailer依赖未安装 → `cd agent && npm install`
- 环境变量缺失 → 检查`.env`文件
- 主机路径挂载失败 → 检查`docker-compose.yml`的volumes

### 问题2: 无法读取系统日志
**错误**: `Error reading SSH log: ENOENT`

**解决**:
```yaml
# 确保docker-compose.yml包含以下挂载
volumes:
  - /var/log:/host/var/log:ro
```

### 问题3: 邮件发送失败
```bash
# 测试SMTP连接
docker exec ssalgten-agent-1 node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

**常见问题**:
- Gmail未启用应用专用密码
- SMTP端口被防火墙拦截
- 邮箱密码错误

### 问题4: 文件基线初始化失败
**错误**: `Failed to initialize baseline`

**解决**:
```bash
# 检查文件权限
docker exec ssalgten-agent-1 ls -l /host/etc/passwd

# 检查挂载路径
docker inspect ssalgten-agent-1 | grep -A 10 Mounts
```

### 问题5: 前端无安全事件数据
```bash
# 检查后端事件创建
docker-compose logs backend | grep "Creating security event"

# 检查API响应
curl http://localhost:3000/api/nodes/stats
```

---

## 📈 性能优化

### 降低心跳频率
修改`agent/src/services/RegistrationService.ts`:
```typescript
// 从30秒改为60秒
setInterval(() => this.sendHeartbeat(), 60000);
```

### 减少监控路径
```bash
# 仅监控最关键的文件
MONITOR_PATHS=/etc/passwd,/etc/shadow
```

### 提高检测阈值
```bash
# 降低误报率
PROCESS_CPU_THRESHOLD=90
SYN_FLOOD_THRESHOLD=200
```

---

## 📚 相关文档

- **[SECURITY_UPGRADE_GUIDE.md](./SECURITY_UPGRADE_GUIDE.md)** - 完整升级指南
- **[SECURITY_MONITORING_IMPLEMENTATION.md](./SECURITY_MONITORING_IMPLEMENTATION.md)** - 实施细节
- **[AGENT_CAPABILITIES_ANALYSIS.md](./AGENT_CAPABILITIES_ANALYSIS.md)** - Agent功能分析

---

## 💡 最佳实践

### 1. 多层监控
```bash
# 启用所有4个监控模块
SSH_MONITOR_ENABLED=true
PROCESS_MONITOR_ENABLED=true
NETWORK_MONITOR_ENABLED=true
FILE_MONITOR_ENABLED=true
```

### 2. 及时告警
```bash
# 启用邮件，确保Critical事件立即通知
EMAIL_ALERTS_ENABLED=true
SMTP_TO=security-team@example.com,admin@example.com
```

### 3. 定期审查
```bash
# 每周查看安全事件趋势
curl http://localhost:3000/api/security-events?days=7
```

### 4. 进程白名单
```bash
# 添加业务进程到白名单，减少误报
WHITELIST_PROCESSES=node,nginx,postgres,redis,your-app
```

### 5. 自定义阈值
根据VPS配置调整阈值：
- **小型VPS** (1C2G): CPU=90%, MEM=80%
- **中型VPS** (2C4G): CPU=80%, MEM=70%
- **大型VPS** (4C8G): CPU=70%, MEM=60%

---

## 🎯 下一步

1. ✅ 完成部署 → `bash scripts/deploy-security-monitoring.sh`
2. ✅ 配置邮件告警
3. ✅ 访问前端验证
4. ✅ 运行测试脚本
5. ✅ 监控真实威胁
6. 📊 根据实际情况调优阈值
7. 🔄 定期更新白名单和监控路径

---

## 🆘 获取帮助

如遇到问题：
1. 查看日志: `docker-compose logs agent backend`
2. 运行诊断: `bash scripts/test-security-monitoring.sh`
3. 查看文档: `docs/` 目录
4. 提交Issue: GitHub Issues

---

**版本**: SsalgTen v2.1.0  
**更新时间**: 2024  
**作者**: SsalgTen Security Team
