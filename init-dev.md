# 本地开发环境初始化指南

## 📋 统一数据库架构

现在本地开发和生产环境都使用PostgreSQL，避免了数据库差异问题。

## 🚀 快速开始

### 1. 启动开发数据库
```bash
# 确保Docker Desktop正在运行
# 启动PostgreSQL开发数据库
npm run dev:db
```

### 2. 初始化数据库
```bash
# 生成Prisma客户端并运行迁移
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

### 3. 启动开发服务
```bash
# 返回项目根目录
cd ..
# 启动前端和后端开发服务
npm run dev
```

## 📝 可用命令

- `npm run dev:db` - 启动开发数据库
- `npm run dev:db:stop` - 停止开发数据库
- `npm run dev` - 启动开发服务（自动启动数据库）
- `npm run dev:setup` - 完整设置（数据库+迁移+种子数据）

## 🔧 数据库配置

**开发环境：**
- 数据库：PostgreSQL 15
- 地址：localhost:5432
- 用户名：ssalgten
- 密码：ssalgten_dev
- 数据库名：ssalgten

**生产环境：**
- 使用docker-compose.yml中的PostgreSQL配置
- 通过环境变量动态配置

## ✅ 优势

- ✅ **统一环境** - 开发和生产使用相同数据库
- ✅ **避免差异** - 消除SQLite vs PostgreSQL的兼容性问题
- ✅ **简化部署** - 相同的Prisma配置和迁移
- ✅ **生产就绪** - 开发环境完全模拟生产环境