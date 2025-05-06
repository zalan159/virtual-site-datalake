# 灵境孪生中台

“灵境孪生中台”是面向数字孪生场景的数据服务平台，致力于为数字孪生管理和应用提供统一、标准化、多源异构数据的整合与服务能力。平台支持多种工业数据类型的接入、转换、存储、管理与分发，助力数字孪生场景的快速构建与高效运维。

## 项目目标

为数字孪生场景和客户端提供统一的数据服务，整合3D模型、IoT、视频流、GIS、附件等多源异构数据，实现数据标准化、统一管理和灵活绑定，支撑数字孪生场景的构建、可视化和智能化。

## 支持的数据类型

1. **3D工业模型数据**
   - 支持多种3D工业模型格式，统一转换为GLB或FBX格式存储。
   - 元数据（如模型描述、结构、标签等）单独抽离存储于MongoDB。
   - 转换后的模型作为数字孪生场景的基础素材，可实例化为模型实例。

2. **模型实例与场景**
   - 支持对基础模型进行实例化，形成模型实例。
   - 模型实例作为数字孪生数据的载体，组成场景结构。

3. **IoT数据**
   - 支持用户自定义输入MQTT数据源，通过连接池管理。
   - 平台自动订阅、实时缓存于Redis，并持久化至MongoDB。
   - 用户可查阅历史与实时MQTT数据，并可将订阅对象绑定到模型实例。

4. **附件数据**
   - 使用MinIO进行对象存储，支持各类附件上传。
   - 可将MinIO对象链接绑定到模型实例。

5. **视频流数据**
   - 支持多种实时视频流（如HLS、RTSP、海康SDK等）。
   - 视频流信息存储于MongoDB，通过平台统一转为标准接口（可扩展）。
   - 支持流送服务（不做视频存储），可绑定到模型实例。

6. **GIS数据**
   - 支持3DTiles数据上传，并可转换为TMS、WMS、WTMS等服务。
   - GIS数据可绑定到数字孪生场景。

7. **数据可视化**
   - 集成GoView数据可视化编辑工具，支持拖拽生成可视化报表。
   - 可视化报表可绑定并叠加到场景中。

## 平台特性

- 多源异构数据标准化与统一管理
- 灵活的数据绑定与场景构建能力
- 支持多种3D模型格式自动转换与存储
- IoT数据实时采集、缓存与历史查询
- 附件、视频流、GIS等多类型数据统一接入
- 可视化报表编辑与场景叠加
- Web端管理页面与API服务
- Docker化部署，支持多种数据库组合
- 默认数据环境：MongoDB、Redis、MinIO

## 系统架构

平台采用微服务与容器化架构，核心服务包括：
- 数据接入与转换服务
- 统一数据存储与管理服务
- 实时数据流与缓存服务
- Web管理与API服务
- 可视化编辑与展示服务

## 环境配置

### 开发环境

开发环境只启动MongoDB、Redis和MinIO服务，方便本地开发和调试：

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

- Web管理端: http://localhost:8000
- MinIO控制台: http://localhost:9001
- MongoDB: localhost:27017
- Redis: localhost:6379

## 配置文件

系统使用YAML格式的配置文件（config.yaml）来管理所有配置项，包括：

- MongoDB配置
- Redis配置
- MinIO配置
- JWT配置
- 支持的数据类型与格式配置

## 环境变量

- MONGO_URL: MongoDB连接URL
- REDIS_URL: Redis连接URL
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