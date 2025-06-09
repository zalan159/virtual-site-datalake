#!/bin/bash
set -e

echo "⚡ 快速构建模式 (跳过所有检查)..."

# 进入web目录
cd web

echo "🧹 清理构建目录..."
rm -rf dist
mkdir -p dist

echo "📦 确保依赖已安装..."
if [ ! -d "node_modules" ]; then
    echo "安装主项目依赖..."
    npm install
fi

echo "🎯 快速构建GoView..."
cd go-view

# 确保GoView依赖已安装
if [ ! -d "node_modules" ]; then
    echo "安装GoView依赖 (跳过脚本)..."
    npm install --ignore-scripts
fi

# 直接使用vite构建，跳过所有检查
echo "🔨 Vite构建GoView (无检查)..."
npx vite build --outDir ../dist/goview --base /goview/

echo "✅ GoView构建完成"
cd ..

echo "⚛️  快速构建React主项目..."
# 直接使用vite构建，跳过TypeScript检查
npx vite build

echo "✅ 快速构建完成！"

# 验证构建结果
if [ -f "dist/index.html" ] && [ -f "dist/goview/index.html" ]; then
    echo "🎉 构建验证成功！"
    echo "📁 文件结构:"
    echo "  ├── dist/"
    echo "  │   ├── index.html (React主应用)"
    echo "  │   ├── assets/ (React资源)"
    echo "  │   └── goview/"
    echo "  │       ├── index.html (GoView应用)"
    echo "  │       └── static/ (GoView资源)"
    
    # 显示文件大小
    echo ""
    echo "📊 构建统计:"
    echo "主应用大小: $(du -sh dist --exclude=dist/goview | cut -f1)"
    echo "GoView大小: $(du -sh dist/goview 2>/dev/null | cut -f1 || echo '未知')"
    echo "总大小: $(du -sh dist | cut -f1)"
else
    echo "❌ 构建验证失败！"
    exit 1
fi 