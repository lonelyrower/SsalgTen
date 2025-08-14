# 开发日志 - 2025年8月13日

## 工作概述
继续优化SsalgTen网络监控系统的部署脚本，主要解决了用户体验问题和部署过程中的各种错误。

## 完成的任务

### 1. 修复部署脚本用户体验问题
**时间**: 上午
**问题**: 用户反馈部署脚本的提示格式不一致，按回车的行为不明确
**解决方案**:
- 统一所有Y/N提示为 `[Y/N]` 格式（之前是混合的 `[Y/n]`, `[y/N]`）
- 添加明确的默认行为说明：`(回车默认选择 Y)` 或 `(回车默认选择 N)`
- 改进root用户警告提示，使其更友好和明确
- 修复 `prompt_yes_no()` 函数返回值逻辑错误（之前返回布尔值，应该返回字符串）

### 2. 解决数据库种子脚本错误
**时间**: 上午
**问题**: `tsx: not found` 错误，生产环境中缺少TypeScript运行时
**解决方案**:
- 将 `package.json` 中的 seed 脚本从 `tsx src/utils/seed.ts` 改为 `node dist/utils/seed.js`
- 确保使用编译后的JavaScript文件而不是TypeScript源码

### 3. 修复数据库认证错误P1000
**时间**: 中午
**问题**: Prisma连接数据库时认证失败
**解决方案**:
- 修复 `DATABASE_URL` 配置，确保Docker内部通信使用正确的端口5432
- 改进数据库启动等待机制，使用健康检查而不是简单的sleep
- 添加30次重试逻辑，每次等待2秒，总共60秒超时
- 增加数据库连接调试信息

### 4. Docker源配置顽固问题（未完全解决）
**时间**: 下午-晚上
**问题**: Debian系统持续尝试使用Ubuntu Docker源，导致404错误
**已尝试的解决方案**:

#### 第一阶段：基础清理
- 添加操作系统检测逻辑
- 清理 `/etc/apt/sources.list.d/docker.list`
- 清理GPG密钥文件

#### 第二阶段：增强清理
- 添加 `apt clean` 和缓存清理
- 搜索并删除所有文件中的docker.com条目
- 增加调试信息显示系统检测结果

#### 第三阶段：全面清理函数
- 创建 `cleanup_docker_sources()` 专用函数
- 停止apt进程，删除所有docker相关文件
- 清理 `/var/lib/apt/lists/*`
- 多重验证和双重保险机制

#### 第四阶段：自动化集成
- 将所有手动清理步骤集成到脚本中
- 在系统依赖安装前自动执行清理
- 添加详细的前后状态对比

**当前状态**: 问题仍然存在，错误出现在系统依赖安装的第一次 `apt update`，说明可能有更深层的配置问题。

## 技术细节

### 文件修改记录
1. `scripts/deploy-production.sh`
   - 添加 `prompt_yes_no()` 函数改进
   - 添加 `cleanup_docker_sources()` 函数
   - 修复数据库等待逻辑
   - 增强调试和验证机制

2. `backend/package.json`
   - 修改 `db:seed` 脚本使用编译后的JS文件

3. `docker-compose.production.yml`
   - 配置可变端口支持
   - 修复健康检查端口动态化

### Git提交记录
```bash
# 主要提交
092ee11 - improve: enhance user prompts with clearer default behavior indication
644f60e - fix: resolve tsx not found error and unify prompt formatting  
df65a8f - fix: correct prompt_yes_no function return logic and root user warning
021d1e0 - fix: resolve database authentication error P1000
c00621d - fix: improve Docker repository detection and cleanup for Debian systems
81b2b4d - fix: comprehensive Docker repository cleanup and validation
c9856da - feat: integrate comprehensive Docker source cleanup into deployment script
```

## 遗留问题

### 1. Docker源配置顽固问题 🔴
**症状**: Debian系统在第一次 `apt update` 时仍然尝试访问Ubuntu Docker源
**可能原因**:
- 系统级别的预配置Docker源
- APT配置缓存问题
- 其他软件包管理器配置的源
- systemd或其他服务预配置的源

**下一步调查方向**:
- 检查 `/etc/apt/apt.conf.d/` 目录
- 检查是否有snap或其他包管理器的配置
- 查看系统启动时是否有自动添加源的服务
- 尝试在脚本最开始就进行清理，而不是在系统依赖安装中

## 用户反馈
- ✅ 提示格式统一问题已解决
- ✅ 按回车默认行为现在很明确
- 🔄 Docker源问题仍需继续解决

### 5. Socket.IO连接问题诊断与修复 ⭐
**时间**: 晚上
**问题**: 用户反馈登录后页面一直显示"Connecting to real-time server..."，无法看到实时数据和Agent探针安装功能

#### 问题诊断过程
1. **本地环境复现**:
   - 启动本地后端开发服务器 (port 3001)
   - 启动本地前端开发服务器 (port 3000)
   - 复现Socket.IO连接失败问题

2. **发现的关键问题**:

**问题一**: Socket.IO认证失败
```typescript
// 文件: backend/src/sockets/socketAuth.ts:27
// 错误：JWT token字段不匹配
(socket as AuthenticatedSocket).user = {
  id: decoded.id,  // 错误：JWT中实际使用userId
  username: decoded.username,
  role: decoded.role
};

// 修复：
id: decoded.userId,  // 正确：匹配AuthController中的JWT payload
```

**问题二**: 前端环境变量配置错误
```typescript
// 文件: frontend/src/services/socketService.ts:43
// 错误：使用不存在的环境变量
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

// 修复：使用正确的环境变量
const apiBaseUrl = import.meta.env.VITE_API_URL;
```

**问题三**: 端口配置不一致
```env
# frontend/.env 错误配置
VITE_API_URL=http://localhost:3002/api

# 应该是
VITE_API_URL=http://localhost:3001/api
```

#### 修复实施
- 修正JWT token认证逻辑
- 统一前端环境变量命名
- 添加Socket.IO认证调试日志
- 本地测试验证修复效果

#### 代码提交
```bash
git commit 100f310: "fix: resolve Socket.IO connection issues"
- Fix JWT token field error in socketAuth.ts (decoded.id -> decoded.userId)
- Fix environment variable name in socketService.ts (VITE_API_BASE_URL -> VITE_API_URL)  
- Add Socket.IO authentication debug logging
```

**修复状态**: ✅ 已完成并推送到GitHub

## 明日计划
1. 等待用户在生产环境验证Socket.IO修复效果
2. 继续调查Docker源残留问题（如仍有用户反馈）
3. 完善系统安装和配置文档

## 学习收获
1. **前后端配置一致性至关重要**: 环境变量命名和端口配置必须保持一致
2. **JWT认证调试技巧**: 通过添加详细日志快速定位认证失败原因
3. **本地复现的价值**: 通过本地环境可以更高效地调试和验证修复
4. **WebSocket连接问题的排查方法**: 从认证、配置、网络连接多个层面逐步排查
5. **用户体验细节很重要**: 一致的提示格式和明确的默认行为能显著改善使用体验

## 当日工作总结
今天主要解决了两大类问题：
1. **部署体验优化**: 统一提示格式、修复数据库配置、改进用户交互
2. **核心功能修复**: 解决Socket.IO连接问题，这是影响用户正常使用的关键问题

特别是Socket.IO问题的解决，直接影响到系统的实时功能和用户核心体验，修复后用户应该能够：
- ✅ 正常看到实时节点状态更新
- ✅ 使用Agent探针安装功能
- ✅ 不再看到"Connecting to real-time server..."持续显示