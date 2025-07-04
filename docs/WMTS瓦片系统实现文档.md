# WMTS瓦片系统实现文档

## 概述

本文档详细记录了在灵境孪生中台（VirtualSite）中实现WMTS瓦片系统的所有修改。该系统解决了Cesium Viewer默认加载Ion Bing Map在某些地区无法访问的问题，实现了基于WMTS标准的瓦片地图服务系统。

## 系统架构

### 总体设计
- **后端**: 提供WMTS数据管理、文件处理、API接口
- **前端**: 瓦片数据管理界面、场景绑定、Cesium集成
- **存储**: MinIO分布式文件存储、MongoDB数据存储

### 数据类型支持
1. **文件类型**: 支持上传tpkx格式瓦片包文件
2. **URL类型**: 支持外部WMTS服务URL

## 后端实现

### 1. 数据模型 (`app/models/wmts.py`)

**新增文件**: 完整的WMTS数据模型定义

```python
# 主要数据结构
class WMTSBase(BaseModel):
    name: str                      # 瓦片图层名称
    description: Optional[str]     # 描述信息
    metadata: Optional[dict]       # 元数据
    tags: List[str]               # 标签
    is_public: bool               # 是否公开
    source_type: str              # 数据源类型: "file" 或 "url"

class WMTSInDB(WMTSBase):
    # 文件类型相关字段
    minio_path: Optional[str]           # MinIO存储路径
    tile_url_template: Optional[str]    # 瓦片URL模板
    
    # URL类型相关字段
    service_url: Optional[str]          # WMTS服务URL
    layer_name: Optional[str]           # 图层标识
    format: Optional[str]               # 瓦片格式
    tile_matrix_set: Optional[str]      # 瓦片矩阵集
    
    # 边界和缩放级别
    min_zoom: Optional[int]             # 最小缩放级别
    max_zoom: Optional[int]             # 最大缩放级别
    bounds: Optional[dict]              # 地理边界
```

**主要特性**:
- 支持文件和URL两种数据源类型
- 完整的瓦片服务元数据
- 地理边界和缩放级别配置
- 标签和权限管理

### 2. 文件处理任务 (`app/tasks/wmts_processor.py`)

**新增文件**: tpkx文件处理器

```python
class WMTSProcessor:
    @staticmethod
    async def process_wmts(task: Task, db) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]
```

**处理流程**:
1. 从MinIO下载tpkx文件
2. 解压tpkx文件（实际为ZIP格式）
3. 解析配置文件（conf.xml）提取元数据
4. 提取瓦片边界、缩放级别等信息
5. 上传解压后的瓦片文件到MinIO
6. 生成瓦片访问URL模板
7. 更新数据库记录

**技术要点**:
- 异步处理避免阻塞API响应
- 线程池执行CPU密集型操作
- 完整的错误处理和状态跟踪
- MinIO分布式文件存储

### 3. 服务层 (`app/services/wmts_service.py`)

**新增文件**: WMTS服务业务逻辑

**主要功能**:
- **CRUD操作**: 创建、读取、更新、删除WMTS图层
- **文件处理**: tpkx文件异步处理
- **状态管理**: 处理进度状态跟踪
- **MinIO集成**: 文件上传下载管理

```python
class WMTSService:
    async def create_wmts(self, wmts_data: WMTSCreate) -> WMTSInDB
    async def get_wmts_list(self, skip: int = 0, limit: int = 20) -> List[WMTSInDB]
    async def process_tpkx_file_async(self, object_id: str, filename: str, wmts_data: WMTSCreate, process_id: str) -> dict
```

### 4. API路由 (`app/routers/wmts.py`)

**新增文件**: WMTS REST API端点

**主要端点**:
- `POST /wmts/upload-url`: 获取文件上传预签名URL
- `POST /wmts/process`: 处理已上传的tpkx文件
- `POST /wmts/create-url`: 创建URL类型的WMTS服务
- `GET /wmts/`: 获取WMTS图层列表
- `GET /wmts/{wmts_id}`: 获取特定WMTS图层详情
- `PUT /wmts/{wmts_id}`: 更新WMTS图层
- `DELETE /wmts/{wmts_id}`: 删除WMTS图层
- `GET /wmts/process-status/{process_id}`: 获取处理状态

