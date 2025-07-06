# 3DTiles 模型服务功能

## 功能说明

本服务提供3DTiles模型的管理功能，包括上传、查询、更新和删除操作。3DTiles是一种用于流式传输大型3D地理空间数据集的开放标准，常用于城市建模、BIM等领域。

## 主要特性

1. **3DTiles模型管理**：记录模型元数据，并提供tileset.json的URL访问
2. **ZIP/3TZ格式上传**：支持zip或3tz格式的3DTiles文件包上传
3. **自动解压与索引**：自动解压上传的压缩包并上传到MinIO存储
4. **基于MongoDB ID的文件组织**：使用MongoDB的ID作为文件夹名称，便于管理
5. **公开访问支持**：创建公开的MinIO桶，便于模型的共享访问

## API接口

### 上传模型
- **POST /api/threedtiles/**
  - 上传3DTiles模型（.zip或.3tz格式）
  - 表单参数：
    - `file`: 文件（必需）
    - `name`: 模型名称（必需）
    - `description`: 描述（可选）
    - `metadata`: 元数据JSON字符串（可选）
    - `tags`: 标签数组JSON字符串（可选）
    - `is_public`: 是否公开（默认为true）

### 查询模型
- **GET /api/threedtiles/{tile_id}**
  - 获取单个3DTiles模型信息
  - 路径参数：
    - `tile_id`: 模型ID

- **GET /api/threedtiles/**
  - 获取所有3DTiles模型列表
  - 查询参数：
    - `skip`: 跳过记录数（默认0）
    - `limit`: 返回记录数（默认100）

### 更新模型
- **PUT /api/threedtiles/{tile_id}**
  - 更新3DTiles模型信息
  - 路径参数：
    - `tile_id`: 模型ID
  - 表单参数：
    - `name`: 模型名称（可选）
    - `description`: 描述（可选）
    - `metadata`: 元数据JSON字符串（可选）
    - `tags`: 标签数组JSON字符串（可选）
    - `is_public`: 是否公开（可选）

### 删除模型
- **DELETE /api/threedtiles/{tile_id}**
  - 删除3DTiles模型
  - 路径参数：
    - `tile_id`: 模型ID

## 使用示例

### 上传3DTiles模型

```bash
curl -X POST "http://localhost:8000/api/threedtiles/" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/3dtiles.zip" \
  -F "name=城市模型" \
  -F "description=某城市的3D建筑模型" \
  -F "metadata={\"region\":\"北京\",\"year\":2023}" \
  -F "tags=[\"城市\",\"建筑\"]" \
  -F "is_public=true"
```

### 加载3DTiles模型

使用加载获取的`tileset_url`加载3DTiles模型：

```javascript
// Cesium示例
const tileset = viewer.scene.primitives.add(
  new Cesium.Cesium3DTileset({
    url: 'http://your-minio-domain:9000/threedtiles/60f0e56f2a3b1e001b8c9a7d/tileset.json'
  })
);
```

## 技术实现

1. 使用FastAPI构建REST API接口
2. MinIO作为对象存储，存储解压后的3DTiles文件
3. MongoDB存储模型元数据和关联信息
4. 自动创建索引优化查询性能

## 文件结构

- `app/models/threedtiles.py`: 3DTiles模型数据结构定义
- `app/services/threedtiles_service.py`: 3DTiles服务层实现逻辑
- `app/routers/threedtiles.py`: API路由定义
- `app/core/minio_client.py`: MinIO客户端，定义和操作存储桶 