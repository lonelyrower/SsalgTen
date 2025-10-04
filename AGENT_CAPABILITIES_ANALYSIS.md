# Agent 功能集成分析报告

## 📊 总体状况

**威胁监控页面需要的功能 vs Agent已实现的功能**

---

## 🎯 威胁监控页面期望的威胁类型

根据 `ThreatVisualization.tsx` 定义，系统支持5种威胁类型：

```typescript
type: 'ddos' | 'bruteforce' | 'malware' | 'intrusion' | 'anomaly';
```

### 1. DDoS攻击 (ddos)
- ❌ **未实现**
- 需要检测：流量峰值、异常连接数、包洪水攻击
- Agent缺少：网络流量监控、连接统计功能

### 2. 暴力破解 (bruteforce)
- ✅ **已实现** (仅SSH)
- 实现文件：`agent/src/services/SecurityMonitor.ts`
- 功能：
  - 监控 `/var/log/auth.log` 或 `/var/log/secure`
  - 检测SSH登录失败记录
  - 统计IP失败次数
  - 超过阈值触发告警
- 配置环境变量：
  ```bash
  SSH_MONITOR_ENABLED=true          # 默认false
  SSH_MONITOR_WINDOW_MIN=10         # 时间窗口(分钟)
  SSH_MONITOR_THRESHOLD=10          # 失败次数阈值
  ```
- ⚠️ **限制**：
  - 只支持SSH暴力破解
  - 不支持：FTP、RDP、MySQL等其他服务
  - 需要Docker挂载 `/var/log` 到 `/host/var/log`

### 3. 恶意软件 (malware)
- ❌ **未实现**
- 需要检测：
  - 可疑进程
  - 异常文件操作
  - 病毒签名扫描
- Agent缺少：进程监控、文件扫描功能

### 4. 入侵检测 (intrusion)
- ⚠️ **部分实现**
- 当前映射：
  - `AGENT_REGISTERED` → intrusion (低严重性)
  - 只是记录新Agent注册，不是真正的入侵检测
- 缺少：
  - 文件完整性检查
  - 系统调用监控
  - Rootkit检测

### 5. 异常行为 (anomaly)
- ⚠️ **部分实现**
- 当前映射：
  - `STATUS_CHANGED` → anomaly (节点上/下线)
  - `IP_CHANGED` → anomaly (IP地址变化)
  - 网络测试失败 → anomaly
- 缺少：
  - CPU/内存异常峰值
  - 异常网络流量
  - 异常进程行为

---

## 📋 Agent当前已实现的功能

### ✅ 核心功能（已完成）

#### 1. 系统监控
- **CPU信息**：型号、核心数、频率、使用率、温度(Linux)
- **内存信息**：总量、已用、可用、类型、速度
- **磁盘信息**：总容量、已用、可用
- **网络接口**：接口名称、IP地址
- **系统信息**：
  - 操作系统类型、版本
  - 主机名
  - 架构
  - 运行时间
  - 负载平均值

#### 2. 网络诊断
- **Ping测试**：
  - 延迟测量
  - 丢包率
  - 支持IPv4/IPv6
- **Traceroute**：
  - 路由跳数
  - 每跳延迟
  - 最大跳数可配置
- **MTR测试**：
  - 结合Ping + Traceroute
  - 实时网络路径分析
- **Speedtest**：
  - 下载速度
  - 上传速度
  - 延迟
  - 抖动

#### 3. 心跳与注册
- **自动注册**：启动时自动向Master注册
- **定期心跳**：
  - 默认30秒间隔
  - 发送系统状态
  - 发送SSH安全告警（如果启用）
- **健康检查**：`/health` 端点

#### 4. 安全功能（仅SSH暴力破解）
- **SSH监控**：
  - 解析 `/var/log/auth.log` (Debian/Ubuntu)
  - 解析 `/var/log/secure` (CentOS/RHEL)
  - 检测失败登录尝试
  - IP频率统计
  - 告警触发
- **限制**：
  - 需要Docker挂载日志目录
  - 仅支持Linux系统
  - 默认禁用（需手动配置）

#### 5. 安全限制
- **目标过滤**：
  - 黑名单：阻止内网地址、本地地址
  - 白名单：允许特定目标（支持通配符）
  - 防止滥用

---

## 🔴 Agent缺失的安全功能

### 1. DDoS检测
**需要实现：**
```typescript
// 监控网络连接数
interface NetworkMonitor {
  trackConnections(): ConnectionStats;
  detectFlood(): boolean;
  getTrafficRate(): number; // Mbps
}
```