### 5. 场景模型更新 (`app/models/scene.py`)

**修改内容**:
```python
# 在Scene类中新增字段
tiles_binding = JSONProperty(default=dict)  # 绑定的WMTS瓦片服务

# 在SceneCreate和SceneUpdate中添加字段
tiles_binding: Optional[dict] = None
```

**数据结构**:
```json
{
  "wmts_id": "瓦片服务ID",
  "enabled": true
}
```

### 6. 任务管理器集成 (`app/tasks/task_manager.py`)

**修改内容**:
1. **新增任务类型**:
```python
class TaskType(str, Enum):
    WMTS_PROCESSING = "wmts_processing"  # 新增
```

2. **任务处理逻辑**:
```python
elif task.task_type == TaskType.WMTS_PROCESSING:
    asyncio.create_task(self._process_wmts_task(task))
```

3. **WMTS任务处理方法**: 完整的异步任务处理流程

### 7. 主应用集成 (`app/main.py`)

**修改内容**:
```python
from app.routers import wmts  # 新增导入
app.include_router(wmts.router, prefix="/wmts", tags=["WMTS瓦片服务"])  # 注册路由
```

## 前端实现

### 1. WMTS API服务 (`web/src/services/wmtsApi.ts`)

**新增文件**: TypeScript API客户端

**主要接口**:
```typescript
export interface WMTSLayer {
  id: string;
  name: string;
  source_type: 'file' | 'url';
  service_url?: string;
  tile_url_template?: string;
  min_zoom?: number;
  max_zoom?: number;
  bounds?: { west: number; south: number; east: number; north: number; };
}

export const wmtsAPI = {
  getWMTSList,
  getWMTSById,
  createWMTSFromUrl,
  uploadAndProcessTpkx,
  pollProcessStatus,
  updateWMTS,
  deleteWMTS
}
```

**特殊功能**:
- `uploadAndProcessTpkx`: 一键上传和处理tpkx文件
- `pollProcessStatus`: 轮询处理状态直到完成

### 2. 瓦片数据管理页面 (`web/src/pages/Data/TileData.tsx`)

**新增文件**: 完整的瓦片数据管理界面

**主要组件**:

#### WMTSDetailModal - 详情查看组件
- 显示WMTS图层完整信息
- 支持边界、缩放级别、格式等详细信息

#### WMTSFormModal - 创建/编辑组件
- 支持URL类型WMTS服务创建
- 动态表单字段根据数据源类型调整

#### TpkxUploadModal - 文件上传组件
- tpkx文件选择和上传
- 实时处理进度显示
- 错误处理和用户反馈

#### 主表格功能
- 分页列表显示
- 状态标签（公开/私有、文件/URL）
- 操作按钮（详情、预览、编辑、删除）

**新增功能 - 瓦片预览**:
- 预览按钮使用`PlayCircleOutlined`图标
- 新页签打开独立的瓦片预览页面
- 传递`wmtsId`参数进行预览

### 3. 瓦片预览页面 (`web/src/pages/TilePreview.tsx`)

**新增文件**: 独立的瓦片预览页面

**功能特性**:
- 独立的Cesium视图器
- 禁用默认底图，专门用于瓦片预览
- 自动加载指定的WMTS图层
- 智能视角定位（基于边界信息）
- 加载状态和错误处理
- 瓦片信息展示栏

**技术实现**:
```typescript
// Cesium配置 - 禁用所有默认UI和底图
const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
  imageryProvider: false,  // 关键：禁用默认影像
  timeline: false,
  animation: false,
  // ... 其他UI控件禁用
});

// 支持两种WMTS类型
if (wmtsLayer.source_type === 'file') {
  // 文件类型使用UrlTemplateImageryProvider
  imageryProvider = new Cesium.UrlTemplateImageryProvider({
    url: tileUrl,
    minimumLevel: wmtsLayer.min_zoom || 0,
    maximumLevel: wmtsLayer.max_zoom || 18,
  });
} else if (wmtsLayer.source_type === 'url') {
  // URL类型使用WebMapTileServiceImageryProvider
  imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
    url: wmtsLayer.service_url,
    layer: wmtsLayer.layer_name || '',
    style: 'default',
    format: wmtsLayer.format || 'image/png',
  });
}
```

