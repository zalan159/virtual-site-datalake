@echo off
echo 🧪 MQTT WebSocket 频率测试工具
echo.

REM 检查是否已安装 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js
    echo 📥 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查是否已安装依赖
if not exist node_modules (
    echo 📦 安装 MQTT 依赖...
    npm install mqtt
    echo.
)

echo 🚀 启动 MQTT 测试客户端...
echo 💡 测试将运行 60 秒，监控消息接收频率
echo 🔍 观察消息间隔和频率统计
echo ⚠️  如果看到 "Not authorized" 错误，说明 broker 有认证限制
echo.

node test-mqtt-ws.js

pause