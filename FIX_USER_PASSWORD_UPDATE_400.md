# 修复用户管理密码更新 400 错误

## 问题描述

在用户管理页面修改用户密码时，系统返回 **HTTP 400 错误**。

### 错误原因

后端 API 的 `UpdateUserSchema` (在 `backend/src/schemas/admin.ts`) 中**没有包含 `password` 字段**。

当管理员通过 `PUT /api/admin/users/:id` 接口更新用户信息并包含密码时：
- 前端发送的请求体包含 `password` 字段
- 后端的 Zod schema 使用了 `.strict()` 模式，会拒绝未定义的字段
- 因此返回 400 Bad Request 错误

## 解决方案

### 1. 更新 `UpdateUserSchema` (backend/src/schemas/admin.ts)

添加可选的 `password` 字段：

```typescript
export const UpdateUserSchema = z
  .object({
    username: z.string().min(1).optional(),
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    avatar: z.string().url().optional(),
    password: z.string().min(6).optional(),  // ← 新增
    role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
    active: z.boolean().optional(),
  })
  .strict();
```

### 2. 更新 `UpdateUserRequest` 接口 (backend/src/controllers/AdminController.ts)

```typescript
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  name?: string;
  avatar?: string;
  password?: string;  // ← 新增
  role?: "ADMIN" | "OPERATOR" | "VIEWER";
  active?: boolean;
}
```

### 3. 更新 `updateUser` 控制器方法

在 `AdminController.updateUser` 方法中添加密码处理逻辑：

```typescript
// 准备更新数据
const dataToUpdate: Record<string, unknown> = { ...updateData };

// 如果包含密码，需要加密
if (updateData.password) {
  if (updateData.password.length < 6) {
    const response: ApiResponse = {
      success: false,
      error: "Password must be at least 6 characters long",
    };
    res.status(400).json(response);
    return;
  }
  dataToUpdate.password = await bcrypt.hash(updateData.password, 12);
}

const updatedUser = await prisma.user.update({
  where: { id },
  data: dataToUpdate,
  // ...
});
```

## 修改的文件

1. ✅ `backend/src/schemas/admin.ts` - 添加 password 字段到 UpdateUserSchema
2. ✅ `backend/src/controllers/AdminController.ts` - 更新接口和控制器方法

## 测试步骤

重启后端服务后，按以下步骤测试：

1. 登录管理员账户
2. 进入**用户管理**页面
3. 点击编辑某个用户
4. 在"新密码"字段输入新密码（至少6个字符）
5. 在"确认密码"字段再次输入相同密码
6. 点击**更新用户**按钮

### 预期结果

- ✅ 请求成功，返回 200 状态码
- ✅ 显示"密码修改成功"提示
- ✅ 用户密码已更新，可以使用新密码登录

## 技术细节

### 前端逻辑 (frontend/src/components/admin/UserModal.tsx)

前端在编辑用户时的密码处理：
- 如果留空 → 不修改密码
- 如果填写 → 必须填写确认密码并匹配
- 只有当密码不为空时才发送到后端

### 后端逻辑

1. **验证**: Zod schema 验证密码长度至少6个字符
2. **加密**: 使用 bcrypt.hash() 加密密码 (saltRounds=12)
3. **更新**: 将加密后的密码保存到数据库

## 安全考虑

- ✅ 密码使用 bcrypt 加密，安全强度高
- ✅ 最小密码长度：6个字符
- ✅ 管理员可以重置任何用户的密码，无需旧密码
- ✅ 日志记录管理员操作，便于审计

## 相关端点对比

系统中有两种修改密码的方式：

### 1. 用户自己修改密码
- **端点**: `POST /api/auth/change-password`
- **认证**: 需要登录
- **权限**: 用户只能修改自己的密码
- **要求**: 必须提供旧密码
- **Schema**: `ChangePasswordSchema`

### 2. 管理员重置用户密码
- **端点**: `PUT /api/admin/users/:id`
- **认证**: 需要管理员权限
- **权限**: 可以修改任何用户的密码
- **要求**: 不需要旧密码
- **Schema**: `UpdateUserSchema` (本次修复)

## 部署

修改后需要重启后端服务：

```bash
# 开发环境
cd backend
npm run dev

# 生产环境 (Docker)
docker-compose restart backend
```

---

**修复状态**: ✅ 已完成  
**测试状态**: ⏳ 待测试  
**影响范围**: 用户管理模块 - 密码修改功能  
**优先级**: 高（影响管理员核心功能）