### 4. 路由配置更新 (`web/src/router/routeConfig.tsx`)

**修改内容**:
1. **导入新组件**:
```typescript
import TileData from '../pages/Data/TileData';
import TilePreview from '../pages/TilePreview';
```

2. **数据管理菜单新增**:
```typescript
{
  path: '/data/tiles',
  name: '瓦片数据',
  icon: <AppstoreOutlined />,
  component: TileData,
}
```

3. **特殊路由新增**:
```typescript
{
  path: '/tile-preview',
  component: TilePreview,
}
```

### 5. 场景属性面板集成 (`web/src/components/DynamicPropertyForm.tsx`)

**修改内容**:

1. **类型扩展**:
```typescript
const [bindModalType, setBindModalType] = useState<'iot' | 'video' | 'file' | 'chart' | 'tiles' | null>(null);
const openBindModal = async (type: 'iot' | 'video' | 'file' | 'chart' | 'tiles') => {
```

2. **WMTS API集成**:
```typescript
import { wmtsAPI, WMTSLayer } from '../services/wmtsApi';

// 在openBindModal中添加tiles处理
} else if (type === 'tiles') {
  const res = await wmtsAPI.getWMTSList();
  list = res.data || [];
  setBindSelectedKeys(formValues.tiles_binding?.wmts_id ? [formValues.tiles_binding.wmts_id] : []);
}
```

3. **绑定处理逻辑**:
```typescript
// tiles_binding字段特殊处理（对象类型）
if (fieldName === 'tiles_binding') {
  return <BindingField fieldName={fieldName} value={value} meta={meta} onOpen={() => openBindModal('tiles')} />;
}

// 绑定保存逻辑
} else if (bindModalType === 'tiles') {
  const tilesBinding = bindSelectedKeys.length > 0 ? {
    wmts_id: bindSelectedKeys[0], // 只选择一个瓦片图层
    enabled: true
  } : {};
  handleFieldChange(field, tilesBinding);
}
```

4. **表格列配置**:
```typescript
if (bindModalType === 'tiles') {
  return [
    { title: '瓦片名称', dataIndex: 'name' },
    { title: 'ID', dataIndex: 'id' },
    { title: '数据源类型', dataIndex: 'source_type' },
    { title: '瓦片格式', dataIndex: 'format' },
  ];
}
```

### 6. Cesium Viewer更新 (`web/src/hooks/useCesiumViewer.ts`)

**修改内容**:
```typescript
viewer = new Viewer(cesiumContainerRef.current, {
  imageryProvider: false,  // 关键修改：禁用默认的影像提供者
  // ... 其他配置保持不变
});
```

**影响**: 所有使用该Hook的Cesium视图器都不再加载默认的Ion Bing Maps

### 7. 场景编辑器集成 (`web/src/pages/Scenes/SceneEditorStandalone.tsx`)

**修改内容**:

1. **API导入**:
```typescript
import { wmtsAPI } from '../../services/wmtsApi';
```

2. **WMTS加载函数**:
```typescript
const loadWMTSLayer = useCallback(async (wmtsId: string) => {
  // 获取WMTS图层详情
  const wmtsResponse = await wmtsAPI.getWMTSById(wmtsId);
  const wmtsData = wmtsResponse.data;
  
  // 根据类型创建不同的ImageryProvider
  if (wmtsData.source_type === 'file') {
    imageryProvider = new Cesium.UrlTemplateImageryProvider({ /* 文件类型配置 */ });
  } else if (wmtsData.source_type === 'url') {
    imageryProvider = new Cesium.WebMapTileServiceImageryProvider({ /* URL类型配置 */ });
  }
  
  // 清除现有WMTS图层并添加新图层
  const imageryLayer = viewerRef.current.imageryLayers.addImageryProvider(imageryProvider);
}, []);
```

3. **场景加载监听**:
```typescript
useEffect(() => {
  if (sceneInfo?.data?.tiles_binding && viewerRef.current && !loadingInstances) {
    const { wmts_id, enabled } = sceneInfo.data.tiles_binding;
    
    if (enabled && wmts_id) {
      loadWMTSLayer(wmts_id);
    }
  }
}, [sceneInfo, viewerRef, loadingInstances, loadWMTSLayer]);
```

