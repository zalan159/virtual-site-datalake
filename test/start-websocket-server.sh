#!/bin/bash

echo "🚀 启动WebSocket测试服务器..."

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 请先安装Node.js"
    exit 1
fi

# 检查是否安装了npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 请先安装npm"
    exit 1
fi

# 进入test目录
cd "$(dirname "$0")"

# 检查package.json是否存在
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 找不到package.json文件"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 启动服务器
echo "🚀 启动WebSocket服务器..."
npm start 