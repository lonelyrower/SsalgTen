# ASN 信息功能实现说明

本文档介绍了 SsalgTen 项目中新增的 ASN (Autonomous System Number) 信息功能。

## 🎯 功能概述

类似于 NetMirror 项目，我们现在支持：

1. **节点 ASN 信息显示** - 展示节点的 IPv4/IPv6 和 ASN 信息
2. **访问者 IP 信息** - 在诊断工具中显示访问者的 IP 和 ASN 信息
3. **自动 ASN 查询** - 创建节点时自动获取 ASN 信息

## 🏗️ 架构变化

### 后端更改

1. **数据库模型扩展** (`backend/prisma/schema.prisma`)
   - 节点模型添加了 ASN 相关字段
   - 新增访问者日志模型用于记录访问统计

2. **新增服务**
   - `IPInfoService.ts` - IP 信息查询服务
   - `VisitorController.ts` - 访问者信息控制器

3. **API 端点**
   ```
   GET /api/visitor/info          # 获取访问者IP信息
   GET /api/visitor/ip/:ip        # 查询指定IP信息
   GET /admin/visitors/stats      # 访问者统计(管理员)
   ```

### 前端更改

1. **NetworkToolkit 组件**
   - 显示目标节点的完整信息（IPv4/IPv6/ASN）
   - 显示访问者的IP信息和ASN

2. **EnhancedWorldMap 组件**
   - 地图弹窗显示节点的ASN信息
   - 优化了信息展示布局

## 🚀 快速使用

### 1. 环境配置

在 `backend/.env` 中添加（可选）：

```env
# IP信息服务配置 (可选)
# 注册 https://ipinfo.io 获取免费API token
# 免费版本每月提供 50,000 次查询
IPINFO_TOKEN=your-ipinfo-api-token-optional
```

> **注意**: 不配置 TOKEN 也能使用，但可能有查询限制

### 2. 数据库迁移

```bash
# 进入backend目录
cd backend

# 生成并应用数据库更改
npx prisma migrate dev --name add-asn-fields

# 生成 Prisma 客户端
npx prisma generate
```

### 3. 更新现有节点的ASN信息

```bash
# 为现有节点批量更新ASN信息
npm run db:update-asn
```

### 4. 启动服务

```bash
# 启动开发环境
npm run dev
```

## 📊 功能展示

### 节点信息展示

在地图上点击节点时，弹窗将显示：

- **基础信息**: 节点名称、位置、供应商
- **IP地址**: IPv4 和 IPv6 地址
- **ASN信息**: ASN 号码和组织名称
- **状态信息**: 最后在线时间等

### 诊断工具界面

打开网络诊断工具时，用户将看到：

- **目标节点信息卡**: 
  - 节点的完整网络信息
  - ASN 详情和服务商信息

- **访问者信息卡**:
  - 用户的真实IP地址
  - 地理位置信息
  - ASN 和网络运营商
  - 时区信息

## 🛠️ 技术细节

### ASN 数据获取

使用免费的 ipinfo.io API：
- 支持 IPv4 和 IPv6
- 包含地理位置、ASN、运营商等信息
- 内置缓存机制（24小时TTL）
- 自动降级处理

### 数据缓存策略

1. **内存缓存**: IPInfoService 内置24小时缓存
2. **数据库缓存**: 访问者信息存储到 visitor_logs 表
3. **错误处理**: API失败时返回基础信息

### 隐私考虑

- 访问者信息仅用于网络诊断展示
- 不收集敏感个人信息
- 遵循数据最小化原则

## 🔧 配置选项

### IPInfo服务配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `IPINFO_TOKEN` | IPInfo API Token | 空（使用免费限制） |

### 缓存配置

- **内存缓存TTL**: 24小时
- **数据库清理**: 可通过定时任务清理旧访问日志
- **并发限制**: 批量查询时限制并发数为5

## 📈 性能优化

1. **批量查询**: 支持并发但限制并发数
2. **缓存策略**: 减少重复API调用
3. **懒加载**: 前端组件按需加载IP信息
4. **错误降级**: API失败时显示基础信息

## 🐛 故障排除

### 常见问题

1. **ASN信息显示为 "Unknown"**
   - 检查网络连接
   - 确认 ipinfo.io 服务可访问
   - 查看后端日志的错误信息

2. **访问者信息加载失败**
   - 检查前端网络请求
   - 确认后端 API 正常响应
   - 查看浏览器控制台错误

3. **数据库迁移失败**
   - 确保数据库服务正常运行
   - 检查 DATABASE_URL 配置
   - 运行 `npx prisma db push` 强制更新

### 调试命令

```bash
# 查看数据库状态
npx prisma studio

# 手动测试ASN更新
npm run db:update-asn

# 查看后端日志
npm run dev

# 检查API端点
curl http://localhost:3001/api/visitor/info
```

## 📚 相关资源

- [IPInfo.io API 文档](https://ipinfo.io/docs)
- [Prisma 数据库文档](https://www.prisma.io/docs)
- [NetMirror 项目参考](https://github.com/catcat-blog/NetMirror)

## 🎉 完成状态

✅ **已完成功能**:
- [x] 数据库模型扩展
- [x] ASN信息获取服务
- [x] 访问者信息API
- [x] 前端界面更新
- [x] 地图弹窗优化
- [x] 诊断工具增强
- [x] 批量更新脚本
- [x] 环境配置支持

🚀 **生产就绪**: 所有功能已完成并可投入使用！