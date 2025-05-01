# 3D模型文件存储系统

这是一个使用FastAPI、MinIO和MongoDB构建的3D模型文件存储系统。系统支持上传、存储和检索各种3D模型文件及其元数据，并包含完整的用户认证系统。

## 功能特点

- 使用MinIO存储3D模型文件
- 使用MongoDB存储文件元数据
- 支持多种3D文件格式的上传和下载
- 支持元数据查询
- 使用Docker容器化部署
- 完整的用户认证系统
  - 用户注册和登录
  - JWT token认证
  - 基于OAuth2的密码模式
  - 用户权限控制
- 文件管理功能
  - 文件上传和下载
  - 文件元数据管理
  - 文件分享
  - 文件权限控制

## 系统要求

- Docker
- Docker Compose

## 环境配置

### 开发环境

开发环境只启动MongoDB和MinIO服务，方便本地开发和调试：

1. 启动开发环境服务：
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. 运行本地开发服务器：
```bash
uvicorn app.main:app --reload
```

### 生产环境

生产环境使用完整的Docker配置，包含所有服务：

1. 启动所有服务：
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 服务访问

- FastAPI应用: http://localhost:8000
- MinIO控制台: http://localhost:9001
- MongoDB: localhost:27017

## API端点

### 认证相关
- POST /auth/register - 用户注册
- POST /auth/token - 用户登录获取token
- GET /auth/users/me - 获取当前用户信息

### 文件操作
- POST /files/upload - 上传3D模型文件和元数据（需要认证）
- GET /files/list - 获取当前用户的所有文件列表（需要认证）
- GET /files/{file_path} - 获取特定文件的详情和下载链接（需要认证）
- DELETE /files/{file_id} - 删除文件（需要认证）
- PUT /files/{file_id} - 更新文件信息（需要认证）
- POST /files/{file_id}/share - 分享文件（需要认证）
- GET /files/shared/list - 获取分享给当前用户的文件列表（需要认证）

## 配置文件

系统使用YAML格式的配置文件（config.yaml）来管理所有配置项，包括：

- MongoDB配置
- MinIO配置
- 阿里云短信配置
- JWT配置
- 支持的文件格式配置

### 支持的文件格式

系统支持多种3D模型文件格式，包括但不限于：

- 3MF (3D Manufacturing Format)
- ACIS (SAT, SAB)
- AutoCAD (DWG, DXF)
- Autodesk 3DS
- CATIA (V4, V5, V6)
- COLLADA (DAE)
- FBX
- GLTF/GLB
- IFC
- IGES
- JT
- NX
- Parasolid
- PDF
- PRC
- Revit
- Rhino3D
- Solid Edge
- SolidWorks
- STEP
- STL
- VRML
- OBJ

每种格式都有详细的版本、扩展名和支持平台信息。

## 环境变量

- MONGO_URL: MongoDB连接URL
- MINIO_ENDPOINT: MinIO服务端点
- MINIO_ACCESS_KEY: MinIO访问密钥
- MINIO_SECRET_KEY: MinIO密钥
- SECRET_KEY: JWT密钥（用于token生成）

## 开发

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 确保开发环境服务已启动：
```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. 运行开发服务器：
```bash
uvicorn app.main:app --reload
```

## API使用示例

### 1. 用户注册
```bash
curl -X POST "http://localhost:8000/auth/register" \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","username":"testuser","password":"password123"}'
```

### 2. 用户登录
```bash
curl -X POST "http://localhost:8000/auth/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=testuser&password=password123"
```

### 3. 上传文件（需要认证）
```bash
curl -X POST "http://localhost:8000/files/upload" \
     -H "Authorization: Bearer {your_token}" \
     -F "file=@model.gltf" \
     -F "metadata={\"description\":\"测试模型\"}"
```

### 4. 获取文件列表（需要认证）
```bash
curl -X GET "http://localhost:8000/files/list" \
     -H "Authorization: Bearer {your_token}"
```

### 5. 更新文件信息（需要认证）
```bash
curl -X PUT "http://localhost:8000/files/{file_id}" \
     -H "Authorization: Bearer {your_token}" \
     -H "Content-Type: application/json" \
     -d '{"description":"新描述","tags":["tag1","tag2"],"is_public":true}'
```

### 6. 分享文件（需要认证）
```bash
curl -X POST "http://localhost:8000/files/{file_id}/share" \
     -H "Authorization: Bearer {your_token}" \
     -H "Content-Type: application/json" \
     -d '{"shared_with":["user_id1","user_id2"],"permissions":["read"]}'
```

### 7. 查看分享的文件（需要认证）
```bash
curl -X GET "http://localhost:8000/files/shared/list" \
     -H "Authorization: Bearer {your_token}"
``` 