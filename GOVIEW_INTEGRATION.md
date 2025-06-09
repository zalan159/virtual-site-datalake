# GoView 集成指南

## 概述

本项目已成功集成了GoView图表编辑器功能，包括：
- 图表项目的后端数据模型和API
- React前端的图表管理页面
- 基于iframe的GoView编辑器和预览器集成
- 图表数据的保存和加载功能

## 项目结构

### 后端文件
- `app/models/chart.py` - 图表数据模型
- `app/routers/charts.py` - 图表管理API接口

### 前端文件
- `web/src/services/chartApi.ts` - 图表API服务
- `web/src/pages/Data/ChartData.tsx` - 图表管理页面
- `web/src/pages/ChartEditorStandalone.tsx` - 图表编辑器页面
- `web/src/pages/ChartPreviewStandalone.tsx` - 图表预览页面

## 部署GoView

### 1. 下载GoView项目
```bash
git clone https://github.com/dromara/go-view.git
cd go-view
```

### 2. 安装依赖
```bash
npm install
```

### 3. 修改GoView配置

需要在GoView项目中添加以下功能以支持与本系统的集成：

#### 3.1 添加消息监听器 (在GoView的main.js或app.vue中)
```javascript
// 监听来自父窗口的消息
window.addEventListener('message', (event) => {
  // 验证来源
  if (event.origin !== 'http://localhost:3000') return; // 替换为你的前端地址
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'LOAD_CHART':
      // 加载图表数据
      loadChartConfig(data);
      break;
    case 'GET_CHART_CONFIG':
      // 返回当前图表配置
      sendChartConfig(data.chartId);
      break;
    case 'GENERATE_PREVIEW':
      // 生成预览图
      generatePreview(data.chartId);
      break;
  }
});

// 发送编辑器准备就绪消息
window.parent.postMessage({
  type: 'EDITOR_READY'
}, '*');
```

#### 3.2 添加数据交互函数
```javascript
// 加载图表配置
function loadChartConfig(chartData) {
  // 将chartData.config加载到GoView编辑器中
  // 具体实现取决于GoView的API
}

// 发送图表配置
function sendChartConfig(chartId) {
  const config = getCurrentChartConfig(); // 获取当前编辑器的配置
  window.parent.postMessage({
    type: 'CHART_CONFIG_RESPONSE',
    chartId: chartId,
    data: {
      config: config,
      name: getCurrentChartName(),
      description: getCurrentChartDescription()
    }
  }, '*');
}

// 生成预览图
function generatePreview(chartId) {
  const canvas = document.querySelector('#chart-canvas'); // 根据实际情况调整选择器
  const previewImage = canvas.toDataURL('image/png');
  
  window.parent.postMessage({
    type: 'PREVIEW_GENERATED',
    chartId: chartId,
    data: {
      previewImage: previewImage
    }
  }, '*');
}
```

### 4. 启动GoView
```bash
npm run dev
```

默认情况下，GoView会在 http://localhost:3001 启动。

### 5. 配置环境变量

在本项目的 `.env` 文件中添加：
```
VITE_REACT_APP_GOVIEW_EDITOR_URL=http://localhost:3001
VITE_REACT_APP_GOVIEW_VIEWER_URL=http://localhost:3001
```

## 使用说明

### 1. 访问图表管理页面
- 登录系统后，进入"数据管理" -> "图表页管理"
- 可以创建、编辑、删除图表项目

### 2. 编辑图表
- 在图表列表中点击"编辑"按钮
- 系统会在新标签页中打开GoView编辑器
- 编辑完成后点击"保存"按钮保存到后端

### 3. 预览图表
- 在图表列表中点击"预览"按钮
- 系统会在新标签页中打开图表预览页面

## API接口
后端地址为项目根目录下.env文件中的VITE_BASE_URL变量

### GoView项目管理接口 (新)
- `GET /api/goview/project/list?token={token}` - 获取项目列表 (需要token)
- `POST /api/goview/project/create?token={token}` - 创建项目 (需要token)
- `GET /api/goview/project/getData?projectId={id}&token={token}` - 获取项目数据 (无鉴权)
- `POST /api/goview/project/save/data?token={token}` - 保存项目数据 (需要token)
- `POST /api/goview/project/edit?token={token}` - 编辑项目信息 (需要token)
- `DELETE /api/goview/project/delete?ids={id}&token={token}` - 删除项目 (需要token)
- `PUT /api/goview/project/publish?token={token}` - 发布/取消发布项目 (需要token)
- `POST /api/goview/project/upload?token={token}` - 上传文件 (需要token)

### 权限隔离说明
- 项目列表接口需要token验证，只能获取当前用户的项目
- 项目数据接口无需鉴权，支持无鉴权预览功能
- 所有修改操作都需要token验证

### 图表模板接口
- `GET /charts/templates/` - 获取模板列表
- `GET /charts/templates/{template_id}` - 获取模板详情
- `POST /charts/templates/` - 创建模板

## 数据结构

### 图表数据模型
```python
class Chart(StructuredNode):
    uid = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty()
    owner = StringProperty(required=True)
    config = JSONProperty(default=dict)  # GoView的完整配置JSON
    preview_image = StringProperty()
    width = IntegerProperty(default=1920)
    height = IntegerProperty(default=1080)
    version = StringProperty(default="1.0.0")
    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default=lambda: datetime.utcnow())
    status = StringProperty(default="draft")
    is_public = BooleanProperty(default=False)
```

## 注意事项

1. **CORS配置**: 确保GoView项目允许来自本系统的跨域请求
2. **安全性**: 在生产环境中，需要验证消息来源的安全性
3. **性能**: 对于复杂图表，考虑实现增量保存功能
4. **兼容性**: 不同版本的GoView可能需要调整集成代码

## 故障排除

### 1. iframe无法加载
- 检查GoView是否正常启动
- 检查CORS配置
- 检查网络连接

### 2. 数据无法保存
- 检查后端API是否正常
- 检查消息传递是否正确
- 查看浏览器控制台错误信息

### 3. 预览图生成失败
- 检查canvas元素是否存在
- 检查图表是否完全渲染
- 检查图片大小限制

## 扩展功能

1. **模板系统**: 可以基于现有图表创建模板
2. **权限控制**: 支持图表的公开/私有设置
3. **版本管理**: 支持图表的版本历史
4. **协作编辑**: 支持多人同时编辑图表
5. **数据源集成**: 与IoT数据源、数据库等集成