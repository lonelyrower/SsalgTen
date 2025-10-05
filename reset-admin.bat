@echo off
REM 快速重置 Admin 密码脚本 (Windows)
REM 使用方法: reset-admin.bat

echo 🔧 正在重置管理员密码...
echo.

cd /d "%~dp0"

REM 检查容器是否运行
docker-compose ps | findstr /C:"backend" /C:"Up" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  警告: backend 容器未运行
    echo 正在启动 backend 容器...
    docker-compose up -d backend
    timeout /t 5 /nobreak >nul
)

REM 在容器中执行密码重置
echo 正在重置密码...
docker-compose exec -T backend npm run reset-admin

echo.
echo ✅ 密码重置完成！
echo.
echo 🔑 请使用以下凭据登录:
echo    用户名: admin
echo    密码: admin123
echo.
echo ⚠️  请在首次登录后立即更改密码！
echo.
pause
