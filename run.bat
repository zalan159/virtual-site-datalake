@echo off
setlocal

REM Project root
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

REM Prefer uv if available (and do NOT activate .venv in this case)
where uv >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "FastAPI Main" cmd /k "uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    REM Fallback: activate local venv if exists
    if exist ".venv\Scripts\activate.bat" (
        call ".venv\Scripts\activate.bat"
    )
    where python
    start "FastAPI Main" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
)

REM Optional: MQTT gateway
REM start "MQTT Gateway" cmd /c "python -m app.iot.mqtt_gateway"

endlocal