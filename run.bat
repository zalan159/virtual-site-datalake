@echo off
setlocal

REM 设置项目根目录
set PROJECT_ROOT=%~dp0
cd /d "%PROJECT_ROOT%"

REM 激活虚拟环境
call .venv\Scripts\activate

REM 检查Python路径
where python

REM 启动服务
start "FastAPI Main" cmd /c "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
@REM start "MQTT Gateway" cmd /c "python -m app.iot.mqtt_gateway"

endlocal