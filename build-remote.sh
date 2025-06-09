#!/bin/bash
set -e

echo "🌐 远程部署构建脚本"
echo "工作目录: $(pwd)"

# 进入web目录
cd web
echo "进入目录: $(pwd)"

echo "🧹 清理构建目录..."
rm -rf dist
mkdir -p dist

echo "📦 检查和安装主项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "安装主项目依赖..."
    npm install --legacy-peer-deps
else
    echo "主项目依赖已存在"
fi

echo "🎯 构建GoView项目..."
cd go-view
echo "当前目录: $(pwd)"

# 检查GoView依赖
if [ ! -d "node_modules" ]; then
    echo "安装GoView依赖 (跳过脚本)..."
    npm install --ignore-scripts --legacy-peer-deps
else
    echo "GoView依赖已存在"
fi

# 验证关键文件
echo "📋 验证构建环境..."
echo "vite.config.ts: $(test -f vite.config.ts && echo '✅ 存在' || echo '❌ 缺失')"
echo "package.json: $(test -f package.json && echo '✅ 存在' || echo '❌ 缺失')"
echo "src目录: $(test -d src && echo '✅ 存在' || echo '❌ 缺失')"

# 使用npx直接调用vite，避免配置问题
echo "🔨 使用npx vite构建GoView..."
npx vite build --outDir ../dist/goview --base /goview/ --mode production

if [ ! -f "../dist/goview/index.html" ]; then
    echo "❌ GoView构建失败！"
    exit 1
fi

echo "✅ GoView构建完成"
cd ..

echo "⚛️  构建React主项目..."
echo "当前目录: $(pwd)"

# 使用npx直接调用vite构建React项目
npx vite build --mode production

if [ ! -f "dist/index.html" ]; then
    echo "❌ React主项目构建失败！"
    exit 1
fi

echo "✅ React主项目构建完成"

# 验证最终构建结果
echo "🔍 验证构建结果..."
if [ -f "dist/index.html" ] && [ -f "dist/goview/index.html" ]; then
    echo "🎉 构建验证成功！"
    
    echo ""
    echo "📁 最终目录结构:"
    ls -la dist/ | head -10
    echo ""
    echo "📁 GoView子目录:"
    ls -la dist/goview/ | head -10
    
    echo ""
    echo "📊 构建统计:"
    echo "总大小: $(du -sh dist | cut -f1)"
    echo "主应用: $(du -sh dist --exclude=dist/goview | cut -f1 || echo '计算中...')"
    echo "GoView: $(du -sh dist/goview | cut -f1 || echo '计算中...')"
    
    echo ""
    echo "🚀 构建完成！可以部署 $(pwd)/dist/ 目录"
else
    echo "❌ 构建验证失败！检查构建日志。"
    echo "主应用index.html: $(test -f dist/index.html && echo '✅' || echo '❌')"
    echo "GoView index.html: $(test -f dist/goview/index.html && echo '✅' || echo '❌')"
    exit 1
fi 