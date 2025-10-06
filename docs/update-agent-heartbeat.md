# Agent 心跳间隔更新指南

本文档说明如何将现有 Agent 的心跳间隔从 30 秒更新为 5 分钟。

## 为什么要更新？

- **减少数据库负载**：心跳频率降低 90%，大幅减少数据写入
- **降低存储需求**：418 节点从每天生成 GB 级数据降至 MB 级
- **提升系统稳定性**：减少数据库连接池压力

## 更新方法

### 方法 1：单台 VPS 手动更新（推荐学习）

适用于测试或少量 VPS。

#### 步骤：

1. **SSH 登录到 VPS**
   ```bash
   ssh root@your-vps-ip
   ```

2. **执行更新脚本**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash
   ```

3. **确认更新**
   - 脚本会显示当前和新的心跳间隔
   - 输入 `y` 确认继续

4. **验证结果**
   ```bash
   # 检查服务状态
   systemctl status ssalgten-agent

   # 查看配置
   grep HEARTBEAT_INTERVAL /opt/ssalgten-agent/.env
   ```

#### 示例输出：
```
======================================
  SsalgTen Agent 心跳间隔更新工具
======================================

[INFO] 当前心跳间隔: 30000 ms
[INFO] 新的心跳间隔: 300000 ms (5 分钟)

[WARNING] 即将修改 Agent 配置并重启服务
确认继续？[y/N] y
[INFO] 备份配置文件...
[INFO] 修改心跳间隔配置...
[SUCCESS] 配置已更新: HEARTBEAT_INTERVAL=300000
[INFO] 重启 Agent 服务...
[SUCCESS] 服务已重启，新配置已生效

✅ 更新完成！
```

---

### 方法 2：批量更新多台 VPS（适合 418 节点）

适用于大量 VPS，需要配置 SSH 密钥。

#### 前置准备：

1. **配置 SSH 密钥免密登录**

   在你的管理机（可以是本地电脑或主服务器）上：

   ```bash
   # 如果还没有 SSH 密钥，先生成
   ssh-keygen -t rsa -b 4096

   # 将公钥复制到所有 VPS（需要逐台执行，或使用脚本）
   ssh-copy-id root@vps-ip-1
   ssh-copy-id root@vps-ip-2
   # ... 重复 418 次
   ```

   **提示**：如果你使用的是 VPS 提供商的控制面板，可能支持批量添加 SSH 密钥。

2. **创建 VPS 列表文件**

   创建 `vps_list.txt` 文件，每行一个 IP 地址：

   ```
   192.168.1.100
   192.168.1.101
   192.168.1.102
   # ... 418 个 IP
   ```

   或者如果有域名：
   ```
   node1.example.com
   node2.example.com
   # ...
   ```

#### 执行批量更新：

```bash
# 下载批量更新脚本
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/batch-update-agents.sh -o batch-update-agents.sh
chmod +x batch-update-agents.sh

# 串行更新（一台一台更新，稳妥但较慢）
./batch-update-agents.sh vps_list.txt

# 并行更新（同时更新多台，快速但需要注意资源）
./batch-update-agents.sh vps_list.txt --parallel --max-parallel 10
```

#### 示例输出：
```
================================================
  SsalgTen Agent 批量更新工具
================================================

[INFO] VPS列表文件: vps_list.txt
[INFO] VPS总数: 418
[INFO] SSH用户: root
[INFO] 执行模式: 并行 (最大 10)

[WARNING] 即将在 418 台VPS上更新Agent心跳间隔
确认继续？[y/N] y

[INFO] [1/418] 开始更新: 192.168.1.100
[SUCCESS] [1/418] ✅ 192.168.1.100 - 更新成功
[INFO] [2/418] 开始更新: 192.168.1.101
[SUCCESS] [2/418] ✅ 192.168.1.101 - 更新成功
...

================================================
  更新结果汇总
================================================
[SUCCESS] 成功: 418 / 418
```

---

### 方法 3：手动修改（不推荐）

如果脚本无法使用，可以手动修改：

```bash
# 1. 备份配置
cp /opt/ssalgten-agent/.env /opt/ssalgten-agent/.env.backup

# 2. 编辑配置文件
nano /opt/ssalgten-agent/.env

# 3. 找到 HEARTBEAT_INTERVAL 这一行，修改为：
HEARTBEAT_INTERVAL=300000

# 4. 保存退出（Ctrl+X, Y, Enter）

# 5. 重启服务
systemctl restart ssalgten-agent

# 6. 验证
systemctl status ssalgten-agent
```

---

## 高级选项

### 自定义心跳间隔

```bash
# 设置为 10 分钟（600000 毫秒）
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash -s -- --interval 600000
```

### 仅修改配置不重启

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash -s -- --no-restart
```

### 预览操作（不实际执行）

```bash
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash -s -- --dry-run
```

---

## 常见问题

### Q1: 更新后会丢失数据吗？
**A:** 不会。脚本只修改心跳间隔配置，不影响现有数据。

### Q2: 更新过程中 Agent 会离线吗？
**A:** 会短暂离线（约 2-5 秒），重启服务时会断开连接。

### Q3: 更新失败怎么办？
**A:** 脚本会自动备份配置文件（`.env.backup.日期时间`），可以手动恢复：
```bash
cp /opt/ssalgten-agent/.env.backup.* /opt/ssalgten-agent/.env
systemctl restart ssalgten-agent
```

### Q4: 如何批量获取所有 VPS 的 IP 地址？
**A:** 如果你的 VPS 管理面板支持导出，可以导出后提取 IP。或者从后端数据库查询：
```bash
docker exec ssalgten-database psql -U ssalgten -d ssalgten -c "SELECT ipv4 FROM nodes WHERE ipv4 IS NOT NULL;" -t > vps_list.txt
```

### Q5: SSH 密钥配置太麻烦，有其他方法吗？
**A:** 可以使用密码登录，但需要安装 `sshpass` 工具：
```bash
# 安装 sshpass
apt-get install sshpass  # Debian/Ubuntu
yum install sshpass      # CentOS/RHEL

# 使用密码批量执行
cat vps_list.txt | while read ip; do
  sshpass -p 'your-password' ssh root@$ip "curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/update-agent-heartbeat.sh | bash"
done
```

---

## 验证更新效果

更新完成后，可以在主服务器上验证：

```bash
# 查看心跳日志数量（应该逐渐减少）
docker exec ssalgten-database psql -U ssalgten -d ssalgten -c "SELECT COUNT(*) FROM heartbeat_logs WHERE timestamp > NOW() - INTERVAL '1 hour';"

# 查看数据库大小（应该保持稳定）
docker exec ssalgten-database psql -U ssalgten -d ssalgten -c "SELECT pg_size_pretty(pg_total_relation_size('heartbeat_logs'));"
```

---

## 建议

- **分批更新**：不要一次性更新所有 418 台，建议先更新 10-20 台测试
- **错峰更新**：避免在业务高峰期更新
- **保留备份**：更新前确认主服务器数据已备份
- **监控日志**：更新过程中观察主服务器后端日志：
  ```bash
  docker logs ssalgten-backend -f
  ```

---

## 脚本源码

- 单台更新脚本：[update-agent-heartbeat.sh](https://github.com/lonelyrower/SsalgTen/blob/main/scripts/update-agent-heartbeat.sh)
- 批量更新脚本：[batch-update-agents.sh](https://github.com/lonelyrower/SsalgTen/blob/main/scripts/batch-update-agents.sh)
