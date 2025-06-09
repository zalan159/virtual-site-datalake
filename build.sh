#!/bin/bash
set -e

echo "🚀 开始构建整合项目..."

# 进入web目录
cd web

echo "🧹 清理旧的构建文件..."
npm run clean

echo "📦 安装主项目依赖..."
npm install

echo "🎯 构建GoView项目 (跳过类型检查)..."
cd go-view

# 使用--ignore-scripts避免husky错误
echo "📦 安装GoView依赖..."
npm install --ignore-scripts

echo "🔨 开始GoView构建 (无类型检查)..."
npm run build

echo "✅ GoView构建完成"
cd ..

echo "⚛️  构建React主项目 (跳过类型检查)..."
npm run build:no-check

echo "✅ 构建完成！"
echo "📁 所有文件已打包到 web/dist/ 目录"
echo "   - React主应用: web/dist/"
echo "   - GoView应用: web/dist/goview/"

# 显示目录结构
echo "📋 最终目录结构:"
if [ -d "dist" ]; then
    ls -la dist/
    if [ -d "dist/goview" ]; then
        echo "GoView子目录:"
        ls -la dist/goview/
    else
        echo "⚠️  GoView目录未找到"
    fi
else
    echo "❌ dist目录未找到"
    exit 1
fi

echo ""
echo "🎉 打包成功！现在可以部署 web/dist/ 目录"