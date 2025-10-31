# SsalgTen 服务诊断脚本 (PowerShell)
# 使用方法: 在 PowerShell 中运行此脚本

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  SsalgTen 服务诊断脚本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Docker 容器状态
Write-Host "📋 1. Docker 容器状态" -ForegroundColor Yellow
Write-Host "-----------------------------------"
try {
    docker ps -a --filter "name=ssalgten" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
} catch {
    Write-Host "  ❌ 无法获取 Docker 容器信息" -ForegroundColor Red
    Write-Host "  请确保 Docker Desktop 正在运行" -ForegroundColor Red
}
Write-Host ""

# 2. 检查端口占用
Write-Host "📋 2. 端口占用检查" -ForegroundColor Yellow
Write-Host "-----------------------------------"
Write-Host "检查端口 3000 (前端):"
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "  ⚠️  端口 3000 被占用: PID $($port3000.OwningProcess)" -ForegroundColor Yellow
    Get-Process -Id $port3000.OwningProcess | Select-Object ProcessName, Id
} else {
    Write-Host "  ℹ️  端口 3000 未被占用" -ForegroundColor Gray
}
Write-Host ""

Write-Host "检查端口 3001 (后端):"
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
    Write-Host "  ✅ 端口 3001 被占用: PID $($port3001.OwningProcess)" -ForegroundColor Green
    Get-Process -Id $port3001.OwningProcess | Select-Object ProcessName, Id
} else {
    Write-Host "  ❌ 端口 3001 未被占用 (后端可能未运行)" -ForegroundColor Red
}
Write-Host ""

# 3. 检查后端健康状态
Write-Host "📋 3. 后端 API 健康检查" -ForegroundColor Yellow
Write-Host "-----------------------------------"
Write-Host "测试 http://localhost:3001/api/health:"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  ✅ 后端响应: $($response.StatusCode) - $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 无法连接到后端 API" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. 检查 Socket.IO 端点
Write-Host "📋 4. Socket.IO 端点检查" -ForegroundColor Yellow
Write-Host "-----------------------------------"
Write-Host "测试 http://localhost:3001/socket.io:"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/socket.io/?EIO=4&transport=polling" -TimeoutSec 5 -UseBasicParsing
    $content = $response.Content.Substring(0, [Math]::Min(100, $response.Content.Length))
    Write-Host "  ✅ Socket.IO 响应: $content..." -ForegroundColor Green
} catch {
    Write-Host "  ❌ Socket.IO 端点无响应" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 5. 查看最近的后端日志
Write-Host "📋 5. 后端最近日志 (最后20行)" -ForegroundColor Yellow
Write-Host "-----------------------------------"
try {
    docker logs --tail 20 ssalgten-backend 2>&1
} catch {
    Write-Host "  ❌ 无法获取后端日志" -ForegroundColor Red
}
Write-Host ""

# 6. 查看前端日志
Write-Host "📋 6. 前端最近日志 (最后10行)" -ForegroundColor Yellow
Write-Host "-----------------------------------"
try {
    docker logs --tail 10 ssalgten-frontend 2>&1
} catch {
    Write-Host "  ❌ 无法获取前端日志" -ForegroundColor Red
}
Write-Host ""

# 7. 检查 Docker 网络
Write-Host "📋 7. Docker 网络配置" -ForegroundColor Yellow
Write-Host "-----------------------------------"
try {
    docker network ls | Select-String "ssalgten"
} catch {
    Write-Host "  ❌ 无法获取网络信息" -ForegroundColor Red
}
Write-Host ""

# 8. 显示诊断建议
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  📊 诊断建议" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查容器是否运行
try {
    $backendRunning = docker ps --filter "name=ssalgten-backend" --filter "status=running" -q
    $frontendRunning = docker ps --filter "name=ssalgten-frontend" --filter "status=running" -q

    if (-not $backendRunning) {
        Write-Host "❌ 后端容器未运行" -ForegroundColor Red
        Write-Host "   解决方案: docker-compose up -d backend" -ForegroundColor Yellow
        Write-Host ""
    }

    if (-not $frontendRunning) {
        Write-Host "❌ 前端容器未运行" -ForegroundColor Red
        Write-Host "   解决方案: docker-compose up -d frontend" -ForegroundColor Yellow
        Write-Host ""
    }

    if ($backendRunning -and $frontendRunning) {
        Write-Host "✅ 所有容器正在运行" -ForegroundColor Green
        Write-Host ""
        Write-Host "如果仍有连接问题，请检查：" -ForegroundColor Yellow
        Write-Host "  1. 浏览器控制台错误信息"
        Write-Host "  2. 后端日志: docker logs -f ssalgten-backend"
        Write-Host "  3. 网络配置: docker network inspect ssalgten_default"
        Write-Host "  4. 清除浏览器缓存并刷新"
        Write-Host ""
    }
} catch {
    Write-Host "⚠️  无法检查容器状态" -ForegroundColor Yellow
    Write-Host "请确保 Docker Desktop 正在运行" -ForegroundColor Yellow
}

# 9. 快速修复建议
Write-Host "🔧 快速修复步骤" -ForegroundColor Cyan
Write-Host "-----------------------------------"
Write-Host "如果服务未运行，执行以下命令："
Write-Host ""
Write-Host "1. 重启所有服务:" -ForegroundColor White
Write-Host "   docker-compose down" -ForegroundColor Gray
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 查看实时日志:" -ForegroundColor White
Write-Host "   docker-compose logs -f" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 完全重建 (如果问题持续):" -ForegroundColor White
Write-Host "   docker-compose down -v" -ForegroundColor Gray
Write-Host "   docker-compose build --no-cache" -ForegroundColor Gray
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  完成诊断" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "详细修复指南请查看: ERROR_DIAGNOSIS_AND_FIX.md" -ForegroundColor Cyan
