# Agent节点名称覆盖问题修复

## 问题描述

当用户在管理后台手动修改Agent节点的名称后，如果该Agent节点离线然后重新上线，节点名称会被恢复为Agent配置文件中的原始名称，覆盖用户的自定义设置。

## 根本原因

在 `backend/src/controllers/NodeController.ts` 的 `registerAgent` 方法中，当Agent重新连接时，代码会无条件地使用Agent提供的 `nodeInfo.name` 更新数据库中的节点名称，即使用户已经手动修改过该名称。

## 修复方案

采用**方案一**：添加标记字段来区分用户自定义名称和Agent默认名称。

### 1. 数据库更改

- 在 `nodes` 表中添加 `nameCustomized` 字段（Boolean类型，默认为false）
- 该字段标记节点名称是否被用户手动修改过

### 2. 后端逻辑修改

#### NodeController.ts
- 在 `registerAgent` 方法中，只有当 `nameCustomized` 为 `false` 时，才允许Agent更新节点名称
- 保护已被用户自定义的节点名称不被Agent覆盖

#### AdminController.ts  
- 在 `updateNode` 方法中，当管理员修改节点名称时，自动将 `nameCustomized` 设置为 `true`
- 确保用户的修改被正确标记

### 3. 数据库迁移
- 创建迁移脚本添加 `nameCustomized` 字段
- 对现有节点，如果名称不符合默认格式（`Node-XXXXXXXX`），则标记为已自定义

## 修复文件清单

1. **数据库迁移**
   - `backend/prisma/migrations/20250929000000_add_name_customized_flag/migration.sql`
   - `backend/prisma/schema.prisma`

2. **后端代码**
   - `backend/src/controllers/NodeController.ts`
   - `backend/src/controllers/AdminController.ts`
   - `backend/src/services/NodeService.ts`

3. **部署脚本**
   - `scripts/migrate-name-customized.sh`

## 修复效果

✅ **修复前**：Agent重连 → 覆盖用户自定义名称 → 名称恢复为默认值

✅ **修复后**：Agent重连 → 检查nameCustomized标记 → 保持用户自定义名称不变

## 部署说明

1. 运行数据库迁移：
   ```bash
   bash scripts/migrate-name-customized.sh
   ```

2. 重启后端服务以加载新代码

3. 现有用户自定义的节点名称将被自动保护

## 兼容性说明

- ✅ 完全向后兼容
- ✅ 不影响现有Agent的正常运行
- ✅ 自动保护现有的用户自定义名称
- ✅ 新节点仍可正常使用Agent提供的默认名称

## 测试验证

1. 手动修改一个节点的名称
2. 重启对应的Agent或模拟Agent重连
3. 验证节点名称保持用户修改的值，不被覆盖

---
**修复完成时间**: 2025-09-29  
**修复类型**: Bug Fix  
**影响范围**: Agent节点名称管理  
**风险等级**: 低风险（向后兼容）