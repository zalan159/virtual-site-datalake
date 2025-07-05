@echo off
echo 🚀 启动WebSocket测试服务器...

REM 检查是否安装了Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 请先安装Node.js
    pause
    exit /b 1
)

REM 检查是否安装了npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 请先安装npm
    pause
    exit /b 1
)

REM 进入test目录
cd /d "%~dp0"

REM 检查package.json是否存在
if not exist "package.json" (
    echo ❌ 错误: 找不到package.json文件
    pause
    exit /b 1
)

REM 安装依赖
echo 📦 安装依赖...
call npm install

REM 启动服务器
echo 🚀 启动WebSocket服务器...
call npm start

pause 