# Scripts 目录结构说明

## 📁 目录结构

项目中有两个 scripts 目录，各司其职：

### 1️⃣ 根目录 `scripts/` - Shell 脚本（用户接口）

```
scripts/
├── reset-admin-password.sh    # 密码重置（Shell 封装）
├── install-agent.sh           # Agent 安装脚本
├── deploy-production.sh       # 生产部署脚本
└── ... 其他运维脚本
```

**用途**：
- 🎯 面向用户的操作脚本
- 🐚 Shell 脚本，可在任何 Linux/Unix 环境执行
- 🔧 运维和部署自动化
- 📦 调用 Docker、系统命令或 backend 内部脚本

**特点**：
- 可以远程执行（`curl | bash`）
- 不需要 Node.js 环境
- 封装复杂的操作流程

### 2️⃣ Backend `src/scripts/` - TypeScript 工具（内部实现）

```
backend/src/scripts/
├── reset-admin.ts         # 密码重置（TS 实现）
├── apikey-manager.ts      # API 密钥管理
├── migrate-map-config.ts  # 地图配置迁移
└── update-asn.ts          # ASN 数据更新
```

**用途**：
- 🛠️ 数据库操作和维护工具
- 📊 数据迁移和更新脚本
- 🔐 安全和配置管理
- 🧰 开发和调试工具

**特点**：
- TypeScript 编写，类型安全
- 直接访问 Prisma、数据库和内部服务
- 通过 npm scripts 调用
- 需要 Node.js 环境

## 🔄 脚本调用关系

```
┌─────────────────────────────────────────────┐
│  用户                                        │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  scripts/reset-admin-password.sh             │  ← Shell 封装
│  - 查找项目/容器                             │
│  - 检查环境                                  │
│  - 执行 Docker 命令                          │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  docker exec backend npm run reset-admin     │  ← Docker 命令
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  backend/src/scripts/reset-admin.ts          │  ← TS 实现
│  - 连接数据库                                │
│  - 重置密码                                  │
│  - 返回结果                                  │
└─────────────────────────────────────────────┘
```

## 📝 使用示例

### 用户操作（推荐）

```bash
# 远程一键重置密码
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/reset-admin-password.sh | bash

# 或在项目目录
bash scripts/reset-admin-password.sh
```

### 开发调试

```bash
# 在容器内直接执行 TS 脚本
docker exec -it backend npm run reset-admin

# 或本地开发环境
cd backend
npm run reset-admin
```

### 其他工具脚本

```bash
# API 密钥管理
npm run apikey show
npm run apikey generate

# 更新 ASN 数据
npm run db:update-asn

# 迁移地图配置
npm run migrate:map-config
```

## 🎯 设计原则

### Shell 脚本（根目录）

✅ **应该**：
- 面向运维人员
- 封装复杂流程
- 处理环境检测
- 提供友好的用户交互

❌ **不应该**：
- 直接操作数据库
- 包含业务逻辑
- 依赖特定的 Node.js 版本

### TypeScript 脚本（backend）

✅ **应该**：
- 实现具体功能
- 直接操作数据库
- 复用项目代码（services, utils）
- 保持类型安全

❌ **不应该**：
- 处理环境检测
- 包含大量 Shell 命令
- 直接面向最终用户

## 🔧 维护指南

### 添加新脚本

1. **用户操作脚本** → 添加到 `scripts/`
   ```bash
   scripts/new-operation.sh
   ```

2. **内部工具脚本** → 添加到 `backend/src/scripts/`
   ```typescript
   backend/src/scripts/new-tool.ts
   ```

3. **注册 npm script**（如果需要）
   ```json
   {
     "scripts": {
       "tool:new": "tsx src/scripts/new-tool.ts"
     }
   }
   ```

### 脚本命名规范

- Shell 脚本：`kebab-case.sh`
- TypeScript 脚本：`kebab-case.ts`
- npm scripts：`category:action`

### 文档要求

每个脚本都应包含：
- 用途说明
- 使用方法
- 参数说明
- 示例

## 🗂️ 历史遗留问题（已清理）

~~`backend/scripts/reset-admin-password.js`~~ ← **已删除**

**原因**：
- 与 `backend/src/scripts/reset-admin.ts` 功能重复
- JavaScript 版本，缺少类型安全
- 不在源码目录，难以维护

**替代方案**：
- 统一使用 TypeScript 版本
- 通过 tsx 直接执行，无需编译

---

**整理状态**: ✅ 已优化  
**目录结构**: 清晰明确  
**职责分离**: Shell 封装 + TS 实现
