# 🔧 脚本整合实施方案

## 📋 整合目标

将3个脚本优化为统一的管理体系：
- **deploy-production.sh**: 初始部署（支持镜像/源码双模式）
- **ssalgten.sh**: 统一管理工具（整合ghcr-deploy.sh功能）

## 🎯 具体实施方案

### **阶段1: ssalgten.sh 功能扩展**

#### 新增镜像模式命令：

```bash
# === 现有命令保持不变 ===
./scripts/ssalgten.sh start           # 源码模式启动
./scripts/ssalgten.sh stop            # 停止服务
./scripts/ssalgten.sh update          # 源码模式更新
./scripts/ssalgten.sh backup          # 数据备份
./scripts/ssalgten.sh monitor         # 系统监控

# === 新增镜像模式 ===
./scripts/ssalgten.sh start --image   # 镜像模式启动
./scripts/ssalgten.sh update --image  # 镜像模式更新
./scripts/ssalgten.sh pull --image    # 拉取最新镜像

# === 模式管理 ===
./scripts/ssalgten.sh mode            # 查看当前模式
./scripts/ssalgten.sh switch image    # 切换到镜像模式
./scripts/ssalgten.sh switch source   # 切换到源码模式

# === 统一命令（自动检测模式）===
./scripts/ssalgten.sh restart         # 根据当前模式重启
./scripts/ssalgten.sh status          # 显示服务状态（含模式信息）
```

#### 新增配置管理：

```bash
# 模式配置文件: /opt/ssalgten/.deployment_mode
echo "image" > /opt/ssalgten/.deployment_mode   # 或 "source"

# 镜像配置: /opt/ssalgten/.env.image
# 源码配置: /opt/ssalgten/.env（现有）
```

### **阶段2: deploy-production.sh 增强**

#### 部署模式选择：

```bash
# 在系统环境配置完成后，新增选择环节：

echo "📦 选择应用部署模式："
echo "1) 镜像模式 (推荐)"
echo "   ✅ 快速部署 (2-3分钟)"
echo "   ✅ 资源消耗少"
echo "   ✅ 一致性强"
echo "   ❌ 代码定制受限"
echo ""
echo "2) 源码模式"
echo "   ✅ 完全可定制"
echo "   ✅ 本地调试方便"
echo "   ❌ 部署较慢 (5-10分钟)"
echo "   ❌ 资源消耗大"

read -p "请选择 (1-2): " deploy_mode
```

#### 镜像模式部署流程：

```bash
if [[ "$deploy_mode" == "1" ]]; then
    # 镜像模式部署
    log_info "📦 使用镜像模式部署..."

    # 1. 创建镜像配置
    create_image_environment_config

    # 2. 拉取镜像
    pull_ghcr_images

    # 3. 启动服务
    start_image_services

    # 4. 设置模式标记
    echo "image" > "$APP_DIR/.deployment_mode"

else
    # 源码模式部署（现有流程）
    build_and_start_services
    echo "source" > "$APP_DIR/.deployment_mode"
fi
```

## 🔧 技术实现细节

### **1. ssalgten.sh 镜像功能集成**

将ghcr-deploy.sh的核心功能集成到ssalgten.sh中：

```bash
# 新增函数
image_pull() {
    local tag=${1:-latest}
    log_info "拉取镜像: tag=$tag"

    local components=("backend" "frontend" "updater" "agent")
    for component in "${components[@]}"; do
        docker pull "ghcr.io/lonelyrower/ssalgten/${component}:${tag}"
    done
}

image_start() {
    log_info "启动镜像模式服务..."

    # 加载镜像配置
    source /opt/ssalgten/.env.image

    # 启动服务
    cd /opt/ssalgten
    docker-compose -f docker-compose.ghcr.yml up -d
}

image_update() {
    local tag=${1:-latest}
    log_info "更新到镜像版本: $tag"

    # 更新镜像
    image_pull "$tag"

    # 重启服务
    docker-compose -f docker-compose.ghcr.yml down
    docker-compose -f docker-compose.ghcr.yml up -d
}

# 模式检测函数
detect_deployment_mode() {
    if [[ -f "/opt/ssalgten/.deployment_mode" ]]; then
        cat "/opt/ssalgten/.deployment_mode"
    else
        echo "source"  # 默认源码模式
    fi
}

# 统一的启动函数
unified_start() {
    local mode=$(detect_deployment_mode)
    local force_mode="$1"

    if [[ -n "$force_mode" ]]; then
        mode="$force_mode"
    fi

    case "$mode" in
        "image")
            image_start
            ;;
        "source")
            source_start  # 现有的启动函数
            ;;
    esac
}
```

