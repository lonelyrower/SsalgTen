# SsalgTen Agent Dockerfile - 监控代理节点
# Use LTS for production builds.
FROM node:22-alpine

# 安装系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    iputils \
    traceroute \
    mtr \
    bind-tools \
    iperf3 \
    python3 \
    py3-pip

# 安装网络测试工具
RUN pip3 install --break-system-packages speedtest-cli

# 创建用户和组
RUN addgroup -g 1001 -S nodejs
RUN adduser -S -u 1001 ssalgten

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装所有依赖 (包括dev依赖用于构建)
RUN npm ci && npm cache clean --force

# 复制源代码
COPY --chown=ssalgten:nodejs . .

# 构建应用
RUN npm run build

# 清理 dev 依赖，仅保留生产依赖以减小镜像大小
RUN npm prune --omit=dev && npm cache clean --force

# 创建日志目录
RUN mkdir -p /app/logs && chown -R ssalgten:nodejs /app/logs

# 设置权限
RUN chown -R ssalgten:nodejs /app
USER ssalgten

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3002}/health || exit 1

# 暴露端口
EXPOSE ${PORT:-3002}

# 启动命令
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
