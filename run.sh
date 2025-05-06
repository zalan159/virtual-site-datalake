#!/bin/bash
set -e

# 设置项目根目录
PROJECT_ROOT=$(dirname "$(readlink -f "$0")")
cd "$PROJECT_ROOT"

# 激活虚拟环境
source .venv/bin/activate

# 启动服务
nohup python -m app.main > main.log 2>&1 &
echo "Main service started (PID: $!)"

nohup python -m app.iot.mqtt_gateway > mqtt_gateway.log 2>&1 &
echo "MQTT Gateway started (PID: $!)"

# 等待并捕获Ctrl+C
trap 'kill $(jobs -p)' SIGINT
wait