### **2. 配置文件管理**

```bash
# 创建镜像配置
create_image_config() {
    cat > /opt/ssalgten/.env.image << EOF
# SsalgTen 镜像模式配置
IMAGE_TAG=latest

# 从现有配置迁移
DOMAIN=$DOMAIN
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
API_KEY_SECRET=$API_KEY_SECRET

# 镜像特定配置
GHCR_REGISTRY=ghcr.io/lonelyrower/ssalgten
EOF
}

# 模式切换
switch_to_image_mode() {
    log_info "切换到镜像模式..."

    # 1. 停止当前服务
    stop_services

    # 2. 创建镜像配置
    create_image_config

    # 3. 拉取镜像
    image_pull latest

    # 4. 启动镜像服务
    image_start

    # 5. 更新模式标记
    echo "image" > /opt/ssalgten/.deployment_mode

    log_success "已切换到镜像模式"
}
```

### **3. 命令行参数处理**

```bash
# 在ssalgten.sh的主函数中添加镜像参数处理
case "$1" in
    "start")
        case "$2" in
            "--image")
                unified_start "image"
                ;;
            *)
                unified_start
                ;;
        esac
        ;;
    "update")
        case "$2" in
            "--image")
                image_update "${3:-latest}"
                ;;
            *)
                source_update  # 现有更新函数
                ;;
        esac
        ;;
    "switch")
        case "$2" in
            "image")
                switch_to_image_mode
                ;;
            "source")
                switch_to_source_mode
                ;;
        esac
        ;;
    "mode")
        show_current_mode
        ;;
esac
```

## 📊 用户体验对比

### **整合前**（3个脚本）：
```bash
# 初始部署
curl ... | bash

# 源码管理
./scripts/ssalgten.sh update

# 镜像管理
./scripts/ghcr-deploy.sh update
```

### **整合后**（2个脚本）：
```bash
# 初始部署（自动选择模式）
curl ... | bash

# 统一管理
./scripts/ssalgten.sh update          # 自动检测模式
./scripts/ssalgten.sh update --image  # 强制镜像模式
./scripts/ssalgten.sh switch image    # 切换模式
```

## 🔄 迁移路径

### **对现有用户**：
1. **无缝兼容**：现有命令完全不变
2. **渐进迁移**：可以随时切换到镜像模式
3. **快速回滚**：可以随时切回源码模式

### **对新用户**：
1. **部署时选择**：初始部署时选择模式
2. **默认推荐**：推荐镜像模式（更快更稳定）
3. **灵活切换**：后续可以随时调整

## 🎯 实施优先级

### **Phase 1: 核心整合**
- [ ] ssalgten.sh增加镜像模式命令
- [ ] 配置文件管理系统
- [ ] 模式检测和切换功能

### **Phase 2: 部署增强**
- [ ] deploy-production.sh模式选择
- [ ] 镜像部署流程
- [ ] 配置迁移工具

### **Phase 3: 优化完善**
- [ ] 删除独立的ghcr-deploy.sh
- [ ] 文档更新
- [ ] 测试和验证

这个方案既保持了向后兼容性，又提供了现代化的镜像部署能力。你觉得这个设计如何？需要我开始实施哪个部分？