**实现思路：**
- 读取 `/proc/net/tcp`, `/proc/net/tcp6`
- 统计SYN_RECV、ESTABLISHED状态数量
- 监控网卡流量 (从 `/sys/class/net/<iface>/statistics/`)
- 阈值检测：连接数、流量速率

### 2. 恶意软件检测
**需要实现：**
```typescript
interface MalwareScanner {
  scanProcesses(): SuspiciousProcess[];
  checkFileIntegrity(): FileChange[];
  detectRootkit(): RootkitIndicator[];
}
```

**实现思路：**
- 进程扫描：检测CPU占用异常、可疑路径、隐藏进程
- 文件监控：监控 `/tmp`, `/var/tmp` 可疑文件
- 哈希验证：关键系统文件完整性检查
- 集成 ClamAV 或 rkhunter（可选）

### 3. 入侵检测系统 (IDS)
**需要实现：**
```typescript
interface IntrusionDetector {
  monitorFileSystem(): FileEvent[];
  trackSystemCalls(): SyscallAnomaly[];
  checkPortScans(): PortScanEvent[];
}
```

**实现思路：**
- 文件监控：使用 `inotify` 监控关键目录
- 端口扫描检测：监控 `netstat` 异常连接
- 特权升级检测：监控 `sudo` 日志
- 防火墙日志分析（`iptables`, `ufw`）

### 4. 其他服务暴力破解
**需要扩展：**
```typescript
interface BruteforceDetector {
  checkSSH(): Alert[];      // ✅ 已实现
  checkFTP(): Alert[];      // ❌ 未实现
  checkRDP(): Alert[];      // ❌ 未实现
  checkMySQL(): Alert[];    // ❌ 未实现
  checkHTTP(): Alert[];     // ❌ 未实现 (web登录)
}
```

### 5. 异常行为分析
**需要增强：**
```typescript
interface AnomalyDetector {
  // ✅ 已有
  detectStatusChange(): boolean;
  detectIPChange(): boolean;
  
  // ❌ 需要添加
  detectCPUSpike(): boolean;
  detectMemoryLeak(): boolean;
  detectDiskFull(): boolean;
  detectTrafficAnomaly(): boolean;
  detectProcessAnomaly(): boolean;
}
```

---

## 📊 当前威胁监控的数据来源

### 前端映射逻辑 (`mapActivityToThreat`)

```typescript
EVENT_TYPE                → THREAT_TYPE    → SEVERITY
------------------------------------------------
SSH_BRUTEFORCE           → bruteforce     → high       ✅ Agent支持
STATUS_CHANGED(OFFLINE)  → anomaly        → high       ✅ 系统自动
STATUS_CHANGED(其他)     → anomaly        → low        ✅ 系统自动
IP_CHANGED               → anomaly        → medium     ✅ 系统自动
AGENT_REGISTERED         → intrusion      → low        ✅ 系统自动
网络测试失败              → anomaly        → medium     ✅ Agent支持
```

### 后端事件创建

在 `NodeController.ts` 的心跳处理中：

```typescript
// 从Agent心跳解析SSH告警
if (heartbeatData.security?.ssh?.alerts?.length) {
  for (const alert of heartbeatData.security.ssh.alerts) {
    await eventService.createEvent(
      node.id,
      "SSH_BRUTEFORCE",
      `SSH brute force attempts detected`,
      { ip: alert.ip, count: alert.count, windowMinutes: alert.windowMinutes }
    );
  }
}
```

---

## 🎯 威胁监控实际状态

### 真实数据（来自Agent）
1. **SSH暴力破解** ✅
   - Agent检测 → 心跳上报 → 后端创建事件 → 前端显示
   - 需要配置启用

### 模拟/衍生数据（来自系统）
2. **异常行为** ⚠️
   - 节点上下线（系统自动）
   - IP变化（系统检测）
   - 网络测试失败（诊断结果）
   
3. **入侵检测** ⚠️
   - 仅记录新Agent注册
   - 不是真正的入侵

### 完全缺失
4. **DDoS攻击** ❌
5. **恶意软件** ❌
6. **其他服务暴力破解** ❌

---

## 🚀 实现优先级建议

### 高优先级（Quick Win）

#### 1. 启用SSH监控（立即可用）
```bash
# 在Agent部署时添加环境变量
SSH_MONITOR_ENABLED=true
SSH_MONITOR_WINDOW_MIN=10
SSH_MONITOR_THRESHOLD=5

# Docker Compose 挂载日志
volumes:
  - /var/log:/host/var/log:ro
```

#### 2. 网络流量监控（DDoS基础）
**工作量：中**
- 读取 `/proc/net/dev` 获取流量统计
- 计算每秒流量速率
- 检测异常峰值
- 预计：1-2天

