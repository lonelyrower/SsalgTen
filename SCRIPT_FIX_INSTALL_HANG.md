# 安装脚本卡住问题修复（v2）

## 问题描述

1. 在执行 `ssalgten.sh` 安装脚本时，在"准备环境变量..."步骤后脚本卡住，无法继续执行
2. 脚本的交互提示不够清晰，用户不知道应该输入 Y 还是 N

## 问题原因分析

### 1. `random_string` 函数可能卡住
- 原实现使用管道链可能阻塞
- 缺少错误处理和fallback

### 2. `detect_default_image_namespace` 函数可能超时
- git命令可能卡住
- 缺少超时保护

### 3. `ensure_env_kv` 函数在root环境下卡住
- `chown "$(whoami):$(whoami)"` 在root环境下可能卡住
- 不必要地调用sudo导致等待密码
- sed -i 兼容性问题

### 4. 交互提示不清晰
- 只显示"默认: n"，用户不知道可输入选项
- 格式不统一（小写/大写混用）

## 修复措施

### 1. 增强 `random_string` 函数
- 5种生成方法，逐个尝试
- 每种方法独立错误检查
- 保证成功的fallback

### 2. 优化 `detect_default_image_namespace` 函数  
- 快速git仓库检测
- timeout限制（3秒）
- 兼容无timeout系统

### 3. 重写 `ensure_env_kv` 和 `ensure_env_basics_image` 函数
- 临时文件替代sed -i
- **添加EUID检查，避免root环境调用sudo**
- **使用chmod 666替代chown，避免所有权问题**
- 智能权限修复

### 4. 统一交互提示
- 清晰的 `[Y/N]` 格式
- 默认值高亮：
  - `[Y/n] (默认: Y)`
  - `[y/N] (默认: N)`  
  - `[Y/N]` (无默认)
- 统一使用大写Y/N
- 明确错误提示

## 测试结果

✓ 脚本语法检查通过
✓ random_string 函数测试通过
✓ ensure_env_kv 逻辑测试通过  
✓ 交互提示格式清晰统一

## 使用说明

```bash
# 重新安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

现在交互提示会清晰显示：
```
是否继续使用root用户部署 [y/N] (默认: N): 
```

用户一眼就知道可以输入 Y 或 N，以及默认值是什么。
