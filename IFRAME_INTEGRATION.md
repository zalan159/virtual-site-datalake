# iframe子应用集成配置指南

## 配置概述

现在您的项目已经成功配置为将GoView作为子应用集成。以下是具体的配置方案：

## 架构说明

### 开发环境
- **React主应用**: http://localhost:3000
- **GoView子应用**: http://localhost:3001  
- **通信方式**: 跨域iframe + postMessage

### 生产环境  
- **React主应用**: http://your-domain.com/
- **GoView子应用**: http://your-domain.com/goview/
- **通信方式**: 同源iframe + postMessage

## 核心配置文件

### 1. iframe配置 (`web/src/config/iframe.ts`)
统一管理所有iframe相关配置：

```typescript
// 自动根据环境选择正确的URL
const config = getGoViewIframeConfig();

// 验证消息来源
isValidMessageSource(event, iframeRef);

// 发送消息到GoView
postMessageToGoView(iframeRef, message);

// 构建GoView URL
buildGoViewEditorUrl(chartId, token);
buildGoViewViewerUrl(projectId, token);
```

### 2. GoView构建配置 (`web/go-view/vite.config.ts`)
- **base路径**: 生产环境设为 `/goview/`
- **输出目录**: `../dist/goview` (输出到主项目的dist子目录)

### 3. React主项目配置 (`web/vite.config.ts`)
- **emptyOutDir**: `false` (不清空输出目录，保留goview子目录)
- **代理配置**: 开发时将 `/goview` 代理到 `http://localhost:3001`

## 构建和部署

### 开发环境启动

1. **同时启动两个服务**:
```bash
cd web
npm run dev:all
```

2. **分别启动**:
```bash
# 终端1 - React主应用
cd web && npm run dev

# 终端2 - GoView子应用  
cd web/go-view && npm run dev
```

### 生产环境构建

1. **一键构建**:
```bash
./build.sh
```

2. **或手动构建**:
```bash
cd web
npm run build:all
```

### 最终目录结构
```
web/dist/
├── index.html                 # React主应用
├── assets/                    # React资源
│   ├── index-[hash].js
│   └── index-[hash].css
├── goview/                    # GoView子应用
│   ├── index.html             # GoView入口
│   ├── static/                # GoView资源  
│   │   ├── js/
│   │   └── css/
│   └── favicon.ico
└── ... (其他文件)
```

## iframe通信协议

### 消息类型

#### 从React发送到GoView:
- `LOAD_CHART`: 加载图表数据
- `GET_CHART_CONFIG`: 请求当前图表配置
- `GENERATE_PREVIEW`: 生成预览图

#### 从GoView发送到React:  
- `EDITOR_READY`: 编辑器准备就绪
- `VIEWER_READY`: 预览器准备就绪
- `CHART_CONFIG_RESPONSE`: 返回图表配置
- `PREVIEW_GENERATED`: 预览图已生成
- `CHART_LOADED`: 图表加载完成
- `CHART_CHANGED`: 图表内容变更

### 消息格式
```typescript
interface Message {
  type: string;
  chartId?: string;
  data?: any;
}
```

## Nginx部署配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/web/dist;
    index index.html;

    # GoView子应用
    location /goview/ {
        alias /path/to/web/dist/goview/;
        try_files $uri $uri/ /goview/index.html;
    }

    # React主应用
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:8000;
        # ... 其他代理配置
    }
}
```

## 环境变量配置

### 开发环境 (.env.development)
```bash
VITE_BASE_URL=http://localhost:8000
VITE_REACT_APP_GOVIEW_EDITOR_URL=http://localhost:3001
VITE_REACT_APP_GOVIEW_VIEWER_URL=http://localhost:3001
```

### 生产环境
无需配置GoView URL，会自动使用 `/goview/` 子路径。

## 安全考虑

1. **消息来源验证**: 
   - 开发环境：验证origin
   - 生产环境：验证iframe的contentWindow

2. **token传递**: 通过URL参数安全传递用户认证信息

3. **同源策略**: 生产环境下iframe和主应用同源，增强安全性

## 故障排除

### 1. iframe无法加载
- 检查构建输出是否正确
- 验证nginx配置
- 查看浏览器控制台错误

### 2. 消息通信失败  
- 检查消息来源验证逻辑
- 确认iframe已完全加载
- 验证消息格式是否正确

### 3. 路径问题
- 确认GoView的base路径设置正确
- 检查静态资源路径是否正确
- 验证hash路由配置

## 测试检查点

部署后请验证以下功能：

1. ✅ React主应用正常访问
2. ✅ GoView子应用可以独立访问 (`/goview/`)
3. ✅ 图表编辑页面iframe正常加载
4. ✅ 图表预览页面iframe正常加载  
5. ✅ iframe和主应用消息通信正常
6. ✅ 图表数据保存和加载功能正常
7. ✅ 静态资源（CSS、JS、图片）加载正常

通过这个配置，您的React主应用和GoView Vue子应用将完美整合在同一个dist目录中，实现统一部署和管理。 