## 技术亮点

### 1. 架构设计
- **分层架构**: 数据层、服务层、API层、展示层清晰分离
- **异步处理**: 文件处理使用任务队列，避免阻塞用户界面
- **类型安全**: 前后端完整的TypeScript类型定义

### 2. 用户体验
- **实时反馈**: 文件处理进度实时显示
- **错误处理**: 完善的错误处理和用户提示
- **预览功能**: 独立页面预览瓦片效果
- **灵活配置**: 支持多种瓦片服务类型

### 3. 性能优化
- **MinIO存储**: 分布式对象存储，支持高并发访问
- **缓存机制**: 合理的缓存策略减少重复请求
- **按需加载**: 只有绑定的场景才加载瓦片图层

### 4. 扩展性
- **插件化设计**: 易于添加新的瓦片服务类型
- **标准化接口**: 遵循WMTS标准，兼容性好
- **模块化组件**: 前端组件可复用

## 使用流程

### 1. 管理瓦片数据
1. 进入"数据管理" → "瓦片数据"
2. 选择添加方式：
   - **上传tpkx文件**: 点击"上传tpkx文件"按钮
   - **添加WMTS服务**: 点击"添加WMTS服务"按钮
3. 填写相关信息并提交
4. 等待处理完成（文件类型需要处理时间）

### 2. 预览瓦片
1. 在瓦片数据列表中点击"预览"按钮
2. 新页签自动打开瓦片预览页面
3. 查看瓦片加载效果和覆盖范围

### 3. 绑定到场景
1. 进入场景编辑器
2. 在右侧"场景设置"面板中找到"瓦片绑定"字段
3. 点击绑定按钮，选择要绑定的瓦片图层
4. 保存场景设置
5. 瓦片图层自动加载到场景中

### 4. 查看效果
- 场景默认不加载任何底图
- 只有绑定并启用的瓦片图层才会显示
- 支持同时查看3D模型和瓦片底图

## 部署说明

### 环境变量
确保以下环境变量正确配置：
```bash
VITE_MINIO_URL=http://your-minio-server  # MinIO服务地址
```

### MinIO配置
系统会自动创建`wmts`存储桶，确保MinIO服务正常运行并具有适当的访问权限。

### 数据库
MongoDB会自动创建相关集合：
- `wmts_layers`: WMTS图层数据
- `wmts_process_status`: 处理状态记录

## 注意事项

1. **文件格式**: 目前只支持tpkx格式的瓦片包文件
2. **处理时间**: tpkx文件处理可能需要较长时间，请耐心等待
3. **存储空间**: 瓦片文件解压后会占用较多存储空间
4. **网络要求**: URL类型的WMTS服务需要确保网络可达性
5. **兼容性**: 建议使用现代浏览器以获得最佳体验

## 故障排除

### 常见问题

1. **瓦片加载失败**
   - 检查MinIO服务是否正常
   - 验证瓦片URL是否可访问
   - 查看浏览器控制台错误信息

2. **文件上传失败**
   - 确认文件格式为tpkx
   - 检查文件大小是否超出限制
   - 验证MinIO连接配置

3. **场景绑定不生效**
   - 确认瓦片绑定配置正确
   - 检查瓦片服务状态是否启用
   - 验证场景保存是否成功

### 日志查看
- 后端日志: 查看FastAPI应用日志
- 前端日志: 打开浏览器开发者工具Console面板
- MinIO日志: 查看MinIO服务器日志

## 总结

本次实现完成了一个功能完整的WMTS瓦片系统，从根本上解决了Cesium Viewer默认底图访问问题。系统具有以下特点：

- **功能完整**: 支持瓦片数据管理、场景绑定、预览等完整功能
- **技术先进**: 采用现代化的技术栈和架构设计
- **用户友好**: 提供直观的用户界面和良好的用户体验
- **扩展性强**: 易于扩展支持更多瓦片服务类型
- **稳定可靠**: 完善的错误处理和状态管理机制

该系统已经可以投入生产使用，并为后续的地图服务功能扩展奠定了坚实的基础。