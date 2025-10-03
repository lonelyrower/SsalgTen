# 安装脚本卡住问题修复

## 问题描述
在执行 `ssalgten.sh` 安装脚本时，在"准备环境变量..."步骤后脚本卡住，无法继续执行。

## 问题原因分析

### 1. `random_string` 函数可能卡住
- 原实现使用管道链 `tr | head` 等命令，在某些系统上可能因为管道阻塞而卡住
- 缺少足够的错误处理和fallback机制

### 2. `detect_default_image_namespace` 函数可能超时
- 调用 `git remote get-url origin` 在非git目录或网络问题时可能卡住
- 缺少超时保护机制

### 3. `ensure_env_kv` 函数可能因权限问题失败
- 使用 `sed -i` 编辑文件，在某些系统上有兼容性问题
- 文件权限问题可能导致写入失败或卡住
- 缺少足够的错误处理

### 4. 文件权限问题
- 部署脚本以root创建文件，但后续可能以其他用户执行
- 缺少权限检查和自动修复机制

## 修复措施

### 1. 增强 `random_string` 函数
- 实现多种随机字符串生成方法，按优先级尝试
- 每种方法都有独立的错误检查
- 最后提供一个必定成功的fallback方案
- 方法包括：
  1. `/dev/urandom` (最安全)
  2. `openssl rand` (广泛可用)
  3. `sha256sum` (常见工具)
  4. `md5sum` (备用)
  5. fallback字符串 (保证成功)

### 2. 优化 `detect_default_image_namespace` 函数
- 添加git仓库快速检测，非git目录直接返回默认值
- 使用 `timeout` 命令限制git命令执行时间（3秒）
- 兼容没有 `timeout` 命令的系统
- 添加更完善的错误处理

### 3. 重写 `ensure_env_kv` 函数
- 使用临时文件替代 `sed -i`，避免兼容性问题
- 添加文件权限检查和自动修复
- 所有文件操作都有错误检查和fallback
- 失败时自动尝试使用sudo权限
- 返回值表示操作是否成功

### 4. 增强 `ensure_env_basics_image` 函数
- 添加详细的日志输出，便于诊断
- 每个关键步骤都有错误检查
- 文件权限问题时自动修复
- 所有配置写入都检查返回值
- 失败时给出清晰的错误信息

### 5. 早期初始化默认值
- 在main函数开始时就初始化 `DEFAULT_IMAGE_NAMESPACE`
- 避免运行时调用可能卡住的函数

## 修改文件
- `scripts/ssalgten.sh`

## 测试建议

### 1. 基本测试
```bash
# 清理环境
rm -rf /opt/ssalgten

# 重新安装
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/ssalgten.sh | bash -s -- --install
```

### 2. 权限测试
```bash
# 以非root用户测试
sudo -u ssalgten bash -c "cd /opt/ssalgten && bash /usr/local/bin/ssalgten deploy"
```

### 3. 诊断模式
如果仍有问题，可以手动执行脚本查看详细输出：
```bash
bash -x /usr/local/bin/ssalgten deploy
```

## 预期改进
- ✓ 脚本不会再因随机字符串生成而卡住
- ✓ Git命令超时不会影响安装
- ✓ 文件权限问题会自动修复
- ✓ 所有错误都有清晰的提示信息
- ✓ 增加了详细的进度日志

## 注意事项
1. 如果系统没有 `timeout` 命令，git检测会直接执行（但有快速失败机制）
2. 某些极端情况下可能需要手动修复 `/opt/ssalgten/.env` 文件权限
3. 建议在执行前确保当前用户在docker组中：`sudo usermod -aG docker $USER`