#### 3. 进程异常检测（恶意软件基础）
**工作量：中**
- 扫描 `ps aux` 输出
- 检测高CPU/内存进程
- 检测可疑路径 (`/tmp`, `/dev/shm`)
- 预计：2-3天

### 中优先级（增强安全）

#### 4. 文件完整性监控
**工作量：高**
- 监控关键系统文件
- 使用 `inotify` 或定期哈希验证
- 预计：3-5天

#### 5. 多服务暴力破解检测
**工作量：中**
- 扩展 SecurityMonitor
- 支持FTP、MySQL日志解析
- 预计：2-3天

### 低优先级（完整IDS）

#### 6. 端口扫描检测
**工作量：高**
- 分析防火墙日志
- 检测异常连接模式
- 预计：5-7天

#### 7. Rootkit检测
**工作量：高**
- 集成 `rkhunter` 或 `chkrootkit`
- 定期扫描
- 预计：5-7天

---

## 📝 配置指南

### 当前可用的安全功能

#### 启用SSH暴力破解监控

**1. Agent环境变量配置**
```bash
# .env
SSH_MONITOR_ENABLED=true
SSH_MONITOR_WINDOW_MIN=10    # 10分钟时间窗口
SSH_MONITOR_THRESHOLD=5      # 5次失败触发告警
```

**2. Docker Compose配置**
```yaml
# docker-compose.yml
services:
  agent:
    volumes:
      - /var/log:/host/var/log:ro  # 只读挂载日志目录
    environment:
      - SSH_MONITOR_ENABLED=true
      - SSH_MONITOR_WINDOW_MIN=10
      - SSH_MONITOR_THRESHOLD=5
```

**3. 验证**
```bash
# 查看Agent日志
docker logs ssalgten-agent-1 -f

# 应该看到：
# [INFO] Security monitor: SSH bruteforce check enabled
# [INFO] Found 3 IPs with failed login attempts
```

---

## 📈 数据流程图

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ SecurityMonitor.checkSshBruteforce()                   │
│     ├─ 读取 /host/var/log/auth.log                        │
│     ├─ 解析失败登录记录                                    │
│     ├─ 统计IP频率                                          │
│     └─ 生成告警列表                                        │
│                                                             │
│  ❌ NetworkMonitor.detectDDoS()           [未实现]        │
│  ❌ MalwareScanner.scanProcesses()         [未实现]        │
│  ❌ IntrusionDetector.checkFileChanges()   [未实现]        │
│                                                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ Heartbeat (30s interval)
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express + Prisma)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NodeController.recordHeartbeat()                          │
│     ├─ 接收 heartbeatData.security.ssh.alerts             │
│     └─ 创建 EventLog (type: SSH_BRUTEFORCE)               │
│                                                             │
│  NodeService.getNodeStats()                                │
│     └─ 统计最近24小时安全事件                              │
│                                                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebSocket + REST API
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HomePage - StatsCards                                     │
│     └─ 显示安全事件总数（24小时）                          │
│                                                             │
│  ThreatVisualization                                       │
│     ├─ 获取 getGlobalActivities()                         │
│     ├─ mapActivityToThreat() 映射事件                     │
│     ├─ 实时更新（5秒刷新）                                 │
│     └─ 按威胁类型过滤展示                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 总结

### 实现状态
- ✅ **SSH暴力破解**：完整实现，需配置启用
- ⚠️ **异常行为**：部分实现（节点状态、IP变化）
- ⚠️ **入侵检测**：仅记录Agent注册
- ❌ **DDoS攻击**：未实现
- ❌ **恶意软件**：未实现

### 功能完整度
- **已实现**：20% (SSH暴力破解)
- **部分实现**：30% (异常行为检测)
- **未实现**：50% (DDoS、恶意软件、完整IDS)

### 推荐行动

1. **立即启用**：SSH暴力破解监控（改配置即可）
2. **短期增强**：网络流量监控、进程异常检测
3. **中期完善**：文件完整性、多服务暴力破解
4. **长期规划**：完整IDS系统、Rootkit检测

### 架构优势
✅ 数据流清晰：Agent → Backend → Frontend
✅ 易于扩展：在 SecurityMonitor 添加新检测器
✅ 实时更新：心跳机制 + WebSocket
✅ 类型安全：前后端TypeScript统一类型定义

---

**结论**：威胁监控UI已完整，但Agent安全功能需要大幅扩展才能提供完整的安全态势感知。当前仅SSH暴力破解可用，其他威胁类型依赖系统事件而非真实检测。
