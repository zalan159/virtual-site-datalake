#!/bin/bash
set -e

# 设置项目根目录
PROJECT_ROOT=$(dirname "$(readlink -f "$0")")
cd "$PROJECT_ROOT"

# 激活虚拟环境
source .venv/bin/activate

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
echo "Main service started (PID: $!)"

# python -m app.iot.mqtt_gateway  &
# echo "MQTT Gateway started (PID: $!)"

# 等待并捕获Ctrl+C
trap 'kill $(jobs -p)' SIGINT
wait